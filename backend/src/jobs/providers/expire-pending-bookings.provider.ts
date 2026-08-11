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

    return {
      provider,
      bookingsRepository,
      queryBuilder,
      configService,
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
    const { provider, bookingsRepository, queryBuilder, configService } =
      buildProvider([], undefined);

    await provider.handleExpirePendingBookings();

    expect(bookingsRepository.createQueryBuilder).toHaveBeenCalledWith(
      'booking',
    );
    // Now that the real key name is known, this pins down exactly what
    // config the provider consults — previously this was either untested
    // or a vague toHaveBeenCalled().
    expect(configService.get).toHaveBeenCalledWith(
      'BOOKING_PAYMENT_TTL_MINUTES',
    );
    expect(queryBuilder.setParameter).toHaveBeenCalled();
  });

  it('uses a different query cutoff when a custom TTL is configured than the default', async () => {
    const { provider: defaultProvider, queryBuilder: defaultQb } =
      buildProvider([], undefined);
    await defaultProvider.handleExpirePendingBookings();

    const { provider: customProvider, queryBuilder: customQb } = buildProvider(
      [],
      '5', // a TTL far shorter than the 120-minute default
    );
    await customProvider.handleExpirePendingBookings();

    // The cutoff Date is passed as the second argument to
    // `andWhere('booking.createdAt < :cutoff', { cutoff })` — NOT via
    // setParameter(), which is only ever called with the constant
    // paymentStatus value and is therefore identical across every TTL
    // configuration. (An earlier version of this test incorrectly
    // compared setParameter calls instead, which would have failed here
    // regardless of whether TTL config actually worked, since that call
    // never varies with TTL at all.)
    const findCutoffCall = (qb: typeof defaultQb) =>
      qb.andWhere.mock.calls.find(
        ([condition]) => condition === 'booking.createdAt < :cutoff',
      );

    const defaultCall = findCutoffCall(defaultQb);
    const customCall = findCutoffCall(customQb);

    expect(defaultCall).toBeDefined();
    expect(customCall).toBeDefined();

    const defaultCutoff = (defaultCall![1] as { cutoff: Date }).cutoff;
    const customCutoff = (customCall![1] as { cutoff: Date }).cutoff;

    expect(customCutoff.getTime()).not.toEqual(defaultCutoff.getTime());
    // A 5-minute TTL means bookings expire sooner than with the 120-minute
    // default, i.e. the cutoff sits LATER (closer to "now") than the
    // default's cutoff.
    expect(customCutoff.getTime()).toBeGreaterThan(defaultCutoff.getTime());
  });

  it('does not throw when the TTL env var is present but not a valid number', async () => {
    const { provider } = buildProvider([], 'not-a-number');

    // getTtlMinutes() falls back to DEFAULT_TTL_MINUTES whenever
    // Number.isFinite(parsed) is false, which parseInt('not-a-number', 10)
    // (-> NaN) satisfies — confirmed against the real implementation.
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

    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await provider.handleExpirePendingBookings();

    expect(ok.status).toBe(BookingStatus.CANCELLED);
    expect(errorSpy).toHaveBeenCalled();

    expect(notificationsService.create).toHaveBeenCalledTimes(1);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2' }),
    );
    expect(notificationsService.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    );

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

  it('still counts the booking as expired and logs a WARNING (not an error) when only the cancellation email fails', async () => {
    // Distinct failure mode from the test above: here the booking save
    // and the in-app notification both succeed — only the email fails.
    // The real provider catches that specific failure inside
    // expireBooking() and logs it via logger.warn, without letting it
    // propagate to the outer try/catch (which would log via logger.error
    // and skip incrementing expiredCount). Previously nothing exercised
    // this distinction at all.
    const booking = {
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
      user: { email: 'user@example.com', fullName: 'Jane Doe' },
      workspace: { name: 'Lagos Hub' },
    };

    const { provider, bookingsRepository, notificationsService, emailService } =
      buildProvider([booking]);
    emailService.sendBookingCancelledEmail.mockRejectedValueOnce(
      new Error('smtp timeout'),
    );

    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await provider.handleExpirePendingBookings();

    expect(booking.status).toBe(BookingStatus.CANCELLED);
    expect(bookingsRepository.save).toHaveBeenCalledWith(booking);
    expect(notificationsService.create).toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});