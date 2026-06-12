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

  const { name, phone, service, note } = req.body;
  if (!name || !phone || !service) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'Missing Telegram configuration' });
  }

  const escapeHTML = (text) => {
    return (text || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const safeName = escapeHTML(name);
  const safePhone = escapeHTML(phone);
  const safeService = escapeHTML(service);
  const safeNote = escapeHTML(note);

  const text = `🎉 <b>CÓ KHÁCH HÀNG ĐẶT LỊCH / BÁO GIÁ</b> 🎉

👤 <b>Tên:</b> ${safeName}
📞 <b>SĐT:</b> ${safePhone}
🛍 <b>Dịch vụ quan tâm:</b> ${safeService}
📝 <b>Ghi chú:</b> 
${safeNote || '<i>Không có</i>'}`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: 'Failed to send Telegram message', details: errorText });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
