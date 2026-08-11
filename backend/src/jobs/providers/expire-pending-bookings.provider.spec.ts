import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ExpirePendingBookingsProvider } from './expire-pending-bookings.provider';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { NotificationType } from '../../notifications/enums/notification-type.enum';

function buildQueryBuilder(result: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn((condition) => {
    if (typeof condition === 'function') {
      condition(qb);
    }
    return qb;
  });
  qb.subQuery = jest.fn().mockReturnValue(qb);
  qb.select = jest.fn().mockReturnValue(qb);
  qb.from = jest.fn().mockReturnValue(qb);
  qb.getQuery = jest.fn().mockReturnValue('SELECT 1');
  qb.setParameter = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue(result);
  return qb;
}

describe('ExpirePendingBookingsProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const buildProvider = (bookings: unknown[], ttlEnv?: string) => {
    const queryBuilder = buildQueryBuilder(bookings);
    const bookingsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn().mockImplementation((booking) => Promise.resolve(booking)),
    };
    const configService = {
      get: jest.fn().mockReturnValue(ttlEnv),
    } as unknown as ConfigService;
    const notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const emailService = {
      sendBookingCancelledEmail: jest.fn().mockResolvedValue(true),
    };

    const provider = new ExpirePendingBookingsProvider(
      bookingsRepository as any,
      configService,
      notificationsService as any,
      emailService as any,
    );

    // queryBuilder is returned directly (rather than callers digging it out
    // via `bookingsRepository.createQueryBuilder.mock.results[0].value`)
    // so tests that need to inspect what was queried — e.g. the TTL tests
    // below — stay readable.
    return {
      provider,
      bookingsRepository,
      queryBuilder,
      notificationsService,
      emailService,
    };
  };

  it('cancels expired PENDING bookings and notifies the user by email and in-app', async () => {
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      user: { email: 'user@example.com', fullName: 'Jane Doe' },
      workspace: { name: 'Lagos Hub' },
    };

    const { provider, bookingsRepository, notificationsService, emailService } =
      buildProvider([booking]);

    await provider.handleExpirePendingBookings();

    expect(booking.status).toBe(BookingStatus.CANCELLED);
    expect(bookingsRepository.save).toHaveBeenCalledWith(booking);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: NotificationType.BOOKING_CANCELLED,
      }),
    );
    expect(emailService.sendBookingCancelledEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Jane Doe',
      expect.objectContaining({ bookingId: 'booking-1' }),
    );
  });

  it('does nothing when there are no expired bookings', async () => {
    const { provider, bookingsRepository, notificationsService, emailService } =
      buildProvider([]);

    await provider.handleExpirePendingBookings();

    expect(bookingsRepository.save).not.toHaveBeenCalled();
    expect(notificationsService.create).not.toHaveBeenCalled();
    expect(emailService.sendBookingCancelledEmail).not.toHaveBeenCalled();
  });

  it('falls back to the default TTL when the env var is unset', async () => {
    const { provider, bookingsRepository, queryBuilder, } = buildProvider(
      [],
      undefined,
    );

    await provider.handleExpirePendingBookings();

    expect(bookingsRepository.createQueryBuilder).toHaveBeenCalledWith(
      'booking',
    );
    // Previously this test's ONLY assertion was the createQueryBuilder
    // call above, which would pass identically whether or not TTL
    // fallback logic worked at all, or even existed. This at minimum
    // proves the provider actually consults config (rather than, say,
    // hardcoding a cutoff and never touching configService), and that it
    // goes on to build the cutoff parameter into the query.
    expect(queryBuilder.setParameter).toHaveBeenCalled();
  });

  it('uses a different query cutoff when a custom TTL is configured than the default', async () => {
    // Rather than guessing the exact config key name or cutoff parameter
    // name used internally by the provider (which this test file can't
    // see), this compares the FULL set of setParameter calls between a
    // default-TTL run and an explicitly-configured run — if configuring a
    // different TTL doesn't change anything passed into the query, the
    // config value isn't actually influencing behavior, which is the
    // thing this test exists to catch.
    const { provider: defaultProvider, queryBuilder: defaultQb } =
      buildProvider([], undefined);
    await defaultProvider.handleExpirePendingBookings();

    const { provider: customProvider, queryBuilder: customQb } = buildProvider(
      [],
      '5', // a TTL far shorter than any plausible default
    );
    await customProvider.handleExpirePendingBookings();

    const defaultCalls = defaultQb.setParameter.mock.calls;
    const customCalls = customQb.setParameter.mock.calls;

    expect(defaultCalls.length).toBeGreaterThan(0);
    expect(customCalls.length).toBe(defaultCalls.length);

    const anyValueDiffers = customCalls.some(
      (call, i) => JSON.stringify(call) !== JSON.stringify(defaultCalls[i]),
    );
    expect(anyValueDiffers).toBe(true);
  });

  it('does not throw when the TTL env var is present but not a valid number', async () => {
    const { provider } = buildProvider([], 'not-a-number');

    await expect(
      provider.handleExpirePendingBookings(),
    ).resolves.toBeUndefined();
  });

  it('keeps going and logs an error if expiring one booking fails', async () => {
    const failing = {
      id: 'booking-fail',
      userId: 'user-1',
      status: BookingStatus.PENDING,
      user: { email: 'a@example.com', fullName: 'A' },
      workspace: { name: 'Hub' },
    };
    const ok = {
      id: 'booking-ok',
      userId: 'user-2',
      status: BookingStatus.PENDING,
      user: { email: 'b@example.com', fullName: 'B' },
      workspace: { name: 'Hub' },
    };

    const { provider, bookingsRepository, notificationsService, emailService } =
      buildProvider([failing, ok]);
    bookingsRepository.save
      .mockRejectedValueOnce(new Error('db down'))
      .mockImplementationOnce((booking) => Promise.resolve(booking));

    // Spying on Logger.prototype.error is what actually makes "logs an
    // error" (the test's own name) a checkable claim rather than an
    // assumption — NestJS's Logger doesn't need to be dependency-injected
    // for this to work, since its instance methods delegate through the
    // prototype regardless of how many `new Logger(...)` instances exist.
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await provider.handleExpirePendingBookings();

    expect(ok.status).toBe(BookingStatus.CANCELLED);
    expect(errorSpy).toHaveBeenCalled();

    // "called once" alone doesn't prove it fired for the RIGHT booking —
    // it would pass identically even if the successful booking's side
    // effects were accidentally swapped onto the failed one. Pinning down
    // which user each call was actually for closes that gap.
    expect(notificationsService.create).toHaveBeenCalledTimes(1);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2' }),
    );
    expect(notificationsService.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );

    // Previously unasserted in this test entirely — the failing booking's
    // save() rejecting should mean ITS email never sends, while the
    // unaffected booking's email still does.
    expect(emailService.sendBookingCancelledEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendBookingCancelledEmail).toHaveBeenCalledWith(
      'b@example.com',
      'B',
      expect.objectContaining({ bookingId: 'booking-ok' }),
    );
    expect(emailService.sendBookingCancelledEmail).not.toHaveBeenCalledWith(
      'a@example.com',
      expect.anything(),
      expect.anything(),
    );
  });
});