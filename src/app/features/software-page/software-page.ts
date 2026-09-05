import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ReleaseUpdate {
  version: string;
  releaseDate: string;
  isLatest?: boolean;
  tagText: string;
  summary: string;
  changes: {
    category: 'new' | 'improved' | 'fixed';
    label: string;
    text: string;
  }[];
  downloadSize?: string;
}

interface SoftwareFeature {
  icon: string;
  title: string;
  description: string;
  badge?: string;
}

interface InstallStep {
  step: string;
  title: string;
  description: string;
  note?: string;
}

interface FaqItem {
  question: string;
  answer: string;
  isOpen: boolean;
}

interface PublicReleaseResponse {
  ok: boolean;
  release: { version: string; notes: string | null; publishedAt: string } | null;
  installer: { available: boolean; size: number | null; downloadUrl: string };
}

@Component({
  selector: 'app-software-page',
  imports: [CommonModule, RouterModule],
  templateUrl: './software-page.html',
  styleUrl: './software-page.scss',
})
export class SoftwarePage implements OnInit {
  private readonly http = inject(HttpClient);
  private installerUrl: string | null = null;

  readonly currentVersion = signal('Đang kiểm tra');
  readonly releaseDate = signal('Đang kiểm tra');
  readonly fileSize = signal('—');
  readonly platform = 'Windows 10 / 11 (64-bit)';
  readonly installerAvailable = signal(false);
  readonly downloadUrl = 'https://drive.google.com/uc?export=download&id=12owkzayPImmnx6xRumjcrPZaLjiVm1-8';

  downloadToastMessage = signal<string | null>(null);

  features: SoftwareFeature[] = [
    {
      icon: 'camera',
      title: 'Live View Canon DSLR Siêu Nét',
      description: 'Kết nối trực tiếp máy ảnh Canon DSLR / Mirrorless qua cổng USB với tốc độ 60 FPS, độ trễ cực thấp dưới 30ms.',
      badge: 'Real-time'
    },
    {
      icon: 'palette',
      title: 'Thiết Kế Khung & Màn Hình Trực Quan',
      description: 'Hỗ trợ Frame Designer & Screen Designer kéo thả trực quan. Tuỳ biến countdown, sticker, chữ ký số và logo sự kiện dễ dàng.',
      badge: 'WYSIWYG'
    },
    {
      icon: 'screen',
      title: 'Đa Tỉ Lệ Màn Hình Linh Hoạt',
      description: 'Tương thích mọi kích thước màn hình: Màn hình ngang (1920x1080), Màn hình dọc (1080x1920) và Màn hình vuông (800x800).',
      badge: 'Responsive'
    },
    {
      icon: 'printer',
      title: 'In Ảnh Nhanh & Tự Động Ghép Khổ',
      description: 'Tự động cắt dải photo strip 2x6 inch hoặc in ảnh 4x6 (10x15cm) sắc nét chỉ trong 8-12 giây với máy in nhiệt DNP, Citizen, Hiti.',
      badge: 'Auto Print'
    },
    {
      icon: 'qr',
      title: 'QR Code & Cloud Gallery Tức Thì',
      description: 'Khách mời quét mã QR hiển thị trên màn hình để tải ngay ảnh gốc, file in và clip Boomerang / GIF về điện thoại.',
      badge: 'Instant QR'
    },
    {
      icon: 'shield',
      title: 'Kiosk Mode & Mã PIN Quản Trị',
      description: 'Chế độ khoá toàn màn hình (Kiosk Mode) bảo mật chống thoát ứng dụng. Cài đặt được bảo vệ bằng mã PIN an toàn.',
      badge: 'Security'
    }
  ];

  installSteps: InstallStep[] = [
    {
      step: '01',
      title: 'Tải bộ cài đặt LumiBooth',
      description: 'Nhấp vào nút "Tải Bản Cài Đặt (64-bit)" ở đầu trang để tải bộ cài LumiBooth về máy tính của bạn.',
      note: 'Dung lượng được hiển thị theo bộ cài đang phát hành. Hãy đảm bảo đường truyền ổn định.'
    },
    {
      step: '02',
      title: 'Chạy trình cài đặt & Cấp quyền',
      description: 'Mở file vừa tải về, chọn "Run as administrator" (Chạy với quyền Quản trị viên). Chọn thư mục cài đặt mặc định và nhấn "Tiếp tục".',
      note: 'Nếu Windows SmartScreen xuất hiện, chọn More Info > Run Anyway.'
    },
    {
      step: '03',
      title: 'Cài đặt Driver Máy Ảnh & Máy In',
      description: 'Đảm bảo máy tính đã cài Canon EOS Utility/EDSDK để nhận diện máy ảnh DSLR, và driver chính hãng cho máy in nhiệt sự kiện (DNP, Citizen...).',
      note: 'Cài driver chính hãng phù hợp với máy ảnh và máy in trước khi vận hành sự kiện.'
    },
    {
      step: '04',
      title: 'Kích hoạt License & Vận hành',
      description: 'Mở biểu tượng LumiBooth ngoài màn hình Desktop. Đăng nhập hoặc kích hoạt License Key để bắt đầu setup sự kiện ngay lập tức.',
      note: 'Liên hệ bộ phận vận hành để nhận mã kích hoạt phù hợp với thiết bị của bạn.'
    }
  ];

  releaseUpdates: ReleaseUpdate[] = [];

  faqs: FaqItem[] = [
    {
      question: 'Phần mềm LumiBooth tương thích với những dòng máy ảnh nào?',
      answer: 'LumiBooth hỗ trợ hầu hết các dòng máy ảnh Canon EOS DSLR & Mirrorless phổ biến hiện nay (như Canon 60D, 70D, 80D, 90D, 5D Mark III/IV, Canon EOS R, RP, R5, R6, R10, R50, M50...) thông qua kết nối USB với Canon EDSDK chính hãng.',
      isOpen: true
    },
    {
      question: 'Cấu hình máy tính tối thiểu để vận hành mượt mà là gì?',
      answer: 'Cấu hình tối thiểu đề xuất: Hệ điều hành Windows 10/11 64-bit, CPU Intel Core i5 thế hệ 8 trở lên (hoặc AMD Ryzen 5 tương đương), RAM tối thiểu 8GB (khuyến nghị 16GB), ổ cứng SSD trống tối thiểu 20GB và màn hình độ phân giải Full HD (1920x1080) có cảm ứng.',
      isOpen: false
    },
    {
      question: 'LumiBooth có hỗ trợ in ảnh 2 dải strip (2x6 inch) không?',
      answer: 'Có! Phần mềm tự động chia và nhân đôi layout cho dải ảnh 2x6 inch hoặc ghép in khổ 4x6 inch (10x15cm). Hệ thống tương thích hoàn hảo với các dòng máy in nhiệt sự kiện cao cấp như DNP DS-RX1HS, DNP DS620, Citizen CY-02, Hiti P525L...',
      isOpen: false
    },
    {
      question: 'Nếu sự kiện mất mạng Internet thì khách có thể chụp và in ảnh được không?',
      answer: 'Hoàn toàn được. LumiBooth hoạt động độc lập không phụ thuộc vào Internet. Ảnh vẫn được chụp, ghép khung và in tự động bình thường. Tất cả dữ liệu sẽ được lưu trong hàng đợi và tự động đồng bộ lên Cloud Gallery ngay khi có mạng trở lại.',
      isOpen: false
    }
  ];

  ngOnInit(): void {
    void this.loadPublishedRelease();
  }

  async loadPublishedRelease(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<PublicReleaseResponse>(
        `${environment.softwareReleaseApiUrl}/download/latest/metadata`
      ));
      if (!response.ok || !response.release) throw new Error('No published release');

      this.currentVersion.set(`v${response.release.version}`);
      this.releaseDate.set(this.formatDate(response.release.publishedAt));
      this.fileSize.set(response.installer.size == null ? '222 MB' : this.formatBytes(response.installer.size));
      this.installerUrl = '/api/download-software';
      this.installerAvailable.set(true);
      this.releaseUpdates = [{
        version: `v${response.release.version}`,
        releaseDate: this.formatDate(response.release.publishedAt),
        isLatest: true,
        tagText: 'Bản mới nhất',
        summary: response.release.notes?.trim() || 'Thông tin phát hành đang được cập nhật.',
        downloadSize: response.installer.size == null ? '222 MB' : this.formatBytes(response.installer.size),
        changes: []
      }];
    } catch {
      this.currentVersion.set('v2.4.0');
      this.releaseDate.set('05/09/2026');
      this.fileSize.set('222 MB');
      this.installerUrl = '/api/download-software';
      this.installerAvailable.set(true);
    }
  }

  triggerDownload(): void {
    this.downloadToastMessage.set('Đang mở trang tải ở tab mới... Vui lòng bấm "Vẫn tải xuống" trên màn hình Google Drive để tải file về máy.');
    setTimeout(() => {
      this.downloadToastMessage.set(null);
    }, 6000);
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(date);
  }

  private formatBytes(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  toggleFaq(index: number) {
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }

  scrollToSection(sectionId: string) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
