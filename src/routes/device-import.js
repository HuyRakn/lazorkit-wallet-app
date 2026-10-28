const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const mongoose = require('mongoose');

// Schema for device sharing and wallet association
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

const DeviceShare = mongoose.models.DeviceShare || mongoose.model('DeviceShare', DeviceShareSchema);

// In-memory store fallback so device pairing works 100% reliably even if MongoDB is offline
const memoryShares = new Map();

const isDbReady = () => mongoose.connection && mongoose.connection.readyState === 1;

async function saveShareRecord(record) {
  memoryShares.set(record.shareId, { ...record });
  if (isDbReady()) {
    try {
      await DeviceShare.findOneAndUpdate(
        { shareId: record.shareId },
        { $set: record },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.warn('[device-import] MongoDB save fallback to memory:', e.message);
    }
  }
  return record;
}

async function findShareByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim();
  const digitsOnly = clean.replace(/[\s-]/g, '');

  // Check in-memory first
  for (const item of memoryShares.values()) {
    if (item.shareId === clean || (item.pairingCode && item.pairingCode === digitsOnly)) {
      return item;
    }
  }

  if (isDbReady()) {
    try {
      const doc = await DeviceShare.findOne({
        $or: [{ shareId: clean }, { pairingCode: digitsOnly }],
      }).lean();
      if (doc) {
        memoryShares.set(doc.shareId, doc);
        return doc;
      }
    } catch (e) {
      console.warn('[device-import] MongoDB find fallback:', e.message);
    }
  }
  return null;
}

async function findSharesByWallet(walletAddress, statuses) {
  const resultsMap = new Map();

  for (const item of memoryShares.values()) {
    if (item.walletAddress === walletAddress && statuses.includes(item.status)) {
      resultsMap.set(item.shareId, item);
    }
  }

  if (isDbReady()) {
    try {
      const docs = await DeviceShare.find({
        walletAddress,
        status: { $in: statuses },
      })
        .sort({ createdAt: -1 })
        .lean();
      for (const d of docs) {
        resultsMap.set(d.shareId, d);
      }
    } catch (e) {
      console.warn('[device-import] MongoDB query fallback:', e.message);
    }
  }

  return Array.from(resultsMap.values()).sort(
    (a, b) => new Date(b.approvedAt || b.createdAt).getTime() - new Date(a.approvedAt || a.createdAt).getTime()
  );
}

async function deleteShareRecord(shareId) {
  const existedInMem = memoryShares.delete(shareId);
  let deletedInDb = false;
  if (isDbReady()) {
    try {
      const res = await DeviceShare.deleteOne({ shareId });
      deletedInDb = res.deletedCount > 0;
    } catch (e) {
      console.warn('[device-import] MongoDB delete fallback:', e.message);
    }
  }
  return existedInMem || deletedInDb;
}

// Parse User-Agent into clean human-readable platform, browser, and OS
function parseDeviceInfo(deviceMetadata = {}, req = {}) {
  const ua = String(deviceMetadata.userAgent || req.headers?.['user-agent'] || '');

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
    ip: req.ip || req.socket?.remoteAddress || '127.0.0.1',
    location: deviceMetadata.location || null,
  };
}

// Extract shareId or 6-digit code from any QR payload (URL, JSON, raw shareId, or 6-digit code)
function extractIdentifierFromQrPayload(qrData) {
  if (!qrData) return null;
  const raw = String(qrData).trim();

  // 1. Check if it's a URL (e.g. https://.../pair?shareId=share_...&code=123456)
  if (/^https?:\/\//i.test(raw) || raw.includes('/pair?')) {
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://localhost${raw}`);
      const sid = url.searchParams.get('shareId');
      const code = url.searchParams.get('code');
      return sid || code || null;
    } catch {
      const match = raw.match(/[?&](?:shareId|code)=([^&#]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
  }

  // 2. Check if it's JSON
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed.shareId || parsed.code || parsed.pairingCode || null;
    } catch {
      // fall through
    }
  }

  // 3. Direct share_... ID or 6-digit pairing code
  const cleaned = raw.replace(/[\s-]/g, '');
  if (cleaned.startsWith('share_') || /^\d{6}$/.test(cleaned)) {
    return cleaned;
  }

  return raw;
}

const generateShareId = () => 'share_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
const generatePairingCode = () => String(Math.floor(100000 + Math.random() * 900000));

// POST /api/device-import/generate-qr
// Supports both:
// - mode: 'sync_from_owner' (Logged-in wallet owner in DevicesTab generating QR for phone/new device)
// - mode: 'request_from_new_device' (Logged-out new device in ConnectWalletModal generating QR for owner to scan)
router.post('/generate-qr', async (req, res, next) => {
  try {
    const {
      passkeyData,
      deviceMetadata,
      mode: requestedMode,
      walletAddress: explicitWallet,
      walletName,
      autoApprove = false,
      frontendOrigin,
    } = req.body || {};

    if (!deviceMetadata && !passkeyData) {
      return res.status(400).json({ error: 'Missing deviceMetadata' });
    }

    const shareId = generateShareId();
    const pairingCode = generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const ownerWallet = explicitWallet || passkeyData?.smartWalletAddress || passkeyData?.publicKey || null;
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

    // Build a real, clickable URL so native iOS/Android cameras open the pairing page directly
    const origin =
      frontendOrigin ||
      req.headers.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://localhost:3000';
    const cleanOrigin = String(origin).replace(/\/$/, '');
    const pairingUrl = `${cleanOrigin}/pair?shareId=${encodeURIComponent(shareId)}&code=${encodeURIComponent(pairingCode)}`;

    // High-contrast dark-on-white QR code for 100% camera & webcam compatibility
    const qrCodeDataURL = await QRCode.toDataURL(pairingUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#06080f',
        light: '#ffffff',
      },
    });

    res.json({
      success: true,
      shareId,
      pairingCode,
      mode,
      pairingUrl,
      qrCode: qrCodeDataURL,
      expiresAt,
    });
  } catch (err) {
    console.error('Generate QR error:', err);
    return next(err);
  }
});

// POST /api/device-import/scan-qr
// Universal endpoint for scanning a QR or entering a 6-digit code from EITHER device!
router.post('/scan-qr', async (req, res, next) => {
  try {
    const { qrData, walletAddress, ownerDeviceId, deviceMetadata } = req.body || {};

    const identifier = extractIdentifierFromQrPayload(qrData);
    if (!identifier) {
      return res.status(400).json({ error: 'Invalid QR code or pairing code' });
    }

    const deviceShare = await findShareByIdentifier(identifier);
    if (!deviceShare) {
      return res.status(404).json({ error: 'Pairing session not found or expired' });
    }

    if (new Date() > new Date(deviceShare.expiresAt)) {
      deviceShare.status = 'expired';
      await saveShareRecord(deviceShare);
      return res.status(400).json({ error: 'QR code has expired. Please generate a new one.' });
    }

    // Case A: The QR was generated by the logged-in Owner ('sync_from_owner'),
    // and is now being claimed/scanned by the New Device (or tested by the owner).
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

      return res.json({
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

    // Case B: The QR was generated by a New Device ('request_from_new_device'),
    // and is now being scanned by the Logged-In Wallet Owner.
    if (!walletAddress) {
      return res.status(400).json({ error: 'Please log into your wallet first to approve this device.' });
    }

    deviceShare.walletAddress = walletAddress;
    deviceShare.ownerDeviceId = ownerDeviceId || `owner_${Date.now()}`;
    deviceShare.status = 'awaiting_approval';
    await saveShareRecord(deviceShare);

    return res.json({
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
  } catch (err) {
    console.error('Scan QR error:', err);
    return next(err);
  }
});

// POST /api/device-import/approve
// Approve or reject device connection
router.post('/approve', async (req, res, next) => {
  try {
    const { shareId, approved, walletAddress } = req.body || {};

    if (!shareId || typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Missing shareId or approved status' });
    }

    const deviceShare = await findShareByIdentifier(shareId);
    if (!deviceShare) {
      return res.status(404).json({ error: 'Pairing session not found' });
    }

    if (deviceShare.status === 'approved' && approved) {
      return res.json({
        success: true,
        message: 'Device connection already approved',
        walletAddress: deviceShare.walletAddress,
        walletName: deviceShare.walletName,
      });
    }

    if (new Date() > new Date(deviceShare.expiresAt)) {
      deviceShare.status = 'expired';
      await saveShareRecord(deviceShare);
      return res.status(400).json({ error: 'Pairing session has expired' });
    }

    if (walletAddress && !deviceShare.walletAddress) {
      deviceShare.walletAddress = walletAddress;
    }

    if (approved) {
      deviceShare.status = 'approved';
      deviceShare.approvedAt = new Date();
      await saveShareRecord(deviceShare);

      return res.json({
        success: true,
        message: 'Device connection approved',
        walletAddress: deviceShare.walletAddress,
        walletName: deviceShare.walletName,
      });
    } else {
      deviceShare.status = 'rejected';
      await saveShareRecord(deviceShare);

      return res.json({
        success: true,
        message: 'Device connection rejected',
      });
    }
  } catch (err) {
    console.error('Approve device error:', err);
    return next(err);
  }
});

// GET /api/device-import/status/:shareId
// Check status of device import request (accepts shareId or 6-digit pairingCode)
router.get('/status/:shareId', async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const deviceShare = await findShareByIdentifier(shareId);

    if (!deviceShare) {
      return res.status(404).json({ error: 'Pairing session not found' });
    }

    if (
      (deviceShare.status === 'pending' || deviceShare.status === 'awaiting_approval') &&
      new Date() > new Date(deviceShare.expiresAt)
    ) {
      deviceShare.status = 'expired';
      await saveShareRecord(deviceShare);
    }

    res.json({
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
  } catch (err) {
    console.error('Check status error:', err);
    return next(err);
  }
});

// GET /api/device-import/pending/:walletAddress
// Get pending / awaiting_approval device requests for a wallet
router.get('/pending/:walletAddress', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const pendingShares = await findSharesByWallet(walletAddress, ['awaiting_approval']);

    res.json({
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
  } catch (err) {
    console.error('Get pending shares error:', err);
    return next(err);
  }
});

// GET /api/device-import/connected/:walletAddress
// Get connected (approved) devices for a wallet
router.get('/connected/:walletAddress', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const approvedShares = await findSharesByWallet(walletAddress, ['approved']);

    res.json({
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
  } catch (err) {
    console.error('Get connected devices error:', err);
    return next(err);
  }
});

// POST /api/device-import/revoke
// Revoke an approved device share
router.post('/revoke', async (req, res, next) => {
  try {
    const { shareId } = req.body || {};

    if (!shareId) {
      return res.status(400).json({ error: 'Missing shareId' });
    }

    const deleted = await deleteShareRecord(shareId);
    if (!deleted) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      success: true,
      message: 'Device revoked successfully',
    });
  } catch (err) {
    console.error('Revoke device error:', err);
    return next(err);
  }
});

module.exports = router;
