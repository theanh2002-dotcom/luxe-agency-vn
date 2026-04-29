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

  constructor(private http: HttpClient) {}

  /**
   * List ảnh trong folder Drive.
   * Gọi: GET https://www.googleapis.com/drive/v3/files?q='folderId'+in+parents&key=xxx
   */
  listPhotosInFolder(folderId: string): Observable<GalleryPhoto[]> {
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

  /** Ảnh full (main viewer + lightbox) */
  getHighResUrl(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.thumbnailLink?.includes('googleusercontent.com')) {
      // Dùng =s1080-rw:
      // - s1080: Resize chính xác xuống 1080px (Không load ảnh gốc 4K rác RAM, 1080px là quá nét cho màn hình đt)
      // - -rw: Ép Google CDN trả về định dạng WEBP siêu nhẹ, giảm thêm 50% dung lượng so với JPEG
      return photo.thumbnailLink.split('=')[0] + '=s1080-rw';
    }
    return `https://drive.google.com/uc?export=view&id=${photo.fileId}`;
  }

  /** Thumbnail (grid + strip) */
  getThumbnailUrl(photo: GalleryPhoto): string {
    if (!photo) return '';
    if (photo.thumbnailLink?.includes('googleusercontent.com')) {
      // Thumbnail hiển thị bằng ngón tay nên chỉ cần =s200-rw (size 200px + WEBP)
      // Tránh lấy ảnh quá to rồi dùng CSS bóp xuống (gây lãng phí RAM/Băng thông)
      return photo.thumbnailLink.split('=')[0] + '=s200-rw';
    }
    return `https://drive.google.com/thumbnail?id=${photo.fileId}&sz=w200`;
  }

  /** Download link */
  getDownloadUrl(photo: GalleryPhoto): string {
    return `https://drive.google.com/uc?export=download&id=${photo.fileId}`;
  }
}
