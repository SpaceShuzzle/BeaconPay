import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { StaleCheckinJob } from './stale-checkin.job';
import { WorkspaceLog } from '../workspace-tracking/entities/workspace-log.entity';
import { NotificationsService } from '../notifications/notifications.service';

const mockLogsRepository = {
  find: jest.fn(),
  save: jest.fn(),
};

const mockNotificationsService = {
  create: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

// Fixed "now" for every test — real time is never read directly. This
// removes the flaky "within N seconds of Date.now()" tolerance checks the
// original tests needed, and lets duration/threshold assertions be exact
// instead of approximate.
const NOW = new Date('2024-03-01T12:00:00.000Z');

function setMaxCheckinHours(hours: string | undefined) {
  mockConfigService.get.mockImplementation((key: string) =>
    key === 'CHECKIN_MAX_HOURS' ? hours : undefined,
  );
}

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

describe('StaleCheckinJob', () => {
  let job: StaleCheckinJob;

  beforeEach(async () => {
    // resetAllMocks (not clearAllMocks) also strips any mockImplementation
    // set during a previous test — e.g. the "uses CHECKIN_MAX_HOURS" test
    // below overrides mockConfigService.get to return '6'. With the
    // original clearAllMocks, that override would silently survive into
    // whichever test ran next (clearAllMocks only clears call history, not
    // implementations), making test outcomes depend on run order. Resetting
    // and then explicitly re-establishing the default here makes every
    // test start from the same known state regardless of order.
    jest.resetAllMocks();
    setMaxCheckinHours('12');

    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaleCheckinJob,
        { provide: getRepositoryToken(WorkspaceLog), useValue: mockLogsRepository },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    job = module.get<StaleCheckinJob>(StaleCheckinJob);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(job).toBeDefined();
  });

  it('should do nothing when no stale check-ins exist', async () => {
    mockLogsRepository.find.mockResolvedValue([]);
    await job.closeStaleCheckIns();
    expect(mockLogsRepository.save).not.toHaveBeenCalled();
    expect(mockNotificationsService.create).not.toHaveBeenCalled();
  });

  it('should close stale check-ins and send notifications', async () => {
    const checkedInAt = hoursAgo(13);
    const staleLog: Partial<WorkspaceLog> = {
      id: 'log-1',
      userId: 'user-1',
      workspaceId: 'ws-1',
      checkedInAt,
      checkedOutAt: null,
      durationMinutes: null,
      notes: null,
    };

    mockLogsRepository.find.mockResolvedValue([staleLog]);
    // Echo back whatever gets passed to save() rather than a fixed value,
    // so the assertions below are checking the job's actual output, not a
    // canned mock response that happens to look right.
    mockLogsRepository.save.mockImplementation((entity) => Promise.resolve(entity));
    mockNotificationsService.create.mockResolvedValue({});

    await job.closeStaleCheckIns();

    expect(mockLogsRepository.save).toHaveBeenCalledTimes(1);
    const savedLog = mockLogsRepository.save.mock.calls[0][0];

    // With time frozen at NOW, checkedOutAt should be exactly NOW — not
    // just "some Date instance" — and duration should be exactly 13h in
    // minutes, not merely "greater than 0".
    expect(savedLog.checkedOutAt.getTime()).toBe(NOW.getTime());
    expect(savedLog.durationMinutes).toBe(13 * 60);
    expect(savedLog.notes).toContain('[auto-closed after 12h]');

    expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        metadata: expect.objectContaining({ workspaceLogId: 'log-1' }),
      }),
    );
  });

  it('should close every stale check-in returned, not just the first', async () => {
    const staleLogs: Partial<WorkspaceLog>[] = [
      {
        id: 'log-1',
        userId: 'user-1',
        workspaceId: 'ws-1',
        checkedInAt: hoursAgo(13),
        checkedOutAt: null,
        durationMinutes: null,
        notes: null,
      },
      {
        id: 'log-2',
        userId: 'user-2',
        workspaceId: 'ws-2',
        checkedInAt: hoursAgo(20),
        checkedOutAt: null,
        durationMinutes: null,
        notes: null,
      },
    ];

    mockLogsRepository.find.mockResolvedValue(staleLogs);
    mockLogsRepository.save.mockImplementation((entity) => Promise.resolve(entity));
    mockNotificationsService.create.mockResolvedValue({});

    await job.closeStaleCheckIns();

    expect(mockLogsRepository.save).toHaveBeenCalledTimes(2);
    expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);

    const savedIds = mockLogsRepository.save.mock.calls.map((call) => call[0].id);
    expect(savedIds).toEqual(expect.arrayContaining(['log-1', 'log-2']));

    const notifiedUserIds = mockNotificationsService.create.mock.calls.map(
      (call) => call[0].userId,
    );
    expect(notifiedUserIds).toEqual(expect.arrayContaining(['user-1', 'user-2']));
  });

  it('should use CHECKIN_MAX_HOURS from config', async () => {
    setMaxCheckinHours('6');
    mockLogsRepository.find.mockResolvedValue([]);

    await job.closeStaleCheckIns();

    const findCall = mockLogsRepository.find.mock.calls[0][0];
    const threshold: Date = findCall.where.checkedInAt.value;

    // Time is frozen, so this can be an exact comparison instead of the
    // "within 5 seconds" tolerance the wall-clock version needed.
    expect(threshold.getTime()).toBe(hoursAgo(6).getTime());
  });
});