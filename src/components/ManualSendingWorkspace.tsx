import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  SkipForward, 
  ShieldAlert, 
  Copy, 
  ExternalLink, 
  Paperclip, 
  Keyboard, 
  Pause, 
  Check, 
  HelpCircle,
  Building,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Campaign, CampaignRecipient, Contact, Role } from '../types';

interface ManualSendingWorkspaceProps {
  campaign: Campaign;
  recipients: CampaignRecipient[];
  contacts: Contact[];
  onBack: () => void;
  onPrepare: (recipientId: string) => Promise<any>;
  onMarkSent: (recipientId: string) => Promise<any>;
  onSkip: (recipientId: string, reason?: string) => Promise<any>;
  onBlockRecipient?: (recipientId: string, reason?: string) => Promise<any>;
  onToggleBlock: (contactId: string, reason?: string) => Promise<any>;
  onPauseCampaign: () => void;
  userRole: Role;
}

export const ManualSendingWorkspace: React.FC<ManualSendingWorkspaceProps> = ({
  campaign,
  recipients,
  contacts,
  onBack,
  onPrepare,
  onMarkSent,
  onSkip,
  onBlockRecipient,
  onToggleBlock,
  onPauseCampaign,
  userRole
}) => {
  // Find first unsent or active recipient ID
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(() => {
    const firstActive = recipients.find(r => r.status === 'READY' || r.status === 'OPENED') || recipients[0];
    return firstActive?.id || null;
  });
  const [copied, setCopied] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyReasons, setPolicyReasons] = useState<any[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(null);

  // Compute current index and recipient safely by ID so background updates never shift contacts
  const activeIdx = recipients.findIndex(r => r.id === selectedRecipientId);
  const currentIndex = activeIdx !== -1 ? activeIdx : 0;
  const currentRecipient = recipients[currentIndex] || null;
  const currentContact = contacts.find(c => c.id === currentRecipient?.contactId);

  const isSent = currentRecipient?.status === 'USER_SENT';
  const isOpened = currentRecipient?.status === 'OPENED';
  const isSuppressed = currentRecipient?.status === 'BLOCKED' || currentRecipient?.status === 'OPTED_OUT' || currentContact?.isGloballyBlocked;

  // Completed metrics
  const total = recipients.length;
  const sentCount = recipients.filter(r => r.status === 'USER_SENT').length;
  const skippedCount = recipients.filter(r => r.status === 'SKIPPED').length;
  const progressPct = Math.round((sentCount / (total || 1)) * 100);

  // Queue navigation functions
  const advanceToNext = useCallback(() => {
    if (currentIndex < recipients.length - 1) {
      setSelectedRecipientId(recipients[currentIndex + 1].id);
    } else {
      setSelectedRecipientId(null);
    }
    setLastOpenedAt(null);
  }, [recipients, currentIndex]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedRecipientId(recipients[currentIndex - 1].id);
      setLastOpenedAt(null);
    }
  }, [recipients, currentIndex]);

  // Direct instant deep-link URL calculation
  const getDeepLinkUrl = useCallback((r?: CampaignRecipient | null) => {
    if (!r) return '';
    const phoneDigits = (r.channelAddress || '').replace(/\D/g, '');
    const encodedBody = encodeURIComponent(r.resolvedMessage || '');
    if (campaign.channel === 'WHATSAPP') {
      return `https://wa.me/${phoneDigits}?text=${encodedBody}`;
    }
    const encodedSubject = encodeURIComponent(r.resolvedSubject || '');
    return `mailto:${r.channelAddress}?subject=${encodedSubject}&body=${encodedBody}`;
  }, [campaign.channel]);

  // Trigger Open Composer (Opening does NOT mark sent and does NOT advance)
  const handleOpenChannel = useCallback(async () => {
    if (!currentRecipient || userRole === 'VIEWER' || isSuppressed) return;
    const directUrl = getDeepLinkUrl(currentRecipient);
    if (directUrl) {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      setLastOpenedAt(new Date().toLocaleTimeString());
    }
    try {
      await onPrepare(currentRecipient.id);
    } catch (err: any) {
      console.warn('onPrepare background sync:', err);
    }
  }, [currentRecipient, userRole, isSuppressed, getDeepLinkUrl, onPrepare]);

  // Auto-select first active recipient when recipients load or change
  useEffect(() => {
    if (!selectedRecipientId && recipients.length > 0) {
      const firstActive = recipients.find(r => r.status === 'READY' || r.status === 'OPENED') || recipients[0];
      if (firstActive) {
        setSelectedRecipientId(firstActive.id);
      }
    }
  }, [recipients, selectedRecipientId]);

  // Mark Sent: ONLY explicit operator action marks as sent - 0ms instant transition & optimistic queue advancement
  const handleMarkSent = useCallback(() => {
    if (!currentRecipient || userRole === 'VIEWER') return;
    const recipientId = currentRecipient.id;
    // Advance queue immediately (0ms latency for operator)
    advanceToNext();
    // Persist to server and database in background
    onMarkSent(recipientId).catch((err: any) => {
      console.error('Background mark sent error:', err);
    });
  }, [currentRecipient, userRole, onMarkSent, advanceToNext]);

  // Skip and advance instantly in 0ms
  const handleSkip = useCallback(() => {
    if (!currentRecipient || userRole === 'VIEWER') return;
    const recipientId = currentRecipient.id;
    // Advance queue immediately
    advanceToNext();
    // Persist skip in background
    onSkip(recipientId, 'Manually skipped in focus workspace').catch((err: any) => {
      console.error('Background skip error:', err);
    });
  }, [currentRecipient, userRole, onSkip, advanceToNext]);

  // Block contact and advance instantly in 0ms
  const handleBlock = useCallback(() => {
    if (!currentContact || !currentRecipient || userRole === 'VIEWER') return;
    if (window.confirm(`Globally block and suppress ${currentContact.displayName}? This stops all future outreach across all channels.`)) {
      const contactId = currentContact.id;
      const recipientId = currentRecipient.id;
      // Advance queue immediately so operator never waits
      advanceToNext();
      // Fire suppression updates concurrently in background
      Promise.all([
        onToggleBlock(contactId, 'Suppressed during campaign review'),
        onBlockRecipient ? onBlockRecipient(recipientId, 'Contact globally suppressed') : Promise.resolve()
      ]).catch((err: any) => {
        console.error('Background block & suppression error:', err);
      });
    }
  }, [currentContact, currentRecipient, userRole, onToggleBlock, onBlockRecipient, advanceToNext]);

  // Copy message
  const handleCopyMessage = () => {
    if (!currentRecipient) return;
    navigator.clipboard.writeText(currentRecipient.resolvedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard navigation listener (W, E, S, K, B, N, P, C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const key = e.key.toUpperCase();
      if (key === 'W' || key === 'E') {
        e.preventDefault();
        handleOpenChannel();
      } else if (key === 'S') {
        e.preventDefault();
        handleMarkSent();
      } else if (key === 'K') {
        e.preventDefault();
        handleSkip();
      } else if (key === 'B') {
        e.preventDefault();
        handleBlock();
      } else if (key === 'C') {
        e.preventDefault();
        handleCopyMessage();
      } else if (key === 'N') {
        e.preventDefault();
        advanceToNext();
      } else if (key === 'P') {
        e.preventDefault();
        goToPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenChannel, handleMarkSent, handleSkip, handleBlock, advanceToNext, goToPrevious]);

  if (!currentRecipient) {
    return (
      <div className="p-8 text-center space-y-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Campaign Queue Complete!
        </h2>
        <p className="text-xs text-neutral-500">
          All recipients have been reviewed and processed.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold"
        >
          Return to Campaign Overview
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Bar: Progress & Emergency Pause */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Workspace</span>
        </button>

        {/* Campaign Name & Counter */}
        <div className="text-center">
          <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
            {campaign.name}
          </div>
          <div className="text-[11px] font-mono text-neutral-500">
            Recipient {currentIndex + 1} of {total} • <strong className="text-emerald-600 dark:text-emerald-400">{sentCount} Confirmed Sent</strong> • {total - sentCount - skippedCount} Remaining
          </div>
        </div>

        {/* Emergency Pause Button */}
        <button
          onClick={onPauseCampaign}
          className="px-2.5 py-1.5 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 transition flex items-center gap-1.5"
          title="Pause Campaign - Stops queue progression immediately"
        >
          <Pause className="w-3 h-3" />
          <span>Pause Campaign</span>
        </button>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-emerald-600 h-1.5 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* MAIN DISPATCH CARD */}
      <div className="p-4 sm:p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl space-y-4 sm:space-y-5">
        {/* Contact Info Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {currentRecipient.contactName}
              </h2>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                isSent
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                  : isOpened
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                  : isSuppressed
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                  : currentRecipient.status === 'SKIPPED'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
              }`}>
                {isSent ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>CONFIRMED SENT</span>
                  </>
                ) : isOpened ? (
                  <>
                    <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
                    <span>OPENED (AWAITING SEND)</span>
                  </>
                ) : isSuppressed ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>SUPPRESSED / BLOCKED</span>
                  </>
                ) : currentRecipient.status === 'SKIPPED' ? (
                  <span>SKIPPED</span>
                ) : (
                  <span>READY TO SEND</span>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-neutral-400" />
                <strong className="text-neutral-700 dark:text-neutral-300">{currentRecipient.companyName || '—'}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                <span>{currentContact?.city || '—'}, {currentContact?.state || ''}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-neutral-700 dark:text-neutral-300">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentRecipient.channelAddress}</span>
              </span>
            </div>
          </div>

          {/* Quick Tag Pills */}
          <div className="flex flex-wrap gap-1">
            {currentContact?.tags.map(t => (
              <span key={t} className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono text-neutral-600 dark:text-neutral-400 font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Guided Banner: Shown when composer is opened, clarifying that message is NOT sent yet */}
        {isOpened && !isSent && (
          <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-3 shadow-xs">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-2">
                <span>WhatsApp Composer Opened in Tab</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-200/80 dark:bg-blue-900 font-mono text-blue-900 dark:text-blue-200 font-semibold">Step 1 Completed</span>
              </div>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                The deep link was opened. Please switch to the WhatsApp tab, inspect the recipient, and manually hit Send. Once sent, click <strong>"2. Mark Sent (S)"</strong> below to record confirmation and advance to the next contact.
              </p>
            </div>
          </div>
        )}

        {/* Attachment Alert Banner (Strict Human-in-the-Loop requirement) */}
        {currentRecipient.attachmentName && (
          <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <Paperclip className="w-4 h-4 text-blue-600" />
              <span>Attachment Required: {currentRecipient.attachmentName}</span>
            </div>
            <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
              Official WhatsApp & Email deep links do not allow silent arbitrary file payloads. 
              When composer opens, please manually attach this document using the paperclip icon before pressing Send.
            </p>
          </div>
        )}

        {/* Message Preview Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[11px]">
              Personalized Message Preview
            </span>
            <button
              onClick={handleCopyMessage}
              className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied to clipboard' : 'Copy text (C)'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/40 text-neutral-900 dark:text-neutral-100 whitespace-pre-line text-sm font-sans leading-relaxed select-text shadow-inner">
            {currentRecipient.resolvedMessage}
          </div>
        </div>

        {/* Human-in-the-Loop Status & Timestamp Indicator */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {lastOpenedAt ? `Composer opened at ${lastOpenedAt} (Pending Send Confirmation)` : isOpened ? 'Composer opened (Pending Send Confirmation)' : 'Ready for outreach — Click Step 1 to open composer'}
            </span>
          </div>

          {isSuppressed && (
            <button
              onClick={() => setPolicyModalOpen(true)}
              className="text-rose-600 dark:text-rose-400 font-semibold underline flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Why can't I send?</span>
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          {/* Main Dispatch Steps (Large Thumb Touch Targets on Mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Open WhatsApp / Email */}
            <a
              href={!isSuppressed && userRole !== 'VIEWER' ? getDeepLinkUrl(currentRecipient) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (isSuppressed || userRole === 'VIEWER') {
                  e.preventDefault();
                  return;
                }
                setLastOpenedAt(new Date().toLocaleTimeString());
                onPrepare(currentRecipient.id).catch(console.warn);
              }}
              className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer select-none ${
                isSuppressed || userRole === 'VIEWER'
                  ? 'opacity-50 pointer-events-none bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                  : isOpened
                  ? 'border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white ring-2 ring-emerald-500/40 shadow-emerald-600/20 shadow-md'
              }`}
              title={`Open Official ${campaign.channel} (W)`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>{isOpened ? `1. Re-open ${campaign.channel}` : `1. Open ${campaign.channel}`}</span>
            </a>

            {/* 2. Mark Sent: Verified by operator */}
            <button
              onClick={handleMarkSent}
              disabled={userRole === 'VIEWER'}
              className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer select-none active:scale-[0.98] ${
                isOpened
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-emerald-600/30 shadow-lg'
                  : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-700'
              }`}
              title="Confirm user transmitted message (S)"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isOpened ? '2. Confirm Sent (S)' : '2. Mark Sent (S)'}</span>
            </button>
          </div>

          {/* Secondary Control Row: Navigation + Skip/Block */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Prev / Next */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                title="Previous (P)"
              >
                ← Prev
              </button>
              <button
                onClick={advanceToNext}
                disabled={currentIndex >= recipients.length - 1}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                title="Next (N)"
              >
                Next →
              </button>
            </div>

            {/* Skip & Block */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSkip}
                disabled={userRole === 'VIEWER'}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                title="Skip (K)"
              >
                Skip
              </button>

              <button
                onClick={handleBlock}
                disabled={userRole === 'VIEWER'}
                className="px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                title="Block / Do Not Contact (B)"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcut Ribbon (Desktop Only) */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 text-[11px] text-neutral-500 font-mono">
        <div className="flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold">W</kbd> Open WhatsApp</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold">S</kbd> Mark Sent</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold">K</kbd> Skip</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold">B</kbd> Block</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold">C</kbd> Copy Text</span>
        </div>
        <div className="text-[10px] text-neutral-400">
          Strict Human Verification • No simulated browser clicks
        </div>
      </div>

      {/* "Why can't I send?" Policy Diagnostic Modal */}
      {policyModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Why can't I send? — Policy Diagnostic</span>
              </h3>
              <button onClick={() => setPolicyModalOpen(false)} className="text-neutral-400">✕</button>
            </div>

            <p className="text-xs text-neutral-500">
              The deterministic Communication Policy Engine evaluated this recipient against all consent, suppression, and data quality gates:
            </p>

            <div className="space-y-2 text-xs">
              {policyReasons.length === 0 ? (
                <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400">
                  {currentRecipient.policyNotes || 'This contact is suppressed or opted out from marketing.'}
                </div>
              ) : (
                policyReasons.map((r, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded flex items-start gap-2 ${
                      r.passed
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    <span className="font-bold text-xs mt-0.5">{r.passed ? '✓' : '✕'}</span>
                    <div>
                      <div className="font-semibold text-[11px] font-mono">{r.code}</div>
                      <div className="text-[11px]">{r.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setPolicyModalOpen(false)}
                className="px-4 py-1.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
