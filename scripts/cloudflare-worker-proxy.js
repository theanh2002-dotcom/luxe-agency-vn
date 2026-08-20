/**
 * Cloudflare Worker for Proxying Google Drive & Google Photos (lh3) Images
 * 
 * Cách cài đặt:
 * 1. Vào Cloudflare Dashboard -> Workers & Pages -> Create Application -> Create Worker
 * 2. Xóa code cũ, Copy và Paste toàn bộ code này vào.
 * 3. Bấm Deploy.
 * 4. Lấy link dạng https://tên-worker.tên-bạn.workers.dev điền vào biến imageProxyUrl trong Angular.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    let targetUrl = '';

    // Nếu đường dẫn bắt đầu bằng /d/ (Ảnh proxy qua lh3.googleusercontent.com)
    if (url.pathname.startsWith('/d/')) {
      targetUrl = `https://lh3.googleusercontent.com${path}`;
    }
    // Nếu đường dẫn bắt đầu bằng /uc (Ảnh gốc tải từ drive.google.com)
    else if (url.pathname.startsWith('/uc')) {
      targetUrl = `https://drive.google.com${path}`;
    }
    else {
      return new Response('Not Found', { status: 404 });
    }

    try {
      // Gọi lên Google
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers
      });

      // Trả về dữ liệu cho người dùng
      // Cấu hình lại Header để cho phép trình duyệt hiển thị bình thường (CORS)
      const newResponse = new Response(response.body, response);
      
      // Chặn trình duyệt chuyển hướng (Google thường chuyển hướng 302 cho /uc download)
      // Nhưng Cloudflare fetch sẽ tự follow redirects, nên body trả về là file thật.
      
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', '*');
      
      // Khuyến khích trình duyệt Cache ảnh trong 30 ngày để giảm tải
      newResponse.headers.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000');
      
      return newResponse;

    } catch (e) {
      return new Response(`Error fetching image: ${e.message}`, { status: 500 });
    }
  },
};
