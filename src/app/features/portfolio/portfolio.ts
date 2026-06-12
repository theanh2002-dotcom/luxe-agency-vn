import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-portfolio',
  imports: [CommonModule, FormsModule],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly requestTimeoutMs = 30_000;
  private readonly uploadTimeoutMs = 15 * 60_000;
  private readonly maxFileSizeBytes = 100 * 1024 * 1024;
  private readonly rawExtensions = new Set([
    '3fr', 'arw', 'cr2', 'cr3', 'dcr', 'dng', 'erf', 'iiq', 'k25', 'kdc',
    'mef', 'mos', 'mrw', 'nef', 'nrw', 'orf', 'pef', 'raf', 'raw', 'rw2',
    'rwl', 'sr2', 'srf', 'srw', 'x3f'
  ]);

  portfolioImages = [
    { url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069', category: 'Lễ Cưới', title: 'Hoàng & Mai' },
    { url: 'https://images.unsplash.com/photo-1532452119098-a3650b3c46d3?q=80&w=2070', category: 'Thiết Kế', title: 'Lễ Đường Pha Lê' },
    { url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2070', category: 'Photobooth', title: 'Góc Selfie Kỷ Niệm' },
    { url: 'https://images.unsplash.com/photo-1546193430-c2d207739ed7?q=80&w=2000', category: 'Phim Trường', title: 'Cặp Đôi Bỉ Ngạn' },
    { url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070', category: 'Ngoại Cảnh', title: 'Chuyến Đi Của Thanh Xuân' },
    { url: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070', category: 'Tiệc Đêm', title: 'Ánh Sáng Nhiệm Màu' }
  ];

  // ===== NEW ORDER PRINTING FEATURE =====
  clientName = '';
  clientPhone = '';
  selectedPhotos: { file: File; quantity: number }[] = [];

  isSubmitting = false;
  isSuccess = false;
  errorMessage = '';

  uploadProgress = 0; // percentage
  currentUploadingIndex = 0;

  get totalQuantity(): number {
    return this.selectedPhotos.reduce((sum, item) => sum + item.quantity, 0);
  }

  get unitPrice(): number {
    return this.totalQuantity > 5 ? 15000 : 20000;
  }

  get totalPrice(): number {
    return this.totalQuantity * this.unitPrice;
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const filesArray = Array.from(input.files);
      const imageFiles = filesArray.filter(file =>
        this.isSupportedImage(file) && file.size <= this.maxFileSizeBytes
      );
      const rejectedFiles = filesArray.filter(file =>
        this.isSupportedImage(file) && file.size > this.maxFileSizeBytes
      );
      const unsupportedFiles = filesArray.filter(file => !this.isSupportedImage(file));
      const newItems = imageFiles.map(file => ({ file, quantity: 1 }));
      this.selectedPhotos = [...this.selectedPhotos, ...newItems];
      const errors = [];
      if (rejectedFiles.length > 0) {
        errors.push(`Ảnh vượt quá 100 MB: ${rejectedFiles.map(file => file.name).join(', ')}`);
      }
      if (unsupportedFiles.length > 0) {
        errors.push(`Định dạng không được hỗ trợ: ${unsupportedFiles.map(file => file.name).join(', ')}`);
      }
      this.errorMessage = errors.join(' ');
      input.value = '';
    }
  }

  private isSupportedImage(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return this.rawExtensions.has(extension);
  }

  removeFile(index: number) {
    this.selectedPhotos.splice(index, 1);
  }

  decreaseQty(index: number) {
    if (this.selectedPhotos[index].quantity > 1) {
      this.selectedPhotos[index].quantity--;
    }
  }

  increaseQty(index: number) {
    this.selectedPhotos[index].quantity++;
  }

  async submitOrder() {
    if (!this.clientName.trim()) {
      this.errorMessage = 'Vui lòng nhập họ tên.';
      return;
    }
    if (!this.clientPhone.trim()) {
      this.errorMessage = 'Vui lòng nhập số điện thoại.';
      return;
    }
    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (!phoneRegex.test(this.clientPhone.trim())) {
      this.errorMessage = 'Số điện thoại không hợp lệ (phải bắt đầu bằng 03/05/07/08/09 và đủ 10 chữ số).';
      return;
    }
    if (this.selectedPhotos.length === 0) {
      this.errorMessage = 'Vui lòng chọn ít nhất 1 ảnh cần in.';
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;
    this.uploadProgress = 0;
    this.currentUploadingIndex = 0;

    try {
      // 1. Create customer folder in Google Drive via Serverless Endpoint
      const folderRes = await this.fetchWithTimeout('/api/create-drive-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.clientName, phone: this.clientPhone })
      });
      if (!folderRes.ok) {
        throw new Error(await this.getApiError(folderRes, 'Lỗi khi tạo thư mục khách hàng trên Drive.'));
      }
      const folderData = await folderRes.json();
      const folderId = folderData.id;
      const folderLink = folderData.webViewLink;

      // 2. Create a resumable session on the server, then upload directly to Drive.
      const totalItems = this.selectedPhotos.length;
      for (let i = 0; i < totalItems; i++) {
        this.currentUploadingIndex = i + 1;
        this.cdr.markForCheck();
        const item = this.selectedPhotos[i];
        const file = item.file;
        const qty = item.quantity;

        // Append quantity to filename, e.g. "sunset_x3.jpg"
        const dotIndex = file.name.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
        const extension = dotIndex !== -1 ? file.name.substring(dotIndex) : '';
        const driveFileName = `${baseName}_x${qty}${extension}`;

        const sessionRes = await this.fetchWithTimeout('/api/create-upload-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId,
            fileName: driveFileName,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size
          })
        });
        if (!sessionRes.ok) {
          throw new Error(await this.getApiError(sessionRes, `Không thể chuẩn bị tải ảnh: ${file.name}`));
        }
        const { uploadUrl } = await sessionRes.json();

        await this.uploadFile(uploadUrl, file, i, totalItems);
      }

      // 3. Submit order and send Telegram notification
      const submitRes = await this.fetchWithTimeout('/api/submit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.clientName,
          phone: this.clientPhone,
          quantity: this.totalQuantity,
          uniquePhotos: totalItems,
          folderLink
        })
      });

      if (!submitRes.ok) {
        throw new Error(await this.getApiError(submitRes, 'Tải ảnh thành công nhưng không thể gửi thông tin đơn hàng.'));
      }

      this.isSuccess = true;
      this.selectedPhotos = [];
      this.clientName = '';
      this.clientPhone = '';
    } catch (err: any) {
      this.errorMessage = err?.name === 'AbortError'
        ? 'Kết nối quá thời gian chờ. Vui lòng kiểm tra mạng và thử lại.'
        : err.message || 'Có lỗi xảy ra trong quá trình đặt hàng. Vui lòng thử lại!';
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  private async fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async getApiError(response: Response, fallback: string): Promise<string> {
    try {
      const data = await response.json();
      return data.message || data.error || fallback;
    } catch {
      return fallback;
    }
  }

  private uploadFile(uploadUrl: string, file: File, index: number, totalItems: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.timeout = this.uploadTimeoutMs;
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const completed = index + event.loaded / event.total;
        this.uploadProgress = Math.min(100, Math.round((completed / totalItems) * 100));
        this.cdr.markForCheck();
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          this.uploadProgress = Math.round(((index + 1) / totalItems) * 100);
          this.cdr.markForCheck();
          resolve();
          return;
        }

        reject(new Error(this.getDriveUploadError(xhr.responseText, file.name)));
      };
      xhr.onerror = () => reject(new Error(`Mất kết nối khi tải ảnh: ${file.name}`));
      xhr.ontimeout = () => reject(new Error(`Tải ảnh quá thời gian chờ: ${file.name}`));
      xhr.send(file);
    });
  }

  private getDriveUploadError(responseText: string, fileName: string): string {
    try {
      const data = JSON.parse(responseText);
      const reason = data?.error?.errors?.[0]?.reason;
      if (reason === 'storageQuotaExceeded') {
        return 'Service Account không có dung lượng lưu trữ. Hãy dùng Shared Drive hoặc OAuth của tài khoản Google có dung lượng.';
      }
      return data?.error?.message || `Tải ảnh thất bại: ${fileName}`;
    } catch {
      return `Tải ảnh thất bại: ${fileName}`;
    }
  }

  resetOrder() {
    this.isSuccess = false;
    this.errorMessage = '';
    this.uploadProgress = 0;
  }
}
