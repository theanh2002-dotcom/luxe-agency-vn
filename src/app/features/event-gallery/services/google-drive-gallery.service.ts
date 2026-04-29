import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface GalleryPhoto {
  fileId: string;
  name: string;
  webViewLink: string;
  thumbnailLink: string;
  createdTime: string;
  isNew?: boolean;
  _thumbError?: boolean;
  _mainError?: boolean;
}

/**
 * Gọi trực tiếp Google Drive REST API từ frontend.
 * 
 * KHÔNG cần backend - hoạt động 100% trên Vercel.
 * 
 * Điều kiện:
 *   - Folder Drive phải share "Anyone with the link → Viewer"
 *   - Cần 1 API Key (miễn phí, tạo trong Google Cloud Console)
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleDriveGalleryService {

  private readonly DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
  private readonly apiKey = environment.googleDriveApiKey;
  private manifestId: string | null = null;

  constructor(private http: HttpClient) {}

  setManifestId(id: string | null) {
    this.manifestId = id;
  }

  /**
   * List ảnh trong folder Drive.
   * Ưu tiên tải _manifest.json nếu có (để tránh giới hạn quota API).
   * Nếu không có manifest, fallback về gọi API cũ.
   */
  listPhotosInFolder(folderId: string): Observable<GalleryPhoto[]> {
    if (this.manifestId) {
      // Gọi file manifest qua API (alt=media) để bypass CORS. Thêm tham số t=Date.now() để phá Cache của trình duyệt!
      const manifestUrl = `${this.DRIVE_API}/${this.manifestId}?alt=media&key=${this.apiKey}&t=${Date.now()}`;
      return this.http.get<any[]>(manifestUrl).pipe(
        map(files => {
          if (!Array.isArray(files)) return [];
          // Sắp xếp giảm dần theo createdTime (mới nhất lên đầu)
          return files.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
            .map(f => ({
              fileId: f.fileId,
              name: f.name,
              webViewLink: `https://drive.google.com/file/d/${f.fileId}/view`,
              thumbnailLink: '', // Manifest không có thumbnailLink, URL helper sẽ dùng fileId
              createdTime: f.createdTime
            } as GalleryPhoto));
        }),
        catchError(err => {
          console.error('[Gallery] Manifest download error:', err);
          return of([]);
        })
      );
    }

    // Fallback: Gọi Drive API
    const params = {
      q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: 'files(id,name,thumbnailLink,webViewLink,createdTime)',
      orderBy: 'createdTime desc',
      pageSize: '100',
      key: this.apiKey
    };

    return this.http.get<any>(this.DRIVE_API, { params }).pipe(
      map(res => (res.files || []).map((f: any) => ({
        fileId: f.id,
        name: f.name,
        webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        thumbnailLink: f.thumbnailLink || '',
        createdTime: f.createdTime
      } as GalleryPhoto))),
      catchError(err => {
        console.error('[Gallery] Drive API error:', err);
        return of([]);
      })
    );
  }

  /** Ảnh full (main viewer) - size tùy chỉnh, KHÔNG dùng -rw để giữ chất lượng cao cho ảnh nghệ thuật */
  getHighResUrl(photo: GalleryPhoto, size: number = 1080): string {
    if (!photo) return '';
    if (photo.thumbnailLink?.includes('googleusercontent.com')) {
      return photo.thumbnailLink.split('=')[0] + `=s${size}`;
    }
    // Fallback CDN link nếu không có thumbnailLink (khi fetch từ manifest)
    return `https://lh3.googleusercontent.com/d/${photo.fileId}=s${size}`;
  }

  /** Lightbox: 2160px cho zoom retina */
  getLightboxUrl(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.thumbnailLink?.includes('googleusercontent.com')) {
      return photo.thumbnailLink.split('=')[0] + '=s2160';
    }
    return `https://lh3.googleusercontent.com/d/${photo.fileId}=s2160`;
  }

  /** Thumbnail (grid + strip) - giữ -rw cho nhẹ, size nhỏ không ảnh hưởng chất lượng */
  getThumbnailUrl(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.thumbnailLink?.includes('googleusercontent.com')) {
      return photo.thumbnailLink.split('=')[0] + '=s200-rw';
    }
    return `https://lh3.googleusercontent.com/d/${photo.fileId}=s200-rw`;
  }

  /** Download link */
  getDownloadUrl(photo: GalleryPhoto): string {
    return `https://drive.google.com/uc?export=download&id=${photo.fileId}`;
  }
}
