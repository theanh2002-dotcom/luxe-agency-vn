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

    // Nếu đường dẫn là tải file (/uc) thì trỏ về drive.google.com
    if (url.pathname.startsWith('/uc')) {
      targetUrl = `https://drive.google.com${path}`;
    }
    // Còn lại (như /d/ hoặc /u/0/d/...) thì trỏ về server ảnh lh3.googleusercontent.com
    else {
      targetUrl = `https://lh3.googleusercontent.com${path}`;
    }

    // -----------------------------------------------------
    // CƠ CHẾ EDGE CACHE TOÀN CẦU CỦA CLOUDFLARE
    // -----------------------------------------------------
    const cacheUrl = new URL(request.url);
    // Xóa bớt tham số linh tinh không cần thiết khi lưu cache nếu có
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    try {
      // 1. Kiểm tra xem ảnh đã được lưu ở Datacenter của VN chưa
      let response = await cache.match(cacheKey);

      if (!response) {
        // 2. Nếu chưa có, tiến hành tải ảnh từ Google Drive về
        const fetchedResponse = await fetch(targetUrl, {
          method: request.method,
          headers: request.headers
        });

        // 3. Tạo một response mới để tùy chỉnh lại bộ Headers
        response = new Response(fetchedResponse.body, fetchedResponse);
        
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', '*');
        
        // Cực kỳ quan trọng: Báo cho Cloudflare Edge VÀ trình duyệt biết là được phép lưu Cache trong 30 ngày (2592000 giây)
        response.headers.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000');
        
        // 4. Đẩy ảnh vừa tải vào kho lưu trữ Edge Cache ở VN (chạy ngầm không làm chậm tốc độ của người dùng)
        if (fetchedResponse.status === 200) {
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }
      }

      // Trả ảnh về cho người dùng
      return response;

    } catch (e) {
      return new Response(`Error fetching image: ${e.message}`, { status: 500 });
    }
  },
};
