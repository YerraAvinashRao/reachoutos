import React, { useState } from 'react';
import { 
  Users, 
  Send, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  ShieldAlert,
  Flame,
  FileText,
  BookOpen,
  X
} from 'lucide-react';
import { Campaign, User } from '../types';

interface DashboardViewProps {
  stats: any;
  campaigns: Campaign[];
  onOpenCampaign: (campaignId: string) => void;
  onNavigate: (tab: any) => void;
  user?: User | null;
  onOpenGuide?: () => void;
  tourCompleted?: boolean;
  onDismissTourBanner?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  campaigns,
  onOpenCampaign,
  onNavigate,
  user,
  onOpenGuide,
  tourCompleted,
  onDismissTourBanner
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('reachout_tour_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const activeCampaign = campaigns.find(c => c.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div 
        data-tour="dashboard.welcome"
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-900/40"
      >
        <div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <span>Welcome back, {user?.name || 'Operator'}</span>
            <span className="text-sm font-normal text-neutral-400">👋</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Human-in-the-Loop Multi-Channel Dispatch • Verified Consent & Data Quality Engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('import')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
          >
            Import Spreadsheet
          </button>
          <button
            onClick={() => onNavigate('campaigns')}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm"
          >
            New Campaign
          </button>
        </div>
      </div>

      {/* Interactive Quick Start & Guide Banner (Hidden once tour is completed or dismissed) */}
      {!isDismissed && !tourCompleted && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950/30 dark:via-neutral-900 dark:to-neutral-900 shadow-xs space-y-3 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <span>New to ReachOut OS? Quick-Start Guided Tour</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold uppercase">Guide</span>
                </h2>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Follow our 4-step workflow: Import Contacts ➔ Craft Template ➔ Launch Campaign ➔ Safe 1-Click Dispatch.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenGuide && (
                <button
                  onClick={onOpenGuide}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Launch Interactive Walkthrough</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('reachout_tour_dismissed', 'true');
                  } catch {}
                  setIsDismissed(true);
                  onDismissTourBanner?.();
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                title="Dismiss quick-start guide banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4 Quick Step Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-xs">
            <button
              onClick={() => onNavigate('contacts')}
              className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-800/60 hover:border-emerald-300 dark:hover:border-emerald-700 text-left transition cursor-pointer group"
            >
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">STEP 1</div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Add or Import Contacts</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">E.164 phone validation</div>
            </button>
            <button
              onClick={() => onNavigate('templates')}
              className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-800/60 hover:border-emerald-300 dark:hover:border-emerald-700 text-left transition cursor-pointer group"
            >
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">STEP 2</div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Create Message Template</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">WhatsApp & Email tags</div>
            </button>
            <button
              onClick={() => onNavigate('campaigns')}
              className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-800/60 hover:border-emerald-300 dark:hover:border-emerald-700 text-left transition cursor-pointer group"
            >
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">STEP 3</div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Activate Campaign</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Automated queue validation</div>
            </button>
            <button
              onClick={() => onNavigate('campaigns')}
              className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-800/60 hover:border-emerald-300 dark:hover:border-emerald-700 text-left transition cursor-pointer group"
            >
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">STEP 4</div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Sending Workspace</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Safe 1-click dispatch</div>
            </button>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Total Contacts</span>
            <Users className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            {stats?.totalContacts ?? '—'}
          </div>
          <div className="text-[10px] text-neutral-400">Canonical phone verified</div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Active Campaigns</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            {stats?.activeCampaigns ?? '0'}
          </div>
          <div className="text-[10px] text-neutral-400">Approved by Manager</div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Prepared & Opened</span>
            <Send className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            {stats?.totalOpened ?? '0'}
          </div>
          <div className="text-[10px] text-neutral-400">Official composer loaded</div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>User Marked Sent</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {stats?.totalSent ?? '0'}
          </div>
          <div className="text-[10px] text-neutral-400">Operator confirmed</div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Pending in Queue</span>
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            {stats?.pendingCount ?? '0'}
          </div>
          <div className="text-[10px] text-neutral-400">Ready for next review</div>
        </div>
      </div>

      {/* Compliance / Truth in Metrics Notice */}
      <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Honest Observability Standard:</span> ReachOut OS does not claim external messages are "Delivered" or "Read" without provider-authenticated webhooks. In human-in-the-loop mode, metrics strictly reflect <span className="font-semibold underline">User Confirmed Sent</span> after the operator reviews and transmits the message in the official composer.
        </div>
      </div>

      {/* Continue Sending Focus Card */}
      {activeCampaign ? (
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
                ACTIVE QUEUE
              </span>
              <span className="text-xs text-neutral-400">• Channel: {activeCampaign.channel}</span>
            </div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {activeCampaign.name}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Target List: {activeCampaign.targetListName} • {activeCampaign.sentCount} of {activeCampaign.recipientsCount} dispatched ({Math.round((activeCampaign.sentCount / (activeCampaign.recipientsCount || 1)) * 100)}%)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenCampaign(activeCampaign.id)}
              className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 font-medium text-xs flex items-center gap-2 shadow-sm transition"
            >
              <span>Continue Outreach Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Campaigns Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Campaigns */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Recent Campaigns
            </h3>
            <button
              onClick={() => onNavigate('campaigns')}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              View all ({campaigns.length})
            </button>
          </div>

          <div className="space-y-2.5">
            {campaigns.slice(0, 4).map(c => {
              const pct = Math.round((c.sentCount / (c.recipientsCount || 1)) * 100);
              return (
                <div
                  key={c.id}
                  onClick={() => onOpenCampaign(c.id)}
                  className="p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 cursor-pointer transition space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {c.name}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {c.sentCount} / {c.recipientsCount} ({pct}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-neutral-900 dark:bg-neutral-100 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Channel: {c.channel}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      c.status === 'ACTIVE' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' 
                        : c.status === 'DRAFT'
                        ? 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Launch & AI Assistant Preview */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>AI Message Copilot</span>
            </h3>
            <button
              onClick={() => onNavigate('ai')}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              Open Lab
            </button>
          </div>

          <div className="p-3 rounded-lg border border-purple-100 dark:border-purple-950/60 bg-purple-50/30 dark:bg-purple-950/10 space-y-2 text-xs">
            <div className="font-medium text-neutral-800 dark:text-neutral-200">
              Assisted Copywriting & Guardrails
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed">
              Powered by server-side Gemini 3.8 Flash. Craft high-converting wholesale outreach, adapt copy into Telugu/Hindi/Hinglish, and automatically screen for spam phrases or unsupported claims before sending.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onNavigate('ai')}
                className="px-2.5 py-1 rounded bg-purple-600 text-white font-medium text-[11px] hover:bg-purple-700 transition"
              >
                Draft Outreach Copy
              </button>
              <button
                onClick={() => onNavigate('templates')}
                className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium text-[11px] hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
              >
                Browse Templates
              </button>
            </div>
          </div>

          {/* Core Product Principles Box */}
          <div className="p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-[11px] text-neutral-500 space-y-1">
            <div className="font-medium text-neutral-700 dark:text-neutral-300">
              Core Operational Safeguards
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-neutral-400">
              <li>Deterministic policy engine checks suppression before handoff.</li>
              <li>Unresolved variables like <code className="font-mono text-[10px]">&#123;&#123;first_name&#125;&#125;</code> block sending.</li>
              <li>No browser extensions or DOM automation scripts permitted.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
