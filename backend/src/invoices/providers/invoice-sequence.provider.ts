import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Name of the Postgres sequence backing invoice numbers. Exported so any
 * code that reads from it (e.g. `nextval('invoice_number_seq')` in an
 * invoice-number provider) references this constant instead of a
 * hand-typed string that could drift out of sync with what's created here.
 */
export const INVOICE_NUMBER_SEQUENCE = 'public.invoice_number_seq';

// Postgres error code for "duplicate object already exists". Under
// concurrent bootstrap (multiple app instances starting at once),
// `CREATE SEQUENCE IF NOT EXISTS` can still race and raise this — treat it
// as a successful outcome rather than a real failure.
const PG_DUPLICATE_OBJECT = '42710';

/**
 * Ensures the PostgreSQL sequence used for invoice numbers exists.
 * Runs once on application bootstrap.
 *
 * This is treated as a fail-fast dependency: invoice generation is broken
 * without this sequence, so if it can't be created (and it's not just a
 * duplicate-create race from concurrent instances booting together), we
 * rethrow and let Nest abort startup rather than come up in a state where
 * the app looks healthy but invoice creation will fail later with a much
 * less obvious error.
 */
@Injectable()
export class InvoiceSequenceProvider implements OnApplicationBootstrap {
  private readonly logger = new Logger(InvoiceSequenceProvider.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.dataSource.query(
        `CREATE SEQUENCE IF NOT EXISTS ${INVOICE_NUMBER_SEQUENCE} START 1`,
      );
      this.logger.log(`${INVOICE_NUMBER_SEQUENCE} sequence ensured`);
    } catch (err) {
      if (getPostgresErrorCode(err) === PG_DUPLICATE_OBJECT) {
        // Another instance created it first between our check and create —
        // the sequence exists, which is exactly what we wanted.
        this.logger.debug(
          `${INVOICE_NUMBER_SEQUENCE} already created by another instance`,
        );
        return;
      }

      this.logger.error(
        `Failed to create ${INVOICE_NUMBER_SEQUENCE}: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}

/**
 * Extracts a Postgres error code from an error thrown by `DataSource.query`,
 * covering both the raw `pg` driver error shape (`err.code`) and TypeORM's
 * `QueryFailedError` wrapper, which nests the original driver error under
 * `driverError`.
 */
function getPostgresErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }

  const direct = (err as { code?: unknown }).code;
  if (typeof direct === 'string') {
    return direct;
  }

  const driverError = (err as { driverError?: { code?: unknown } }).driverError;
  if (driverError && typeof driverError.code === 'string') {
    return driverError.code;
  }

  return undefined;
}