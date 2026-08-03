import { BadRequestException, Injectable } from '@nestjs/common';
import { PlanType } from '../enums/plan-type.enum';

const HOURS_PER_WORKDAY = 8;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

const PLAN_CONFIG: Readonly<
  Record<
    PlanType,
    {
      days: number;
      discount: number;
    }
  >
> = {
  [PlanType.DAILY]: {
    days: 1,
    discount: 0,
  },
  [PlanType.WEEKLY]: {
    days: 5,
    discount: 0.05,
  },
  [PlanType.MONTHLY]: {
    days: 22,
    discount: 0.10,
  },
  [PlanType.QUARTERLY]: {
    days: 66,
    discount: 0.15,
  },
  [PlanType.YEARLY]: {
    days: 264,
    discount: 0.20,
  },
};

@Injectable()
export class PricingService {
  /**
   * Calculates the booking amount (in kobo).
   *
   * - Daily plans use the actual number of calendar days.
   * - All other plans use predefined working-day equivalents.
   */
  calculateAmount(
    hourlyRateKobo: number,
    planType: PlanType,
    seatCount: number,
    startDate: string,
    endDate: string,
  ): number {
    this.validateInputs(hourlyRateKobo, seatCount);

    const billableDays =
      planType === PlanType.DAILY
        ? this.calculateCalendarDays(startDate, endDate)
        : this.getPlanConfig(planType).days;

    const { discount } = this.getPlanConfig(planType);

    const grossAmount =
      hourlyRateKobo * HOURS_PER_WORKDAY * billableDays * seatCount;

    return Math.floor(grossAmount * (1 - discount));
  }

  /**
   * Returns the configured duration and discount for a plan.
   */
  getPlanSummary(planType: PlanType): {
    days: number;
    discountPct: number;
  } {
    const config = this.getPlanConfig(planType);

    return {
      days: config.days,
      discountPct: config.discount * 100,
    };
  }

  /**
   * Returns configuration for a pricing plan.
   */
  private getPlanConfig(planType: PlanType) {
    const config = PLAN_CONFIG[planType];

    if (!config) {
      throw new BadRequestException('Invalid plan type.');
    }

    return config;
  }

  /**
   * Calculates the number of billable calendar days.
   */
  private calculateCalendarDays(
    startDate: string,
    endDate: string,
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid booking dates.');
    }

    if (end < start) {
      throw new BadRequestException(
        'End date cannot be before start date.',
      );
    }

    const difference =
      (end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY;

    return Math.max(1, Math.ceil(difference));
  }

  /**
   * Validates pricing inputs.
   */
  private validateInputs(
    hourlyRateKobo: number,
    seatCount: number,
  ): void {
    if (hourlyRateKobo <= 0) {
      throw new BadRequestException(
        'Hourly rate must be greater than zero.',
      );
    }

    if (seatCount <= 0) {
      throw new BadRequestException(
        'Seat count must be greater than zero.',
      );
    }
  }
}