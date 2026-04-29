import { Component } from '@angular/core';

@Component({
  selector: 'app-portfolio',
  imports: [],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio {
  portfolioImages = [
    { url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069', category: 'Lễ Cưới', title: 'Hoàng & Mai' },
    { url: 'https://images.unsplash.com/photo-1532452119098-a3650b3c46d3?q=80&w=2070', category: 'Thiết Kế', title: 'Lễ Đường Pha Lê' },
    { url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2070', category: 'Photobooth', title: 'Góc Selfie Kỷ Niệm' },
    { url: 'https://images.unsplash.com/photo-1546193430-c2d207739ed7?q=80&w=2000', category: 'Phim Trường', title: 'Cặp Đôi Bỉ Ngạn' },
    { url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070', category: 'Ngoại Cảnh', title: 'Chuyến Đi Của Thanh Xuân' },
    { url: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070', category: 'Tiệc Đêm', title: 'Ánh Sáng Nhiệm Màu' }
  ];
}
