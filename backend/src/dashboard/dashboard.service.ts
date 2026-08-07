import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter.entity';
import { AdminAnalyticsProvider } from './providers/admin-analytics.provider';
import { MemberDashboardProvider } from './providers/member-dashboard.provider';

// Only the columns getUsers() actually selects — using this instead of the
// full User entity type means consumers can't accidentally assume fields
// like `password` are present just because the return type says `User[]`.
type UserListItem = Pick<
  User,
  | 'id'
  | 'firstname'
  | 'lastname'
  | 'email'
  | 'role'
  | 'isActive'
  | 'isSuspended'
  | 'isVerified'
  | 'createdAt'
  | 'profilePicture'
>;

export interface UserStatsResult {
  totalMembers: number;
  verifiedMembers: number;
  activeWorkspaces: number;
  deskOccupancy: number;
}

export interface ActivityItem {
  id: string;
  type: 'member_verified' | 'member_registered';
  description: string;
  timestamp: Date;
}

export interface MonthlyRegistration {
  month: string;
  count: number;
}

export interface AdminStatsResult {
  users: {
    total: number;
    active: number;
    suspended: number;
    newThisMonth: number;
  };
  newsletter: {
    total: number;
    verified: number;
    active: number;
    newThisMonth: number;
    confirmationRate: number;
  };
  registrationTrend: MonthlyRegistration[];
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class DashboardService {
  private static readonly DEFAULT_PAGE_SIZE = 20;
  private static readonly MAX_PAGE_SIZE = 100;
  private static readonly DEFAULT_ACTIVITY_LIMIT = 10;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(NewsletterSubscriber)
    private readonly newsletterRepository: Repository<NewsletterSubscriber>,
    private readonly adminAnalyticsProvider: AdminAnalyticsProvider,
    private readonly memberDashboardProvider: MemberDashboardProvider,
  ) {}

  /**
   * Stats visible to any authenticated user.
   *
   * `userId` isn't currently used in the query — kept in the signature
   * since these are meant to be global platform stats (not per-user), and
   * the parameter exists for interface consistency / future per-user
   * personalization rather than by accident. Flagging in case that's not
   * actually the intent.
   */
  async getUserStats(userId: string): Promise<UserStatsResult> {
    void userId;

    const [totalMembers, verifiedMembers, activeWorkspaces] =
      await Promise.all([
        this.userRepository.count({
          where: { isActive: true, isDeleted: false },
        }),
        this.userRepository.count({
          where: { isActive: true, isDeleted: false, isVerified: true },
        }),
        this.adminAnalyticsProvider.getActiveWorkspacesCount(),
      ]);

    return {
      totalMembers,
      verifiedMembers,
      activeWorkspaces,
      deskOccupancy: Math.min(
        Math.round((verifiedMembers / Math.max(totalMembers, 1)) * 100),
        100,
      ),
    };
  }

  /**
   * Recent activity — derived from user registrations and verifications.
   */
  async getActivity(
    limit: number = DashboardService.DEFAULT_ACTIVITY_LIMIT,
  ): Promise<ActivityItem[]> {
    const safeLimit = this.clampLimit(
      limit,
      DashboardService.DEFAULT_ACTIVITY_LIMIT,
    );

    const recentUsers = await this.userRepository.find({
      // Was missing previously — every other query in this service
      // excludes soft-deleted users; this one didn't, so a deleted
      // account's registration/verification event kept appearing in the
      // "recent activity" feed indefinitely.
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
      take: safeLimit,
      select: [
        'id',
        'firstname',
        'lastname',
        'email',
        'createdAt',
        'isVerified',
      ],
    });

    return recentUsers.map((u) => ({
      id: u.id,
      type: u.isVerified ? 'member_verified' : 'member_registered',
      description: u.isVerified
        ? `${u.firstname} ${u.lastname} verified their account`
        : `${u.firstname} ${u.lastname} registered`,
      timestamp: u.createdAt,
    }));
  }

  /**
   * Admin-only system-wide stats.
   */
  async getAdminStats(): Promise<AdminStatsResult> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // registrationTrend folded into the same Promise.all batch — it
    // doesn't depend on any of the other results, so there's no reason to
    // wait for them to finish before starting it.
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      newUsersThisMonth,
      totalSubscribers,
      verifiedSubscribers,
      activeSubscribers,
      newSubscribersThisMonth,
      registrationTrend,
    ] = await Promise.all([
      this.userRepository.count({ where: { isDeleted: false } }),
      this.userRepository.count({
        where: { isActive: true, isDeleted: false },
      }),
      this.userRepository.count({
        where: { isSuspended: true, isDeleted: false },
      }),
      this.userRepository.count({
        where: { createdAt: MoreThanOrEqual(thirtyDaysAgo), isDeleted: false },
      }),
      this.newsletterRepository.count(),
      this.newsletterRepository.count({ where: { isVerified: true } }),
      this.newsletterRepository.count({ where: { isActive: true } }),
      this.newsletterRepository.count({
        where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) },
      }),
      this.getMonthlyRegistrations(6),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        newThisMonth: newUsersThisMonth,
      },
      newsletter: {
        total: totalSubscribers,
        verified: verifiedSubscribers,
        active: activeSubscribers,
        newThisMonth: newSubscribersThisMonth,
        confirmationRate:
          totalSubscribers > 0
            ? Math.round((verifiedSubscribers / totalSubscribers) * 100)
            : 0,
      },
      registrationTrend,
    };
  }

  /**
   * Admin-only: list all users with pagination.
   */
  async getUsers(
    page: number,
    limit: number,
    search?: string,
  ): Promise<PaginatedResult<UserListItem>> {
    const safePage = this.clampPage(page);
    const safeLimit = this.clampLimit(limit, DashboardService.DEFAULT_PAGE_SIZE);

    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'user.id',
        'user.firstname',
        'user.lastname',
        'user.email',
        'user.role',
        'user.isActive',
        'user.isSuspended',
        'user.isVerified',
        'user.createdAt',
        'user.profilePicture',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (search) {
      qb.andWhere(
        '(user.firstname ILIKE :search OR user.lastname ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data as UserListItem[],
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  getAdminAnalytics(from?: string, to?: string) {
    return this.adminAnalyticsProvider.getFullAdminDashboard(from, to);
  }

  getMemberDashboard(userId: string) {
    return this.memberDashboardProvider.getMemberDashboard(userId);
  }

  getMemberBookings(userId: string, page: number, limit: number) {
    return this.memberDashboardProvider.getMemberBookings(
      userId,
      this.clampPage(page),
      this.clampLimit(limit, DashboardService.DEFAULT_PAGE_SIZE),
    );
  }

  getMemberPayments(userId: string, page: number, limit: number) {
    return this.memberDashboardProvider.getMemberPayments(
      userId,
      this.clampPage(page),
      this.clampLimit(limit, DashboardService.DEFAULT_PAGE_SIZE),
    );
  }

  getMemberInvoices(userId: string, page: number, limit: number) {
    return this.memberDashboardProvider.getMemberInvoices(
      userId,
      this.clampPage(page),
      this.clampLimit(limit, DashboardService.DEFAULT_PAGE_SIZE),
    );
  }

  getMemberCheckIns(userId: string, limit: number) {
    return this.memberDashboardProvider.getMemberCheckIns(
      userId,
      this.clampLimit(limit, DashboardService.DEFAULT_PAGE_SIZE),
    );
  }

  /**
   * Registration count per month for the last `months` months (oldest
   * first), e.g. [{ month: 'Mar', count: 12 }, ..., { month: 'Aug', count: 30 }].
   *
   * Previously this only applied `MoreThanOrEqual(start)` with no upper
   * bound, so each "monthly" count was actually a running total of
   * everyone registered from that month onward — not the number
   * registered during that month. Since `start` moves closer to the
   * present as the loop progresses, the returned counts were a
   * monotonically shrinking sequence with no real relationship to
   * month-over-month registrations. Fixed with `Between(start, end)`.
   *
   * Also now issues all `months` queries concurrently instead of one at a
   * time in a sequential loop.
   */
  private async getMonthlyRegistrations(
    months: number,
  ): Promise<MonthlyRegistration[]> {
    const now = new Date();

    const ranges = Array.from({ length: months }, (_, idx) => {
      const i = months - 1 - idx; // oldest -> newest, same ordering as before
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999,
      );
      return { start, end };
    });

    const counts = await Promise.all(
      ranges.map(({ start, end }) =>
        this.userRepository.count({
          where: { createdAt: Between(start, end), isDeleted: false },
        }),
      ),
    );

    return ranges.map(({ start }, idx) => ({
      month: start.toLocaleString('en', { month: 'short' }),
      count: counts[idx],
    }));
  }

  private clampPage(page: number): number {
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  }

  private clampLimit(limit: number, fallback: number): number {
    const value =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : fallback;
    return Math.min(value, DashboardService.MAX_PAGE_SIZE);
  }
}