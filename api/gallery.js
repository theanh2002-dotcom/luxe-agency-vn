import { fetchWithTimeout, getGoogleAccessToken } from './_google-oauth.js';
import { createMediaToken, createStableMediaId } from './_media-token.js';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
const MEDIA_PROXY_URL = process.env.PUBLIC_MEDIA_PROXY_URL || 'https://image-photobooth.laihoanganh456.workers.dev';
const GALLERY_RESOLVER_URL = process.env.GALLERY_RESOLVER_URL || 'https://tanhbooth-api.laihoanganh456.workers.dev';
const GALLERY_RESOLVER_SECRET = process.env.GALLERY_RESOLVER_SECRET;
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
  const sessionPublicId = firstQueryValue(req.query?.s);
  const cursor = firstQueryValue(req.query?.cursor);
  if ((!isSafeId(requestedId) && !isSafeId(legacyQueryValue)) || (legacyQueryValue && !isSafeId(legacyQueryValue))) {
    res.status(400).json({ error: 'Gallery identifier is invalid' });
    return;
  }
  if (sessionPublicId && !isSessionPublicId(sessionPublicId)) {
    res.status(400).json({ error: 'Session identifier is invalid' });
    return;
  }
  if (sessionPublicId && !isEventPublicId(requestedId)) {
    res.status(400).json({ error: 'Session filter requires an event identifier' });
    return;
  }
  if (sessionPublicId && legacyQueryValue) {
    res.status(400).json({ error: 'Session and legacy manifest filters cannot be combined' });
    return;
  }
  if (cursor && (!isCursor(cursor) || sessionPublicId || legacyQueryValue || !isEventPublicId(requestedId))) {
    res.status(400).json({ error: 'Gallery cursor is invalid' });
    return;
  }

  try {
    const source = await resolveGallerySource(requestedId, legacyQueryValue, sessionPublicId, cursor);
    if (source.status === 'PENDING') {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        mode: sessionPublicId ? 'SESSION' : 'EVENT',
        status: 'PENDING',
        event: requestedId,
        session: sessionPublicId || null,
        items: [],
        pollAfterMs: 5000,
        nextCursor: null
      });
      return;
    }
    const media = source.files
      ? source.files.map(file => toPublicMedia(file))
      : normalizeManifest(source.manifest).map(item => toPublicMedia(item));

    // Giữ polling tối đa 5 giây nhưng cho phép browser cache cùng response,
    // tránh gọi lại API vô ích giữa các lần render trên mobile.
    res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=10');
    const mode = legacyQueryValue || !isEventPublicId(requestedId) ? 'LEGACY' : (sessionPublicId ? 'SESSION' : 'EVENT');
    const status = mode === 'SESSION' && media.length === 0 ? 'PENDING' : 'READY';
    res.status(200).json({
      mode,
      status,
      event: isEventPublicId(requestedId) ? requestedId : null,
      session: sessionPublicId || null,
      items: media,
      pollAfterMs: status === 'PENDING' ? 5000 : null,
      nextCursor: source.nextCursor || null
    });
  } catch (error) {
    console.error('[gallery] gallery request failed:', error?.message || error);
    res.status(502).json({ error: 'Gallery is temporarily unavailable' });
  }
}

async function resolveGallerySource(requestedId, legacyQueryValue, sessionPublicId, cursor) {
  if (legacyQueryValue) {
    return { manifest: await readDriveJson(legacyQueryValue), nextCursor: null };
  }
  if (!isSafeId(requestedId)) throw new Error('Gallery folder is invalid');
  if (isEventPublicId(requestedId)) {
    const resolved = await resolveEventFolder(requestedId);
    if (resolved.status !== 'READY') return { status: 'PENDING' };
    const page = await listMediaFiles(resolved.driveFolderId, sessionPublicId || null, true, cursor || null, Boolean(sessionPublicId));
    return { status: 'READY', files: page.files, nextCursor: page.nextCursor };
  }
  const page = await listMediaFiles(requestedId, null, false, null, true);
  return { files: page.files, nextCursor: null };
}

async function resolveEventFolder(eventPublicId) {
  if (!GALLERY_RESOLVER_SECRET) throw new Error('Missing gallery resolver authentication');
  const response = await fetchWithTimeout(
    `${GALLERY_RESOLVER_URL.replace(/\/$/, '')}/v1/gallery/events/${encodeURIComponent(eventPublicId)}/folder`,
    {
      headers: {
        Authorization: `Bearer ${GALLERY_RESOLVER_SECRET}`,
        Accept: 'application/json'
      }
    }
  );
  if (!response.ok) throw new Error(`Gallery folder resolver failed (${response.status})`);
  const payload = await response.json();
  if (payload?.status === 'PENDING') return { status: 'PENDING' };
  if (payload?.status !== 'READY' || !isSafeId(payload?.driveFolderId)) {
    throw new Error('Gallery folder resolver response is invalid');
  }
  return { status: 'READY', driveFolderId: payload.driveFolderId };
}

async function listMediaFiles(folderId, sessionPublicId = null, canonicalOnly = true, cursor = null, loadAllPages = false) {
  const prefix = sessionPublicId ? `SB_${sessionPublicId}_` : null;
  const query = [
    `'${escapeDriveLiteral(folderId)}' in parents`,
    'trashed = false',
    `(mimeType contains 'image/' or mimeType contains 'video/')`,
    ...(prefix ? [`name contains '${escapeDriveLiteral(prefix)}'`] : [])
  ].join(' and ');
  const page = await driveList(query, 'files(id,name,mimeType,size,createdTime,modifiedTime)', cursor, loadAllPages);
  const files = !canonicalOnly ? page.files : page.files.filter(file => sessionPublicId
    ? isCanonicalSessionMedia(file?.name, sessionPublicId)
    : isCanonicalEventFinal(file?.name)
  );
  return { files: files.sort(compareMediaItems), nextCursor: page.nextCursor };
}

async function readDriveJson(fileId) {
  const response = await driveFetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`);
  if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
  return response.json();
}

async function driveList(query, fields, initialCursor = null, loadAllPages = false) {
  const result = [];
  let pageToken = initialCursor || '';
  do {
    const pageFields = `nextPageToken,${fields}`;
    const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `${DRIVE_FILES_URL}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(pageFields)}&orderBy=createdTime desc&pageSize=100${page}`;
    const response = await driveFetch(url);
    if (!response.ok) throw new Error(`Drive list failed (${response.status})`);
    const data = await response.json();
    if (Array.isArray(data.files)) result.push(...data.files);
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
  } while (loadAllPages && pageToken && result.length < 1000);
  return { files: result, nextCursor: loadAllPages ? null : (pageToken || null) };
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

function isCursor(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._~+/=-]{1,2048}$/.test(value);
}

function isEventPublicId(value) {
  return typeof value === 'string' && /^evt_[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}$/.test(value);
}

function isSessionPublicId(value) {
  return typeof value === 'string' && /^ses_[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}$/.test(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCanonicalSessionMedia(name, sessionPublicId) {
  const prefix = escapeRegExp(`SB_${sessionPublicId}_`);
  return new RegExp(`^${prefix}(?:final|shot_[1-9][0-9]*|bts)\\.(?:jpe?g|png|webp|mp4|m4v|webm|mov)$`, 'i').test(String(name || ''));
}

function isCanonicalEventFinal(name) {
  return /^SB_ses_[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}_final\.(?:jpe?g|png|webp)$/i.test(String(name || ''));
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
