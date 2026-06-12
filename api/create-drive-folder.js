import { fetchWithTimeout, getGoogleAccessToken } from './_google-oauth.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Missing name or phone number' });
  }

  const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
  if (!phoneRegex.test(phone.trim())) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ (phải bắt đầu bằng 03/05/07/08/09 và đủ 10 chữ số).' });
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    return res.status(500).json({ error: 'Missing Google Drive root folder ID' });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    const dateStr = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date()).replace(/\//g, '-');

    const folderMetadata = {
      name: `${phone} - ${dateStr}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId]
    };

    const driveResponse = await fetchWithTimeout('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(folderMetadata)
    });

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      return res.status(driveResponse.status).json({ error: 'Failed to create Drive folder', details: errorText });
    }

    const folderData = await driveResponse.json();
    return res.status(200).json(folderData);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
