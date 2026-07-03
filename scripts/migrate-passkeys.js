const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
const Order = require('../src/models/Order');

// Helper: compress P-256 point (x,y) to 33-byte compressed key, return base64 string
function compressP256ToBase64(xBn, yBn) {
  if (!xBn || !yBn) return null;
  try {
    const xBuf = Buffer.isBuffer(xBn) ? xBn : Buffer.from(xBn);
    const yBuf = Buffer.isBuffer(yBn) ? yBn : Buffer.from(yBn);
    const yIsEven = (yBuf[yBuf.length - 1] % 2) === 0;
    const prefix = Buffer.from([yIsEven ? 0x02 : 0x03]);
    const comp = Buffer.concat([prefix, xBuf]);
    return comp.toString('base64');
  } catch (e) {
    console.error('Failed to compress P-256 pubkey:', e);
    return null;
  }
}

function normalizePublicKey(key) {
  if (!key) return key;
  let buf;
  if (typeof key === 'string') {
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(key)) {
      buf = Buffer.from(key, 'base64');
    } else {
      buf = Buffer.from(key, 'hex');
    }
  } else if (Array.isArray(key) || key instanceof Uint8Array) {
    buf = Buffer.from(key);
  } else {
    return key;
  }

  if (buf.length === 33 && (buf[0] === 2 || buf[0] === 3)) {
    return buf;
  }

  if (buf.length === 33) {
    const x = buf.subarray(0, 32);
    const y0 = buf[32];
    const prefix = (y0 % 2 === 0) ? 2 : 3;
    return Buffer.concat([Buffer.from([prefix]), x]);
  }

  if (buf.length === 64) {
    const x = buf.subarray(0, 32);
    const y = buf.subarray(32, 64);
    const yIsEven = (y[31] % 2 === 0);
    const prefix = yIsEven ? 2 : 3;
    return Buffer.concat([Buffer.from([prefix]), x]);
  }

  if (buf.length === 65 && buf[0] === 4) {
    const x = buf.subarray(1, 33);
    const y = buf.subarray(33, 65);
    const yIsEven = (y[31] % 2 === 0);
    const prefix = yIsEven ? 2 : 3;
    return Buffer.concat([Buffer.from([prefix]), x]);
  }

  return buf;
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not set in .env.local');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  const orders = await Order.find({ passkeyData: { $exists: true } });
  console.log(`Found ${orders.length} orders to inspect.`);

  let updatedCount = 0;
  for (const order of orders) {
    let changed = false;
    const pd = order.passkeyData;
    if (!pd) continue;

    // Check passkeyPubkey, passkeyPublicKey, publicKeyBase64
    const keysToCheck = ['passkeyPubkey', 'passkeyPublicKey', 'publicKeyBase64'];
    for (const keyName of keysToCheck) {
      if (pd[keyName]) {
        const original = pd[keyName];
        const normalized = normalizePublicKey(original).toString('base64');
        if (original !== normalized) {
          console.log(`Order ${order.reference}: Updating pd.${keyName} from ${original} to ${normalized}`);
          pd[keyName] = normalized;
          changed = true;
        }
      }
    }

    // Check x and y coordinate compression if present
    if (pd.publicKey && pd.publicKey.x && pd.publicKey.y) {
      try {
        let xBytes, yBytes;
        const toBytes = (val) => {
          if (!val) return null;
          if (Buffer.isBuffer(val)) return val;
          if (val.data) return Buffer.from(val.data);
          if (Array.isArray(val)) return Buffer.from(val);
          if (val instanceof Uint8Array) return Buffer.from(val);
          if (typeof val === 'string') {
            if (/^[A-Za-z0-9+/]*={0,2}$/.test(val)) return Buffer.from(val, 'base64');
            return Buffer.from(val, 'hex');
          }
          return null;
        };
        xBytes = toBytes(pd.publicKey.x);
        yBytes = toBytes(pd.publicKey.y);
        if (xBytes && yBytes) {
          const comp = compressP256ToBase64(xBytes, yBytes);
          if (comp && pd.passkeyPublicKey !== comp) {
            console.log(`Order ${order.reference}: Updating pd.passkeyPublicKey from ${pd.passkeyPublicKey} to compressed x/y ${comp}`);
            pd.passkeyPublicKey = comp;
            changed = true;
          }
        }
      } catch (err) {
        console.error(`Failed to handle coordinates for order ${order.reference}:`, err);
      }
    }

    if (changed) {
      order.markModified('passkeyData');
      await order.save();
      updatedCount++;
    }
  }

  console.log(`Migration finished. Updated ${updatedCount} orders.`);
  await mongoose.disconnect();
}

run().catch(console.error);
