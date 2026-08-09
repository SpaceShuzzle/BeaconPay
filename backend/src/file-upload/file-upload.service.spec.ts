import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';

describe('FileUploadService', () => {
  let module: TestingModule;
  let service: FileUploadService;
  let configValues: Record<string, string | number>;

  // A minimal ConfigService stand-in — real values come from
  // `configValues`, set per-test below, so each test controls exactly
  // what CLAMAV_ENABLED/HOST/PORT the service sees without touching real
  // environment variables.
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in configValues ? configValues[key] : defaultValue,
    ),
  };

  async function setup(): Promise<void> {
    module = await Test.createTestingModule({
      providers: [
        FileUploadService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<FileUploadService>(FileUploadService);
  }

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('when scanning is explicitly disabled', () => {
    beforeEach(async () => {
      configValues = { CLAMAV_ENABLED: 'false' };
      await setup();
      await module.init(); // triggers onModuleInit
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('treats every buffer as clean without attempting to scan', async () => {
      const result = await service.scanMalware(Buffer.from('anything'));
      expect(result).toBe(true);
    });
  });

  describe('when scanning is enabled but the scanner never initialized', () => {
    beforeEach(async () => {
      // No CLAMAV_HOST configured and nothing running on the default port
      // in a test environment — onModuleInit's clamscan.init() is expected
      // to fail here, leaving the service in its "unavailable" state.
      configValues = {};
      await setup();
      await module.init();
    });

    it('fails closed: throws rather than reporting the file as clean', async () => {
      await expect(
        service.scanMalware(Buffer.from('anything')),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  // TODO: the two suites above are the full extent of what's testable
  // without a real (or containerized) clamd instance, because the
  // ClamAV client is constructed internally via `new NodeClam().init()`
  // inside onModuleInit rather than being injected. That means the
  // "scanner is available and actually scans a buffer" path — including
  // the isInfected=true / isInfected=false branches — currently has NO
  // unit test coverage; it can only be exercised via an integration test
  // against a real clamd (e.g. in CI via a docker-compose clamav service).
  //
  // If unit-level coverage of the scan-result branches matters, the fix
  // is to extract the ClamAV client behind an injectable token (e.g. a
  // `CLAMAV_CLIENT` provider built by a factory that calls
  // `new NodeClam().init(...)`), so tests can supply a mock client with
  // `scanBuffer` stubbed to return `{ isInfected: true, viruses: [...] }`
  // or `{ isInfected: false, viruses: [] }` directly — turning this from
  // an integration concern into a plain unit test.
});