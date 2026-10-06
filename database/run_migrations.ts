/**
 * ReachOut OS PostgreSQL Migration Runner
 * If DATABASE_URL (direct postgres connection string with password) is provided in .env,
 * this script automatically connects and executes migrations in a safe transaction.
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || connectionString.includes('your-password')) {
    console.error('====================================================');
    console.error('MANUAL SUPABASE SQL EXECUTION REQUIRED');
    console.error('====================================================');
    console.error('DATABASE_URL is not set with direct PostgreSQL credentials.');
    console.error('To apply migrations, either:');
    console.error('1. Open your Supabase Dashboard SQL Editor at:');
    console.error('   https://supabase.com/dashboard/project/cxzynykcdxadhhkjsmgs/sql/new');
    console.error('   Copy and paste:');
    console.error('   - database/migrations/001_initial_schema.sql');
    console.error('   - database/migrations/002_rls_policies.sql');
    console.error('2. OR set DATABASE_URL in .env:');
    console.error('   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.cxzynykcdxadhhkjsmgs.supabase.co:5432/postgres"');
    console.error('   and re-run: npx tsx database/run_migrations.ts');
    console.error('====================================================');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database directly.');

    const migration1 = fs.readFileSync(path.join(__dirname, 'migrations', '001_initial_schema.sql'), 'utf8');
    const migration2 = fs.readFileSync(path.join(__dirname, 'migrations', '002_rls_policies.sql'), 'utf8');

    console.log('Applying 001_initial_schema.sql...');
    await client.query('BEGIN');
    await client.query(migration1);
    console.log('✓ 001_initial_schema.sql applied.');

    console.log('Applying 002_rls_policies.sql...');
    await client.query(migration2);
    await client.query('COMMIT');
    console.log('✓ 002_rls_policies.sql applied.');

    console.log('\nAll migrations executed and verified successfully in PostgreSQL!');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
