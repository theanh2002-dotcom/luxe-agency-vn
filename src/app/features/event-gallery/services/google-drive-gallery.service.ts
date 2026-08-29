import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

export interface GalleryPhoto {
  // This is an opaque public media handle, never a Google Drive file id.
  mediaId: string;
  name: string;
  kind: 'image' | 'video';
  mimeType?: string;
  createdTime: string;
  thumbnailUrl: string;
  mediaUrl: string;
  lightboxUrl: string;
  downloadUrl: string;
  isNew?: boolean;
  _thumbError?: boolean;
  _mainError?: boolean;
}

interface PublicGalleryMedia {
  id: string;
  name: string;
  kind: 'image' | 'video';
  mimeType?: string;
  createdAt: string;
  thumbnailUrl: string;
  mediaUrl: string;
  lightboxUrl: string;
  downloadUrl: string;
}

interface PublicGalleryResponse {
  items?: PublicGalleryMedia[];
}

/**
 * Public gallery client.
 *
 * Google Drive is resolved by the server-side gallery API. The browser only
 * receives sanitized media metadata and opaque Cloudflare media URLs; it does
 * not carry an API key or provider-specific file metadata.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleDriveGalleryService {
  private legacyQueryValue: string | null = null;

  constructor(private http: HttpClient) {}

  /** Reads the manifest id carried by the desktop-generated QR link. */
  setLegacyQueryValue(value: string | null) {
    this.legacyQueryValue = value;
  }

  listPhotosInFolder(publicGalleryId: string): Observable<GalleryPhoto[]> {
    let params = new HttpParams().set('id', publicGalleryId);
    if (this.legacyQueryValue) params = params.set('m', this.legacyQueryValue);

    return this.http.get<PublicGalleryResponse | PublicGalleryMedia[]>('/api/gallery', { params }).pipe(
      map(response => {
        const items = Array.isArray(response) ? response : (response?.items || []);
        return items.map(item => this.fromPublicMedia(item));
      }),
      catchError(error => {
        console.error('[Gallery] Public gallery API error:', error);
        return of([]);
      })
    );
  }

  isVideo(photo: GalleryPhoto | null | undefined): boolean {
    if (!photo) return false;
    return photo.kind === 'video' || photo.mimeType?.toLowerCase().startsWith('video/') === true;
  }

  /** Browser playback URL supplied by the server-side gallery API. */
  getVideoUrl(photo: GalleryPhoto): string {
    return photo?.mediaUrl || '';
  }

  getHighResUrl(photo: GalleryPhoto, _size: number = 1440): string {
    return photo?.mediaUrl || '';
  }

  getLightboxUrl(photo: GalleryPhoto): string {
    return photo?.lightboxUrl || photo?.mediaUrl || '';
  }

  getThumbnailUrl(photo: GalleryPhoto): string {
    return photo?.thumbnailUrl || photo?.mediaUrl || '';
  }

  getDownloadUrl(photo: GalleryPhoto): string {
    return photo?.downloadUrl || photo?.mediaUrl || '';
  }

  private fromPublicMedia(item: PublicGalleryMedia): GalleryPhoto {
    return {
      mediaId: item.id,
      name: item.name || (item.kind === 'video' ? 'Video sự kiện' : 'Ảnh sự kiện'),
      kind: item.kind === 'video' ? 'video' : 'image',
      mimeType: item.mimeType,
      createdTime: item.createdAt || new Date().toISOString(),
      thumbnailUrl: item.thumbnailUrl || item.mediaUrl,
      mediaUrl: item.mediaUrl,
      lightboxUrl: item.lightboxUrl || item.mediaUrl,
      downloadUrl: item.downloadUrl || item.mediaUrl
    };
  }
}
