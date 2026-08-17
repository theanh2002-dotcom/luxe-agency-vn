// Vercel Serverless Function to fetch Google Drive files and cache the response
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { folderId, folderIds, apiKey } = req.query;

  if ((!folderId && !folderIds) || !apiKey) {
    return res.status(400).json({ error: 'Missing folderId(s) or apiKey' });
  }

  // Cache Configuration (The Secret Weapon):
  // s-maxage=5: Cache on Vercel Edge Network for 5 seconds (All 200 users hitting in 5s get the same cache).
  // stale-while-revalidate=10: Serve stale cache up to 10s while fetching new data in background.
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');

  try {
    let parentQuery = '';
    if (folderIds) {
      const ids = folderIds.split(',').map(id => `'${id.trim()}' in parents`);
      parentQuery = `(${ids.join(' or ')})`;
    } else {
      parentQuery = `'${folderId}' in parents`;
    }

    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(parentQuery + " and trashed = false and mimeType contains 'image/'")}&fields=files(id,name,thumbnailLink,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=100&key=${apiKey}`;
    
    const response = await fetch(driveUrl);
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: 'Drive API Error', details: errorText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
