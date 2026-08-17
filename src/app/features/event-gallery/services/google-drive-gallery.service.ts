import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, switchMap, forkJoin } from 'rxjs';
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
      // Dùng cache-buster để tránh browser cache file JSON cũ
      const cb = new Date().getTime();
      return this.http.get<any>(`https://www.googleapis.com/drive/v3/files/${this.manifestId}?alt=media&key=${this.apiKey}&t=${cb}`).pipe(
        map(manifest => {
          const manifestArray = Array.isArray(manifest) ? manifest : [];
          // Lọc ra các session
          const sessions = manifestArray.filter(item => item?.type === 'session' && item?.folderId);
          if (sessions.length > 0) {
            const allFolderIds = sessions.map(s => s.folderId);
            
            // CHUNKING: Google Drive API 'q' parameter có giới hạn độ phức tạp.
            // Chia nhỏ thành các batch (tối đa 5 folder mỗi batch)
            const BATCH_SIZE = 5;
            const batches: Observable<GalleryPhoto[]>[] = [];
            
            for (let i = 0; i < allFolderIds.length; i += BATCH_SIZE) {
              const chunk = allFolderIds.slice(i, i + BATCH_SIZE);
              const folderIdsStr = chunk.join(',');
              batches.push(this.fetchFromDriveProxy(folderId, folderIdsStr));
            }
            
            // Gộp kết quả của tất cả các batch lại
            return forkJoin(batches).pipe(
              map((results: any[]) => {
                let combined: GalleryPhoto[] = [];
                for (const res of results) {
                  combined = combined.concat(res);
                }
                // Sắp xếp lại theo thời gian mới nhất
                return combined.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
              })
            );
          }
          // Nếu không phải event manifest (hoặc rỗng), fallback
          return of(this.fetchFromDriveProxy(folderId));
        }),
        catchError(err => {
          console.error('[Gallery] Failed to fetch manifest, falling back to folderId', err);
          return of(this.fetchFromDriveProxy(folderId));
        }),
        switchMap((obs: any) => obs instanceof Observable ? obs : of(obs))
      ) as any;
    }

    return this.fetchFromDriveProxy(folderId);
  }

  private fetchFromDriveProxy(folderId: string, folderIds?: string): Observable<GalleryPhoto[]> {
    const isLocalhost = window.location.hostname === 'localhost';
    const proxyUrl = isLocalhost ? this.DRIVE_API : `/api/drive`;
    
    let params: any = {};
    if (isLocalhost) {
      let parentQuery = '';
      if (folderIds) {
        const ids = folderIds.split(',').map(id => `'${id.trim()}' in parents`);
        parentQuery = `(${ids.join(' or ')})`;
      } else {
        parentQuery = `'${folderId}' in parents`;
      }
      params = {
        q: `${parentQuery} and trashed = false and mimeType contains 'image/'`,
        fields: 'files(id,name,thumbnailLink,webViewLink,createdTime)',
        orderBy: 'createdTime desc',
        pageSize: '100',
        key: this.apiKey
      };
    } else {
      params = { apiKey: this.apiKey };
      if (folderIds) params.folderIds = folderIds;
      else params.folderId = folderId;
    }

    return this.http.get<any>(proxyUrl, { params }).pipe(
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
