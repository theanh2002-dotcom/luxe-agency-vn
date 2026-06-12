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
    try {
      const response = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.form.name,
          phone: this.form.phone,
          service: this.form.service,
          note: this.form.note
        })
      });

      if (!response.ok) {
        throw new Error('Gửi yêu cầu báo giá thất bại');
      }
    } catch(err) {
      console.error('Lỗi khi gửi báo giá qua Telegram:', err);
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
