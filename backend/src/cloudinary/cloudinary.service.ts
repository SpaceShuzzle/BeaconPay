import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';

const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export interface DeleteImageResult {
  result: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly maxFileSizeBytes: number;
  private readonly allowedMimeTypes: string[];

  constructor(private readonly configService: ConfigService) {
    this.maxFileSizeBytes =
      this.configService.get<number>('CLOUDINARY_MAX_FILE_SIZE_BYTES') ??
      DEFAULT_MAX_FILE_SIZE_BYTES;

    const configuredTypes = this.configService.get<string>(
      'CLOUDINARY_ALLOWED_MIME_TYPES',
    );
    this.allowedMimeTypes = configuredTypes
      ? configuredTypes.split(',').map((t) => t.trim())
      : DEFAULT_ALLOWED_MIME_TYPES;

    // Fail fast, with a clear message, at construction time rather than
    // letting the first upload attempt fail deep inside the Cloudinary SDK
    // with a less obvious "Must supply cloud_name" error.
    const { cloud_name } = cloudinary.config();
    if (!cloud_name) {
      this.logger.warn(
        'Cloudinary is not configured (missing cloud_name) — uploads will fail until CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET are set.',
      );
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<UploadApiResponse> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder:
            folder ||
            this.configService.get<string>('CLOUDINARY_FOLDER') ||
            'profile-pictures',
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        },
        (error: UploadApiErrorResponse | undefined, result) => {
          if (error) {
            this.logger.error(
              `Cloudinary upload failed: ${error.message}`,
              error.http_code ? `HTTP ${error.http_code}` : undefined,
            );
            return reject(
              new BadRequestException(
                `Failed to upload image: ${error.message}`,
              ),
            );
          }
          if (!result) {
            return reject(
              new BadRequestException(
                'Cloudinary returned no result for the upload',
              ),
            );
          }
          resolve(result);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  /**
   * Validates the file before it's sent to Cloudinary, so obviously-bad
   * input (wrong type, too large, empty buffer) fails immediately with a
   * clear 400 instead of round-tripping to Cloudinary first — or worse,
   * silently succeeding, since `resource_type: 'auto'` will happily accept
   * non-image files (PDFs, videos, arbitrary binaries) with no complaint.
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No file provided or file is empty');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > this.maxFileSizeBytes) {
      const maxMb = (this.maxFileSizeBytes / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is ${maxMb}MB.`,
      );
    }
  }

  async deleteImage(publicId: string): Promise<DeleteImageResult> {
    if (!publicId?.trim()) {
      throw new BadRequestException('publicId is required');
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId);

      // Cloudinary's destroy() resolves (doesn't reject) even when the
      // asset doesn't exist — result.result is 'not found' rather than an
      // error. Surface that distinctly from an actual failure, since
      // "already deleted / never existed" is often fine to treat as a
      // no-op by the caller rather than a hard error.
      if (result.result !== 'ok' && result.result !== 'not found') {
        this.logger.warn(
          `Cloudinary destroy returned unexpected result "${result.result}" for publicId "${publicId}"`,
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to delete Cloudinary image "${publicId}": ${message}`,
      );
      throw new BadRequestException(
        `Failed to delete image from Cloudinary: ${message}`,
      );
    }
  }

  /**
   * Extracts the public_id from a Cloudinary delivery URL, e.g.:
   *   https://res.cloudinary.com/demo/image/upload/v1699999999/profile-pictures/users/abc123.jpg
   *   -> "profile-pictures/users/abc123"
   *
   * Handles what the original split-by-'/' version couldn't:
   *   - Nested folders of any depth (not just one level)
   *   - The version segment (`v` + digits) that real delivery URLs include
   *   - Malformed/non-Cloudinary URLs (throws instead of returning garbage)
   *
   * Does NOT attempt to strip transformation segments (e.g. `w_500,h_500`)
   * that appear between `/upload/` and the version — if you generate URLs
   * with inline transformations applied, store the public_id separately
   * rather than round-tripping it through this method.
   */
  extractPublicIdFromUrl(url: string): string {
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      throw new BadRequestException(`Not a valid URL: "${url}"`);
    }

    const segments = pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');

    if (uploadIndex === -1 || uploadIndex === segments.length - 1) {
      throw new BadRequestException(
        `Could not find an "upload" segment with a following path in URL: "${url}"`,
      );
    }

    let remaining = segments.slice(uploadIndex + 1);

    // Drop the version segment if present (e.g. "v1699999999").
    if (/^v\d+$/.test(remaining[0])) {
      remaining = remaining.slice(1);
    }

    if (remaining.length === 0) {
      throw new BadRequestException(
        `No path segments found after "/upload/" in URL: "${url}"`,
      );
    }

    // Strip only the final extension from the last segment, preserving any
    // dots that are legitimately part of the public_id itself.
    const lastIndex = remaining.length - 1;
    const lastSegment = remaining[lastIndex];
    const dotIndex = lastSegment.lastIndexOf('.');
    remaining[lastIndex] =
      dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;

    return remaining.join('/');
  }
}