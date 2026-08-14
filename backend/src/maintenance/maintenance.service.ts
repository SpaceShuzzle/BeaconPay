import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

export type TicketStatus = 'open' | 'in-progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface MaintenanceTicket {
  readonly id: string;
  readonly description: string;
  readonly status: TicketStatus;
  readonly priority: TicketPriority;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const VALID_STATUSES: readonly TicketStatus[] = [
  'open',
  'in-progress',
  'resolved',
];
const VALID_PRIORITIES: readonly TicketPriority[] = ['low', 'medium', 'high'];

// Higher number = higher priority. Centralizing this avoids the
// indexOf-based comparator bug (wrong sort direction, O(n) lookup per compare).
const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function isValidPriority(value: string): value is TicketPriority {
  return (VALID_PRIORITIES as string[]).includes(value);
}

function isValidStatus(value: string): value is TicketStatus {
  return (VALID_STATUSES as string[]).includes(value);
}

@Injectable()
export class MaintenanceService {
  private tickets: MaintenanceTicket[] = [];

  createTicket(description: string, priority: string): MaintenanceTicket {
    const trimmedDescription = description?.trim();
    if (!trimmedDescription) {
      throw new BadRequestException('Description must not be empty.');
    }
    if (!isValidPriority(priority)) {
      throw new BadRequestException(
        `Invalid priority "${priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}.`,
      );
    }

    const now = new Date();
    const ticket: MaintenanceTicket = {
      id: randomUUID(),
      description: trimmedDescription,
      status: 'open',
      priority,
      createdAt: now,
      updatedAt: now,
    };

    this.tickets.push(ticket);
    return ticket;
  }

  getTickets(): MaintenanceTicket[] {
    // Return a copy so callers can't mutate internal state directly.
    return [...this.tickets];
  }

  getTicketById(id: string): MaintenanceTicket {
    const ticket = this.tickets.find((t) => t.id === id);
    if (!ticket) {
      throw new NotFoundException(`Ticket with id "${id}" was not found.`);
    }
    return ticket;
  }

  updateTicketStatus(id: string, status: string): MaintenanceTicket {
    if (!isValidStatus(status)) {
      throw new BadRequestException(
        `Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}.`,
      );
    }

    const index = this.tickets.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Ticket with id "${id}" was not found.`);
    }

    const updated: MaintenanceTicket = {
      ...this.tickets[index],
      status,
      updatedAt: new Date(),
    };
    this.tickets[index] = updated;
    return updated;
  }

  /**
   * Open tickets ordered highest priority first, then oldest first
   * within the same priority (fair queueing).
   */
  triageTickets(): MaintenanceTicket[] {
    return this.tickets
      .filter((t) => t.status === 'open')
      .sort((a, b) => {
        const priorityDiff =
          PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
  }

  getTicketsByStatus(status: TicketStatus): MaintenanceTicket[] {
    return this.tickets.filter((t) => t.status === status);
  }

  deleteTicket(id: string): void {
    const index = this.tickets.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Ticket with id "${id}" was not found.`);
    }
    this.tickets.splice(index, 1);
  }
}