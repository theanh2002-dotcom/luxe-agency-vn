import { Component, OnInit, OnDestroy, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { GoogleDriveGalleryService, GalleryPhoto } from './services/google-drive-gallery.service';

/** Wrapper cho windowing - giữ index gốc để opacity toggle đúng */
export interface VisiblePhoto {
  photo: GalleryPhoto;
  originalIndex: number;
}

@Component({
  selector: 'app-event-gallery',
  imports: [CommonModule],
  templateUrl: './event-gallery.html',
  styleUrl: './event-gallery.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventGallery implements OnInit, OnDestroy {
  eventId: string | null = '';

  // ===== STATE SIGNALS =====
  photos = signal<GalleryPhoto[]>([]);
  selectedIndex = signal<number>(0);
  isLoading = signal<boolean>(true);
  isPolling = signal<boolean>(false);
  showLightbox = signal<boolean>(false);
  lightboxIndex = signal<number>(0);
  errorMessage = signal<string | null>(null);
  viewMode = signal<'slideshow' | 'grid'>('slideshow');
  loadedImages = signal<Set<string>>(new Set());

  // ===== COMPUTED =====
  selectedPhoto = computed(() => this.photos()[this.selectedIndex()]);
  photoCount = computed(() => this.photos().length);

  /**
   * WINDOWING: Chỉ render ±2 ảnh xung quanh ảnh đang xem trong DOM.
   * 100 ảnh → chỉ 5 thẻ <img> trong DOM → không bao giờ lag mobile.
   */
  visibleMainPhotos = computed<VisiblePhoto[]>(() => {
    const all = this.photos();
    const idx = this.selectedIndex();
    const total = all.length;
    if (total === 0) return [];

    const WINDOW = 2;
    const seen = new Set<number>();
    const result: VisiblePhoto[] = [];

    for (let offset = -WINDOW; offset <= WINDOW; offset++) {
      const i = (idx + offset + total) % total;
      if (!seen.has(i)) {
        seen.add(i);
        result.push({ photo: all[i], originalIndex: i });
      }
    }
    return result;
  });

  // ===== POLLING CONFIG (Exponential Backoff) =====
  private pollTimeoutId: any = null;
  private knownFileIds = new Set<string>();
  private noNewPhotosSince = 0;
  private pollIntervalMs = 5000;
  private readonly POLL_BASE_MS = 5000;
  private readonly POLL_MAX_MS = 30000;
  private readonly AUTO_STOP_MS = 5 * 60 * 1000;

  // ===== LRU CACHE (giữ tối đa 20 ảnh gần nhất trong RAM) =====
  private lruCache = new Map<string, HTMLImageElement>();
  private readonly MAX_CACHE = 20;

  // Demo mode
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
    // PREDICTIVE PRELOADING: chỉ preload ảnh current ± 1 (3 ảnh thay vì tất cả)
    effect(() => {
      const idx = this.selectedIndex();
      const all = this.photos();
      if (all.length === 0) return;

      const total = all.length;
      const targets = [
        (idx - 1 + total) % total,
        idx,
        (idx + 1) % total
      ];
      for (const i of targets) {
        this.preloadSingle(all[i]);
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.eventId = params.get('id');
      this.route.queryParamMap.subscribe(queryParams => {
        const manifestId = queryParams.get('m');
        this.driveService.setManifestId(manifestId);
        this.loadInitialPhotos();
      });
    });
  }

  ngOnDestroy() {
    this.stopPolling();
    this.lruCache.clear();
  }

  // ========== DATA LOADING ==========

  private loadInitialPhotos() {
    this.isLoading.set(true);

    if (this.eventId && this.eventId.startsWith('demo')) {
      setTimeout(() => {
        this.photos.set(this.demoPhotos);
        this.demoPhotos.forEach(p => this.knownFileIds.add(p.fileId));
        this.isLoading.set(false);
      }, 800);
      return;
    }

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

  // ========== POLLING (Exponential Backoff) ==========

  private startPolling() {
    if (this.pollTimeoutId || !this.eventId) return;
    this.isPolling.set(true);
    this.noNewPhotosSince = Date.now();
    this.pollIntervalMs = this.POLL_BASE_MS;
    this.schedulePollTick();
  }

  private schedulePollTick() {
    this.pollTimeoutId = setTimeout(() => this.executePollTick(), this.pollIntervalMs);
  }

  private executePollTick() {
    if (!this.isPolling() || !this.eventId) return;

    this.driveService.listPhotosInFolder(this.eventId).subscribe({
      next: (files) => {
        const newFiles = files.filter(f => !this.knownFileIds.has(f.fileId));

        if (newFiles.length > 0) {
          newFiles.forEach(f => { f.isNew = true; this.knownFileIds.add(f.fileId); });
          this.photos.update(current => [...newFiles, ...current]);
          this.noNewPhotosSince = Date.now();
          this.pollIntervalMs = this.POLL_BASE_MS; // Reset → poll nhanh lại

          setTimeout(() => {
            this.photos.update(current => current.map(p => ({ ...p, isNew: false })));
          }, 5000);
        } else {
          // Exponential backoff: ×1.5 mỗi lần không có ảnh mới (5s → 7.5s → 11s → ... → max 30s)
          this.pollIntervalMs = Math.min(Math.round(this.pollIntervalMs * 1.5), this.POLL_MAX_MS);
        }

        if (Date.now() - this.noNewPhotosSince > this.AUTO_STOP_MS) {
          this.stopPolling();
          return;
        }
        this.schedulePollTick();
      },
      error: () => {
        this.pollIntervalMs = Math.min(this.pollIntervalMs * 2, this.POLL_MAX_MS);
        this.schedulePollTick();
      }
    });
  }

  private stopPolling() {
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
    this.isPolling.set(false);
  }

  // ========== UI ACTIONS ==========

  private syncScrollAnimations(index: number) {
    requestAnimationFrame(() => {
      const mainEl = document.querySelector('.gallery-main-photo');
      mainEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

    // Preload lightbox ảnh kế tiếp ở độ phân giải cao
    const total = this.photoCount();
    [index, (index - 1 + total) % total, (index + 1) % total].forEach(i => {
      this.preloadSingle(this.photos()[i], 2160);
    });
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
    
    // Phát hiện thiết bị iOS (iPhone/iPad/iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.userAgent.includes("Mac") && "ontouchend" in document);

    if (isIOS) {
      // Trên iOS, dùng window.location.href sẽ kích hoạt bảng thông báo tải xuống (Download prompt) của Safari mượt hơn
      // mà không bị dính lỗi mở tab mới chỉ xem ảnh.
      window.location.href = url;
    } else {
      // Các trình duyệt khác có thể dùng iframe ẩn để tải mượt mà không bị giật nháy tab
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 5000);
    }
  }

  async downloadAllPhotos() {
    const photos = this.photos();
    for (let i = 0; i < photos.length; i++) {
      this.downloadPhoto(photos[i]);
      // Tăng delay trên iOS để Safari kịp xử lý popup tải về, hoặc giữ nguyên 800ms
      await new Promise(resolve => setTimeout(resolve, 1000));
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

  onTouchEndMain(event: TouchEvent) {
    const diff = this.touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) this.navigateNext();
      else this.navigatePrev();
    }
  }

  // ========== IMAGE URL HELPERS ==========

  /** Main photo: s1080 (không -rw, chất lượng cao) */
  getPhotoSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.fileId.startsWith('demo')) return photo.thumbnailLink;
    if (photo._mainError) return this.driveService.getDownloadUrl(photo);
    return this.driveService.getHighResUrl(photo, 1080);
  }

  /** Retina srcset: Cung cấp nhiều mốc kích thước để trình duyệt tự chọn */
  getRetinaSrcset(photo: GalleryPhoto): string {
    if (!photo || photo.fileId.startsWith('demo') || photo._mainError) return '';
    const s800 = this.driveService.getHighResUrl(photo, 800);
    const s1440 = this.driveService.getHighResUrl(photo, 1440);
    const s2160 = this.driveService.getHighResUrl(photo, 2160);
    return `${s800} 800w, ${s1440} 1440w, ${s2160} 2160w`;
  }

  getSizesAttr(): string {
    return "(max-width: 768px) 100vw, 80vw";
  }

  onImageLoad(fileId: string) {
    if (fileId) {
      this.loadedImages.update(set => {
        const newSet = new Set(set);
        newSet.add(fileId);
        return newSet;
      });
    }
  }

  /** Lightbox: 2560px cho zoom */
  getLightboxSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.fileId.startsWith('demo')) return photo.thumbnailLink;
    if (photo._mainError) return this.driveService.getDownloadUrl(photo);
    return this.driveService.getLightboxUrl(photo);
  }

  /** Thumbnail: s200-rw (nhẹ, WebP) */
  getThumbSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.fileId.startsWith('demo')) return photo.thumbnailLink;
    if (photo._thumbError) return this.driveService.getHighResUrl(photo, 400);
    return this.driveService.getThumbnailUrl(photo);
  }

  // ========== ERROR HANDLING ==========

  onThumbError(photo: GalleryPhoto) {
    if (!photo._thumbError) {
      photo._thumbError = true;
      this.photos.update(pts => [...pts]);
    }
  }

  onMainError(photo: GalleryPhoto) {
    if (!photo._mainError) {
      photo._mainError = true;
      this.photos.update(pts => [...pts]);
    }
  }

  // ========== LRU CACHE + PREDICTIVE PRELOAD ==========

  /**
   * Preload 1 ảnh vào LRU Cache + gọi decode() trước để 0 jank khi chuyển ảnh.
   * Cache giữ tối đa MAX_CACHE ảnh, evict ảnh cũ nhất khi đầy.
   */
  private preloadSingle(photo: GalleryPhoto, size: number = 1080) {
    if (!photo) return;
    const url = size <= 1080
      ? this.getPhotoSrc(photo)
      : this.driveService.getHighResUrl(photo, size);
    if (!url) return;

    // LRU touch: di chuyển về cuối Map nếu đã có
    if (this.lruCache.has(url)) {
      const img = this.lruCache.get(url)!;
      this.lruCache.delete(url);
      this.lruCache.set(url, img);
      return;
    }

    const img = new Image();
    img.src = url;
    // decode() ngầm → đảm bảo GPU đã giải mã xong pixel trước khi hiển thị → 0 giật frame
    img.decode().catch(() => {});

    this.lruCache.set(url, img);

    // Evict ảnh cũ nhất nếu vượt ngưỡng
    while (this.lruCache.size > this.MAX_CACHE) {
      const oldestKey = this.lruCache.keys().next().value;
      if (oldestKey) this.lruCache.delete(oldestKey);
      else break;
    }
  }
}
