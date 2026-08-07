import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

/**
 * Creates the shared database configuration used by both
 * NestJS and the TypeORM CLI.
 *
 * Keeping the configuration in one place helps prevent
 * differences between application and migration environments.
 */
export const createDatabaseOptions = (
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions => {
  // Use localhost when no database host is provided.
  const host = env.DATABASE_HOST || 'localhost';

  /**
   * Enable SSL when:
   * - Running in production
   * - PostgreSQL explicitly requires SSL
   * - DATABASE_SSL is set to true
   * - Connecting to a Neon-hosted PostgreSQL database
   */
  const sslRequired =
    env.NODE_ENV === 'production' ||
    env.PGSSLMODE === 'require' ||
    env.DATABASE_SSL === 'true' ||
    host.includes('neon.tech');

  return {
    type: 'postgres',

    // PostgreSQL connection details are loaded from environment variables.
    host,
    port: Number(env.DATABASE_PORT || 5432),
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,

    // Entity and migration files used by TypeORM.
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/migrations/*{.ts,.js}'],

    // Custom table used by TypeORM to track executed migrations.
    migrationsTableName: 'typeorm_migrations',

    // Schema changes should be handled through migrations instead.
    synchronize: false,

    // Use SSL when connecting to environments that require it.
    ssl: sslRequired ? { rejectUnauthorized: false } : false,
  };
};

/**
 * Creates the NestJS-specific TypeORM configuration.
 *
 * It reuses the shared database settings while allowing NestJS
 * to automatically discover entities registered by its modules.
 */
export const createNestDatabaseOptions = (
  env: NodeJS.ProcessEnv = process.env,
): TypeOrmModuleOptions => ({
  ...createDatabaseOptions(env),

  // Automatically load entities registered with NestJS modules.
  autoLoadEntities: true,
});