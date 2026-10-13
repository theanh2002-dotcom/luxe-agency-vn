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

interface TechLimitationItem {
  name: string;
  detail: string;
}

interface TechLimitation {
  icon: string;
  category: string;
  title: string;
  level: 'critical' | 'warning' | 'info';
  levelLabel: string;
  description: string;
  items: TechLimitationItem[];
  recommendation: string;
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

  readonly currentVersion = signal('v1.0.15');
  readonly releaseDate = signal('14/10/2026');
  readonly fileSize = signal('845.6 MB');
  readonly platform = 'Windows 10 / 11 (64-bit)';
  readonly installerAvailable = signal(true);
  readonly downloadUrl = 'https://drive.usercontent.google.com/download?id=1JF9hX5l3z_S-V3-5cLrOczoqrfmJc_Yi&export=download&confirm=t';
  readonly googleDriveUrl = 'https://drive.google.com/file/d/1JF9hX5l3z_S-V3-5cLrOczoqrfmJc_Yi/view?usp=sharing';
  readonly googleDriveZipUrl = 'https://drive.google.com/file/d/1JF9hX5l3z_S-V3-5cLrOczoqrfmJc_Yi/view?usp=sharing';
  readonly googleDriveFolderUrl = 'https://drive.google.com/drive/folders/12kUOKaVUdW9Bg3cdioG2PLshN5UhDHkD?usp=sharing';

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
      description: 'Nhận diện 468 điểm khuôn mặt với AI: Làm mịn da giữ nguyên vân da tự nhiên (Pore-preserving), xóa mụn thâm, làm trắng sáng răng khi cười, khử quầng thâm mắt và bóp cằm thon gọn tự nhiên.',
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
      title: 'Tải bộ cài đặt Pica Photobox',
      description: 'Nhấp vào nút "Tải Bản Cài Đặt (Windows 64-bit)" ở đầu trang để tải bộ cài Pica Photobox về máy tính của bạn.',
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
      description: 'Cắm cáp USB máy ảnh (Canon, Sony, Nikon, Fuji) vào máy tính — Pica Photobox đã tích hợp sẵn bộ SDK điều khiển chính hãng, tự nhận diện ngay mà không cần cài thêm Canon EOS Utility. Đối với máy in nhiệt sự kiện (DNP, Citizen, Hiti...), hãy cài đặt driver chính hãng của máy in trên Windows.',
      note: 'Lưu ý: Tuyệt đối không mở Canon EOS Utility khi chạy Pica Photobox để tránh xung đột cổng USB.'
    },
    {
      step: '04',
      title: 'Kích hoạt License & Vận hành',
      description: 'Mở biểu tượng Pica Photobox ngoài màn hình Desktop. Đăng nhập hoặc kích hoạt License Key để bắt đầu setup sự kiện ngay lập tức.',
      note: 'Liên hệ bộ phận vận hành để nhận mã kích hoạt phù hợp với thiết bị của bạn.'
    }
  ];

  techLimitations: TechLimitation[] = [
    {
      icon: 'lock',
      category: 'Xung Đột Ứng Dụng Hãng',
      title: 'Ứng Dụng Độc Quyền Của Hãng Máy Ảnh',
      level: 'critical',
      levelLabel: 'Bắt buộc tuân thủ',
      description: 'Pica Photobox đã tích hợp sẵn trọn bộ SDK điều khiển chính hãng (Canon EDSDK, Sony CrSDK...). Các ứng dụng quản lý máy ảnh của hãng sẽ chiếm độc quyền cổng kết nối USB (Exclusive Device Lock), gây lỗi rớt Live View hoặc từ chối bấm chụp.',
      items: [
        {
          name: 'Canon EOS Utility / EOS Webcam Utility',
          detail: 'Tuyệt đối tắt hoàn toàn (kể cả icon ở khay hệ thống Taskbar) trước khi khởi động Pica Photobox.'
        },
        {
          name: 'Sony Imaging Edge / Remote / Webcam',
          detail: 'Đóng mọi ứng dụng nền của Sony để nhường quyền điều khiển trực tiếp cho Sony CrSDK native.'
        },
        {
          name: 'Nikon Camera Control Pro / Nikon Webcam',
          detail: 'Tắt toàn bộ tiến trình điều khiển hoặc truyền file ngầm của Nikon đang mở trên Windows.'
        }
      ],
      recommendation: 'Khuyến nghị: Kiểm tra khay hệ thống (System Tray góc dưới phải Windows) để đảm bảo không có tiện ích máy ảnh nào chạy ngầm trước khi mở quầy Photobooth.'
    },
    {
      icon: 'cable',
      category: 'Băng Thông Cổng USB',
      title: 'Cổng Cắm USB & Cáp Kết Nối Máy Ảnh',
      level: 'critical',
      levelLabel: 'Phần cứng & Cáp nối',
      description: 'Luồng Live View 60 FPS độ trễ dưới 30ms kết hợp truyền tải tức thì ảnh gốc 24MP - 33MP đòi hỏi băng thông USB phải ổn định tuyệt đối và không bị chia sẻ chập chờn.',
      items: [
        {
          name: 'Cắm trực tiếp bo mạch chủ (Motherboard)',
          detail: 'Cắm cáp máy ảnh vào cổng USB 3.0 (màu xanh dương) ở mặt sau case PC hoặc cổng độc lập trên Mini PC/Laptop.'
        },
        {
          name: 'Tránh dùng USB Hub không nguồn phụ',
          detail: 'Không cắm máy ảnh chung USB Hub thụ động với máy in nhiệt hoặc màn hình cảm ứng để tránh sụt điện áp và nghẽn gói tin khi máy in hoạt động.'
        },
        {
          name: 'Tiêu chuẩn cáp USB Tethering',
          detail: 'Dùng cáp chuẩn USB 3.0 chống nhiễu có cục lọc từ ferrite core, chiều dài tối ưu dưới 3 mét. Nếu cần kéo dài trên 5 mét, bắt buộc dùng cáp Active USB hoặc cáp quang có cấp nguồn phụ.'
        }
      ],
      recommendation: 'Khuyến nghị: Dành riêng 1 cổng USB 3.0 độc lập cho máy ảnh và 1 cổng riêng cho máy in nhiệt để đạt hiệu suất 0ms giật lag.'
    },
    {
      icon: 'camera-setting',
      category: 'Cài Đặt Máy Ảnh',
      title: 'Chế Độ Phơi Sáng & Nguồn Điện Máy Ảnh',
      level: 'warning',
      levelLabel: 'Cài đặt vận hành',
      description: 'Đảm bảo độ sáng và tone màu của toàn bộ ảnh chụp trong sự kiện đồng đều 100%, đồng thời triệt tiêu rủi ro máy ảnh tự tắt nguồn giữa chừng.',
      items: [
        {
          name: 'Khóa chế độ Manual (M) & Tắt Auto ISO',
          detail: 'Chuyển vòng xoay chế độ máy sang M. Cố định khẩu độ (f/4 - f/8), tốc độ chụp (1/125s - 1/200s) và ISO cố định (100 - 400). Tuyệt đối không bật Auto ISO để tránh ảnh bị chớp sáng sai lệch khi đánh flash.'
        },
        {
          name: 'Chế độ lấy nét AF-Servo / AI Focus',
          detail: 'Thiết lập chế độ lấy nét tự động nhận diện khuôn mặt/mắt (Face/Eye Detection) để hệ thống bắt nét chuẩn xác vào khách chụp.'
        },
        {
          name: 'Tắt chế độ tự động tắt nguồn (Auto Sleep)',
          detail: 'Vào Menu máy ảnh -> Cài đặt nguồn (Power Management) -> Đặt Auto Power Off thành Disable / Never.'
        },
        {
          name: 'Sử dụng bộ nguồn cắm điện (Dummy Battery)',
          detail: 'Sử dụng adapter nguồn cắm điện trực tiếp (DC Coupler / Dummy Battery hoặc Type-C PD) thay vì pin máy ảnh để đảm bảo máy hoạt động liên tục 8-12 tiếng không lo chai pin hay sụt áp.'
        }
      ],
      recommendation: 'Khuyến nghị: Luôn chuẩn bị sẵn 1 bộ Dummy Battery dự phòng và kiểm tra vòng xoay chế độ máy ảnh ở vị trí M trước giờ đón khách.'
    },
    {
      icon: 'printer-gear',
      category: 'Máy In Nhiệt Sự Kiện',
      title: 'Cấu Hình Driver Máy In & Khổ Giấy Windows',
      level: 'warning',
      levelLabel: 'In ấn tự động',
      description: 'Phần mềm tương thích hoàn hảo với các dòng máy in nhiệt DNP DS-RX1HS, DS620, Citizen CY-02, Hiti P525L... Hệ thống in tự động gửi lệnh thông qua Windows Print Spooler.',
      items: [
        {
          name: 'Cài đặt Driver Windows chính hãng',
          detail: 'Cài đặt bản driver mới nhất từ trang chủ DNP, Citizen hoặc Hiti dành cho Windows 10/11 64-bit trước khi kết nối.'
        },
        {
          name: 'Thiết lập khổ giấy mặc định sẵn (Printing Preferences)',
          detail: 'Vào Control Panel -> Devices and Printers -> Click chuột phải máy in -> Printing Preferences: Chọn khổ giấy mặc định là 4x6 inch (10x15cm) hoặc kích hoạt chế độ cắt 2 dải (2-inch cut) nếu in photo strip.'
        },
        {
          name: 'Tránh ngắt nguồn đột ngột khi đang in',
          detail: 'Không rút cáp USB hoặc tắt công tắc nguồn khi máy in đang cuốn giấy. Pica Photobox tích hợp sẵn công cụ Clear Print Queue 1-chạm nếu phát hiện kẹt hàng đợi từ Windows.'
        }
      ],
      recommendation: 'Khuyến nghị: Chạy tính năng "In Trang Thử Nghiệm" trong phần Cài đặt của Pica Photobox để xác nhận máy in đã sẵn sàng và khổ giấy đúng chuẩn.'
    },
    {
      icon: 'wifi-router',
      category: 'Mạng Không Dây',
      title: 'Mạng LAN Nội Bộ & Web Remote Trên Smartphone',
      level: 'info',
      levelLabel: 'Mạng LAN không dây',
      description: 'Tính năng Web Remote cho phép quản trị viên bấm chụp, chọn chụp lại và duyệt chuyển khoản ngân hàng 1 chạm ngay trên điện thoại thông qua mạng Wi-Fi/LAN.',
      items: [
        {
          name: 'Kết nối chung mạng nội bộ (LAN / Wi-Fi)',
          detail: 'Điện thoại quản trị và máy tính Photobooth bắt buộc phải kết nối vào cùng 1 mạng Wi-Fi hoặc cùng switch mạng LAN.'
        },
        {
          name: 'Không bật AP Isolation (Client Isolation)',
          detail: 'Router Wi-Fi tại địa điểm sự kiện không được bật tính năng AP Isolation hoặc mạng khách (Guest Wi-Fi), vì chế độ này chặn các thiết bị nội bộ giao tiếp với nhau.'
        },
        {
          name: 'Giải pháp Mobile Hotspot khi không có Wi-Fi',
          detail: 'Nếu sự kiện ngoài trời hoặc Wi-Fi hội trường bị chặn cổng, bạn chỉ cần bật Mobile Hotspot trên máy tính Windows (hoặc phát từ điện thoại), kết nối các máy lại là có thể điều khiển mượt mà không cần Internet.'
        }
      ],
      recommendation: 'Khuyến nghị: Trang bị một bộ phát Wi-Fi bỏ túi (Pocket Router) phát riêng cho quầy Photobooth để đường truyền độc lập, tốc độ phản hồi dưới 10ms.'
    },
    {
      icon: 'cpu-chip',
      category: 'Cấu Hình Hệ Thống',
      title: 'Yêu Cầu Hệ Điều Hành & Cấu Hình Phần Cứng',
      level: 'info',
      levelLabel: 'Cấu hình đề xuất',
      description: 'Để bộ xử lý AI Face Beauty 468 điểm và thuật toán làm đẹp vân da tự nhiên chạy mượt mà theo thời gian thực kết hợp render khung ảnh 4K sắc nét.',
      items: [
        {
          name: 'Hệ điều hành Windows 10/11 (64-bit)',
          detail: 'Chỉ hỗ trợ hệ điều hành Windows 10 hoặc Windows 11 bản 64-bit. Không hỗ trợ Windows 7/8, Windows 32-bit hay macOS.'
        },
        {
          name: 'Bộ vi xử lý (CPU)',
          detail: 'Tối thiểu Intel Core i5 thế hệ 8 trở lên hoặc AMD Ryzen 5 thế hệ 3 trở lên (khuyến nghị 6 nhân 12 luồng) để xử lý đa luồng AI và Live View song song.'
        },
        {
          name: 'Bộ nhớ RAM & Ổ cứng',
          detail: 'Tối thiểu 8GB RAM (khuyến nghị 16GB RAM để xử lý hàng loạt ảnh độ phân giải cao). Ổ cứng SSD còn trống ít nhất 20GB cho dữ liệu sự kiện.'
        },
        {
          name: 'Card đồ họa (GPU)',
          detail: 'Hỗ trợ card onboard Intel UHD Graphics 630 trở lên hoặc card đồ họa rời NVIDIA GeForce GTX để tăng tốc phần cứng DirectX/GPU.'
        }
      ],
      recommendation: 'Khuyến nghị: Bộ máy Mini PC nhỏ gọn (Intel NUC hoặc Minisforum Ryzen) kết hợp màn hình cảm ứng Full HD là giải pháp tối ưu cho booth chụp di động.'
    }
  ];

  releaseUpdates: ReleaseUpdate[] = [
    {
      version: 'v1.0.15',
      releaseDate: '14/10/2026',
      isLatest: true,
      tagText: 'Bản mới nhất',
      summary: 'Đột phá tối ưu hóa tốc độ Live View với bộ giải mã libjpeg-turbo SIMD AVX2 thuần túy (<1ms, 0 heap allocation), nâng cấp bộ nướng màu Direct 24-bit Flat Pointer LUT (<0.8ms, triệt tiêu banding), GPU Bicubic Scaling sắc nét, cùng hệ thống Chính sách Làm đẹp Chân dung AI mặc định theo sự kiện (Event Beauty Policy) và 10 thanh trượt tinh chỉnh chuyên sâu.',
      downloadSize: '845.6 MB',
      changes: [
        { category: 'improved', label: 'Giải mã Live View siêu tốc với libjpeg-turbo SIMD AVX2/SSE2', text: 'Chuyển đổi toàn diện sang thư viện libjpeg-turbo chuẩn công nghiệp x86/AVX2/SSE2, giải mã trực tiếp JPEG sang con trỏ BGRA32 chỉ tốn ~1.0ms (nhanh gấp 5 lần WIC của Windows), tiết kiệm 80% tải CPU và 0 byte cấp phát rác trên GC Heap.' },
        { category: 'improved', label: 'Bộ nướng màu thời gian thực Direct 24-bit Pointer LUT', text: 'Prebake bảng tra phẳng 16.7 triệu màu bằng thuật toán nội suy trilinear 3D và duyệt con trỏ không rẽ nhánh (branchless 8-way unroll), nướng màu Live View đạt tốc độ kỷ lục <0.8ms (>1000 FPS), loại bỏ 100% hiện tượng Color Banding và Posterization.' },
        { category: 'improved', label: 'GPU Bicubic Filtering khử răng cưa & nén JPEG', text: 'Nâng cấp chế độ hiển thị Live View trên DirectX sang GPU Bicubic (HighQuality), làm mịn các khối nén JPEG và khử răng cưa viền, cho chất lượng ngắm Live View nét căng mịn màng trên màn hình 2K/4K.' },
        { category: 'new', label: 'Chính sách Làm đẹp Chân dung AI theo sự kiện (Event Beauty Policy)', text: 'Cho phép quản trị viên cấu hình chế độ làm đẹp mặc định cho từng sự kiện (Khách tự do chọn, Khóa cố định Studio hoặc Tắt làm đẹp), tinh chỉnh sẵn 10 thông số cho từng mẫu (Tự Nhiên, Mịn Da, Sáng Hồng, AI Glam) và tự động áp dụng ngay khi chụp xong mà không gây nặng luồng Live View.' },
        { category: 'improved', label: '10 Thanh chỉnh sửa chi tiết Làm đẹp tại Kiosk (Fine Adjustment Sliders)', text: 'Hiển thị đầy đủ 10 công cụ làm đẹp chuyên sâu (Mịn da, Sáng da, Thon mặt, Son môi, Má hồng, Sáng mắt, Chân mày, Tông da, Chi tiết, Nét AI) kèm thanh trượt phần trăm độc lập trên màn hình Xem lại & Chỉnh sửa khi bật quyền cho phép khách tự tinh chỉnh.' },
        { category: 'fixed', label: 'Chuẩn hóa Khung căn ảnh Live View (Crop Guide Reset)', text: 'Tự động làm mới trạng thái khung căn ảnh khi bắt đầu phiên chụp mới chưa chọn khung, khắc phục triệt để hiện tượng lưu giữ khung căn của phiên chụp trước.' }
      ]
    },
    {
      version: 'v1.0.14',
      releaseDate: '12/10/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Đột phá tối ưu hóa luồng lấy nét và chớp màn trập (Studio AF Capture Pipeline): Lấy nét 4 bước Native EDSDK êm ái, xóa bỏ hoàn toàn hiện tượng khựng giật Live View, cơ chế cứu hộ AF thông minh (Auto AF Fallback) chống lỗi khóa màn trập 65539, và công nghệ xem lại ảnh GPU tức thì không độ trễ.',
      downloadSize: '844.7 MB',
      changes: [
        { category: 'improved', label: 'Chuẩn hóa luồng lấy nét 4 bước chuyên nghiệp (Studio AF Pipeline)', text: 'Thực hiện lấy nét chủ động trước khi chớp màn trập 1 giây với 4 bước chuẩn xác (Press Halfway -> Lắng nghe tín hiệu khóa nét -> Release Halfway -> Chớp màn trập Full Press), giúp ảnh nét căng từng sợi tóc mà không làm giật khựng Live View.' },
        { category: 'fixed', label: 'Cơ chế cứu hộ lấy nét thông minh (AF Fallback EDS_ERR_DEVICE_BUSY 65539)', text: 'Tự động bắt lỗi và fallback an toàn khi máy ảnh gặp môi trường ánh sáng phức tạp hoặc đối tượng di chuyển bất ngờ, ngăn chặn triệt để lỗi treo cứng màn trập 65539 của Canon EDSDK.' },
        { category: 'improved', label: 'Tách biệt luồng Live View 60 FPS và màn trập', text: 'Tách biệt hoàn toàn luồng truyền hình ảnh ngắm Live View và luồng điều khiển lấy nét màn trập, đảm bảo khung hình khách hàng ngắm trên màn hình luôn mượt mà trong suốt quá trình đếm ngược.' },
        { category: 'new', label: 'Công nghệ xem lại ảnh GPU tức thì (Zero-latency Quick Review)', text: 'Tự động nạp trước và hiển thị tức thì ảnh vừa chụp thông qua bộ giải mã phần cứng GPU trong khi background worker âm thầm đồng bộ và lưu trữ file RAW/JPEG gốc.' },
        { category: 'improved', label: 'Thanh thời gian chờ chuyển màn hình chia sẻ (Auto-Transition Timer)', text: 'Cải tiến thanh trượt đếm ngược thông minh tại màn hình xem lại và chia sẻ, khóa chuyển màn hình trong 3 giây đầu để khách hàng ngắm trọn vẹn ảnh thành phẩm trước khi cho phép chuyển về màn hình chính.' }
      ]
    },
    {
      version: 'v1.0.13',
      releaseDate: '11/10/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Tối ưu luồng hiển thị Live View mượt mà tự nhiên khử nhiễu khối JPEG, nâng cấp đồng bộ điều khiển từ xa Web Remote 2 chiều cho màn xem lại & chia sẻ, hoàn thiện bộ đếm ngược Native dslrBooth (0ms latency) và công cụ thiết kế khung ảnh thông minh 50MB.',
      downloadSize: '844.3 MB',
      changes: [
        { category: 'improved', label: 'Tối ưu Live View mượt mà & Khử nhiễu khối JPEG (Bilinear GPU)', text: 'Chuyển đổi thuật toán nội suy GPU sang Bilinear Filtering trên toàn hệ thống Native Underlay, triệt tiêu viền khối nén JPEG và làm dịu hạt nhiễu cảm biến, mang lại hình ảnh xem trước trong trẻo và êm mắt.' },
        { category: 'new', label: 'Đồng bộ điều khiển từ xa 2 chiều (Web Remote Control)', text: 'Hỗ trợ điều khiển đầy đủ từ xa trên điện thoại: Bấm chụp, chọn chụp lại từng slot ảnh, lật ảnh, duyệt in và kết thúc phiên ngay trên màn hình Xem lại & Chia sẻ mà không cần chạm Kiosk.' },
        { category: 'improved', label: 'Nâng cấp thiết kế khung ảnh (Frame Creator & Designer)', text: 'Nâng giới hạn dung lượng tải ảnh khung lên 50MB, tự động nhận diện và xếp các ô chụp nằm sau lớp ảnh khung, hỗ trợ click chọn xuyên qua vùng trong suốt, sửa lỗi lưu chuẩn DPI chế độ thủ công và thêm nút [+ Tạo mới] thuận tiện.' },
        { category: 'new', label: 'Bộ đếm ngược Native dslrBooth (0ms Latency)', text: 'Chuyển đổi hoàn toàn cơ chế đếm ngược chụp ảnh sang Native WPF render trực tiếp trên GPU, thiết kế huy hiệu tròn đen mờ tối giản chuẩn dslrBooth, số trắng tinh khôi nảy số nhẹ không giật lag.' },
        { category: 'improved', label: 'Khung căn ảnh Live View siêu nét & trong trẻo', text: 'Loại bỏ hoàn toàn hiệu ứng bóng mờ đen (blur shadow) ở 4 góc và viền thừa, viền trắng thanh lịch sắc sảo giúp khách hàng dễ dàng căn chỉnh góc chụp chuẩn xác.' },
        { category: 'improved', label: 'Tối ưu nút bấm Thao tác Camera (LẬT ẢNH)', text: 'Rút gọn nhãn nút bấm thành [LẬT ẢNH] trực quan, hiển thị trạng thái kích hoạt nổi bật giúp khách hàng và nhân viên vận hành dễ dàng thao tác.' },
        { category: 'improved', label: 'Autofocus chủ động & Đồng bộ màn trập', text: 'Kích hoạt lấy nét trước 1 giây cuối của đếm ngược, đảm bảo bắt trọn khoảnh khắc sắc nét tuyệt đối ngay khi màn trập chớp.' }
      ]
    },
    {
      version: 'v1.0.12',
      releaseDate: '07/10/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Đột phá thuật toán AI Face Retouch tự nhiên thế hệ mới: Màu môi đỏ thuần quyến rũ (True Red Lip tint), má hồng ửng tròn tự nhiên hai bên gò má, bảo vệ khối sống mũi 3D và loại bỏ hoàn toàn biến dạng nhọn cằm, tinh chỉnh độ mịn thanh thoát không bị ảo.',
      downloadSize: '835.4 MB',
      changes: [
        { category: 'improved', label: 'Màu môi đỏ thuần tự nhiên (True Red Lip Tint)', text: 'Cân bằng lại sắc tố màu môi đỏ tươi quyến rũ, loại bỏ ánh hồng sen bệt và lem viền, độ mọng nước tự nhiên chuẩn tông son cao cấp.' },
        { category: 'new', label: 'Má hồng ửng tròn tự nhiên (Natural Cheek Blush)', text: 'Thuật toán khuếch tán má hồng tập trung chuẩn xác tại tâm hai gò má, loại bỏ hiện tượng hồng lan cả mặt, tạo vẻ đẹp rạng rỡ tươi tắn.' },
        { category: 'improved', label: 'Bảo vệ khối sống mũi 3D & Chống bẹp khuôn mặt', text: 'Giảm mức độ làm mịn và bù sáng vùng sống mũi để giữ trọn vẹn khối bóng 3D, sống mũi thanh cao sắc nét tự nhiên không bị mờ nhạt.' },
        { category: 'improved', label: 'Loại bỏ biến dạng chóp cằm & Tinh chỉnh độ mịn da', text: 'Triệt tiêu hoàn toàn hiệu ứng kéo nhọn cằm V-line tam giác; điều chỉnh độ mịn da vừa vặn, giữ trọn vẹn lỗ chân lông và vân da thật không bị giả ảo.' },
        { category: 'improved', label: 'Tối ưu hoá các Mẫu AI Beauty Presets', text: 'Cân bằng hoàn hảo các preset Tự Nhiên, Mịn Da, Sáng Hồng, Studio Glam giữa màn hình chụp Live View, chỉnh sửa nhanh và luồng in ấn.' }
      ]
    },
    {
      version: 'v1.0.11',
      releaseDate: '05/10/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Tối ưu hoá vượt bậc Live View và Frame Pipeline cho trải nghiệm ngắm chụp mượt mà không độ trễ, bổ sung bộ màu chân dung & da chuẩn Studio Hàn Quốc (Korean Clean Pink, Baby Pink Glow, Nàng Thơ, Porcelain Ivory, Retro Bronze Y2K) dưới định dạng 3D LUT Cube và XML Presets.',
      downloadSize: '835.0 MB',
      changes: [
        { category: 'improved', label: 'Tối ưu Live View Pipeline & Zero-Allocation Buffer', text: 'Cải tiến bộ giải mã khung hình Live View với cơ chế tái sử dụng buffer bộ nhớ đệm, loại bỏ cấp phát GC thừa, tối ưu hóa đa luồng giúp Live View 60 FPS cực kỳ mượt mà, phản hồi tức thì.' },
        { category: 'new', label: 'Bổ sung Preset Màu & 3D LUT Chân Dung Đỉnh Cao', text: 'Tích hợp sẵn các tone màu chân dung thời thượng: Korean Clean Pink (hồng trong veo Hàn Quốc), Skin Baby Pink Glow (trắng hồng mọng nước), Nàng Thơ Trắng Hồng Baby, Porcelain Ivory (trắng sứ sang trọng) và Retro Bronze Y2K.' },
        { category: 'new', label: 'GradeController & Preview Màu Thời Gian Thực', text: 'Hệ thống GradeStore & GradeBaker kết hợp bộ tạo mẫu thumbnail trực quan, cho phép khách hàng xem trước hiệu ứng màu sắc ngay trên màn hình Live View và trước khi in.' },
        { category: 'improved', label: 'Đồng bộ Giao diện Chụp & Điều khiển từ xa', text: 'Tối ưu giao diện SelfBooth Shoot & Select Page, nâng cấp Remote Bridge Hooks và hệ thống điều khiển camera chuyên nghiệp ổn định cao.' }
      ]
    },
    {
      version: 'v1.0.10',
      releaseDate: '30/09/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Nâng cấp toàn diện bộ lọc màu chân dung & da mặt, tối ưu hoá luồng chụp Self Photo Booth chuyên nghiệp với mã phiên chụp, gói chụp linh hoạt, quét QR nhận ảnh và bảo vệ tối ưu trải nghiệm khách hàng.',
      downloadSize: '830.0 MB',
      changes: [
        { category: 'improved', label: 'Tối ưu hóa Pipeline Màu Chân Dung (Skin Tone & Lips)', text: 'Cải tiến thuật toán Hermite roll-off bảo toàn chi tiết vùng sáng, giữ trọn sắc tố da hồng hào tự nhiên và màu môi sắc nét, không bị bết màu hay cháy sáng.' },
        { category: 'new', label: 'Quy trình Self Photo Booth Chuyên Nghiệp', text: 'Tích hợp chọn gói chụp theo thời gian/số lượng ảnh, hiển thị mã phiên chụp (Session Code), đếm ngược linh hoạt, tạm dừng và hộp thoại xác nhận khi kết thúc sớm.' },
        { category: 'new', label: 'Thanh toán & Vé QR Nhận Ảnh Tức Thì', text: 'Hỗ trợ cơ chế khóa phiên chụp trước thanh toán (Pay Before Capture), tự động xuất mã QR vé số để khách quét xem trước và chọn ảnh tiện lợi ngay trên điện thoại.' },
        { category: 'improved', label: 'Live View Gương & Xem Lại Ảnh Nhanh (Quick Review)', text: 'Hỗ trợ lật gương Live View thời gian thực, xem lại nhanh ảnh vừa chụp trực quan và giao diện toàn màn hình mượt mà không độ trễ.' }
      ]
    },
    {
      version: 'v1.0.9',
      releaseDate: '25/09/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Đột phá AI Retouch & Làm đẹp thông minh: Làm trắng răng tự nhiên khi cười, triệt tiêu vết thâm mụn giữ trọn vân da thật, khử quầng thâm mắt & rãnh lệ, và chuẩn hoá bóp cằm V-line tự nhiên chống biến dạng khuôn mặt.',
      downloadSize: '829.8 MB',
      changes: [
        { category: 'new', label: 'Làm trắng sáng răng tự nhiên (Teeth Whitening)', text: 'Nhận diện chuẩn xác dải răng trong khoang miệng khi cười, khử sắc tố vàng ố và tăng độ sáng trong suốt; tích hợp bộ lọc bảo vệ viền môi chống lem son tuyệt đối.' },
        { category: 'new', label: 'Triệt tiêu thâm mụn & đốm nâu (Blemish Suppression)', text: 'Tự động bóc tách và bù sáng vi mô cho các hố thâm mụn, vết thâm đỏ hoặc tàn nhang; bảo tồn 100% kết cấu lỗ chân lông và vi vân da thật (Pore-preserving).' },
        { category: 'new', label: 'Khử quầng thâm mắt & Rãnh lệ (Dark Circles Concealing)', text: 'Trích xuất dải mặt nạ mí dưới hình trăng khuyết, bù sáng rãnh lệ và triệt tiêu sắc tố thâm tím xanh; tích hợp mượt mà vào thanh điều khiển Sáng mắt.' },
        { category: 'improved', label: 'Bóp cằm V-line tự nhiên & Chống méo mặt', text: 'Tái thiết kế toàn diện trường lực biến dạng quai hàm: neo gốc biến dạng dưới môi dưới, bảo vệ tuyệt đối khóe miệng, cánh mũi, gò má và mắt; mang lại đường nét thon gọn tự nhiên.' },
        { category: 'improved', label: 'Cân bằng các Mẫu làm đẹp nhanh (Beauty Presets)', text: 'Tối ưu hoá các preset Tự Nhiên, Mịn Da, Sáng Hồng, Studio Glam đồng bộ hoàn hảo giữa màn hình chụp Live View, màn hình chỉnh sửa và luồng xuất ảnh in chất lượng cao.' }
      ]
    },
    {
      version: 'v1.0.8',
      releaseDate: '14/09/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Phiên bản nâng cấp toàn diện hệ thống in ảnh: Tinh giản giao diện cấu hình máy in, tích hợp bộ công cụ chuẩn đoán hàng đợi & phục hồi Print Spooler an toàn, và theo dõi cuộn giấy in.',
      downloadSize: '860.6 MB',
      changes: [
        { category: 'new', label: 'Chuẩn đoán & Tự phục hồi Print Spooler', text: 'Tích hợp bộ công cụ xử lý sự cố in một chạm: Xóa hàng đợi in kẹt (Clear Print Queue đa tầng với PowerShell fallback) và tự động khởi động lại Print Spooler khi máy in bị ngắt kết nối đột ngột.' },
        { category: 'improved', label: 'Giao diện Cài đặt Máy in trực quan', text: 'Thiết kế lại khu vực cấu hình máy in gọn gàng, gom các công cụ Windows thành 1 hàng duy nhất (Chọn máy in, Cấu hình Driver, Hàng đợi in) và hỗ trợ In trang thử nghiệm trực tiếp.' },
        { category: 'improved', label: 'Theo dõi Cuộn giấy in', text: 'Chuyển tính năng giám sát cuộn giấy in và số lượng ảnh còn lại vào thẻ Chính sách sự kiện để quản lý tập trung và khoa học.' },
        { category: 'improved', label: 'Độ ổn định & Chống đơ giao diện', text: 'Ngăn chặn hiện tượng treo ứng dụng khi thao tác các tác vụ chuẩn đoán in hoặc khi hệ điều hành phản hồi chậm.' }
      ]
    },
    {
      version: 'v1.0.7',
      releaseDate: '12/09/2026',
      isLatest: false,
      tagText: 'Bản trước',
      summary: 'Phiên bản đóng gói Inno Setup chính thức: Tích hợp đầy đủ Canon & Sony SDK plug & play, nâng cấp làm đẹp Studio Glam AI và tối ưu giải phóng RAM triệt để.',
      downloadSize: '861.0 MB',
      changes: [
        { category: 'new', label: 'Sony Alpha SDK & Driver', text: 'Tích hợp toàn diện Sony CrSDK, SonyCameraHost và tùy chọn cài đặt driver signed libusbK cho máy ảnh Sony ngay trong bộ cài.' },
        { category: 'new', label: 'Canon Plug & Play', text: 'Đóng gói toàn diện bộ điều khiển Canon EDSDK và CanonEdSdkBridge native mới nhất, cắm cáp USB nhận ngay không cần cấu hình phức tạp.' },
        { category: 'new', label: 'Studio Glam AI', text: 'Nâng cấp tính năng làm đẹp da chuyên sâu với thuật toán nhận diện khuôn mặt và phục hồi cấu trúc vân da tự nhiên chuẩn Studio.' },
        { category: 'improved', label: 'Dọn dẹp RAM', text: 'Cơ chế giải phóng RAM triệt để ngay sau mỗi session chụp và tự động dọn sạch bộ nhớ đệm khi máy chuyển về màn hình chờ.' },
        { category: 'improved', label: 'Bộ cài đặt Inno Setup', text: 'Đóng gói trình cài đặt trọn gói 861 MB lưu trữ trên Google Drive CDN tốc độ cao, sửa triệt để lỗi file corrupted khi tải mạng yếu.' }
      ]
    },
    {
      version: 'v1.0.6',
      releaseDate: '09/09/2026',
      isLatest: false,
      tagText: 'Bản trước',
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
      question: 'Phần mềm Pica Photobox tương thích với những dòng máy ảnh nào và có cần cài driver không?',
      answer: 'Pica Photobox hỗ trợ hầu hết các dòng máy ảnh Canon EOS DSLR / Mirrorless, Sony Alpha (CrSDK), Nikon và Fujifilm qua kết nối USB. Toàn bộ SDK điều khiển chính hãng đã được đóng gói sẵn trong Pica Photobox (Plug & Play), bạn chỉ cần cắm cáp USB vào máy tính là phần mềm tự động nhận diện. Tuyệt đối không cài đặt hoặc mở phần mềm Canon EOS Utility để tránh chiếm dụng và xung đột cổng USB.',
      isOpen: true
    },
    {
      question: 'Tính năng Điều khiển từ xa (Web Remote) qua điện thoại hoạt động như thế nào?',
      answer: 'Chỉ cần điện thoại hoặc máy tính bảng kết nối chung mạng Wi-Fi/mạng LAN với máy tính Photobooth, nhân viên sự kiện có thể truy cập giao diện Web Remote (được bảo vệ bằng mã PIN) để bấm chụp, chụp lại, đổi chế độ và duyệt xác nhận chuyển khoản ngân hàng 1 chạm từ xa mà không cần thao tác trực tiếp trên màn hình Kiosk.',
      isOpen: false
    },
    {
      question: 'Chức năng Làm đẹp khuôn mặt (AI Beauty) và Bộ lọc màu có gì đặc biệt?',
      answer: 'Pica Photobox ứng dụng AI nhận diện 468 điểm mốc trên khuôn mặt với thuật toán làm mịn da thông minh giữ nguyên vân da tự nhiên (Pore-preserving - không bị bệt da hay giả tạo), xóa mụn thâm, làm trắng răng và làm sáng mắt. Ngoài ra, phần mềm hỗ trợ hàng chục bộ lọc màu điện ảnh 3D LUT (Tone Hàn Quốc, Vintage, Film...) xem trước trực tiếp trên Live View và tính năng chụp ảnh thẻ (ID Photo) với AI tách nền chuẩn studio.',
      isOpen: false
    },
    {
      question: 'Cấu hình máy tính tối thiểu để vận hành mượt mà là gì?',
      answer: 'Cấu hình tối thiểu đề xuất: Hệ điều hành Windows 10/11 64-bit, CPU Intel Core i5 thế hệ 8 trở lên (hoặc AMD Ryzen 5 tương đương), RAM tối thiểu 8GB (khuyến nghị 16GB), ổ cứng SSD trống tối thiểu 20GB và màn hình độ phân giải Full HD (1920x1080) có cảm ứng.',
      isOpen: false
    },
    {
      question: 'Pica Photobox có hỗ trợ in ảnh 2 dải strip (2x6 inch) không?',
      answer: 'Có! Phần mềm tự động chia và nhân đôi layout cho dải ảnh 2x6 inch hoặc ghép in khổ 4x6 inch (10x15cm). Hệ thống tương thích hoàn hảo với các dòng máy in nhiệt sự kiện cao cấp như DNP DS-RX1HS, DNP DS620, Citizen CY-02, Hiti P525L...',
      isOpen: false
    },
    {
      question: 'Nếu sự kiện mất mạng Internet thì khách có thể chụp và in ảnh được không?',
      answer: 'Hoàn toàn được. Pica Photobox hoạt động độc lập không phụ thuộc vào Internet. Ảnh vẫn được chụp, làm đẹp AI, ghép khung và in tự động bình thường. Tất cả dữ liệu sẽ được lưu trong hàng đợi an toàn và tự động đồng bộ lên Cloud Gallery ngay khi có mạng trở lại.',
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

      if (response.release.version === '1.0.15' && this.releaseUpdates.length > 0) {
        this.currentVersion.set(`v${response.release.version}`);
        this.releaseDate.set(this.formatDate(response.release.publishedAt));
        this.fileSize.set(response.installer.size == null ? '845.2 MB' : this.formatBytes(response.installer.size));
        this.installerAvailable.set(true);
        this.releaseUpdates[0].releaseDate = this.formatDate(response.release.publishedAt);
        this.releaseUpdates[0].summary = response.release.notes?.trim() || this.releaseUpdates[0].summary;
        this.releaseUpdates[0].downloadSize = response.installer.size == null ? '845.2 MB' : this.formatBytes(response.installer.size);
      } else {
        // Keep latest static release v1.0.15 at top if API provides older version
        this.currentVersion.set('v1.0.15');
        this.releaseDate.set('13/10/2026');
        this.fileSize.set('845.2 MB');
        this.installerAvailable.set(true);
      }
    } catch {
      this.currentVersion.set('v1.0.15');
      this.releaseDate.set('13/10/2026');
      this.fileSize.set('845.2 MB');
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
