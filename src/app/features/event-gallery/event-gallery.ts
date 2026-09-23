import { Component, OnInit, OnDestroy, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { GoogleDriveGalleryService, GalleryPhoto, GallerySession } from './services/google-drive-gallery.service';

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
  sessions = signal<GallerySession[]>([]);
  activeSession = signal<GallerySession | null>(null);
  activeSessionMediaIndex = signal<number>(0);
  isSingleSession = signal<boolean>(false);
  selectedIndex = signal<number>(0);
  isLoading = signal<boolean>(true);
  isPolling = signal<boolean>(false);
  showLightbox = signal<boolean>(false);
  lightboxIndex = signal<number>(0);
  errorMessage = signal<string | null>(null);
  galleryStatus = signal<'PENDING' | 'READY'>('PENDING');
  viewMode = signal<'slideshow' | 'grid'>('slideshow');
  loadedImages = signal<Set<string>>(new Set());

  // ===== COMPUTED =====
  selectedPhoto = computed(() => this.photos()[this.selectedIndex()]);
  photoCount = computed(() => this.photos().length);
  sessionCount = computed(() => this.sessions().length);
  activeSessionMedia = computed(() => {
    const s = this.activeSession();
    if (!s) return [];
    return s.allMedia || [];
  });
  selectedSessionMedia = computed(() => {
    const list = this.activeSessionMedia();
    const idx = this.activeSessionMediaIndex();
    return list[idx] || list[0] || null;
  });
  currentLightboxMedia = computed<GalleryPhoto | null>(() => {
    const s = this.activeSession();
    if (s && s.allMedia && s.allMedia.length > 0) {
      return s.allMedia[this.activeSessionMediaIndex()] || s.allMedia[0];
    }
    return this.photos()[this.lightboxIndex()] || null;
  });

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
  private knownMediaIds = new Set<string>();
  private noNewPhotosSince = 0;
  private pollIntervalMs = 5000;
  private readonly POLL_BASE_MS = 5000;
  private readonly POLL_MAX_MS = 30000;
  private readonly AUTO_STOP_MS = 5 * 60 * 1000;
  private isSessionGallery = false;
  private readonly visibilityHandler = () => {
    if (document.hidden) this.stopPolling();
    else if (this.eventId && !this.errorMessage() && this.galleryStatus() === 'PENDING') this.startPolling();
  };

  // ===== LRU CACHE (giữ tối đa 20 ảnh gần nhất trong RAM) =====
  private lruCache = new Map<string, HTMLImageElement>();
  private readonly MAX_CACHE = 20;

  // ===== IOS WEB SHARE PREPARATION =====
  private preparedShareFile: File | null = null;
  private preparedShareMediaId: string | null = null;
  private sharePrepareAbort: AbortController | null = null;

  // Demo mode
  private demoPhotos: GalleryPhoto[] = [
    { mediaId: 'demo1', name: 'Khoảnh khắc hạnh phúc', kind: 'image', thumbnailUrl: 'photos/photo1.png', mediaUrl: 'photos/photo1.png', lightboxUrl: 'photos/photo1.png', downloadUrl: 'photos/photo1.png', createdTime: new Date().toISOString() },
    { mediaId: 'demo2', name: 'Lễ cắt bánh', kind: 'image', thumbnailUrl: 'photos/photo2.png', mediaUrl: 'photos/photo2.png', lightboxUrl: 'photos/photo2.png', downloadUrl: 'photos/photo2.png', createdTime: new Date().toISOString() },
    { mediaId: 'demo3', name: 'Trao nhẫn cưới', kind: 'image', thumbnailUrl: 'photos/photo3.png', mediaUrl: 'photos/photo3.png', lightboxUrl: 'photos/photo3.png', downloadUrl: 'photos/photo3.png', createdTime: new Date().toISOString() },
    { mediaId: 'demo4', name: 'Chân dung cặp đôi', kind: 'image', thumbnailUrl: 'photos/photo4.png', mediaUrl: 'photos/photo4.png', lightboxUrl: 'photos/photo4.png', downloadUrl: 'photos/photo4.png', createdTime: new Date().toISOString() },
  ];

  private demoSessions: GallerySession[] = [
    {
      sessionId: 'ses_demo2',
      sessionNumber: 2,
      timestamp: Date.now(),
      timeFormatted: '20:45',
      finalPhoto: { mediaId: 'demo1', name: 'Dải ảnh in #2', kind: 'image', thumbnailUrl: 'photos/photo1.png', mediaUrl: 'photos/photo1.png', lightboxUrl: 'photos/photo1.png', downloadUrl: 'photos/photo1.png', createdTime: new Date().toISOString(), sessionInfo: { sessionId: 'ses_demo2', sessionNumber: 2, timeFormatted: '20:45', shotCount: 2, hasBts: false, totalMediaCount: 3 } },
      shots: [
        { mediaId: 'demo2', name: 'Ảnh chụp 1', kind: 'image', thumbnailUrl: 'photos/photo2.png', mediaUrl: 'photos/photo2.png', lightboxUrl: 'photos/photo2.png', downloadUrl: 'photos/photo2.png', createdTime: new Date().toISOString() },
        { mediaId: 'demo3', name: 'Ảnh chụp 2', kind: 'image', thumbnailUrl: 'photos/photo3.png', mediaUrl: 'photos/photo3.png', lightboxUrl: 'photos/photo3.png', downloadUrl: 'photos/photo3.png', createdTime: new Date().toISOString() }
      ],
      allMedia: [
        { mediaId: 'demo1', name: 'Dải ảnh in #2', kind: 'image', thumbnailUrl: 'photos/photo1.png', mediaUrl: 'photos/photo1.png', lightboxUrl: 'photos/photo1.png', downloadUrl: 'photos/photo1.png', createdTime: new Date().toISOString() },
        { mediaId: 'demo2', name: 'Ảnh chụp 1', kind: 'image', thumbnailUrl: 'photos/photo2.png', mediaUrl: 'photos/photo2.png', lightboxUrl: 'photos/photo2.png', downloadUrl: 'photos/photo2.png', createdTime: new Date().toISOString() },
        { mediaId: 'demo3', name: 'Ảnh chụp 2', kind: 'image', thumbnailUrl: 'photos/photo3.png', mediaUrl: 'photos/photo3.png', lightboxUrl: 'photos/photo3.png', downloadUrl: 'photos/photo3.png', createdTime: new Date().toISOString() }
      ],
      mediaCount: 3
    },
    {
      sessionId: 'ses_demo1',
      sessionNumber: 1,
      timestamp: Date.now() - 600000,
      timeFormatted: '20:35',
      finalPhoto: { mediaId: 'demo4', name: 'Dải ảnh in #1', kind: 'image', thumbnailUrl: 'photos/photo4.png', mediaUrl: 'photos/photo4.png', lightboxUrl: 'photos/photo4.png', downloadUrl: 'photos/photo4.png', createdTime: new Date().toISOString(), sessionInfo: { sessionId: 'ses_demo1', sessionNumber: 1, timeFormatted: '20:35', shotCount: 1, hasBts: false, totalMediaCount: 2 } },
      shots: [
        { mediaId: 'demo3', name: 'Ảnh chụp 1', kind: 'image', thumbnailUrl: 'photos/photo3.png', mediaUrl: 'photos/photo3.png', lightboxUrl: 'photos/photo3.png', downloadUrl: 'photos/photo3.png', createdTime: new Date().toISOString() }
      ],
      allMedia: [
        { mediaId: 'demo4', name: 'Dải ảnh in #1', kind: 'image', thumbnailUrl: 'photos/photo4.png', mediaUrl: 'photos/photo4.png', lightboxUrl: 'photos/photo4.png', downloadUrl: 'photos/photo4.png', createdTime: new Date().toISOString() },
        { mediaId: 'demo3', name: 'Ảnh chụp 1', kind: 'image', thumbnailUrl: 'photos/photo3.png', mediaUrl: 'photos/photo3.png', lightboxUrl: 'photos/photo3.png', downloadUrl: 'photos/photo3.png', createdTime: new Date().toISOString() }
      ],
      mediaCount: 2
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private driveService: GoogleDriveGalleryService
  ) {
    // PREDICTIVE PRELOADING: chỉ preload ảnh current ± 1 (3 ảnh thay vì tất cả)
    effect(() => {
      const idx = this.selectedIndex();
      const all = this.photos();
      if (all.length === 0) {
        this.prepareShareFile(undefined);
        return;
      }

      const total = all.length;
      const targets = [
        (idx - 1 + total) % total,
        idx,
        (idx + 1) % total
      ];
      for (const i of targets) {
        this.preloadSingle(all[i]);
      }

      this.prepareShareFile(all[idx]);
    });
  }

  ngOnInit() {
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.route.paramMap.subscribe(params => {
      this.eventId = params.get('id');
      this.route.queryParamMap.subscribe(queryParams => {
        const legacyQueryValue = queryParams.get('m');
        const sessionPublicId = queryParams.get('s');
        this.isSessionGallery = Boolean(sessionPublicId);
        this.isSingleSession.set(Boolean(sessionPublicId));
        this.driveService.setRouteQuery(legacyQueryValue, sessionPublicId);
        this.loadInitialPhotos();
      });
    });
  }

  ngOnDestroy() {
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.lruCache.clear();
    this.sharePrepareAbort?.abort();
    this.sharePrepareAbort = null;
    this.preparedShareFile = null;
    this.preparedShareMediaId = null;
  }

  // ========== DATA LOADING ==========

  private loadInitialPhotos() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.knownMediaIds.clear();

    if (this.eventId && this.eventId.startsWith('demo')) {
      setTimeout(() => {
        this.photos.set(this.demoPhotos);
        this.sessions.set(this.demoSessions);
        this.demoPhotos.forEach(p => this.knownMediaIds.add(p.mediaId));
        this.isLoading.set(false);
      }, 800);
      return;
    }

    if (!this.eventId) return;

    this.loadGalleryPage(null, []);
  }

  private loadGalleryPage(cursor: string | null, accumulated: GalleryPhoto[]) {
    if (!this.eventId) return;
    this.driveService.listPhotosInFolder(this.eventId, cursor).subscribe({
      next: (result) => {
        const byId = new Map(accumulated.map(photo => [photo.mediaId, photo]));
        result.photos.forEach(photo => byId.set(photo.mediaId, photo));
        const photos = Array.from(byId.values());
        if (!this.isSessionGallery && result.status === 'READY' && result.nextCursor) {
          this.loadGalleryPage(result.nextCursor, photos);
          return;
        }
        if (result.sessions && result.sessions.length > 0) {
          this.sessions.set(result.sessions);
        }
        this.galleryStatus.set(result.status);
        this.photos.set(this.sortPhotos(photos));
        photos.forEach(p => this.knownMediaIds.add(p.mediaId));
        this.isLoading.set(false);
        if (result.status === 'PENDING') {
          this.pollIntervalMs = result.pollAfterMs || this.POLL_BASE_MS;
          this.startPolling();
        } else {
          this.stopPolling();
        }
      },
      error: (err) => {
        console.error('Failed to load photos:', err);
        this.errorMessage.set(this.describeGalleryError(err));
        this.isLoading.set(false);
      }
    });
  }

  // ========== POLLING (Exponential Backoff) ==========

  private startPolling() {
    if (this.pollTimeoutId || !this.eventId || this.errorMessage() || this.galleryStatus() !== 'PENDING') return;
    this.isPolling.set(true);
    this.noNewPhotosSince = Date.now();
    this.pollIntervalMs = Math.max(this.POLL_BASE_MS, Math.min(this.pollIntervalMs, this.POLL_MAX_MS));
    this.schedulePollTick();
  }

  private schedulePollTick() {
    this.pollTimeoutId = setTimeout(() => this.executePollTick(), this.pollIntervalMs);
  }

  private executePollTick() {
    if (!this.isPolling() || !this.eventId) return;

    this.driveService.listPhotosInFolder(this.eventId).subscribe({
      next: (result) => {
        if (!this.isSessionGallery && result.status === 'READY') {
          this.stopPolling();
          this.loadInitialPhotos();
          return;
        }
        const files = result.photos;
        this.galleryStatus.set(result.status);
        if (result.sessions && result.sessions.length > 0) {
          this.sessions.set(result.sessions);
          const curr = this.activeSession();
          if (curr) {
            const found = result.sessions.find(s => s.sessionId === curr.sessionId);
            if (found) this.activeSession.set(found);
          }
        }
        const newFiles = files.filter(f => !this.knownMediaIds.has(f.mediaId));

        if (newFiles.length > 0) {
          newFiles.forEach(f => { f.isNew = true; this.knownMediaIds.add(f.mediaId); });
          const selectedMediaId = this.selectedPhoto()?.mediaId;
          const merged = this.sortPhotos([...this.photos(), ...newFiles]);
          this.photos.set(merged);
          if (selectedMediaId) {
            const nextIndex = merged.findIndex(photo => photo.mediaId === selectedMediaId);
            if (nextIndex >= 0) this.selectedIndex.set(nextIndex);
          }
          this.noNewPhotosSince = Date.now();
          this.pollIntervalMs = this.POLL_BASE_MS; // Reset → poll nhanh lại

          setTimeout(() => {
            this.photos.update(current => current.map(p => ({ ...p, isNew: false })));
          }, 5000);
        } else {
          // Exponential backoff: ×1.5 mỗi lần không có ảnh mới (5s → 7.5s → 11s → ... → max 30s)
          this.pollIntervalMs = Math.min(Math.round(this.pollIntervalMs * 1.5), this.POLL_MAX_MS);
        }

        if (result.status === 'READY' && this.isSessionGallery) {
          this.stopPolling();
          return;
        }

        if (result.pollAfterMs) {
          this.pollIntervalMs = Math.max(this.pollIntervalMs, result.pollAfterMs);
        }
        if (Date.now() - this.noNewPhotosSince > this.AUTO_STOP_MS) {
          this.stopPolling();
          return;
        }
        this.schedulePollTick();
      },
      error: (err) => {
        this.errorMessage.set(this.describeGalleryError(err));
        this.stopPolling();
      }
    });
  }

  private sortPhotos(photos: GalleryPhoto[]): GalleryPhoto[] {
    return [...photos].sort((left, right) => {
      const leftVideo = this.isVideo(left) ? 1 : 0;
      const rightVideo = this.isVideo(right) ? 1 : 0;
      if (leftVideo !== rightVideo) return leftVideo - rightVideo;

      const leftTime = Date.parse(left.createdTime || '');
      const rightTime = Date.parse(right.createdTime || '');
      if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return 0;
    });
  }

  private stopPolling() {
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
    this.isPolling.set(false);
  }

  retryLoad() {
    this.errorMessage.set(null);
    this.stopPolling();
    this.loadInitialPhotos();
  }

  private describeGalleryError(error: any): string {
    const status = Number(error?.status || 0);
    if (status === 400 || status === 403) return 'Liên kết thư viện không hợp lệ hoặc không còn quyền truy cập.';
    if (status === 502 || status === 503) return 'Dịch vụ thư viện đang tạm thời gián đoạn. Vui lòng thử lại sau.';
    return 'Không thể tải ảnh. Vui lòng kiểm tra kết nối và thử lại.';
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

  openSessionByPhoto(photo: GalleryPhoto, index = 0) {
    this.lightboxIndex.set(index);
    let session = photo ? this.sessions().find(s => s.sessionId === photo.sessionId || s.finalPhoto?.mediaId === photo.mediaId) : null;
    if (session) {
      this.activeSession.set(session);
      this.activeSessionMediaIndex.set(0);
      if (session.allMedia[0]) this.preloadSingle(session.allMedia[0], 2160);
    } else {
      this.activeSession.set(null);
      this.activeSessionMediaIndex.set(0);
      if (photo) this.preloadSingle(photo, 2160);
    }
    this.showLightbox.set(true);
    document.body.style.overflow = 'hidden';
  }

  openLightbox(index: number) {
    const photo = this.photos()[index];
    if (photo) {
      this.openSessionByPhoto(photo, index);
    }
  }

  selectSessionMedia(index: number) {
    this.activeSessionMediaIndex.set(index);
    const media = this.activeSessionMedia()[index];
    if (media) this.preloadSingle(media, 2160);
  }

  closeLightbox() {
    this.showLightbox.set(false);
    this.activeSession.set(null);
    this.activeSessionMediaIndex.set(0);
    document.body.style.overflow = '';
  }

  lightboxPrev() {
    const session = this.activeSession();
    if (session && session.allMedia && session.allMedia.length > 1) {
      const total = session.allMedia.length;
      this.activeSessionMediaIndex.update(i => (i - 1 + total) % total);
      const cur = session.allMedia[this.activeSessionMediaIndex()];
      if (cur) this.preloadSingle(cur, 2160);
      return;
    }
    const total = this.photoCount();
    this.lightboxIndex.update(i => (i - 1 + total) % total);
    const cur = this.photos()[this.lightboxIndex()];
    if (cur) this.preloadSingle(cur, 2160);
  }

  lightboxNext() {
    const session = this.activeSession();
    if (session && session.allMedia && session.allMedia.length > 1) {
      const total = session.allMedia.length;
      this.activeSessionMediaIndex.update(i => (i + 1) % total);
      const cur = session.allMedia[this.activeSessionMediaIndex()];
      if (cur) this.preloadSingle(cur, 2160);
      return;
    }
    const total = this.photoCount();
    this.lightboxIndex.update(i => (i + 1) % total);
    const cur = this.photos()[this.lightboxIndex()];
    if (cur) this.preloadSingle(cur, 2160);
  }

  downloadCurrentLightboxMedia() {
    const media = this.currentLightboxMedia();
    if (media) this.downloadPhoto(media);
  }

  async downloadActiveSession() {
    const mediaList = this.activeSessionMedia();
    for (let i = 0; i < mediaList.length; i++) {
      this.directDownloadPhoto(mediaList[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
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
    if (!this.isIOSDevice()) {
      this.directDownloadPhoto(photo);
      return;
    }

    if (typeof navigator.share !== 'function') {
      this.directDownloadPhoto(photo);
      return;
    }

    const file = this.preparedShareFile;
    if (!file || this.preparedShareMediaId !== photo.mediaId) {
      this.prepareShareFile(photo);
      return;
    }

    try {
      if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) {
        const mediaType = this.isVideo(photo) ? 'video' : 'image';
        console.warn(`[Gallery] Prepared ${mediaType} cannot be shared on this iOS browser`);
        return;
      }

      navigator.share({ files: [file] }).catch(error => {
        if (this.isShareNoFallbackError(error)) return;

        console.warn('[Gallery] Image share failed; falling back to direct download:', error);
        this.directDownloadPhoto(photo);
      });
    } catch (error) {
      if (this.isShareNoFallbackError(error)) return;

      console.warn('[Gallery] Image share could not start; falling back to direct download:', error);
      this.directDownloadPhoto(photo);
    }
  }

  async downloadAllPhotos() {
    const photos = this.photos();
    for (let i = 0; i < photos.length; i++) {
      this.directDownloadPhoto(photos[i]);
      // Tăng delay trên iOS để Safari kịp xử lý popup tải về, hoặc giữ nguyên 800ms
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private directDownloadPhoto(photo: GalleryPhoto): void {
    const url = this.driveService.getDownloadUrl(photo);

    if (this.isIOSDevice()) {
      // Safari iOS xử lý download cross-origin ổn định hơn khi navigation được
      // tạo bởi chính click gesture. Worker sẽ trả Content-Disposition: attachment.
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = photo.name || 'event-media';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      // Các trình duyệt khác có thể dùng iframe ẩn để tải mượt mà không bị giật nháy tab
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 5000);
    }
  }

  private prepareShareFile(photo: GalleryPhoto | undefined): void {
    if (photo && this.preparedShareMediaId === photo.mediaId &&
      (this.preparedShareFile || this.sharePrepareAbort)) {
      return;
    }

    this.sharePrepareAbort?.abort();
    this.sharePrepareAbort = null;
    this.preparedShareFile = null;
    this.preparedShareMediaId = null;

    if (!photo || !this.isIOSDevice()) return;

    const url = this.driveService.getDownloadUrl(photo);
    if (!url) return;

    const controller = new AbortController();
    this.sharePrepareAbort = controller;
    this.preparedShareMediaId = photo.mediaId;

    void fetch(url, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Download request failed with status ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        if (controller.signal.aborted || this.sharePrepareAbort !== controller) return;

        const mimeType = this.getShareMimeType(photo);
        const fileName = photo.name?.trim() || (this.isVideo(photo) ? 'event-media.mp4' : 'event-media.jpg');
        this.preparedShareFile = new File([blob], fileName, { type: mimeType });
        this.sharePrepareAbort = null;
      })
      .catch(error => {
        if (this.isShareAbortError(error) || controller.signal.aborted) return;
        if (this.sharePrepareAbort === controller) {
          this.sharePrepareAbort = null;
          this.preparedShareFile = null;
          this.preparedShareMediaId = null;
          console.warn('[Gallery] Could not prepare image for sharing:', error);
        }
      });
  }

  private getShareMimeType(photo: GalleryPhoto): string {
    const mimeType = photo.mimeType?.trim();
    const mediaType = this.isVideo(photo) ? 'video' : 'image';
    const fallback = this.isVideo(photo) ? 'video/mp4' : 'image/jpeg';
    return mimeType && new RegExp(`^${mediaType}/[a-z0-9.+-]+$`, 'i').test(mimeType) ? mimeType : fallback;
  }

  private isIOSDevice(): boolean {
    if (typeof navigator === 'undefined') return false;

    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document);
  }

  private isShareAbortError(error: unknown): boolean {
    return typeof error === 'object' && error !== null &&
      'name' in error && (error as { name?: unknown }).name === 'AbortError';
  }

  private isShareNoFallbackError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('name' in error)) return false;

    const name = (error as { name?: unknown }).name;
    return name === 'AbortError' || name === 'NotAllowedError' || name === 'InvalidStateError';
  }

  // ========== SWIPE GESTURES ==========

  private touchStartX = 0;
  private touchStartTouchCount = 0;
  private touchGestureCancelled = false;

  onTouchStart(event: TouchEvent) {
    this.touchStartTouchCount = event.touches.length;
    this.touchGestureCancelled = event.touches.length !== 1;
    if (!this.touchGestureCancelled) {
      this.touchStartX = event.touches[0].clientX;
    }
  }

  onTouchMove(event: TouchEvent) {
    // A second finger means pinch/viewport zoom, never a gallery swipe.
    if (event.touches.length !== 1) {
      this.touchGestureCancelled = true;
    }
  }

  onTouchEnd(event: TouchEvent) {
    if (this.touchGestureCancelled || this.touchStartTouchCount !== 1 || event.changedTouches.length !== 1) {
      this.resetTouchGesture();
      return;
    }

    const diff = this.touchStartX - event.changedTouches[0].clientX;
    this.resetTouchGesture();
    if (Math.abs(diff) > 50) {
      if (diff > 0) this.lightboxNext();
      else this.lightboxPrev();
    }
  }

  onTouchEndMain(event: TouchEvent) {
    if (this.touchGestureCancelled || this.touchStartTouchCount !== 1 || event.changedTouches.length !== 1) {
      this.resetTouchGesture();
      return;
    }

    const diff = this.touchStartX - event.changedTouches[0].clientX;
    this.resetTouchGesture();
    if (Math.abs(diff) > 50) {
      if (diff > 0) this.navigateNext();
      else this.navigatePrev();
    }
  }

  private resetTouchGesture() {
    this.touchStartX = 0;
    this.touchStartTouchCount = 0;
    this.touchGestureCancelled = false;
  }

  // ========== IMAGE URL HELPERS ==========

  isVideo(photo: GalleryPhoto): boolean {
    return this.driveService.isVideo(photo);
  }

  /** Main photo: s1080 (không -rw, chất lượng cao) */
  getPhotoSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.mediaId.startsWith('demo')) return photo.mediaUrl;
    return this.driveService.getHighResUrl(photo, 1080);
  }

  getVideoSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    return this.driveService.getVideoUrl(photo);
  }

  /** Retina srcset: Cung cấp nhiều mốc kích thước để trình duyệt tự chọn */
  getRetinaSrcset(photo: GalleryPhoto): string {
    if (!photo || this.isVideo(photo) || photo.mediaId.startsWith('demo') || photo._mainError) return '';
    const s800 = this.driveService.getHighResUrl(photo, 800);
    const s1440 = this.driveService.getHighResUrl(photo, 1440);
    const s2160 = this.driveService.getHighResUrl(photo, 2160);
    return `${s800} 800w, ${s1440} 1440w, ${s2160} 2160w`;
  }

  getSizesAttr(): string {
    return "(max-width: 768px) 100vw, 80vw";
  }

  onImageLoad(mediaId: string) {
    if (mediaId) {
      this.loadedImages.update(set => {
        const newSet = new Set(set);
        newSet.add(mediaId);
        return newSet;
      });
    }
  }

  /** Lightbox: 2560px cho zoom */
  getLightboxSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.mediaId.startsWith('demo')) return photo.mediaUrl;
    return this.driveService.getLightboxUrl(photo);
  }

  /** Grid preview: 2560px ảnh gốc sắc nét, video dùng thumbnail poster */
  getPreviewSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (this.isVideo(photo)) return this.getThumbSrc(photo);
    return this.getLightboxSrc(photo);
  }

  /** Thumbnail: s200-rw (nhẹ, WebP) */
  getThumbSrc(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.mediaId.startsWith('demo')) return photo.thumbnailUrl;
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
    // Video playback is intentionally user initiated. Preloading it as an
    // Image would request a poster/HTML response and waste bandwidth.
    if (!photo || this.isVideo(photo)) return;
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
