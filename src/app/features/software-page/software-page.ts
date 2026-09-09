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

  readonly currentVersion = signal('v1.0.6');
  readonly releaseDate = signal('09/09/2026');
  readonly fileSize = signal('550.0 MB');
  readonly platform = 'Windows 10 / 11 (64-bit)';
  readonly installerAvailable = signal(true);
  readonly downloadUrl = environment.softwareDownloadUrl;

  downloadToastMessage = signal<string | null>(null);

  features: SoftwareFeature[] = [
    {
      icon: 'camera',
      title: 'Live View Đa Dòng Máy Ảnh Siêu Nét',
      description: 'Hỗ trợ máy ảnh Canon DSLR/Mirrorless, Sony Alpha (CrSDK), Nikon và Fujifilm qua USB với tốc độ 60 FPS, độ trễ dưới 30ms. Plug & Play nhận ngay không cần driver ngoài.',
      badge: 'Plug & Play'
    },
    {
      icon: 'sparkles',
      title: 'AI Face Beauty & Làm Đẹp Tự Nhiên',
      description: 'Nhận diện 468 điểm khuôn mặt với AI: Làm mịn da giữ nguyên vân da tự nhiên (Pore-preserving), xóa mụn thâm, làm trắng răng và sáng mắt tinh tế.',
      badge: 'AI Retouch'
    },
    {
      icon: 'remote',
      title: 'Điều Khiển Từ Xa Bằng Điện Thoại (Web Remote)',
      description: 'Quản trị viên dễ dàng bấm chụp, chụp lại, chuyển chế độ và duyệt chuyển khoản ngân hàng 1 chạm từ smartphone qua mạng LAN không cần chạm màn hình Kiosk.',
      badge: 'Web Remote'
    },
    {
      icon: 'palette',
      title: 'Bộ Lọc Màu 3D LUT & Ảnh Thẻ Studio',
      description: 'Xem trước thời gian thực hàng chục tone màu điện ảnh (Hàn Quốc, Vintage, Film...) và tích hợp module chụp ảnh thẻ chuẩn quốc tế với AI tách nền.',
      badge: '3D LUT & ID'
    },
    {
      icon: 'screen',
      title: 'Thiết Kế Khung & Màn Hình Trực Quan',
      description: 'Hỗ trợ Frame Designer & Screen Designer kéo thả trực quan. Tuỳ biến countdown, sticker, chữ ký số và logo sự kiện dễ dàng theo mọi tỉ lệ (16:9, 9:16, 1:1).',
      badge: 'WYSIWYG'
    },
    {
      icon: 'printer',
      title: 'In Ảnh Siêu Tốc & Tự Động Ghép Khổ',
      description: 'Tự động cắt dải photo strip 2x6 inch hoặc in ảnh 4x6 (10x15cm) sắc nét chỉ trong 8-12 giây với máy in nhiệt DNP, Citizen, Hiti.',
      badge: 'Auto Print'
    },
    {
      icon: 'qr',
      title: 'QR Code & Cloud Gallery Tức Thì',
      description: 'Khách mời quét mã QR hiển thị trên màn hình để tải ngay ảnh gốc độ phân giải cao, file in và clip Boomerang / GIF về điện thoại không chạm.',
      badge: 'Instant QR'
    },
    {
      icon: 'shield',
      title: 'Kiosk Mode & Bảo Mật Mạng LAN',
      description: 'Chế độ khoá toàn màn hình (Kiosk Mode) bảo mật chống thoát ứng dụng. Cài đặt được bảo vệ bằng mã PIN và khoá phân quyền truy cập nội bộ an toàn.',
      badge: 'Security'
    },
    {
      icon: 'sync',
      title: 'Vận Hành Offline & Đồng Bộ Tự Động',
      description: 'Hoạt động 100% độc lập không cần Internet. Khi có mạng trở lại, toàn bộ ảnh, file in và lịch sử sự kiện sẽ tự động đồng bộ lên đám mây.',
      badge: 'Offline First'
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
      title: 'Kết nối Máy Ảnh & Cài Driver Máy In',
      description: 'Cắm cáp USB máy ảnh (Canon, Sony, Nikon, Fuji) vào máy tính — LumiBooth đã tích hợp sẵn bộ SDK điều khiển chính hãng, tự nhận diện ngay mà không cần cài thêm Canon EOS Utility. Đối với máy in nhiệt sự kiện (DNP, Citizen, Hiti...), hãy cài đặt driver chính hãng của máy in trên Windows.',
      note: 'Lưu ý: Tuyệt đối không mở Canon EOS Utility khi chạy LumiBooth để tránh xung đột cổng USB.'
    },
    {
      step: '04',
      title: 'Kích hoạt License & Vận hành',
      description: 'Mở biểu tượng LumiBooth ngoài màn hình Desktop. Đăng nhập hoặc kích hoạt License Key để bắt đầu setup sự kiện ngay lập tức.',
      note: 'Liên hệ bộ phận vận hành để nhận mã kích hoạt phù hợp với thiết bị của bạn.'
    }
  ];

  releaseUpdates: ReleaseUpdate[] = [
    {
      version: 'v1.0.6',
      releaseDate: '09/09/2026',
      isLatest: true,
      tagText: 'Bản mới nhất',
      summary: 'Cải thiện kết nối máy ảnh, Live View và trải nghiệm xử lý ảnh.',
      downloadSize: '550.0 MB',
      changes: [
        { category: 'improved', label: 'Máy ảnh', text: 'Cải thiện khả năng kết nối và chuyển đổi giữa các dòng máy ảnh được hỗ trợ.' },
        { category: 'improved', label: 'Live View', text: 'Cải thiện tốc độ hiển thị và độ ổn định trong quá trình chụp.' },
        { category: 'improved', label: 'Ảnh đầu ra', text: 'Tinh chỉnh màu sắc, làm đẹp và lưu ảnh để trải nghiệm sử dụng tự nhiên hơn.' }
      ]
    }
  ];

  faqs: FaqItem[] = [
    {
      question: 'Phần mềm LumiBooth tương thích với những dòng máy ảnh nào và có cần cài driver không?',
      answer: 'LumiBooth hỗ trợ hầu hết các dòng máy ảnh Canon EOS DSLR / Mirrorless, Sony Alpha (CrSDK), Nikon và Fujifilm qua kết nối USB. Toàn bộ SDK điều khiển chính hãng đã được đóng gói sẵn trong LumiBooth (Plug & Play), bạn chỉ cần cắm cáp USB vào máy tính là phần mềm tự động nhận diện. Tuyệt đối không cài đặt hoặc mở phần mềm Canon EOS Utility để tránh chiếm dụng và xung đột cổng USB.',
      isOpen: true
    },
    {
      question: 'Tính năng Điều khiển từ xa (Web Remote) qua điện thoại hoạt động như thế nào?',
      answer: 'Chỉ cần điện thoại hoặc máy tính bảng kết nối chung mạng Wi-Fi/mạng LAN với máy tính Photobooth, nhân viên sự kiện có thể truy cập giao diện Web Remote (được bảo vệ bằng mã PIN) để bấm chụp, chụp lại, đổi chế độ và duyệt xác nhận chuyển khoản ngân hàng 1 chạm từ xa mà không cần thao tác trực tiếp trên màn hình Kiosk.',
      isOpen: false
    },
    {
      question: 'Chức năng Làm đẹp khuôn mặt (AI Beauty) và Bộ lọc màu có gì đặc biệt?',
      answer: 'LumiBooth ứng dụng AI nhận diện 468 điểm mốc trên khuôn mặt với thuật toán làm mịn da thông minh giữ nguyên vân da tự nhiên (Pore-preserving - không bị bệt da hay giả tạo), xóa mụn thâm, làm trắng răng và làm sáng mắt. Ngoài ra, phần mềm hỗ trợ hàng chục bộ lọc màu điện ảnh 3D LUT (Tone Hàn Quốc, Vintage, Film...) xem trước trực tiếp trên Live View và tính năng chụp ảnh thẻ (ID Photo) với AI tách nền chuẩn studio.',
      isOpen: false
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
      answer: 'Hoàn toàn được. LumiBooth hoạt động độc lập không phụ thuộc vào Internet. Ảnh vẫn được chụp, làm đẹp AI, ghép khung và in tự động bình thường. Tất cả dữ liệu sẽ được lưu trong hàng đợi an toàn và tự động đồng bộ lên Cloud Gallery ngay khi có mạng trở lại.',
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
      this.fileSize.set(response.installer.size == null ? '170.6 MB' : this.formatBytes(response.installer.size));
      this.installerAvailable.set(true);

      if (response.release.version === '1.0.6' && this.releaseUpdates.length > 0) {
        this.releaseUpdates[0].releaseDate = this.formatDate(response.release.publishedAt);
        this.releaseUpdates[0].summary = response.release.notes?.trim() || this.releaseUpdates[0].summary;
        this.releaseUpdates[0].downloadSize = response.installer.size == null ? '170.6 MB' : this.formatBytes(response.installer.size);
      } else {
        this.releaseUpdates = [{
          version: `v${response.release.version}`,
          releaseDate: this.formatDate(response.release.publishedAt),
          isLatest: true,
          tagText: 'Bản mới nhất',
          summary: response.release.notes?.trim() || 'Thông tin phát hành đang được cập nhật.',
          downloadSize: response.installer.size == null ? '170.6 MB' : this.formatBytes(response.installer.size),
          changes: []
        }];
      }
    } catch {
      this.currentVersion.set('v1.0.6');
      this.releaseDate.set('09/09/2026');
      this.fileSize.set('550.0 MB');
      this.installerAvailable.set(true);
    }
  }

  triggerDownload(): void {
    this.downloadToastMessage.set('Đang mở trang tải bản mới nhất ở tab mới...');
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
