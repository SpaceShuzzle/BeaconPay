import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NodeClam from 'clamscan';

/**
 * Wraps ClamAV (via the `clamscan` npm package, talking to a `clamd`
 * daemon) for scanning uploaded file buffers.
 *
 * SECURITY NOTE: the previous version of `scanMalware` was a stub that
 * unconditionally returned `true` ("clean") for every file, meaning
 * every caller had false confidence that scanning was happening when it
 * categorically was not. This implementation fails CLOSED instead: if
 * scanning is enabled but the scanner is unreachable or errors,
 * `scanMalware` THROWS rather than silently reporting the file as clean.
 * If you need scanning off for local development (no clamd running),
 * that must be explicit via `CLAMAV_ENABLED=false` — never an
 * accidental side effect of the scanner being down.
 *
 * Requires:
 *   npm install clamscan
 * ...and a reachable ClamAV daemon (clamd). Configure via:
 *   CLAMAV_ENABLED     — 'false' to explicitly disable scanning (default: enabled)
 *   CLAMAV_HOST        — clamd host (default: 'localhost')
 *   CLAMAV_PORT        — clamd TCP port (default: 3310)
 *   CLAMAV_TIMEOUT_MS  — scan timeout in ms (default: 60000)
 */
@Injectable()
export class FileUploadService implements OnModuleInit {
  private readonly logger = new Logger(FileUploadService.name);
  private clamscan: NodeClam | null = null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    // Defaults to enabled — scanning must be explicitly turned off, never
    // accidentally left off.
    this.enabled =
      this.configService.get<string>('CLAMAV_ENABLED') !== 'false';
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        'Malware scanning is DISABLED via CLAMAV_ENABLED=false. ' +
          'All uploaded files will be treated as clean WITHOUT being scanned. ' +
          'This should never be the case in production.',
      );
      return;
    }

    try {
      this.clamscan = await new NodeClam().init({
        clamdscan: {
          host: this.configService.get<string>('CLAMAV_HOST', 'localhost'),
          port: this.configService.get<number>('CLAMAV_PORT', 3310),
          timeout: this.configService.get<number>(
            'CLAMAV_TIMEOUT_MS',
            60_000,
          ),
        },
      });
      this.logger.log('ClamAV malware scanner initialized');
    } catch (err) {
      // Don't crash app bootstrap over this, but make it impossible to
      // miss that scanning isn't actually working — scanMalware() below
      // will throw on every call until this is resolved, rather than
      // quietly behaving as if nothing's wrong.
      this.logger.error(
        `Failed to initialize ClamAV scanner: ${this.errorMessage(err)}. ` +
          `Uploads will be rejected until this is resolved (scanning fails closed).`,
      );
      this.clamscan = null;
    }
  }

  /**
   * Scans a file buffer for malware.
   *
   * Returns `true` only when the file was actually scanned and found
   * clean (or scanning was explicitly disabled via config). Throws
   * `ServiceUnavailableException` if scanning is enabled but the scanner
   * isn't available or the scan itself fails — callers should treat that
   * as "reject this upload and ask the user to retry," not as permission
   * to proceed as if the file were clean.
   */
  async scanMalware(buffer: Buffer): Promise<boolean> {
    if (!this.enabled) {
      // Explicitly opted out via config — see the warning logged in
      // onModuleInit. Not a silent fallback path.
      return true;
    }

    if (!this.clamscan) {
      throw new ServiceUnavailableException(
        'Malware scanner is not available — refusing to accept the upload rather than skipping the scan.',
      );
    }

    this.logger.debug(`Scanning file buffer of size ${buffer.length} bytes`);

    try {
      // NOTE: verify this call against your installed `clamscan` version —
      // the package's API has changed across major versions (e.g.
      // `is_infected` -> `isInfected`). Written against the current
      // documented `scanBuffer` API returning { isInfected, viruses }.
      const { isInfected, viruses } = await this.clamscan.scanBuffer(buffer);

      if (isInfected) {
        this.logger.warn(
          `Malware detected in uploaded file: ${viruses.join(', ') || 'unknown signature'}`,
        );
      }

      return !isInfected;
    } catch (err) {
      this.logger.error(`Malware scan failed: ${this.errorMessage(err)}`);
      // Fail closed: a scan that couldn't complete is NOT the same thing
      // as a clean result, and must not be treated as one.
      throw new ServiceUnavailableException(
        'Malware scan could not be completed — the file was not accepted.',
      );
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}