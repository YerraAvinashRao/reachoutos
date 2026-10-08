/**
 * ReachOut OS - Production Environment Validator
 * Validates critical infrastructure environment variables on server startup
 */

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
  config: {
    nodeEnv: string;
    port: number;
    hasSupabaseUrl: boolean;
    hasSupabaseKey: boolean;
    hasGeminiKey: boolean;
    hasWebhookToken: boolean;
    isServerless: boolean;
  };
}

export class EnvironmentValidator {
  private static REQUIRED_VARS = [
    ['SUPABASE_URL', 'VITE_SUPABASE_URL'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']
  ];

  private static OPTIONAL_VARS = [
    { name: 'GEMINI_API_KEY', description: 'Enables AI Copilot & Template generation' },
    { name: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', description: 'Enables Meta WhatsApp Inbound Webhook verification' },
    { name: 'DATABASE_URL', description: 'Direct PostgreSQL connection string for connection pooling' }
  ];

  static validate(): EnvValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variable groups (at least one in each group must exist)
    for (const group of this.REQUIRED_VARS) {
      const found = group.some(key => Boolean(process.env[key]));
      if (!found) {
        missing.push(group.join(' OR '));
      }
    }

    // Check optional variables and warn if absent
    for (const opt of this.OPTIONAL_VARS) {
      if (!process.env[opt.name]) {
        warnings.push(`${opt.name} is not set (${opt.description})`);
      }
    }

    const isServerless = process.env.IS_SERVERLESS === '1' || Boolean(process.env.VERCEL);
    const port = parseInt(process.env.PORT || '3000', 10);
    const nodeEnv = process.env.NODE_ENV || 'development';

    const isValid = missing.length === 0;

    return {
      isValid,
      missing,
      warnings,
      config: {
        nodeEnv,
        port,
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        hasSupabaseKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        hasWebhookToken: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
        isServerless
      }
    };
  }

  static printStartupDiagnostics(): void {
    const res = this.validate();
    console.log('\n======================================================');
    console.log('🚀 ReachOut OS - Production Environment Diagnostics');
    console.log('======================================================');
    console.log(`• Environment:  ${res.config.nodeEnv}`);
    console.log(`• Serverless:   ${res.config.isServerless ? 'Yes (Vercel)' : 'No (Container / Node)'}`);
    console.log(`• Port:         ${res.config.port}`);
    console.log(`• Supabase DB:  ${res.config.hasSupabaseUrl && res.config.hasSupabaseKey ? '✅ Configured' : '❌ Missing Credentials'}`);
    console.log(`• AI Copilot:   ${res.config.hasGeminiKey ? '✅ Active' : '⚠️ Fallback Mode (No API Key)'}`);
    console.log(`• Meta Webhook: ${res.config.hasWebhookToken ? '✅ Configured' : '⚠️ Default Token'}`);

    if (res.missing.length > 0) {
      console.error('\n❌ CRITICAL: Missing Required Environment Variables:');
      res.missing.forEach(m => console.error(`  - ${m}`));
    }

    if (res.warnings.length > 0 && res.config.nodeEnv === 'production') {
      console.log('\nℹ️ Optional Configuration Notes:');
      res.warnings.forEach(w => console.log(`  - ${w}`));
    }
    console.log('======================================================\n');
  }
}
