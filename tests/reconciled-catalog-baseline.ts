import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

export const CANONICAL_TABLES = [
  'audit_logs',
  'campaign_recipients',
  'campaigns',
  'communication_preferences',
  'contact_list_members',
  'contact_lists',
  'contact_timeline',
  'contacts',
  'message_templates',
  'tenant_members',
  'tenants',
  'users'
] as const;

export async function runCatalogBaseline() {
  console.log('================================================================');
  console.log('RECONCILED LIVE DATABASE CATALOG BASELINE & ROW FINGERPRINTS');
  console.log(`Supabase Host: ${url}`);
  console.log(`Timestamp (UTC): ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const supabase = createClient(url, serviceKey);

  const results: Array<{
    table: string;
    exists: boolean;
    rowCount: number;
    sha256: string;
  }> = [];

  for (const table of CANONICAL_TABLES) {
    const { data, count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .order('id', { ascending: true });

    if (error) {
      console.error(`FATAL: Table [${table}] verification failed: ${error.message} (code: ${error.code})`);
      process.exit(1);
    }

    const rowCount = count ?? (data ? data.length : 0);
    const rowsJson = data && data.length > 0 ? JSON.stringify(data) : '';
    const hash = crypto.createHash('sha256').update(rowsJson).digest('hex');

    results.push({
      table,
      exists: true,
      rowCount,
      sha256: hash
    });
  }

  console.log('| Table Name | Exists | Row Count | SHA-256 Fingerprint (Order By ID) |');
  console.log('| :--- | :---: | :---: | :--- |');
  for (const r of results) {
    console.log(`| \`${r.table}\` | YES | ${r.rowCount.toLocaleString()} | \`${r.sha256}\` |`);
  }

  console.log('\n================================================================');
  console.log(`CATALOG SUMMARY: Exactly 12/12 canonical tables verified and fingerprinted.`);
  console.log('================================================================\n');
}

runCatalogBaseline().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
