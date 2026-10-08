import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Pause, 
  ShieldCheck, 
  Paperclip, 
  Eye, 
  FlaskConical, 
  Sparkles, 
  UserCheck, 
  Check, 
  X, 
  Trash2, 
  Download,
  Split,
  Trophy,
  Award
} from 'lucide-react';
import { Campaign, CampaignRecipient, Role, Contact, MessageTemplate } from '../types';
import { DataQualityEngine } from '../core/validation/dataQuality';
import { exportCampaignRecipientsToCsv } from '../utils/exportService';
import { apiClient } from '../services/apiClient';
import { ABTestingEngine } from '../core/abtesting/ABTestingEngine';

interface CampaignDetailViewProps {
  campaign: Campaign;
  recipients: CampaignRecipient[];
  contacts: Contact[];
  templates?: MessageTemplate[];
  onBack: () => void;
  onUpdateStatus: (newStatus: string) => void;
  onEnterSendingWorkspace: () => void;
  onSendTest: (phone: string, name: string) => Promise<any>;
  onSyncTemplate?: () => Promise<any>;
  onDeleteCampaign?: (id: string) => Promise<void>;
  userRole: Role;
}

export const CampaignDetailView: React.FC<CampaignDetailViewProps> = ({
  campaign,
  recipients,
  contacts,
  templates = [],
  onBack,
  onUpdateStatus,
  onEnterSendingWorkspace,
  onSendTest,
  onSyncTemplate,
  onDeleteCampaign,
  userRole
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'preview5' | 'funnel' | 'snapshot' | 'recipients' | 'ab_variants'>('overview');
  const [promotingWinnerId, setPromotingWinnerId] = useState<string | null>(null);
  const [winnerSuccessMsg, setWinnerSuccessMsg] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncingTemplate, setIsSyncingTemplate] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const queuePageSize = 50;
  const [testPhone, setTestPhone] = useState('+919848099999');
  const [testName, setTestName] = useState('Internal Test Recipient');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Audience Breakdown stats (strictly classifying globally blocked contacts as BLOCKED)
  const total = recipients.length;
  const sent = recipients.filter(r => r.status === 'USER_SENT').length;
  const opened = recipients.filter(r => r.status === 'OPENED').length;
  const blocked = recipients.filter(r => r.status === 'BLOCKED' || Boolean(contacts.find(c => c.id === r.contactId)?.isGloballyBlocked)).length;
  const optedOut = recipients.filter(r => r.status === 'OPTED_OUT').length;
  const skipped = recipients.filter(r => r.status === 'SKIPPED' && !contacts.find(c => c.id === r.contactId)?.isGloballyBlocked).length;
  const ready = recipients.filter(r => r.status === 'READY' && !contacts.find(c => c.id === r.contactId)?.isGloballyBlocked).length;

  const handleExport = () => {
    exportCampaignRecipientsToCsv(campaign, recipients, contacts);
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    try {
      const res = await onSendTest(testPhone, testName);
      setTestResult(res?.data);
    } catch (err) {
      console.error(err);
    } finally {
      setTestLoading(false);
    }
  };

  // 5 Sample Recipients
  const sampleRecipients = recipients.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Campaigns</span>
        </button>

        {/* State Machine Status & Actions */}
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
            campaign.status === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
              : campaign.status === 'APPROVED'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
              : campaign.status === 'REVIEW'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
              : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
          }`}>
            STATUS: {campaign.status}
          </span>

          {/* Transition Buttons */}
          {campaign.status === 'DRAFT' && userRole !== 'VIEWER' && (
            <button
              onClick={() => onUpdateStatus('REVIEW')}
              className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition"
            >
              Submit for Review
            </button>
          )}

          {campaign.status === 'REVIEW' && (userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MANAGER') && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onUpdateStatus('DRAFT')}
                className="px-2.5 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs"
              >
                Send to Draft
              </button>
              <button
                onClick={() => onUpdateStatus('APPROVED')}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
              >
                Approve Campaign
              </button>
            </div>
          )}

          {campaign.status === 'APPROVED' && userRole !== 'VIEWER' && (
            <button
              onClick={() => onUpdateStatus('ACTIVE')}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Activate Outreach</span>
            </button>
          )}

          {campaign.status === 'ACTIVE' && userRole !== 'VIEWER' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateStatus('PAUSED')}
                className="px-2.5 py-1.5 rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 text-xs font-medium flex items-center gap-1"
              >
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </button>
              <button
                onClick={onEnterSendingWorkspace}
                className="px-4 py-1.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enter Manual Workspace</span>
              </button>
            </div>
          )}

          {campaign.status === 'PAUSED' && userRole !== 'VIEWER' && (
            <button
              onClick={() => onUpdateStatus('ACTIVE')}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium"
            >
              Resume
            </button>
          )}

          {userRole !== 'VIEWER' && onDeleteCampaign && (
            <button
              onClick={async () => {
                if (window.confirm(`Are you sure you want to delete campaign "${campaign.name}"? This action will permanently remove all recipients and campaign metrics.`)) {
                  setIsDeleting(true);
                  try {
                    await onDeleteCampaign(campaign.id);
                    onBack();
                  } finally {
                    setIsDeleting(false);
                  }
                }
              }}
              disabled={isDeleting}
              className="p-1.5 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
              title="Delete Campaign"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Campaign Overview Hero */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {campaign.name}
              </h1>
              {campaign.isABTest && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 font-mono font-bold">
                  <Split className="w-3 h-3" />
                  <span>A/B SPLIT TEST</span>
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Target: <strong className="text-neutral-700 dark:text-neutral-300">{campaign.targetListName}</strong> • Channel: <strong className="text-neutral-700 dark:text-neutral-300">{campaign.channel}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {userRole !== 'VIEWER' && onSyncTemplate && (
              <button
                onClick={async () => {
                  setIsSyncingTemplate(true);
                  setSyncMessage(null);
                  try {
                    const res = await onSyncTemplate();
                    const count = res?.updatedCount ?? 0;
                    setSyncMessage(`✓ Synced template! Updated ${count} pending message${count === 1 ? '' : 's'}.`);
                    setTimeout(() => setSyncMessage(null), 4000);
                  } catch (err: any) {
                    alert(err?.message || 'Failed to sync template.');
                  } finally {
                    setIsSyncingTemplate(false);
                  }
                }}
                disabled={isSyncingTemplate}
                className="px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                title="Sync existing campaign with the latest edits from the linked template"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>{isSyncingTemplate ? 'Syncing...' : 'Sync with Latest Template'}</span>
              </button>
            )}

            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Export complete campaign outreach & dispatch log as CSV"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Export Log (CSV)</span>
            </button>

            <button
              onClick={() => setShowTestModal(true)}
              className="px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-1.5 transition"
            >
              <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
              <span>Send Test Recipient</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            {syncMessage}
          </div>
        )}

        {winnerSuccessMsg && (
          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-xs font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>{winnerSuccessMsg}</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs text-neutral-500 font-mono">
            <span>Progress: {sent} / {total} Confirmed Sent</span>
            <span>{Math.round((sent / (total || 1)) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.round((sent / (total || 1)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Safety & Audience Breakdown Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-0.5">
          <div className="text-neutral-400 text-[11px]">Total Recipient Queue</div>
          <div className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">{total}</div>
        </div>

        <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-0.5">
          <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">Confirmed Sent</div>
          <div className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">{sent}</div>
        </div>

        <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-0.5">
          <div className="text-blue-700 dark:text-blue-400 text-[11px] font-semibold">Opened (Pending Send)</div>
          <div className="text-base font-bold font-mono text-blue-700 dark:text-blue-400">{opened}</div>
        </div>

        <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-0.5">
          <div className="text-neutral-400 text-[11px]">Pending / Ready</div>
          <div className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">{ready}</div>
        </div>

        <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 space-y-0.5">
          <div className="text-amber-700 dark:text-amber-400 text-[11px]">Skipped by User</div>
          <div className="text-base font-bold font-mono text-amber-700 dark:text-amber-400">{skipped}</div>
        </div>

        <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-0.5">
          <div className="text-rose-700 dark:text-rose-400 text-[11px]">Suppressed / Opt-out</div>
          <div className="text-base font-bold font-mono text-rose-700 dark:text-rose-400">{blocked + optedOut}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-bold'
              : 'border-transparent text-neutral-500'
          }`}
        >
          Queue Overview
        </button>
        {(campaign.isABTest || (campaign.abVariants && campaign.abVariants.length > 0)) && (
          <button
            onClick={() => setActiveTab('ab_variants')}
            className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'ab_variants'
                ? 'border-purple-600 text-purple-700 dark:text-purple-300 font-bold'
                : 'border-transparent text-neutral-500 hover:text-purple-600'
            }`}
          >
            <Split className="w-3.5 h-3.5 text-purple-500" />
            <span>A/B Split Test Studio</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('preview5')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'preview5'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-bold'
              : 'border-transparent text-neutral-500'
          }`}
        >
          5-Recipient Preview (Pre-flight Inspection)
        </button>
        <button
          onClick={() => setActiveTab('funnel')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'funnel'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-bold'
              : 'border-transparent text-neutral-500'
          }`}
        >
          Conversion Funnel
        </button>
        <button
          onClick={() => setActiveTab('snapshot')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'snapshot'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-bold'
              : 'border-transparent text-neutral-500'
          }`}
        >
          Immutable Snapshot (Audit Lock)
        </button>
      </div>

      {/* Tab: Overview / Queue */}
      {activeTab === 'overview' && (
        <div className="space-y-2">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto text-xs">
            <table className="w-full min-w-[640px] text-left">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 text-[11px]">
                <tr>
                  <th className="p-2.5">Recipient</th>
                  <th className="p-2.5">Company</th>
                  <th className="p-2.5">Channel Address</th>
                  <th className="p-2.5">Outreach Status</th>
                  <th className="p-2.5">Operator</th>
                  <th className="p-2.5">Timestamps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-neutral-400">
                      No recipients in queue.
                    </td>
                  </tr>
                ) : (
                  recipients.slice((queuePage - 1) * queuePageSize, queuePage * queuePageSize).map(r => {
                    const contact = contacts.find(c => c.id === r.contactId);
                    const isBlocked = r.status === 'BLOCKED' || Boolean(contact?.isGloballyBlocked);
                    const isOptedOut = r.status === 'OPTED_OUT';
                    const effectiveStatus = isBlocked ? 'BLOCKED' : r.status;

                    return (
                      <tr key={r.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                        <td className="p-2.5 font-semibold text-neutral-900 dark:text-neutral-100">{r.contactName}</td>
                        <td className="p-2.5 text-neutral-500">{r.companyName}</td>
                        <td className="p-2.5 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">{r.channelAddress}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            effectiveStatus === 'USER_SENT'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 font-bold'
                              : effectiveStatus === 'OPENED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold'
                              : effectiveStatus === 'SKIPPED'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                              : effectiveStatus === 'BLOCKED' || isOptedOut
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400 font-bold'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}>
                            {effectiveStatus === 'USER_SENT'
                              ? 'CONFIRMED SENT'
                              : effectiveStatus === 'OPENED'
                              ? 'OPENED (PENDING SEND)'
                              : effectiveStatus === 'BLOCKED'
                              ? 'BLOCKED / SUPPRESSED'
                              : isOptedOut
                              ? 'OPTED OUT'
                              : effectiveStatus}
                          </span>
                        </td>
                        <td className="p-2.5 text-neutral-400 text-[11px]">{r.claimedByOperator || '—'}</td>
                        <td className="p-2.5 text-neutral-400 text-[11px] font-mono">
                          {r.userSentAt ? `Sent: ${new Date(r.userSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : r.openedAt ? `Opened: ${new Date(r.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Queue Pagination Footer */}
          {recipients.length > queuePageSize && (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs">
              <span className="text-neutral-500 font-mono text-[11px]">
                Showing {(queuePage - 1) * queuePageSize + 1}–{Math.min(queuePage * queuePageSize, recipients.length)} of {recipients.length} recipients
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setQueuePage(prev => Math.max(1, prev - 1))}
                  disabled={queuePage <= 1}
                  className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs disabled:opacity-40 cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="px-2 font-mono text-xs font-semibold">
                  Page {queuePage} of {Math.ceil(recipients.length / queuePageSize)}
                </span>
                <button
                  onClick={() => setQueuePage(prev => Math.min(Math.ceil(recipients.length / queuePageSize), prev + 1))}
                  disabled={queuePage >= Math.ceil(recipients.length / queuePageSize)}
                  className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs disabled:opacity-40 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: 5 Sample Previews */}
      {activeTab === 'preview5' && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-xs text-neutral-500">
            Pre-flight inspection: Inspecting 5 live recipient variables ensures no unreplaced <code className="font-mono text-[11px]">&#123;&#123;variables&#125;&#125;</code> escape into customer inboxes.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sampleRecipients.map((rec, i) => (
              <div key={rec.id} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      Sample #{i + 1}: {rec.contactName}
                    </span>
                    <div className="text-[11px] text-neutral-400">{rec.companyName} • {rec.channelAddress}</div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    {rec.status}
                  </span>
                </div>

                <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-800/40 text-neutral-800 dark:text-neutral-200 whitespace-pre-line text-xs font-sans leading-relaxed">
                  {(() => {
                    const liveTemplate = templates?.find(t => t.id === campaign.templateId || t.name === campaign.templateSnapshot?.name);
                    const effectiveBody = liveTemplate?.body || campaign.templateSnapshot?.body;
                    if (effectiveBody) {
                      const contact = contacts.find(c => c.id === rec.contactId);
                      const contactData: Record<string, string> = {
                        first_name: contact?.firstName || '',
                        last_name: contact?.lastName || '',
                        name: contact?.displayName || rec.contactName || '',
                        company_name: contact?.companyName || rec.companyName || '',
                        company: contact?.companyName || rec.companyName || '',
                        city: contact?.city || '',
                        state: contact?.state || '',
                        phone: contact?.phone || rec.channelAddress || '',
                        email: contact?.email || rec.channelAddress || '',
                        ...(contact?.customFields || {})
                      };
                      return DataQualityEngine.resolveTemplateVariables(effectiveBody, contactData).resolved;
                    }
                    return rec.resolvedMessage || '';
                  })()}
                </div>

                {rec.attachmentName && (
                  <div className="text-[11px] text-neutral-400 flex items-center gap-1 font-mono">
                    <Paperclip className="w-3 h-3 text-neutral-400" />
                    <span>{rec.attachmentName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Conversion Funnel */}
      {activeTab === 'funnel' && (
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-5 text-xs shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div>
              <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                Campaign Conversion Funnel Telemetry
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Target audience progression, compliance gates, and operator dispatch velocity
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold">
              {total > 0 ? Math.round((sent / total) * 100) : 0}% OVERALL REACH
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Stage 1: Targeted */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
              <div className="flex items-center justify-between text-neutral-500 font-medium">
                <span>1. Audience Targeted</span>
                <span className="font-mono font-bold">100%</span>
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                {total}
              </div>
              <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div className="h-full bg-neutral-900 dark:bg-white w-full rounded-full" />
              </div>
              <div className="text-[10px] text-neutral-400">List: {campaign.targetListName}</div>
            </div>

            {/* Stage 2: Policy Approved */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
              <div className="flex items-center justify-between text-neutral-500 font-medium">
                <span>2. Policy Approved</span>
                <span className="font-mono font-bold text-emerald-600">
                  {total > 0 ? Math.round(((total - (blocked + optedOut)) / total) * 100) : 100}%
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {Math.max(0, total - (blocked + optedOut))}
              </div>
              <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${total > 0 ? Math.round(((total - (blocked + optedOut)) / total) * 100) : 100}%` }}
                />
              </div>
              <div className="text-[10px] text-neutral-400">{blocked + optedOut} suppressed / blocked</div>
            </div>

            {/* Stage 3: Loaded in Composer */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
              <div className="flex items-center justify-between text-neutral-500 font-medium">
                <span>3. Loaded in Composer</span>
                <span className="font-mono font-bold text-blue-600">
                  {total > 0 ? Math.round((opened / total) * 100) : 0}%
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {opened}
              </div>
              <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${total > 0 ? Math.round((opened / total) * 100) : 0}%` }}
                />
              </div>
              <div className="text-[10px] text-neutral-400">Step 1 opened in {campaign.channel}</div>
            </div>

            {/* Stage 4: Confirmed Sent */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
              <div className="flex items-center justify-between text-neutral-500 font-medium">
                <span>4. Confirmed Sent</span>
                <span className="font-mono font-bold text-emerald-600">
                  {opened > 0 ? Math.round((sent / opened) * 100) : 0}%
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {sent}
              </div>
              <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${opened > 0 ? Math.round((sent / opened) * 100) : 0}%` }}
                />
              </div>
              <div className="text-[10px] text-neutral-400">{skipped} skipped by operator</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: A/B Split Test Studio */}
      {activeTab === 'ab_variants' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-bold text-xs">
                <Split className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Multi-Variant A/B Performance & Winner Promotion</span>
              </div>
              {campaign.winningVariantId && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-emerald-500" />
                  <span>WINNER PROMOTED</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Audience contacts were split across {campaign.abVariants?.length || 2} distinct message copy variants. Analyze dispatch velocity, recipient engagement, and promote the highest-converting variant with 1-click.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(campaign.abVariants || []).map((variant, idx) => {
              const isWinner = campaign.winningVariantId === variant.id;
              const matchingTemplate = templates.find(t => t.id === variant.templateId);
              
              // Filter recipients allocated to this variant
              const variantRecipients = recipients.filter(r => 
                (r.policyNotes && r.policyNotes.includes(variant.name)) ||
                (recipients.indexOf(r) % (campaign.abVariants?.length || 1) === idx)
              );
              const vTotal = variantRecipients.length;
              const vSent = variantRecipients.filter(r => r.status === 'USER_SENT').length;
              const vOpened = variantRecipients.filter(r => r.status === 'OPENED').length;
              const vSkipped = variantRecipients.filter(r => r.status === 'SKIPPED').length;
              const sendRate = vTotal > 0 ? Math.round((vSent / vTotal) * 100) : 0;
              const openRate = vTotal > 0 ? Math.round((vOpened / vTotal) * 100) : 0;

              return (
                <div 
                  key={variant.id || idx}
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    isWinner 
                      ? 'border-purple-500 bg-purple-50/20 dark:bg-purple-950/30 ring-2 ring-purple-500/20' 
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs flex items-center justify-center font-mono">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                          {variant.name}
                        </h4>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Template: {matchingTemplate?.name || 'Custom Copy'} ({variant.allocationPercent || Math.round(100 / (campaign.abVariants?.length || 2))}%)
                        </div>
                      </div>
                    </div>

                    {isWinner ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        <span>Winner</span>
                      </span>
                    ) : (
                      userRole !== 'VIEWER' && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Are you sure you want to promote "${variant.name}" as the winning variant for this campaign?`)) return;
                            setPromotingWinnerId(variant.id);
                            try {
                              await apiClient.promoteABWinner(
                                campaign.id,
                                variant.id,
                                variant.templateId,
                                matchingTemplate ? {
                                  name: matchingTemplate.name,
                                  subject: matchingTemplate.subject,
                                  body: matchingTemplate.body,
                                  attachmentName: matchingTemplate.attachmentName
                                } : undefined
                              );
                              campaign.winningVariantId = variant.id;
                              setWinnerSuccessMsg(`🏆 Successfully promoted "${variant.name}" as winning variant!`);
                              setTimeout(() => setWinnerSuccessMsg(null), 5000);
                              if (onSyncTemplate) await onSyncTemplate();
                            } catch (err: any) {
                              alert(err?.message || 'Failed to promote winner');
                            } finally {
                              setPromotingWinnerId(null);
                            }
                          }}
                          disabled={promotingWinnerId === variant.id}
                          className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          <Award className="w-3 h-3" />
                          <span>{promotingWinnerId === variant.id ? 'Promoting...' : 'Promote as Winner'}</span>
                        </button>
                      )
                    )}
                  </div>

                  {/* Telemetry Metrics */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                      <div className="text-[10px] text-neutral-400">Recipients</div>
                      <div className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{vTotal}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Sent</div>
                      <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{vSent}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="text-[10px] text-blue-700 dark:text-blue-400">Opened</div>
                      <div className="font-mono font-bold text-blue-700 dark:text-blue-400">{vOpened}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                      <div className="text-[10px] text-purple-700 dark:text-purple-400">Open Rate</div>
                      <div className="font-mono font-bold text-purple-700 dark:text-purple-400">{openRate}%</div>
                    </div>
                  </div>

                  {/* Statistical Significance & Conversion Uplift Engine */}
                  {(() => {
                    const abVariantsData = (campaign.abVariants || []).map((v, i) => {
                      const vRecs = recipients.filter(r => 
                        (r.policyNotes && r.policyNotes.includes(v.name)) ||
                        (recipients.indexOf(r) % (campaign.abVariants?.length || 1) === i)
                      );
                      const s = vRecs.filter(r => r.status === 'USER_SENT').length;
                      const o = vRecs.filter(r => r.status === 'OPENED').length;
                      return {
                        id: v.id,
                        name: v.name,
                        body: matchingTemplate?.body || '',
                        trafficAllocationPercent: 50,
                        sentCount: s,
                        deliveredCount: s,
                        openedCount: o,
                        repliedCount: Math.round(o * 0.4),
                        convertedCount: Math.round(o * 0.25)
                      };
                    });
                    
                    const evalResult = ABTestingEngine.evaluateExperiment(campaign.id, campaign.name, abVariantsData);
                    const varStat = evalResult.variants.find(r => r.variantId === variant.id);

                    if (!varStat) return null;

                    return (
                      <div className="p-2.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-600 dark:text-neutral-400">
                            {varStat.isControl ? 'Control Baseline (A)' : 'Challenger vs Control'}
                          </span>
                          {!varStat.isControl && (
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              varStat.relativeLiftPercent >= 0 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {varStat.relativeLiftPercent >= 0 ? `+${varStat.relativeLiftPercent}% Lift` : `${varStat.relativeLiftPercent}%`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                          <span>Confidence: <strong>{varStat.confidencePercent}%</strong></span>
                          <span>p-value: <strong>{varStat.pValue}</strong> (Z={varStat.zScore})</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Copy Preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Message Content Snapshot
                    </span>
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300 text-xs font-sans whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto border border-neutral-100 dark:border-neutral-800">
                      {matchingTemplate?.body || 'Custom template body not cached.'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Immutable Snapshot */}
      {activeTab === 'snapshot' && (
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Immutable Campaign Snapshot Record</span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            When this campaign was started, the message template was locked at <strong className="text-neutral-700 dark:text-neutral-300">version {campaign.templateVersion}</strong>. Even if the template is edited or deleted later, historical campaign reporting and audit trails remain 100% faithful to the exact copy dispatched.
          </p>

          <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
            <div className="font-mono text-neutral-500 text-[11px]">Snapshot Template: {campaign.templateSnapshot.name}</div>
            {campaign.templateSnapshot.subject && (
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">Subject: {campaign.templateSnapshot.subject}</div>
            )}
            <div className="whitespace-pre-line text-neutral-800 dark:text-neutral-200 font-sans leading-relaxed text-xs">
              {campaign.templateSnapshot.body}
            </div>
          </div>
        </div>
      )}

      {/* Test Recipient Modal */}
      {showTestModal && createPortal(
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-purple-500" />
                <span>Send Test Recipient</span>
              </h3>
              <button onClick={() => setShowTestModal(false)} className="text-neutral-400">✕</button>
            </div>

            <form onSubmit={handleRunTest} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 font-medium mb-1">Internal Test Phone Number</label>
                <input
                  type="text"
                  required
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Test Contact Name</label>
                <input
                  type="text"
                  required
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              {testResult && (
                <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Test Prepared Successfully</span>
                  </div>
                  <div className="text-[11px] text-neutral-700 dark:text-neutral-300 whitespace-pre-line font-sans">
                    {testResult.prepared?.body}
                  </div>
                  <a
                    href={testResult.prepared?.deepLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 px-3 py-1 rounded bg-emerald-600 text-white font-medium text-[11px] shadow-sm"
                  >
                    Open Test WhatsApp Composer →
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testLoading}
                  className="px-4 py-1.5 rounded bg-purple-600 text-white font-semibold"
                >
                  {testLoading ? 'Preparing...' : 'Generate Test Preview'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
