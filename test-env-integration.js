const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Read and parse .env manually
try {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    
    const key = trimmed.substring(0, eqIndex).trim();
    let val = trimmed.substring(eqIndex + 1).trim();
    
    // Strip surrounding quotes
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    
    process.env[key] = val;
  }
  console.log('✅ Loaded .env file successfully');
} catch (err) {
  console.error('❌ Failed to read .env file:', err.message);
  process.exit(1);
}

// 2. Validate loaded env variables
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

console.log('\n=== Configuration Check ===');
console.log('- TELEGRAM_BOT_TOKEN:', botToken ? 'OK (' + botToken.substring(0, 10) + '...)' : 'MISSING');
console.log('- TELEGRAM_CHAT_ID:', chatId ? 'OK' : 'MISSING');
console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', clientEmail ? 'OK' : 'MISSING');
console.log('- GOOGLE_PRIVATE_KEY length:', privateKey ? privateKey.length + ' chars' : 'MISSING');
console.log('- GOOGLE_DRIVE_ROOT_FOLDER_ID:', rootFolderId ? 'OK' : 'MISSING');

if (!botToken || !chatId || !clientEmail || !privateKey || !rootFolderId) {
  console.error('❌ One or more environment variables are missing. Please check your .env file.');
  process.exit(1);
}

// 3. Helper to get Access Token
async function getAccessToken() {
  try {
    let key = privateKey.replace(/\\n/g, '\n').replace(/\\r/g, '\r').trim();
    try {
      crypto.createPrivateKey(key);
    } catch {
      throw new Error('GOOGLE_PRIVATE_KEY is invalid or incomplete');
    }
    const header = JSON.stringify({ alg: 'RS256', typ: 'JWT' });
    const base64Header = Buffer.from(header).toString('base64url');

    const now = Math.floor(Date.now() / 1000);
    const claim = JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    });
    const base64Claim = Buffer.from(claim).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${base64Header}.${base64Claim}`);
    const signature = sign.sign(key, 'base64url');
    const jwt = `${base64Header}.${base64Claim}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    return data.access_token;
  } catch (err) {
    console.error('❌ Failed to get Google OAuth token:', err.message);
    return null;
  }
}

async function runTests() {
  console.log('\n--- 🚀 Testing Google Drive Auth & Folder Creation ---');
  const token = await getAccessToken();
  if (!token) {
    console.error('❌ Google Auth failed! Please check your GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.');
  } else {
    console.log('✅ Google Auth successful! Token obtained.');
    
    // Attempt to create a test folder
    console.log('Testing folder creation in Google Drive...');
    const folderMetadata = {
      name: `TEST_FOLDER - ${new Date().toLocaleString('vi-VN')}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId]
    };

    try {
      const driveResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(folderMetadata)
      });

      const responseBody = await driveResponse.json();
      if (!driveResponse.ok) {
        console.error('❌ Failed to create folder in Google Drive:', responseBody);
        console.error('👉 Make sure the Google Drive folder exists and is shared with the Service Account email!');
      } else {
        console.log('✅ Success! Google Drive folder created successfully:', responseBody.name);
        console.log('Folder ID:', responseBody.id);
      }
    } catch (err) {
      console.error('❌ Error creating Drive folder:', err.message);
    }
  }

  console.log('\n--- 🚀 Testing Telegram Notification ---');
  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🛎️ <b>[TEST] Luxe Agency VN</b>\nThông số cấu hình của bạn hoàn toàn chính xác! Hệ thống đã kết nối thành công.`,
        parse_mode: 'HTML'
      })
    });

    const resData = await response.json();
    if (!response.ok) {
      console.error('❌ Telegram Send failed:', resData);
    } else {
      console.log('✅ Success! Test message sent to Telegram. Message ID:', resData.result.message_id);
    }
  } catch (err) {
    console.error('❌ Telegram Send failed with network error:', err.message);
  }
}

runTests();
