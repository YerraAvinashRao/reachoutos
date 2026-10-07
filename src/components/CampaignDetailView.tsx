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
  Trash2
} from 'lucide-react';
import { Campaign, CampaignRecipient, Role, Contact } from '../types';

interface CampaignDetailViewProps {
  campaign: Campaign;
  recipients: CampaignRecipient[];
  contacts: Contact[];
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
  onBack,
  onUpdateStatus,
  onEnterSendingWorkspace,
  onSendTest,
  onSyncTemplate,
  onDeleteCampaign,
  userRole
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'preview5' | 'snapshot' | 'recipients'>('overview');
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

  // Audience Breakdown stats
  const total = recipients.length;
  const sent = recipients.filter(r => r.status === 'USER_SENT').length;
  const opened = recipients.filter(r => r.status === 'OPENED').length;
  const skipped = recipients.filter(r => r.status === 'SKIPPED').length;
  const blocked = recipients.filter(r => r.status === 'BLOCKED').length;
  const optedOut = recipients.filter(r => r.status === 'OPTED_OUT').length;
  const ready = recipients.filter(r => r.status === 'READY').length;

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
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {campaign.name}
            </h1>
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
                  recipients.slice((queuePage - 1) * queuePageSize, queuePage * queuePageSize).map(r => (
                    <tr key={r.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                      <td className="p-2.5 font-semibold text-neutral-900 dark:text-neutral-100">{r.contactName}</td>
                      <td className="p-2.5 text-neutral-500">{r.companyName}</td>
                      <td className="p-2.5 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">{r.channelAddress}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          r.status === 'USER_SENT'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 font-bold'
                            : r.status === 'OPENED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold'
                            : r.status === 'SKIPPED'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                            : r.status === 'BLOCKED' || r.status === 'OPTED_OUT'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}>
                          {r.status === 'USER_SENT'
                            ? 'CONFIRMED SENT'
                            : r.status === 'OPENED'
                            ? 'OPENED (PENDING SEND)'
                            : r.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-neutral-400 text-[11px]">{r.claimedByOperator || '—'}</td>
                      <td className="p-2.5 text-neutral-400 text-[11px] font-mono">
                        {r.userSentAt ? `Sent: ${new Date(r.userSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : r.openedAt ? `Opened: ${new Date(r.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </td>
                    </tr>
                  ))
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
                  {rec.resolvedMessage}
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
