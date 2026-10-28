import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// Mongoose schema shared with backend
const DeviceShareSchema = new mongoose.Schema({
  shareId: { type: String, required: true, unique: true },
  pairingCode: { type: String, required: false, index: true },
  mode: {
    type: String,
    enum: ['sync_from_owner', 'request_from_new_device'],
    default: 'request_from_new_device',
  },
  autoApprove: { type: Boolean, default: false },
  walletAddress: { type: String, required: false },
  walletName: { type: String, required: false },
  ownerDeviceId: { type: String, required: false },
  newDeviceData: {
    passkeyData: { type: mongoose.Schema.Types.Mixed },
    publicKey: { type: String },
    deviceId: { type: String },
    userAgent: { type: String },
    platform: { type: String },
    browser: { type: String },
    os: { type: String },
    screen: { type: mongoose.Schema.Types.Mixed },
    language: { type: String },
    ip: { type: String },
    location: { type: mongoose.Schema.Types.Mixed },
  },
  status: {
    type: String,
    enum: ['pending', 'awaiting_approval', 'approved', 'rejected', 'expired'],
    default: 'pending',
  },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const DeviceShare =
  mongoose.models.DeviceShare || mongoose.model('DeviceShare', DeviceShareSchema);

// Global in-memory store across hot reloads in Next.js dev mode
const globalForShares = globalThis as unknown as {
  __rampfiDeviceShares?: Map<string, any>;
  __rampfiMongoConnecting?: Promise<any> | null;
};

if (!globalForShares.__rampfiDeviceShares) {
  globalForShares.__rampfiDeviceShares = new Map<string, any>();
}
const memoryShares = globalForShares.__rampfiDeviceShares;

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return true;
  const uri = process.env.MONGO_URI;
  if (!uri) return false;
  try {
    if (!globalForShares.__rampfiMongoConnecting) {
      globalForShares.__rampfiMongoConnecting = mongoose
        .connect(uri, { serverSelectionTimeoutMS: 2500 })
        .catch(() => null)
        .finally(() => {
          globalForShares.__rampfiMongoConnecting = null;
        });
    }
    await globalForShares.__rampfiMongoConnecting;
    return Number(mongoose.connection.readyState) === 1;
  } catch {
    return false;
  }
}

async function saveShareRecord(record: any) {
  memoryShares.set(record.shareId, { ...record });
  if (await ensureDbConnected()) {
    try {
      await DeviceShare.findOneAndUpdate(
        { shareId: record.shareId },
        { $set: record },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.warn('[next-device-import] MongoDB save fallback to memory:', (e as Error).message);
    }
  }
  return record;
}

async function findShareByIdentifier(identifier: string) {
  if (!identifier) return null;
  const clean = String(identifier).trim();
  const digitsOnly = clean.replace(/[\s-]/g, '');

  for (const item of memoryShares.values()) {
    if (item.shareId === clean || (item.pairingCode && item.pairingCode === digitsOnly)) {
      return item;
    }
  }

  if (await ensureDbConnected()) {
    try {
      const doc = await DeviceShare.findOne({
        $or: [{ shareId: clean }, { pairingCode: digitsOnly }],
      }).lean();
      if (doc) {
        memoryShares.set((doc as any).shareId, doc);
        return doc as any;
      }
    } catch (e) {
      console.warn('[next-device-import] MongoDB find fallback:', (e as Error).message);
    }
  }
  return null;
}

async function findSharesByWallet(walletAddress: string, statuses: string[]) {
  const resultsMap = new Map<string, any>();

  for (const item of memoryShares.values()) {
    if (item.walletAddress === walletAddress && statuses.includes(item.status)) {
      resultsMap.set(item.shareId, item);
    }
  }

  if (await ensureDbConnected()) {
    try {
      const docs = await DeviceShare.find({
        walletAddress,
        status: { $in: statuses },
      })
        .sort({ createdAt: -1 })
        .lean();
      for (const d of docs as any[]) {
        resultsMap.set(d.shareId, d);
      }
    } catch (e) {
      console.warn('[next-device-import] MongoDB query fallback:', (e as Error).message);
    }
  }

  return Array.from(resultsMap.values()).sort(
    (a, b) =>
      new Date(b.approvedAt || b.createdAt).getTime() -
      new Date(a.approvedAt || a.createdAt).getTime()
  );
}

async function deleteShareRecord(shareId: string) {
  const existedInMem = memoryShares.delete(shareId);
  let deletedInDb = false;
  if (await ensureDbConnected()) {
    try {
      const res = await DeviceShare.deleteOne({ shareId });
      deletedInDb = res.deletedCount > 0;
    } catch (e) {
      console.warn('[next-device-import] MongoDB delete fallback:', (e as Error).message);
    }
  }
  return existedInMem || deletedInDb;
}

function parseDeviceInfo(deviceMetadata: any = {}, req: NextRequest) {
  const ua = String(deviceMetadata.userAgent || req.headers.get('user-agent') || '');

  let os = deviceMetadata.os || '';
  if (!os) {
    if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else os = 'OS';
  }

  let browser = deviceMetadata.browser || '';
  if (!browser) {
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'Chrome';
    else if (/Firefox\/|FxiOS\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua)) browser = 'Safari';
    else browser = 'Browser';
  }

  let platform = deviceMetadata.platformLabel || '';
  if (!platform) {
    if (/iPad|Tablet/i.test(ua)) platform = 'Tablet';
    else if (/Mobile|iPhone|iPod|Android/i.test(ua)) platform = 'Mobile Phone';
    else platform = `Desktop (${os})`;
  }

  const rawScreen = deviceMetadata.screen || {};
  const screen = {
    w: rawScreen.w || rawScreen.width || 1920,
    h: rawScreen.h || rawScreen.height || 1080,
  };

  return {
    deviceId: deviceMetadata.deviceId || `dev_${Date.now()}`,
    userAgent: ua,
    platform,
    browser,
    os,
    screen,
    language: deviceMetadata.language || 'en-US',
    ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
    location: deviceMetadata.location || null,
  };
}

function extractIdentifierFromQrPayload(qrData: string): { id: string | null; walletFromUrl?: string; nameFromUrl?: string } {
  if (!qrData) return { id: null };
  const raw = String(qrData).trim();

  if (/^https?:\/\//i.test(raw) || raw.includes('/pair?')) {
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://localhost${raw}`);
      const sid = url.searchParams.get('shareId');
      const code = url.searchParams.get('code');
      const w = url.searchParams.get('w') || undefined;
      const n = url.searchParams.get('n') || undefined;
      return { id: sid || code || null, walletFromUrl: w, nameFromUrl: n };
    } catch {
      const match = raw.match(/[?&](?:shareId|code)=([^&#]+)/);
      if (match) return { id: decodeURIComponent(match[1]) };
    }
  }

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return { id: parsed.shareId || parsed.code || parsed.pairingCode || null };
    } catch {
      // fall through
    }
  }

  const cleaned = raw.replace(/[\s-]/g, '');
  return { id: cleaned };
}

const generateShareId = () => 'share_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
const generatePairingCode = () => String(Math.floor(100000 + Math.random() * 900000));

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params;
    const [action, param] = slug || [];

    if (action === 'status' && param) {
      const deviceShare = await findShareByIdentifier(param);
      if (!deviceShare) {
        return NextResponse.json({ error: 'Pairing session not found' }, { status: 404 });
      }

      if (
        (deviceShare.status === 'pending' || deviceShare.status === 'awaiting_approval') &&
        new Date() > new Date(deviceShare.expiresAt)
      ) {
        deviceShare.status = 'expired';
        await saveShareRecord(deviceShare);
      }

      return NextResponse.json({
        success: true,
        shareId: deviceShare.shareId,
        pairingCode: deviceShare.pairingCode,
        mode: deviceShare.mode,
        autoApprove: deviceShare.autoApprove,
        status: deviceShare.status,
        walletAddress: deviceShare.walletAddress,
        walletName: deviceShare.walletName,
        newDeviceData: deviceShare.newDeviceData,
        approvedAt: deviceShare.approvedAt,
        expiresAt: deviceShare.expiresAt,
      });
    }

    if (action === 'pending' && param) {
      const pendingShares = await findSharesByWallet(param, ['awaiting_approval']);
      return NextResponse.json({
        success: true,
        pendingShares: pendingShares.map((share) => ({
          shareId: share.shareId,
          pairingCode: share.pairingCode,
          mode: share.mode,
          newDeviceData: share.newDeviceData,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
        })),
      });
    }

    if (action === 'connected' && param) {
      const approvedShares = await findSharesByWallet(param, ['approved']);
      return NextResponse.json({
        success: true,
        connectedDevices: approvedShares.map((share) => ({
          shareId: share.shareId,
          pairingCode: share.pairingCode,
          mode: share.mode,
          newDeviceData: share.newDeviceData,
          createdAt: share.createdAt,
          approvedAt: share.approvedAt,
        })),
      });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  } catch (err: any) {
    console.error('[next-device-import GET]', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params;
    const [action] = slug || [];
    const body = await req.json().catch(() => ({}));

    if (action === 'generate-qr') {
      const {
        passkeyData,
        deviceMetadata,
        mode: requestedMode,
        walletAddress: explicitWallet,
        walletName,
        autoApprove = false,
        frontendOrigin,
      } = body;

      const shareId = generateShareId();
      const pairingCode = generatePairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const ownerWallet =
        explicitWallet || passkeyData?.smartWalletAddress || passkeyData?.publicKey || null;
      const mode = requestedMode || (ownerWallet ? 'sync_from_owner' : 'request_from_new_device');
      const parsedDevice = parseDeviceInfo(deviceMetadata, req);

      const record = {
        shareId,
        pairingCode,
        mode,
        autoApprove: Boolean(autoApprove),
        walletAddress: mode === 'sync_from_owner' ? ownerWallet : null,
        walletName: walletName || null,
        ownerDeviceId: mode === 'sync_from_owner' ? parsedDevice.deviceId : null,
        newDeviceData: {
          passkeyData: passkeyData || null,
          publicKey: ownerWallet,
          ...parsedDevice,
        },
        status: 'pending',
        expiresAt,
        approvedAt: null,
        createdAt: new Date(),
      };

      await saveShareRecord(record);

      const origin =
        frontendOrigin ||
        req.headers.get('origin') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://localhost:3000';
      const cleanOrigin = String(origin).replace(/\/$/, '');

      // Embed wallet parameters in the URL so even cross-network phones can inspect & link seamlessly
      const params = new URLSearchParams({
        shareId,
        code: pairingCode,
      });
      if (mode === 'sync_from_owner' && ownerWallet) {
        params.set('w', ownerWallet);
        if (walletName) params.set('n', walletName);
        if (autoApprove) params.set('a', '1');
      }

      const pairingUrl = `${cleanOrigin}/pair?${params.toString()}`;

      const qrCodeDataURL = await QRCode.toDataURL(pairingUrl, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#06080f',
          light: '#ffffff',
        },
      });

      return NextResponse.json({
        success: true,
        shareId,
        pairingCode,
        mode,
        pairingUrl,
        qrCode: qrCodeDataURL,
        expiresAt,
      });
    }

    if (action === 'scan-qr') {
      const { qrData, walletAddress, ownerDeviceId, deviceMetadata } = body;
      const { id: identifier, walletFromUrl, nameFromUrl } = extractIdentifierFromQrPayload(qrData);

      if (!identifier) {
        return NextResponse.json({ error: 'Invalid QR code or pairing code' }, { status: 400 });
      }

      let deviceShare = await findShareByIdentifier(identifier);

      // If scanned via self-contained URL on another instance, reconstruct record
      if (!deviceShare && walletFromUrl) {
        deviceShare = {
          shareId: identifier,
          pairingCode: identifier.length === 6 ? identifier : generatePairingCode(),
          mode: 'sync_from_owner',
          autoApprove: true,
          walletAddress: walletFromUrl,
          walletName: nameFromUrl || 'RampFi Passkey Vault',
          status: 'pending',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          createdAt: new Date(),
          newDeviceData: {},
        };
      }

      if (!deviceShare) {
        return NextResponse.json(
          { error: 'Pairing code not found or expired. Please generate a new QR code.' },
          { status: 404 }
        );
      }

      if (new Date() > new Date(deviceShare.expiresAt)) {
        deviceShare.status = 'expired';
        await saveShareRecord(deviceShare);
        return NextResponse.json(
          { error: 'QR code has expired. Please generate a new one.' },
          { status: 400 }
        );
      }

      if (deviceShare.mode === 'sync_from_owner' && deviceShare.walletAddress) {
        const scannerDevice = parseDeviceInfo(deviceMetadata, req);
        deviceShare.newDeviceData = {
          ...deviceShare.newDeviceData,
          ...scannerDevice,
        };

        if (deviceShare.autoApprove) {
          deviceShare.status = 'approved';
          deviceShare.approvedAt = new Date();
        } else {
          deviceShare.status = 'awaiting_approval';
        }

        await saveShareRecord(deviceShare);

        return NextResponse.json({
          success: true,
          mode: 'sync_from_owner',
          status: deviceShare.status,
          walletAddress: deviceShare.walletAddress,
          walletName: deviceShare.walletName,
          deviceShare: {
            shareId: deviceShare.shareId,
            pairingCode: deviceShare.pairingCode,
            newDeviceData: deviceShare.newDeviceData,
            expiresAt: deviceShare.expiresAt,
          },
        });
      }

      if (!walletAddress) {
        return NextResponse.json(
          { error: 'Please log into your wallet first to approve this device.' },
          { status: 400 }
        );
      }

      deviceShare.walletAddress = walletAddress;
      deviceShare.ownerDeviceId = ownerDeviceId || `owner_${Date.now()}`;
      deviceShare.status = 'awaiting_approval';
      await saveShareRecord(deviceShare);

      return NextResponse.json({
        success: true,
        mode: 'request_from_new_device',
        status: deviceShare.status,
        walletAddress: deviceShare.walletAddress,
        deviceShare: {
          shareId: deviceShare.shareId,
          pairingCode: deviceShare.pairingCode,
          newDeviceData: deviceShare.newDeviceData,
          expiresAt: deviceShare.expiresAt,
        },
      });
    }

    if (action === 'approve') {
      const { shareId, approved, walletAddress } = body;
      if (!shareId || typeof approved !== 'boolean') {
        return NextResponse.json({ error: 'Missing shareId or approved status' }, { status: 400 });
      }

      const deviceShare = await findShareByIdentifier(shareId);
      if (!deviceShare) {
        return NextResponse.json({ error: 'Pairing session not found' }, { status: 404 });
      }

      if (walletAddress && !deviceShare.walletAddress) {
        deviceShare.walletAddress = walletAddress;
      }

      if (approved) {
        deviceShare.status = 'approved';
        deviceShare.approvedAt = new Date();
        await saveShareRecord(deviceShare);
        return NextResponse.json({
          success: true,
          message: 'Device connection approved',
          walletAddress: deviceShare.walletAddress,
          walletName: deviceShare.walletName,
        });
      } else {
        deviceShare.status = 'rejected';
        await saveShareRecord(deviceShare);
        return NextResponse.json({
          success: true,
          message: 'Device connection rejected',
        });
      }
    }

    if (action === 'revoke') {
      const { shareId } = body;
      if (!shareId) {
        return NextResponse.json({ error: 'Missing shareId' }, { status: 400 });
      }
      await deleteShareRecord(shareId);
      return NextResponse.json({
        success: true,
        message: 'Device revoked successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 404 });
  } catch (err: any) {
    console.error('[next-device-import POST]', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
