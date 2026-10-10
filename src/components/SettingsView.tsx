import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Database, 
  Server, 
  Lock, 
  Download, 
  Users, 
  Radio, 
  Key,
  HardDrive,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Link2,
  Zap,
  Send,
  Palette,
  Building2
} from 'lucide-react';
import { Tenant, Role, User } from '../types';
import { supabase } from '../services/supabaseClient';
import { WebhookGatewayService, WebhookEndpoint } from '../core/integrations/WebhookGatewayService';
import { TenantBrandingService, TenantBrandingConfig } from '../core/branding/TenantBrandingService';

interface SettingsViewProps {
  tenant: Tenant | null;
  onToggleKillSwitch: (reason: string) => void;
  onExportContacts: () => void;
  userRole: Role;
  user?: User | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  tenant,
  onToggleKillSwitch,
  onExportContacts,
  userRole,
  user
}) => {
  const [killReason, setKillReason] = useState('Safety check initiated by administrator');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [branding, setBranding] = useState<TenantBrandingConfig>(() => TenantBrandingService.getBranding());
  const [brandingSavedMsg, setBrandingSavedMsg] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_password_set: true }
      });
      if (error) throw error;
      setPasswordMsg({ type: 'success', text: 'Password updated successfully! You can now sign in with this password.' });
      setNewPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err?.message || 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Workspace Settings & Security Governance
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">
          Emergency kill switches, RBAC access gates, infrastructure portability adapters, and data retention policies
        </p>
      </div>

      {/* 0. User Account Profile & Dual-Auth Security */}
      {user && (
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                <UserIcon className="w-4 h-4 text-emerald-600" />
                <span>Account Profile & Authentication</span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Your linked identity details used across campaign operations and audit trails.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              ROLE: {user.role}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <div className="text-[11px] text-neutral-500">Full Name (Authoritative)</div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                {user.name || 'Unnamed Operator'}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <div className="text-[11px] text-neutral-500">Email Address</div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5 font-mono">
                {user.email}
              </div>
            </div>
          </div>

          {/* Quick password change */}
          <form onSubmit={handleUpdatePassword} className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
            <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 text-xs">
              <Lock className="w-3.5 h-3.5 text-neutral-500" />
              <span>Update / Reset Account Password</span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Setting a password allows direct login using your email & password without needing Google OAuth.
            </p>
            {passwordMsg && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-900/60 text-rose-300'
              }`}>
                {passwordMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}
            <div className="flex gap-2 max-w-md">
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
              />
              <button
                type="submit"
                disabled={passwordLoading || !newPassword}
                className="px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 text-xs shrink-0 cursor-pointer"
              >
                {passwordLoading ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 1. Emergency Kill Switch */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Workspace Outreach Emergency Kill Switch</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xl">
              Halts all manual and queued outreach across every campaign and channel instantaneously. When active, no operator can prepare, open, or transmit messages.
            </p>
          </div>

          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
            tenant?.isKillSwitchActive
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 animate-pulse'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
          }`}>
            {tenant?.isKillSwitchActive ? 'PAUSED (ACTIVE)' : 'ARMED & READY'}
          </span>
        </div>

        {tenant?.isKillSwitchActive ? (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-300 space-y-2">
            <div>
              <strong>Kill Switch Activated:</strong> {tenant.killSwitchReason || 'No reason provided'}
            </div>
            <div className="text-[11px] text-rose-700 dark:text-rose-400">
              Triggered by: {tenant.killSwitchTriggeredBy || 'Administrator'} at {tenant.killSwitchTriggeredAt}
            </div>
            {userRole !== 'VIEWER' && userRole !== 'OPERATOR' && (
              <button
                onClick={() => onToggleKillSwitch('Resumed by administrator')}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition"
              >
                Resume All Workspace Outreach
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <input
              type="text"
              placeholder="Reason for triggering kill switch (e.g. Catalog pricing error)..."
              value={killReason}
              onChange={(e) => setKillReason(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
            />
            {userRole !== 'VIEWER' && userRole !== 'OPERATOR' && (
              <button
                onClick={() => onToggleKillSwitch(killReason)}
                className="px-4 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition"
              >
                Trigger Kill Switch (Pause All)
              </button>
            )}
          </div>
        )}
      </div>

      {/* 1b. Meta WhatsApp Business Policy Engine Registry */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Meta WhatsApp Business Policy Engine</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                ACTIVE v2026-10
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Authoritative, data-driven compliance engine based on official Meta WhatsApp Business Policies and Guidelines.
            </p>
          </div>
          <a
            href="https://business.whatsapp.com/policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Official Meta Policy Reference ↗</span>
          </a>
        </div>

        {/* Policy Metadata Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="text-[10px] text-neutral-400 uppercase font-mono">Authority</div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5">Meta Platforms, Inc.</div>
          </div>
          <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="text-[10px] text-neutral-400 uppercase font-mono">Version Cycle</div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5">2026-10 (Monthly)</div>
          </div>
          <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="text-[10px] text-neutral-400 uppercase font-mono">Enforcement Mode</div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">Strict / Fail-Closed</div>
          </div>
          <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="text-[10px] text-neutral-400 uppercase font-mono">Decision Hierarchy</div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5">AI Proposes → Engine Decides</div>
          </div>
        </div>

        {/* 8 Mandatory Policy Domains Grid */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
            Active Compliance Domain Gates
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">01</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">Consent & Documented Opt-In</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-CONSENT-001 • Category & channel match</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">02</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">Opt-Out & Instant Suppression</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-OPTOUT-001 • Hard block override</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">03</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">24-Hour Customer Service Window</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-WINDOW-001 • Freeform vs Approved Template</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">04</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">Template Category Integrity</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-TEMPLATE-002 • Anti-repurposing check</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">05</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">Content & Deception Defense</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-CONTENT-001 • Spam, fraud & claims classifier</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">06</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">Prohibited Goods & Meta Commerce</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-PROHIBITED-001 • Tobacco, alcohol & weapons block</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">07</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">Data Protection & PII Safeguard</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-DATA-001 • Card numbers, CVV & IDs stripped</div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">08</span>
              <div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">Quality Tiers & Anti-Spam Limits</div>
                <div className="text-[10px] text-neutral-500 font-mono">WA-QUALITY-001 • Rate limits & tier protection</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Infrastructure & Database Portability Matrix */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-3">
        <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100 text-sm">
          <Database className="w-4 h-4 text-blue-500" />
          <span>Infrastructure & Provider Abstraction Matrix</span>
        </div>
        <p className="text-[11px] text-neutral-500">
          The domain core is decoupled from all vendor SDKs via repository ports (<code className="font-mono">ContactRepository</code>, <code className="font-mono">CampaignRepository</code>).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
              <span>Database Adapter</span>
              <span className="text-[10px] text-emerald-600 font-mono font-bold">ONLINE</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">SupabaseDatabaseAdapter (PostgreSQL + RLS)</div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400">PostgreSQL Schema & RLS Authoritative</div>
          </div>

          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
              <span>Object Storage Adapter</span>
              <span className="text-[10px] text-blue-600 font-mono font-bold">ACTIVE</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">InMemoryStorageProvider</div>
            <div className="text-[10px] text-neutral-400">S3 / Supabase Storage Compatible</div>
          </div>

          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
              <span>AI Provider Adapter</span>
              <span className="text-[10px] text-purple-600 font-mono font-bold">CONNECTED</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">@google/genai (3.8 Flash)</div>
            <div className="text-[10px] text-neutral-400">Deterministic Policy Guardrails</div>
          </div>
        </div>
      </div>

      {/* 3. Role-Based Access Control (RBAC) Matrix */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-3">
        <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100 text-sm">
          <Lock className="w-4 h-4 text-neutral-600" />
          <span>Role-Based Access Control (RBAC) Permissions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-neutral-700 dark:text-neutral-300">
            <thead className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 font-medium">
              <tr>
                <th className="py-2">Capability</th>
                <th className="py-2 text-center">OWNER</th>
                <th className="py-2 text-center">ADMIN</th>
                <th className="py-2 text-center">MANAGER</th>
                <th className="py-2 text-center">OPERATOR</th>
                <th className="py-2 text-center">VIEWER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
              <tr>
                <td className="py-2 font-medium">View Contacts & Timeline</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Import & Edit Contacts</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-rose-500">✕</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Execute Manual Outreach (W, E, S)</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-rose-500">✕</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Approve Outreach Campaigns</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-rose-500">✕</td>
                <td className="py-2 text-center text-rose-500">✕</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Trigger Emergency Kill Switch</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-emerald-600">✓</td>
                <td className="py-2 text-center text-rose-500">✕</td>
                <td className="py-2 text-center text-rose-500">✕</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Universal Webhook & CRM Sync Gateway */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div>
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-500" />
              <span>Universal Webhooks & CRM Sync Gateway</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Real-time HMAC-signed outbound webhooks connecting ReachOutOS with HubSpot, Salesforce, Zoho, or Google Sheets.
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold">
            HMAC SHA-256 SIGNED
          </span>
        </div>

        <div className="space-y-3">
          {WebhookGatewayService.getEndpoints().map((ep) => (
            <div key={ep.id} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100">{ep.name}</span>
                  <span className="px-2 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-mono text-[9px] font-bold">
                    ACTIVE
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const log = await WebhookGatewayService.testEndpoint(ep.id);
                    alert(`✓ Webhook Test Ping Sent to ${ep.name}!\nResponse: HTTP ${log.statusCode} (Latency: ${log.durationMs}ms)`);
                  }}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer self-start sm:self-auto"
                >
                  <Zap className="w-3 h-3 text-amber-300" />
                  <span>Send Test Ping</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-neutral-500 truncate">
                Endpoint URL: <strong className="text-neutral-700 dark:text-neutral-300">{ep.url}</strong>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60">
                <div className="flex items-center gap-1.5">
                  <span>Events:</span>
                  {ep.subscribedEvents.map(evt => (
                    <span key={evt} className="px-1.5 py-0.2 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {evt}
                    </span>
                  ))}
                </div>
                <div>Delivered: <strong className="text-emerald-600">{ep.successCount}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Enterprise White-Label Branding & Custom Tracking Domain */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div>
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-500" />
              <span>Multi-Tenant White-Label Branding & Custom Domain</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Customize brand name, logo, primary color tokens, and custom shortlink redirect domains.
            </p>
          </div>
          {brandingSavedMsg && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold">
              ✓ BRANDING SAVED
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Organization / Brand Name:
            </label>
            <input
              type="text"
              value={branding.orgName}
              onChange={(e) => setBranding({ ...branding, orgName: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Custom Shortlink Tracking Domain:
            </label>
            <input
              type="text"
              value={branding.trackingDomain}
              onChange={(e) => setBranding({ ...branding, trackingDomain: e.target.value })}
              placeholder="e.g. links.yourbrand.com"
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Sender Desk Alias:
            </label>
            <input
              type="text"
              value={branding.senderAlias}
              onChange={(e) => setBranding({ ...branding, senderAlias: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Primary Brand Accent Color:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={branding.primaryColor}
                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                className="w-8 h-8 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
              />
              <input
                type="text"
                value={branding.primaryColor}
                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Live Tracking Link Preview */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 text-[11px] flex items-center justify-between">
          <div className="font-mono text-neutral-600 dark:text-neutral-400 truncate">
            Sample Tracking URL: <strong className="text-emerald-600 dark:text-emerald-400">{TenantBrandingService.createBrandedLink('https://reachoutos.com/catalog.pdf', 'retailer_intro')}</strong>
          </div>
          <button
            onClick={() => {
              TenantBrandingService.updateBranding(branding);
              setBrandingSavedMsg(true);
              setTimeout(() => setBrandingSavedMsg(false), 3000);
            }}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs cursor-pointer shrink-0 ml-2"
          >
            Save Brand Settings
          </button>
        </div>
      </div>

      {/* 6. Data Lifecycle & Export */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              Data Lifecycle Management & Export
            </h3>
            <p className="text-[11px] text-neutral-500">
              Export tenant contacts or audit trails in CSV format for local backup.
            </p>
          </div>

          <button
            onClick={onExportContacts}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Verified Contacts CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
