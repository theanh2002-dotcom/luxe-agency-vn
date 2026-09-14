import { fetchWithTimeout, getGoogleAccessToken } from './_google-oauth.js';
import { createMediaToken, createStableMediaId } from './_media-token.js';

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
  const sessionTag = firstQueryValue(req.query?.s ?? req.query?.session);
  if (!isSafeId(requestedId) && !isSafeId(legacyQueryValue)) {
    res.status(400).json({ error: 'Gallery identifier is invalid' });
    return;
  }

  try {
    const source = await resolveGallerySource(requestedId, legacyQueryValue, sessionTag);
    const media = source.files
      ? source.files.map(file => toPublicMedia(file))
      : normalizeManifest(source.manifest).map(item => toPublicMedia(item));

    // Giữ polling tối đa 5 giây nhưng cho phép browser cache cùng response,
    // tránh gọi lại API vô ích giữa các lần render trên mobile.
    res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=10');
    res.status(200).json({ items: media, session: sessionTag || null });
  } catch (error) {
    console.error('[gallery] server-side resolver failed:', error?.message || error);
    res.status(502).json({ error: 'Gallery is temporarily unavailable' });
  }
}

async function resolveGallerySource(requestedId, legacyQueryValue, sessionTag) {
  if (legacyQueryValue) {
    return { manifest: await readDriveJson(legacyQueryValue) };
  }
  if (!isSafeId(requestedId)) throw new Error('Gallery folder is invalid');

  if (sessionTag && isSafeSessionTag(sessionTag)) {
    const sessionFiles = await findSessionFiles(requestedId, sessionTag);
    return { files: sessionFiles };
  }

  return { files: await listMediaFiles(requestedId) };
}

async function findSessionFiles(rootFolderId, sessionTag) {
  const match = String(sessionTag).match(/ses_[A-Za-z0-9]+/i);
  const searchPattern = match ? match[0] : sessionTag;

  // Search for session subfolder inside rootFolderId (e.g. SB_Session_ses_...)
  const folderQuery = [
    `'${escapeDriveLiteral(rootFolderId)}' in parents`,
    'trashed = false',
    `mimeType = 'application/vnd.google-apps.folder'`,
    `name contains '${escapeDriveLiteral(searchPattern)}'`
  ].join(' and ');

  const subfolders = await driveList(folderQuery, 'files(id,name,createdTime)');
  if (subfolders && subfolders.length > 0) {
    const sessionFolder = subfolders[0];
    return await listMediaFiles(sessionFolder.id);
  }

  // Fallback: search for direct media files matching the session pattern
  const fileQuery = [
    `'${escapeDriveLiteral(rootFolderId)}' in parents`,
    'trashed = false',
    `(mimeType contains 'image/' or mimeType contains 'video/')`,
    `name contains '${escapeDriveLiteral(searchPattern)}'`
  ].join(' and ');

  const directFiles = await driveList(fileQuery, 'files(id,name,mimeType,size,createdTime,modifiedTime)');
  if (directFiles && directFiles.length > 0) {
    return directFiles.sort(compareMediaItems);
  }

  return [];
}

async function listMediaFiles(folderId) {
  const query = [
    `'${escapeDriveLiteral(folderId)}' in parents`,
    'trashed = false',
    `(mimeType contains 'image/' or mimeType contains 'video/')`
  ].join(' and ');
  const files = await driveList(query, 'files(id,name,mimeType,size,createdTime,modifiedTime)');
  return files.sort(compareMediaItems);
}

async function readDriveJson(fileId) {
  const response = await driveFetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`);
  if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
  return response.json();
}

async function driveList(query, fields) {
  const url = `${DRIVE_FILES_URL}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=createdTime desc&pageSize=100`;
  const response = await driveFetch(url);
  if (!response.ok) throw new Error(`Drive list failed (${response.status})`);
  const data = await response.json();
  return Array.isArray(data.files) ? data.files : [];
}

async function driveFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (hasOAuthConfiguration()) {
    const accessToken = await getGoogleAccessToken();
    headers.set('Authorization', `Bearer ${accessToken}`);
    return fetchWithTimeout(url, { ...options, headers });
  }

  if (!DRIVE_API_KEY) throw new Error('Missing Google Drive authentication');
  const separator = url.includes('?') ? '&' : '?';
  return fetchWithTimeout(`${url}${separator}key=${encodeURIComponent(DRIVE_API_KEY)}`, {
    ...options,
    headers
  });
}

function hasOAuthConfiguration() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

function normalizeManifest(manifest) {
  const items = Array.isArray(manifest) ? manifest : [];
  const sessionItems = items.filter(item =>
    item?.fileId && ['final', 'photo', 'video'].includes(String(item.type || '').toLowerCase())
  );
  if (sessionItems.length > 0) return sessionItems.sort(compareMediaItems);

  // Event manifests historically contain one final file per session.
  return items
    .filter(item => item?.type === 'session' && item?.fileId)
    .map(item => ({
      fileId: item.fileId,
      type: 'final',
      name: `Session ${item.sessionId || ''}`.trim(),
      createdTime: item.createdTime
    }))
    .sort(compareMediaItems);
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
    id: createStableMediaId({ fileId, kind }),
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

function compareMediaItems(left, right) {
  const leftKind = mediaKindRank(left);
  const rightKind = mediaKindRank(right);
  if (leftKind !== rightKind) return leftKind - rightKind;

  const leftTime = parseMediaTime(left);
  const rightTime = parseMediaTime(right);
  if (leftTime !== rightTime) return rightTime - leftTime;
  return 0;
}

function mediaKindRank(item) {
  const mimeType = item?.mimeType || inferMimeType(item?.type, item?.name);
  return mimeType.startsWith('video/') || String(item?.type || '').toLowerCase() === 'video' ? 1 : 0;
}

function parseMediaTime(item) {
  const raw = item?.createdTime || item?.createdAt || item?.modifiedTime;
  const value = Date.parse(raw || '');
  return Number.isNaN(value) ? 0 : value;
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

function isSafeSessionTag(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]{3,128}$/.test(value);
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
