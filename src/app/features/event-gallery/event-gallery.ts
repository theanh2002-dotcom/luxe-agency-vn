import { Component, OnInit, OnDestroy, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { interval, Subscription, switchMap } from 'rxjs';
import { GoogleDriveGalleryService, GalleryPhoto } from './services/google-drive-gallery.service';

@Component({
  selector: 'app-event-gallery',
  imports: [CommonModule],
  templateUrl: './event-gallery.html',
  styleUrl: './event-gallery.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventGallery implements OnInit, OnDestroy {
  eventId: string | null = '';

  // State signals
  photos = signal<GalleryPhoto[]>([]);
  selectedIndex = signal<number>(0);
  isLoading = signal<boolean>(true);
  isPolling = signal<boolean>(false);
  showLightbox = signal<boolean>(false);
  lightboxIndex = signal<number>(0);
  errorMessage = signal<string | null>(null);

  // Computed
  selectedPhoto = computed(() => this.photos()[this.selectedIndex()]);
  photoCount = computed(() => this.photos().length);

  // Polling config
  private pollSub?: Subscription;
  private knownFileIds = new Set<string>();
  private noNewPhotosSince = 0;
  private readonly POLL_INTERVAL_MS = 5000;      // 5 giây
  private readonly AUTO_STOP_MS = 5 * 60 * 1000; // 5 phút

  // Demo mode: dùng ảnh mẫu khi eventId bắt đầu bằng "demo"
  private demoPhotos: GalleryPhoto[] = [
    { fileId: 'demo1', name: 'Khoảnh khắc hạnh phúc', webViewLink: '', thumbnailLink: 'photos/photo1.png', createdTime: new Date().toISOString() },
    { fileId: 'demo2', name: 'Lễ cắt bánh', webViewLink: '', thumbnailLink: 'photos/photo2.png', createdTime: new Date().toISOString() },
    { fileId: 'demo3', name: 'Trao nhẫn cưới', webViewLink: '', thumbnailLink: 'photos/photo3.png', createdTime: new Date().toISOString() },
    { fileId: 'demo4', name: 'Chân dung cặp đôi', webViewLink: '', thumbnailLink: 'photos/photo4.png', createdTime: new Date().toISOString() },
  ];

  constructor(
    private route: ActivatedRoute,
    private driveService: GoogleDriveGalleryService
  ) {
    // Tự động preload (tải ngầm) TẤT CẢ ảnh vào RAM của trình duyệt
    effect(() => {
      const pts = this.photos();
      if (pts.length > 0) {
        this.preloadAllPhotos(pts);
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.eventId = params.get('id');
      this.loadInitialPhotos();
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  // ========== DATA LOADING ==========

  private loadInitialPhotos() {
    this.isLoading.set(true);

    // Demo mode
    if (this.eventId && this.eventId.startsWith('demo')) {
      setTimeout(() => {
        this.photos.set(this.demoPhotos);
        this.demoPhotos.forEach(p => this.knownFileIds.add(p.fileId));
        this.isLoading.set(false);
      }, 800);
      return;
    }

    // Real mode: Gọi trực tiếp Google Drive API
    if (!this.eventId) return;

    this.driveService.listPhotosInFolder(this.eventId).subscribe({
      next: (photos) => {
        this.photos.set(photos);
        photos.forEach(p => this.knownFileIds.add(p.fileId));
        this.isLoading.set(false);
        this.startPolling();
      },
      error: (err) => {
        console.error('Failed to load photos:', err);
        this.errorMessage.set('Không thể tải ảnh. Vui lòng thử lại sau.');
        this.isLoading.set(false);
      }
    });
  }

  // ========== POLLING ==========

  private startPolling() {
    if (this.pollSub || !this.eventId) return;
    this.isPolling.set(true);
    this.noNewPhotosSince = Date.now();

    this.pollSub = interval(this.POLL_INTERVAL_MS).pipe(
      switchMap(() => this.driveService.listPhotosInFolder(this.eventId!))
    ).subscribe(files => {
      const newFiles = files.filter(f => !this.knownFileIds.has(f.fileId));

      if (newFiles.length > 0) {
        newFiles.forEach(f => {
          f.isNew = true;
          this.knownFileIds.add(f.fileId);
        });
        // Prepend ảnh mới vào đầu
        this.photos.update(current => [...newFiles, ...current]);
        this.noNewPhotosSince = Date.now();

        // Xóa badge "Mới" sau 5 giây
        setTimeout(() => {
          this.photos.update(current =>
            current.map(p => ({ ...p, isNew: false }))
          );
        }, 5000);
      }

      // Auto-stop sau 5 phút không có ảnh mới
      if (Date.now() - this.noNewPhotosSince > this.AUTO_STOP_MS) {
        this.stopPolling();
      }
    });
  }

  private stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.isPolling.set(false);
  }

  // ========== UI ACTIONS ==========

  /**
   * Đồng bộ hóa cuộn mượt mà với render loop của trình duyệt
   */
  private syncScrollAnimations(index: number) {
    requestAnimationFrame(() => {
      // 1. Cuộn lên phần ảnh chính
      const mainEl = document.querySelector('.gallery-main-photo');
      mainEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // 2. Cuộn thumbnail strip để ảnh active luôn nằm giữa màn hình
      const thumbEls = document.querySelectorAll('.thumbnail-item');
      if (thumbEls && thumbEls[index]) {
        thumbEls[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }

  selectPhoto(index: number) {
    this.selectedIndex.set(index);
    this.syncScrollAnimations(index);
  }

  openLightbox(index: number) {
    this.lightboxIndex.set(index);
    this.showLightbox.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    this.showLightbox.set(false);
    document.body.style.overflow = '';
  }

  lightboxPrev() {
    const total = this.photoCount();
    this.lightboxIndex.update(i => (i - 1 + total) % total);
  }

  lightboxNext() {
    const total = this.photoCount();
    this.lightboxIndex.update(i => (i + 1) % total);
  }

  navigatePrev() {
    const total = this.photoCount();
    this.selectedIndex.update(i => {
      const newIdx = (i - 1 + total) % total;
      this.syncScrollAnimations(newIdx);
      return newIdx;
    });
  }

  navigateNext() {
    const total = this.photoCount();
    this.selectedIndex.update(i => {
      const newIdx = (i + 1) % total;
      this.syncScrollAnimations(newIdx);
      return newIdx;
    });
  }

  downloadPhoto(photo: GalleryPhoto) {
    if (!photo) return;
    const url = this.driveService.getDownloadUrl(photo);
    
    // Sử dụng thẻ iframe ẩn để tải file thay vì mở tab mới (thẻ <a> target _blank)
    // Cách này giúp tránh bị trình duyệt block popup khi tải nhiều ảnh cùng lúc
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    
    // Xóa iframe sau khi trình duyệt đã bắt đầu tải
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 5000);
  }

  async downloadAllPhotos() {
    const photos = this.photos();
    for (let i = 0; i < photos.length; i++) {
      this.downloadPhoto(photos[i]);
      // Đợi 800ms giữa mỗi lần tải để tránh bị trình duyệt chặn (Spam protection)
      // Lần đầu tiên tải nhiều ảnh, trình duyệt sẽ hiện thông báo hỏi quyền "Cho phép tải nhiều tệp"
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  // ========== SWIPE GESTURES ==========

  private touchStartX = 0;

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    const diff = this.touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) this.lightboxNext();
      else this.lightboxPrev();
    }
  }

  // ========== IMAGE URL HELPERS ==========

  /**
   * Ảnh chính + lightbox: chất lượng cao
   * Dùng Google Drive direct view link
   */
  getPhotoSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    // Demo mode
    if (photo.fileId.startsWith('demo')) return photo.thumbnailLink;
    return this.driveService.getHighResUrl(photo);
  }

  /**
   * Thumbnail: chất lượng vừa cho grid + strip
   */
  getThumbSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    // Demo mode
    if (photo.fileId.startsWith('demo')) return photo.thumbnailLink;
    return this.driveService.getThumbnailUrl(photo);
  }

  // ========== PRELOAD CACHING ==========
  
  private preloadedUrls = new Set<string>();

  /**
   * Tải ngầm (preload) toàn bộ ảnh vào cache trình duyệt.
   * Bất cứ ảnh nào lấy được từ Google Drive sẽ được tự động tống vào RAM từ từ.
   * Nhờ vậy sếp xem ảnh nào cũng 0ms delay.
   */
  private preloadAllPhotos(photos: GalleryPhoto[]) {
    if (!photos || photos.length === 0) return;

    photos.forEach((photo, index) => {
      const url = this.getPhotoSrc(photo);
      if (url && !this.preloadedUrls.has(url)) {
        this.preloadedUrls.add(url);
        
        // Tải rải đều ra (cách nhau 100ms) để không bị nghẽn mạng lúc vừa vào web
        setTimeout(() => {
          const img = new Image();
          img.src = url;
        }, index * 100);
      }
    });
  }
}
