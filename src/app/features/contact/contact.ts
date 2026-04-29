import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-contact',
  imports: [FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  form = {
    name: '',
    phone: '',
    service: 'Photobooth Bae',
    note: ''
  };

  phoneError = signal('');
  submitted = signal(false);

  constructor(private router: Router) {}

  validatePhone(phone: string): boolean {
    const vnPhone = /^(0|\+84)(3[2-9]|5[6|8|9]|7[06-9]|8[0-9]|9[0-9])[0-9]{7}$/;
    return vnPhone.test(phone.trim());
  }

  async sendToTelegram() {
    // ID của anh Thế Anh đã bắt được
    const token = '8352009369:AAHlp3LG5JX-r_xYsRIYIswgrgYSl5NqLxE';
    const chatId = '5673994427'; 

    const text = `
🎉 <b>CÓ KHÁCH HÀNG ĐẶT LỊCH / BÁO GIÁ</b> 🎉

👤 <b>Tên:</b> ${this.form.name}
📞 <b>SĐT:</b> ${this.form.phone}
🛍 <b>Dịch vụ quan tâm:</b> ${this.form.service}
📝 <b>Ghi chú:</b> 
${this.form.note || '<i>Không có</i>'}
    `;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    try {
      await fetch(url, {
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
    } catch(err) {
      console.error('Lỗi khi gửi Telegram:', err);
    }
  }

  async onSubmit() {
    this.phoneError.set('');

    if (!this.form.name.trim()) return;

    if (!this.validatePhone(this.form.phone)) {
      this.phoneError.set('Số điện thoại không hợp lệ. Vui lòng nhập đúng định dạng Việt Nam (VD: 0779359756).');
      return;
    }

    // Hiển thị loading hoặc gửi đi
    this.submitted.set(true);
    
    // Gửi thông báo qua Telegram
    await this.sendToTelegram();

    // Reset form sau 4 giây
    setTimeout(() => {
      this.submitted.set(false);
      this.form.name = '';
      this.form.phone = '';
      this.form.note = '';
    }, 4000);
  }
}
