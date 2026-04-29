import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-services-showcase',
  imports: [RouterLink],
  templateUrl: './services-showcase.html',
  styleUrl: './services-showcase.scss',
})
export class ServicesShowcase {
  services = signal([
    {
      id: 1,
      title: 'Premium Photobooth',
      description: 'Kiosk chụp ảnh với thiết bị DSLR cao cấp và in siêu tốc.',
      longDescription: 'Khác với những bốt chụp hình thông thường, Premium Photobooth được trang bị máy ảnh DSLR chuyên nghiệp, hệ thống đèn flash studio và máy in nhiệt siêu tốc, mang đến những bức ảnh sắc nét, rực rỡ và lấy liền chỉ sau vài giây.',
      whyUs: 'Hệ thống ánh sáng studio được tinh chỉnh tối ưu cho không gian tiệc cưới, kết hợp phần mềm chụp ảnh tự động và kho template thiết kế riêng mang đậm dấu ấn cá nhân của cô dâu chú rể.',
      includes: [
        'Máy ảnh DSLR độ phân giải cao',
        'Đèn Studio chuyên dụng',
        'Máy in nhiệt siêu tốc (lấy liền trong 10s)',
        'Nhân viên hỗ trợ tại sự kiện',
        'Thiết kế Template ảnh miễn phí'
      ],
      bgUrl: 'https://i.pinimg.com/736x/84/a5/fc/84a5fc4f1d7742ef1f726a59b53e6c12.jpg',
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
      glareOpacity: 0, glareTx: 50, glareTy: 50
    },
    {
      id: 2,
      title: 'Bướm LED Nghệ Thuật',
      description: 'Đàn bướm LED drone kích thước 40–50cm sải cánh, bay lượn uyển chuyển theo kịch bản riêng.',
      longDescription: 'Mỗi con bướm LED là một thiết bị drone được chế tác tinh xảo, sải cánh 40–50cm, bay theo kịch bản được lập trình sẵn — tạo ra màn trình diễn nghệ thuật không gian đặc biệt, ấn tượng và hoàn toàn an toàn cho không gian tiệc kín.',
      whyUs: 'Mỗi con bướm drone được điều khiển bởi phần mềm lập trình quỹ đạo bay chính xác. Đội ngũ kỹ thuật viên giám sát trực tiếp toàn bộ buổi trình diễn, đảm bảo an toàn tuyệt đối cho không gian sự kiện.',
      includes: [
        'Thiết bị công nghệ drone an toàn hạng VIP',
        'Ekip kỹ thuật viên vận hành giám sát liên tục',
        'Kịch bản trình diễn được lập trình trước',
        'Clip Tiktok Highlights độc quyền'
      ],
      bgUrl: 'https://scontent.fhan4-1.fna.fbcdn.net/v/t39.30808-6/654198936_1965328817439064_1616175635499315100_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=e06c5d&_nc_eui2=AeGL0cIgetiZjJXqd--yd-hUtJ2AZjQUage0nYBmNBRqBw0ykIvUNn-LhSjq1DkTsiFkkkhKPgdnMtVNEchOg71q&_nc_ohc=k-x5Tp5nPZkQ7kNvwF3LtHk&_nc_oc=AdrZsx1awuzh1pQlHktz1VTfDRp-Au2E3hif-SSx0AU-2YZICZWHt0LBEuNunq6HBdI&_nc_zt=23&_nc_ht=scontent.fhan4-1.fna&_nc_gid=Qp5uLNkRU4_ZMMMsDPvSRQ&_nc_ss=7b2a8&oh=00_Af0lJHPxDt3UavM80ZXmhOqjF9xM5h9fp2cJ1d--tchX_w&oe=69F393CE',
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
      glareOpacity: 0, glareTx: 50, glareTy: 50
    },
    {
      id: 3,
      title: 'Drone Trao Nhẫn',
      description: 'Robot bay tự động tiến vào tâm sự kiện giao nhẫn lãng mạn.',
      longDescription: 'Ứng dụng công nghệ bay không người lái tự động hóa, drone được trang trí tinh tế sẽ mang theo đôi nhẫn cưới lướt nhẹ vào đến tay chú rể ngay khoảnh khắc trao nhẫn thiêng liêng nhất, tạo nên sự bất ngờ vô giá cho khách mời.',
      whyUs: 'Drone được tinh chỉnh để lướt êm với tiếng ồn rất thấp, quỹ đạo bay tính toán kĩ lưỡng đảm bảo tuyệt đối an toàn. Vận trình bay được thử nghiệm trước hàng chục lần mang đến khoảnh khắc hoàn hảo.',
      includes: [
        'Drone chuyên dụng mod giảm tiếng ồn',
        'Trang trí lúp cưới/hoa nghệ thuật trên thân drone',
        'Phi công điều khiển flycam dày dặn kinh nghiệm',
        'Plan A & B dự phòng rủi ro kỹ thuật'
      ],
      bgUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?q=80&w=2139',
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
      glareOpacity: 0, glareTx: 50, glareTy: 50
    },
    {
      id: 4,
      title: 'Phóng Sự Điện Ảnh',
      description: 'Khung hình quy mô Hollywood với kỹ thuật màu điện ảnh.',
      longDescription: 'Đội ngũ quay phim sử dụng trang thiết bị hiện đại chuẩn điện ảnh (Cines camera, Gimbal), áp dụng kỹ thuật kể chuyện kết hợp với chỉnh màu chuyên nghiệp, biến thước phim ngày cưới thành một tác phẩm nghệ thuật kinh điển riêng.',
      whyUs: 'Chúng tôi không chỉ ghi hình mà còn bắt trọn từng cảm xúc vi tế nhất của sự kiện. Mỗi video mang một kịch bản riêng không bị rập khuôn, màu sắc được trau chuốt tỉ mỉ (Color grading) chuẩn rạp rạp.',
      includes: [
        'Máy quay chuẩn điện ảnh 4K độ phân giải siêu nét',
        'Kịch bản phân cảnh tinh tế và cảm xúc',
        'Đội ngũ Hậu kì Dựng phim hiện đại',
        'Màu phim điện ảnh Color Grading cá nhân hóa'
      ],
      bgUrl: 'https://i.pinimg.com/736x/35/cf/f8/35cff88aafb60e2aa939afeac556e522.jpg',
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
      glareOpacity: 0, glareTx: 50, glareTy: 50
    }
  ]);

  onMouseMove(event: MouseEvent, index: number, cardEl: HTMLElement) {
    const rect = cardEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = (x / rect.width) - 0.5;
    const centerY = (y / rect.height) - 0.5;

    const rotateX = centerY * -15;
    const rotateY = centerX * 15;

    this.services.update(items => {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
        glareTx: x,
        glareTy: y,
        glareOpacity: 0.4
      };
      return newItems;
    });
  }

  onMouseLeave(index: number) {
    this.services.update(items => {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        glareOpacity: 0
      };
      return newItems;
    });
  }

  // Quản lý Modal Detail
  activeService = signal<any | null>(null);

  openServiceModal(service: any) {
    this.activeService.set(service);
    // Vô hiệu hoá scroll body khi mở popup
    document.body.style.overflow = 'hidden';
  }

  closeServiceModal() {
    this.activeService.set(null);
    document.body.style.overflow = 'auto';
  }
}
