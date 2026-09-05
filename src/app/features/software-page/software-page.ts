import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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

@Component({
  selector: 'app-software-page',
  imports: [CommonModule, RouterModule],
  templateUrl: './software-page.html',
  styleUrl: './software-page.scss',
})
export class SoftwarePage {
  readonly currentVersion = 'v2.4.0';
  readonly releaseDate = '05/09/2026';
  readonly fileSize = '142 MB';
  readonly platform = 'Windows 10 / 11 (64-bit)';
  readonly downloadLink = '#download-section'; // Can be replaced with actual download URL (e.g. Google Drive / S3)

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
      description: 'Nhấp vào nút "Tải Bản Cài Đặt (64-bit)" ở đầu trang để tải file cài đặt LumiBooth_Setup_v2.4.0.exe về máy tính của bạn.',
      note: 'Dung lượng ~142 MB, hãy đảm bảo đường truyền ổn định.'
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
      note: 'Bộ driver thông dụng đã được đóng gói sẵn trong thư mục Drivers của phần mềm.'
    },
    {
      step: '04',
      title: 'Kích hoạt License & Vận hành',
      description: 'Mở biểu tượng LumiBooth ngoài màn hình Desktop. Đăng nhập hoặc kích hoạt License Key để bắt đầu setup sự kiện ngay lập tức.',
      note: 'Tặng kèm 14 ngày dùng thử đầy đủ tính năng cho người dùng mới.'
    }
  ];

  releaseUpdates: ReleaseUpdate[] = [
    {
      version: 'v2.4.0',
      releaseDate: '05/09/2026',
      isLatest: true,
      tagText: 'Bản Mới Nhất',
      summary: 'Phiên bản đột phá bổ sung hỗ trợ responsive toàn diện cho mọi tỉ lệ màn hình Kiosk, tích hợp Screen Designer trực quan và tối ưu hoá luồng Live View Canon.',
      downloadSize: '142 MB',
      changes: [
        {
          category: 'new',
          label: 'Tính năng mới',
          text: 'Tích hợp bộ điều chỉnh tỉ lệ khung hình Kiosk đa dạng: 16:9 ngang (1920x1080), 9:16 dọc (1080x1920) và 1:1 vuông (800x800).'
        },
        {
          category: 'new',
          label: 'Tính năng mới',
          text: 'Trình biên tập màn hình Screen Designer thời gian thực, cho phép tuỳ chỉnh vị trí camera countdown, icon và giao diện chào mừng.'
        },
        {
          category: 'improved',
          label: 'Cải tiến',
          text: 'Giảm thiểu độ trễ Live View Canon DSLR/Mirrorless xuống dưới 30ms, tối ưu tốc độ render khung ảnh 4K song song.'
        },
        {
          category: 'improved',
          label: 'Cải tiến',
          text: 'Nâng cấp hệ thống bảo mật Kiosk với tính năng xác thực mã PIN bảo vệ trang cài đặt cấu hình.'
        },
        {
          category: 'fixed',
          label: 'Sửa lỗi',
          text: 'Khắc phục sự cố không nhận máy in nhiệt DNP khi rút cáp USB đột ngột; tự động tái kết nối mà không cần khởi động lại phần mềm.'
        },
        {
          category: 'fixed',
          label: 'Sửa lỗi',
          text: 'Sửa lỗi sinh mã QR Code khi sự kiện hoạt động ở chế độ Offline (mạng nội bộ không có kết nối Internet quốc tế).'
        }
      ]
    },
    {
      version: 'v2.3.5',
      releaseDate: '15/08/2026',
      tagText: 'Ổn Định',
      summary: 'Bổ sung tính năng quay Boomerang & Video GIF ngắn kèm hiệu ứng nhạc nền, nâng cấp giao diện người dùng Pearl Luxury sang trọng.',
      downloadSize: '138 MB',
      changes: [
        {
          category: 'new',
          label: 'Tính năng mới',
          text: 'Hỗ trợ quay clip Boomerang 3 giây và Video ngắn kèm watermark sự kiện động.'
        },
        {
          category: 'improved',
          label: 'Cải tiến',
          text: 'Giao diện phong cách Modern Pearl Luxury với hiệu ứng chuyển động mượt mà, thân thiện với màn hình cảm ứng.'
        },
        {
          category: 'improved',
          label: 'Cải tiến',
          text: 'Tự động giải phóng bộ nhớ đệm (cache) sau mỗi lượt chụp, giúp máy hoạt động liên tục 24/7 không bị giật lag.'
        },
        {
          category: 'fixed',
          label: 'Sửa lỗi',
          text: 'Xử lý lỗi lệch màu sắc khi in ảnh bằng máy in Citizen CX-02.'
        }
      ]
    },
    {
      version: 'v2.2.0',
      releaseDate: '20/07/2026',
      tagText: 'Ổn Định',
      summary: 'Nâng cấp hệ thống quản lý sự kiện offline và đồng bộ hàng đợi Cloud Sync khi có mạng trở lại.',
      downloadSize: '135 MB',
      changes: [
        {
          category: 'new',
          label: 'Tính năng mới',
          text: 'Cơ chế lưu trữ hàng đợi ngoại tuyến (Offline Queue), tự động tải ảnh lên Cloud Gallery khi thiết bị kết nối lại Wi-Fi.'
        },
        {
          category: 'improved',
          label: 'Cải tiến',
          text: 'Bổ sung thống kê số lượt chụp, số bản in và tỷ lệ chia sẻ mã QR theo thời gian thực.'
        },
        {
          category: 'fixed',
          label: 'Sửa lỗi',
          text: 'Sửa lỗi treo ứng dụng khi máy ảnh Canon cạn pin giữa chừng.'
        }
      ]
    }
  ];

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

  triggerDownload() {
    this.downloadToastMessage.set('Đang chuẩn bị gói cài đặt LumiBooth v2.4.0 (Windows 64-bit)...');
    setTimeout(() => {
      this.downloadToastMessage.set(null);
    }, 4500);
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
