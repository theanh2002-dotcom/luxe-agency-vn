import { fetchWithTimeout } from './_google-oauth.js';
import { createMediaToken } from './_media-token.js';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
const MEDIA_PROXY_URL = process.env.PUBLIC_MEDIA_PROXY_URL || 'https://image-photobooth.laihoanganh456.workers.dev';
const ALLOWED_ORIGINS = new Set([
  'https://tanh.event-vn.com',
  'https://luxe-agency-vn.vercel.app',
  'http://localhost:4200',
  'http://127.0.0.1:4200'
]);

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const requestedId = firstQueryValue(req.query?.id ?? req.query?.publicId ?? req.query?.folderId);
  const legacyQueryValue = firstQueryValue(req.query?.m);
  if (!isSafeId(requestedId) && !isSafeId(legacyQueryValue)) {
    res.status(400).json({ error: 'Gallery identifier is invalid' });
    return;
  }

  try {
    if (!DRIVE_API_KEY) throw new Error('Missing GOOGLE_DRIVE_API_KEY');
    const source = await resolveGallerySource(requestedId, legacyQueryValue);
    const media = source.files
      ? source.files.map(file => toPublicMedia(file))
      : normalizeManifest(source.manifest).map(item => toPublicMedia(item));

    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10');
    res.status(200).json({ items: media });
  } catch (error) {
    console.error('[gallery] server-side resolver failed:', error?.message || error);
    res.status(502).json({ error: 'Gallery is temporarily unavailable' });
  }
}

async function resolveGallerySource(requestedId, legacyQueryValue) {
  if (legacyQueryValue) {
    return { manifest: await readDriveJson(legacyQueryValue) };
  }
  if (!isSafeId(requestedId)) throw new Error('Gallery folder is invalid');
  return { files: await listMediaFiles(requestedId) };
}

async function listMediaFiles(folderId) {
  const query = [
    `'${escapeDriveLiteral(folderId)}' in parents`,
    'trashed = false',
    `(mimeType contains 'image/' or mimeType contains 'video/')`
  ].join(' and ');
  return driveList(query, 'files(id,name,mimeType,size,createdTime,modifiedTime)');
}

async function readDriveJson(fileId) {
  const response = await fetchWithTimeout(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(DRIVE_API_KEY)}`);
  if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
  return response.json();
}

async function driveList(query, fields) {
  const url = `${DRIVE_FILES_URL}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=createdTime desc&pageSize=100&key=${encodeURIComponent(DRIVE_API_KEY)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Drive list failed (${response.status})`);
  const data = await response.json();
  return Array.isArray(data.files) ? data.files : [];
}

function normalizeManifest(manifest) {
  const items = Array.isArray(manifest) ? manifest : [];
  const sessionItems = items.filter(item =>
    item?.fileId && ['final', 'photo', 'video'].includes(String(item.type || '').toLowerCase())
  );
  if (sessionItems.length > 0) return sessionItems;

  // Event manifests historically contain one final file per session.
  return items
    .filter(item => item?.type === 'session' && item?.fileId)
    .map(item => ({
      fileId: item.fileId,
      type: 'final',
      name: `Session ${item.sessionId || ''}`.trim(),
      createdTime: item.createdTime
    }));
}

function toPublicMedia(item) {
  const fileId = item.fileId || item.id;
  const mimeType = item.mimeType || inferMimeType(item.type, item.name);
  const kind = mimeType.startsWith('video/') || String(item.type || '').toLowerCase() === 'video'
    ? 'video'
    : 'image';
  const mediaToken = createMediaToken({
    fileId,
    kind,
    mimeType,
    name: sanitizeName(item.name || (kind === 'video' ? 'Video sự kiện' : 'Ảnh sự kiện'))
  });
  const mediaBase = `${MEDIA_PROXY_URL.replace(/\/$/, '')}/media/${mediaToken}`;

  return {
    id: mediaToken,
    name: sanitizeName(item.name || (kind === 'video' ? 'Video sự kiện' : 'Ảnh sự kiện')),
    kind,
    mimeType,
    createdAt: item.createdTime || item.modifiedTime || new Date().toISOString(),
    thumbnailUrl: `${mediaBase}?variant=thumbnail&size=200`,
    mediaUrl: kind === 'video' ? mediaBase : `${mediaBase}?variant=image&size=1080`,
    lightboxUrl: kind === 'video' ? mediaBase : `${mediaBase}?variant=image&size=2560`,
    downloadUrl: `${mediaBase}/download`
  };
}

function inferMimeType(type, name) {
  if (String(type || '').toLowerCase() === 'video' || /\.(mp4|m4v|webm|mov|ogg)$/i.test(name || '')) {
    return 'video/mp4';
  }
  return 'image/jpeg';
}

function sanitizeName(value) {
  return String(value).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 180) || 'Media';
}

function escapeDriveLiteral(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isSafeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{3,256}$/.test(value);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
