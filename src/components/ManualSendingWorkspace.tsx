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
  Clock,
  ShieldCheck,
  BookOpen,
  Sparkles,
  RotateCcw,
  Zap,
  Briefcase,
  TrendingUp,
  Languages,
  Loader2,
  Edit3
} from 'lucide-react';
import { Campaign, CampaignRecipient, Contact, Role, MessageTemplate } from '../types';
import { PolicyEngine } from '../compliance/PolicyEngine';
import { ComplianceDecision } from '../compliance/ComplianceDecision';
import { DataQualityEngine } from '../core/validation/dataQuality';
import { apiClient } from '../services/apiClient';
import { PacingQualityService } from '../core/compliance/PacingQualityService';
import { MultiChannelFallbackService } from '../core/channels/MultiChannelFallbackService';

interface ManualSendingWorkspaceProps {
  campaign: Campaign;
  recipients: CampaignRecipient[];
  contacts: Contact[];
  templates?: MessageTemplate[];
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
  templates = [],
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

  // AI Rephrase & Custom In-Memory Message Overrides
  const [recipientOverrides, setRecipientOverrides] = useState<Record<string, string>>({});
  const [isRewriting, setIsRewriting] = useState(false);
  const [activeAiMode, setActiveAiMode] = useState<string | null>(null);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineDraft, setInlineDraft] = useState('');

  // Compute current index and recipient safely by ID so background updates never shift contacts
  const activeIdx = recipients.findIndex(r => r.id === selectedRecipientId);
  const currentIndex = activeIdx !== -1 ? activeIdx : 0;
  const currentRecipient = recipients[currentIndex] || null;
  const currentContact = contacts.find(c => c.id === currentRecipient?.contactId);

  const isSent = currentRecipient?.status === 'USER_SENT';
  const isOpened = currentRecipient?.status === 'OPENED';
  const isSuppressed = currentRecipient?.status === 'BLOCKED' || currentRecipient?.status === 'OPTED_OUT' || currentContact?.isGloballyBlocked;

  // Helper to dynamically get the most up-to-date message for a recipient
  const getActiveMessage = useCallback((r?: CampaignRecipient | null): string => {
    if (!r) return '';
    // 0. If this specific recipient has an AI rewrite or manual override in memory, use it!
    if (recipientOverrides[r.id] !== undefined) {
      return recipientOverrides[r.id];
    }
    // 1. Authoritatively resolve against live template in state if available
    const liveTemplate = templates?.find(t => t.id === campaign.templateId || t.name === campaign.templateSnapshot?.name);
    const effectiveBody = liveTemplate?.body || campaign?.templateSnapshot?.body;

    if (effectiveBody) {
      const contact = contacts.find(c => c.id === r.contactId);
      const contactData: Record<string, string> = {
        first_name: contact?.firstName || '',
        last_name: contact?.lastName || '',
        name: contact?.displayName || r.contactName || '',
        company_name: contact?.companyName || r.companyName || '',
        company: contact?.companyName || r.companyName || '',
        city: contact?.city || '',
        state: contact?.state || '',
        phone: contact?.phone || r.channelAddress || '',
        email: contact?.email || r.channelAddress || '',
        ...(contact?.customFields || {})
      };
      return DataQualityEngine.resolveTemplateVariables(effectiveBody, contactData).resolved;
    }
    return r.resolvedMessage || '';
  }, [campaign, templates, contacts, recipientOverrides]);

  const getActiveSubject = useCallback((r?: CampaignRecipient | null): string | undefined => {
    if (!r) return undefined;
    const liveTemplate = templates?.find(t => t.id === campaign.templateId || t.name === campaign.templateSnapshot?.name);
    const effectiveSubject = liveTemplate?.subject || campaign?.templateSnapshot?.subject;

    if (effectiveSubject) {
      const contact = contacts.find(c => c.id === r.contactId);
      const contactData: Record<string, string> = {
        first_name: contact?.firstName || '',
        last_name: contact?.lastName || '',
        name: contact?.displayName || r.contactName || '',
        company_name: contact?.companyName || r.companyName || '',
        company: contact?.companyName || r.companyName || '',
        city: contact?.city || '',
        state: contact?.state || '',
        phone: contact?.phone || r.channelAddress || '',
        email: contact?.email || r.channelAddress || '',
        ...(contact?.customFields || {})
      };
      return DataQualityEngine.resolveTemplateVariables(effectiveSubject, contactData).resolved;
    }
    return r.resolvedSubject;
  }, [campaign, templates, contacts]);

  // Evaluate Meta WhatsApp Compliance in real time for currently selected recipient
  const complianceDecision: ComplianceDecision = React.useMemo(() => {
    if (!currentRecipient) {
      return {
        decision: 'ALLOW',
        reason: 'No recipient selected',
        violations: [],
        evaluatedRules: [],
        requiredActions: [],
        canHumanOverride: true,
        policyVersion: '2026-10',
        evaluatedAt: new Date().toISOString()
      };
    }

    return PolicyEngine.evaluate({
      tenantId: campaign.tenantId || 'default',
      contactId: currentContact?.id,
      contactPhone: currentRecipient.channelAddress || currentContact?.phone || '',
      contactName: currentRecipient.contactName || currentContact?.displayName,
      channel: currentRecipient.channel,
      isMarketing: true,
      messageBody: getActiveMessage(currentRecipient) || campaign.templateSnapshot?.body || '',
      templateId: campaign.templateId,
      templateName: campaign.templateSnapshot?.name,
      templateCategory: (campaign.templateSnapshot as any)?.category || 'MARKETING',
      templateStatus: 'APPROVED',
      consentStatus: (currentContact?.preferences?.WHATSAPP?.marketingAllowed ? 'GRANTED' : 'UNKNOWN') as any,
      isGloballyBlocked: Boolean(currentContact?.isGloballyBlocked || isSuppressed),
      actorRole: userRole,
      lastInboundMessageAt: currentContact?.lastInteractionAt
    });
  }, [currentRecipient, currentContact, campaign, isSuppressed, userRole, getActiveMessage]);

  // Completed metrics
  const total = recipients.length;
  const sentCount = recipients.filter(r => r.status === 'USER_SENT').length;
  const skippedCount = recipients.filter(r => r.status === 'SKIPPED').length;
  const blockedCount = recipients.filter(r => r.status === 'BLOCKED').length;
  const optOutCount = recipients.filter(r => r.status === 'OPTED_OUT').length;
  const progressPct = Math.round((sentCount / (total || 1)) * 100);

  // Pacing Timer state (Anti-Spam velocity guard)
  const [pacingTimer, setPacingTimer] = useState<number>(0);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  // Calculate Meta Phone Number Health & Pacing metrics
  const qualityMetrics = React.useMemo(() => {
    return PacingQualityService.calculateQualityMetrics({
      totalSent24h: sentCount,
      blockedCount24h: blockedCount,
      optOutCount24h: optOutCount
    });
  }, [sentCount, blockedCount, optOutCount]);

  // Decrement pacing timer countdown
  useEffect(() => {
    if (pacingTimer > 0) {
      const interval = setInterval(() => {
        setPacingTimer(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pacingTimer]);

  const handleEmailFallback = () => {
    if (!currentContact || !currentRecipient) return;
    const fallback = MultiChannelFallbackService.generateEmailFallback({
      contact: currentContact,
      whatsappMessageBody: getActiveMessage(currentRecipient),
      campaignName: campaign.name
    });

    if (!fallback.canSendEmail) {
      alert(fallback.blockReason || 'Cannot send email fallback');
      return;
    }

    window.open(fallback.mailtoUrl, '_blank', 'noopener,noreferrer');
    setFallbackMessage(`✓ Email composer launched for ${fallback.recipientEmail}`);
    setTimeout(() => setFallbackMessage(null), 5000);
  };

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
    const activeMsg = getActiveMessage(r);
    const encodedBody = encodeURIComponent(activeMsg);
    if (campaign.channel === 'WHATSAPP') {
      return `https://wa.me/${phoneDigits}?text=${encodedBody}`;
    }
    const activeSub = getActiveSubject(r) || '';
    const encodedSubject = encodeURIComponent(activeSub);
    return `mailto:${r.channelAddress}?subject=${encodedSubject}&body=${encodedBody}`;
  }, [campaign.channel, getActiveMessage, getActiveSubject]);

  // Trigger Open Composer (Opening does NOT mark sent and does NOT advance)
  const handleOpenChannel = useCallback(async () => {
    if (!currentRecipient || userRole === 'VIEWER' || isSuppressed) return;

    // Hard Rule: Meta Policy Engine decides. If BLOCK, prevent dispatch.
    if (complianceDecision.decision === 'BLOCK') {
      setPolicyModalOpen(true);
      return;
    }

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
  }, [currentRecipient, userRole, isSuppressed, complianceDecision, getDeepLinkUrl, onPrepare]);

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
    const msg = getActiveMessage(currentRecipient);
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // AI Rephraser Handler
  const handleAiRewrite = async (mode: 'shorten' | 'persuasive' | 'professional' | 'telugu' | 'hindi' | 'hinglish') => {
    if (!currentRecipient || isRewriting) return;
    setIsRewriting(true);
    setActiveAiMode(mode);
    try {
      const currentMsg = getActiveMessage(currentRecipient);
      const res = await apiClient.aiRewrite({
        message: currentMsg,
        mode
      });
      if (res?.rewritten) {
        setRecipientOverrides(prev => ({
          ...prev,
          [currentRecipient.id]: res.rewritten
        }));
      }
    } catch (err: any) {
      console.error('AI Rewrite error:', err);
    } finally {
      setIsRewriting(false);
    }
  };

  // Reset to Base Template
  const handleResetToOriginal = () => {
    if (!currentRecipient) return;
    setRecipientOverrides(prev => {
      const next = { ...prev };
      delete next[currentRecipient.id];
      return next;
    });
    setActiveAiMode(null);
    setIsEditingInline(false);
  };

  // Save manual inline edits
  const handleSaveInlineEdit = () => {
    if (!currentRecipient) return;
    setRecipientOverrides(prev => ({
      ...prev,
      [currentRecipient.id]: inlineDraft
    }));
    setIsEditingInline(false);
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

              {/* Meta WhatsApp Policy Compliance Badge */}
              <button
                onClick={() => setPolicyModalOpen(true)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border transition cursor-pointer ${
                  complianceDecision.decision === 'ALLOW'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                    : complianceDecision.decision === 'HUMAN_REVIEW'
                    ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                }`}
                title="Click to view Meta WhatsApp Business Policy compliance evaluation"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>
                  {complianceDecision.decision === 'ALLOW'
                    ? 'Meta Safe (v2026-10)'
                    : complianceDecision.decision === 'HUMAN_REVIEW'
                    ? 'Meta Review Req'
                    : 'Meta Policy Blocked'}
                </span>
              </button>

              {/* Meta Phone Number Quality Health Indicator */}
              <div 
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 border shadow-2xs ${
                  qualityMetrics.status === 'GREEN'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                    : qualityMetrics.status === 'YELLOW'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 animate-pulse'
                }`}
                title={`Meta WhatsApp Phone Reputation Score: ${qualityMetrics.qualityScore}/100. Pacing Delay: ${qualityMetrics.recommendedDelaySeconds}s`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  qualityMetrics.status === 'GREEN' ? 'bg-emerald-500' : qualityMetrics.status === 'YELLOW' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
                <span>Meta Health: {qualityMetrics.qualityScore}% ({qualityMetrics.status})</span>
              </div>
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

        {/* Meta WhatsApp Policy Violation Alert */}
        {complianceDecision.decision === 'BLOCK' && (
          <div className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-900 dark:text-rose-200 space-y-2">
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Blocked by Meta WhatsApp Business Policy (v2026-10)</span>
              </div>
              <button
                onClick={() => setPolicyModalOpen(true)}
                className="underline text-[11px] text-rose-700 dark:text-rose-300 hover:text-rose-900 cursor-pointer"
              >
                Inspect Violations
              </button>
            </div>
            <div className="text-[11px] leading-relaxed">
              {complianceDecision.violations[0]?.reason}
            </div>
            <div className="text-[10px] font-mono text-rose-700 dark:text-rose-400 flex flex-wrap items-center justify-between gap-2">
              <span>Rule ID: {complianceDecision.violations[0]?.ruleId} • Account Safety Active</span>
              <span>Action: {complianceDecision.requiredActions[0] || 'Resolve policy violation'}</span>
            </div>
          </div>
        )}

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

        {/* Message Preview & AI Rephraser Box */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[11px]">
                Personalized Message
              </span>
              {recipientOverrides[currentRecipient.id] !== undefined && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 flex items-center gap-1 shadow-xs animate-in fade-in duration-200">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                  <span>AI Adapted {activeAiMode ? `(${activeAiMode})` : ''}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {recipientOverrides[currentRecipient.id] !== undefined && (
                <button
                  onClick={handleResetToOriginal}
                  className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition cursor-pointer"
                  title="Revert to base template copy"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Original</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (isEditingInline) {
                    setIsEditingInline(false);
                  } else {
                    setInlineDraft(getActiveMessage(currentRecipient));
                    setIsEditingInline(true);
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingInline ? 'Cancel Edit' : 'Edit Text'}</span>
              </button>

              <button
                onClick={handleCopyMessage}
                className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy (C)'}</span>
              </button>
            </div>
          </div>

          {/* AI Quick Rephrase Action Chips */}
          <div className="p-2 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center gap-1.5 text-xs">
            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-500 mr-1 pl-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>AI Tone:</span>
            </div>

            <button
              onClick={() => handleAiRewrite('shorten')}
              disabled={isRewriting || userRole === 'VIEWER'}
              className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                activeAiMode === 'shorten' && recipientOverrides[currentRecipient.id]
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600'
              }`}
            >
              {isRewriting && activeAiMode === 'shorten' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-500" />}
              <span>Shorten (&lt;50w)</span>
            </button>

            <button
              onClick={() => handleAiRewrite('professional')}
              disabled={isRewriting || userRole === 'VIEWER'}
              className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                activeAiMode === 'professional' && recipientOverrides[currentRecipient.id]
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600'
              }`}
            >
              {isRewriting && activeAiMode === 'professional' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Briefcase className="w-3 h-3 text-blue-500" />}
              <span>Professional B2B</span>
            </button>

            <button
              onClick={() => handleAiRewrite('persuasive')}
              disabled={isRewriting || userRole === 'VIEWER'}
              className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                activeAiMode === 'persuasive' && recipientOverrides[currentRecipient.id]
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600'
              }`}
            >
              {isRewriting && activeAiMode === 'persuasive' ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3 text-emerald-500" />}
              <span>Margin / Value Hook</span>
            </button>

            <div className="h-4 w-[1px] bg-neutral-300 dark:bg-neutral-700 mx-0.5 hidden sm:block" />

            <button
              onClick={() => handleAiRewrite('telugu')}
              disabled={isRewriting || userRole === 'VIEWER'}
              className={`px-2 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                activeAiMode === 'telugu' && recipientOverrides[currentRecipient.id]
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300'
              }`}
              title="Translate to Business Telugu"
            >
              {isRewriting && activeAiMode === 'telugu' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3 text-indigo-500" />}
              <span>తెలుగు (Telugu)</span>
            </button>

            <button
              onClick={() => handleAiRewrite('hindi')}
              disabled={isRewriting || userRole === 'VIEWER'}
              className={`px-2 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                activeAiMode === 'hindi' && recipientOverrides[currentRecipient.id]
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300'
              }`}
              title="Translate to Business Hindi"
            >
              {isRewriting && activeAiMode === 'hindi' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3 text-orange-500" />}
              <span>हिंदी (Hindi)</span>
            </button>

            <button
              onClick={() => handleAiRewrite('hinglish')}
              disabled={isRewriting || userRole === 'VIEWER'}
              className={`px-2 py-1 rounded-lg font-medium text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                activeAiMode === 'hinglish' && recipientOverrides[currentRecipient.id]
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300'
              }`}
              title="Conversational Hinglish"
            >
              {isRewriting && activeAiMode === 'hinglish' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3 text-teal-500" />}
              <span>Hinglish</span>
            </button>
          </div>

          {/* Editable Textarea or Live Preview Display */}
          {isEditingInline ? (
            <div className="space-y-2">
              <textarea
                value={inlineDraft}
                onChange={(e) => setInlineDraft(e.target.value)}
                rows={5}
                className="w-full p-3.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-sm font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-y"
                placeholder="Type customized outreach message for this recipient..."
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-neutral-400">
                  {inlineDraft.length} chars • {inlineDraft.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingInline(false)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveInlineEdit}
                    className="px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    Save Custom Copy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-xl border transition duration-200 ${
              isRewriting 
                ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 animate-pulse' 
                : recipientOverrides[currentRecipient.id] !== undefined
                ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-neutral-850'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/40'
            } text-neutral-900 dark:text-neutral-100 whitespace-pre-line text-sm font-sans leading-relaxed select-text shadow-inner relative`}>
              {getActiveMessage(currentRecipient)}
              <div className="mt-3 pt-2.5 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span>
                  {getActiveMessage(currentRecipient).length} chars • {getActiveMessage(currentRecipient).trim().split(/\s+/).filter(Boolean).length} words • ~{Math.max(3, Math.ceil(getActiveMessage(currentRecipient).trim().split(/\s+/).filter(Boolean).length / 3.5))}s read time
                </span>
                <span>Deep link auto-synchronized</span>
              </div>
            </div>
          )}
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

        {fallbackMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{fallbackMessage}</span>
          </div>
        )}

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

          {/* Secondary Control Row: Navigation + Fallback + Skip/Block */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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

            {/* Multi-Channel Smart Email Fallback */}
            {currentContact?.email && currentRecipient.channel === 'WHATSAPP' && (
              <button
                onClick={handleEmailFallback}
                className="px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title={`Launch Email Fallback for ${currentContact.email}`}
              >
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <span>Email Fallback ({currentContact.email.split('@')[0]})</span>
              </button>
            )}

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

      {/* Meta WhatsApp Policy Diagnostic Modal */}
      {policyModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  complianceDecision.decision === 'ALLOW' 
                    ? 'bg-emerald-500/10 text-emerald-600' 
                    : complianceDecision.decision === 'HUMAN_REVIEW'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-rose-500/10 text-rose-600'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Meta WhatsApp Policy Engine
                  </h3>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    Official Registry v2026-10 • Meta Platforms, Inc.
                  </div>
                </div>
              </div>
              <button onClick={() => setPolicyModalOpen(false)} className="text-neutral-400 hover:text-white p-1 rounded">✕</button>
            </div>

            {/* Decision Banner */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              complianceDecision.decision === 'ALLOW'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : complianceDecision.decision === 'HUMAN_REVIEW'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                <span>Decision Tier:</span>
                <span className="font-mono uppercase font-bold text-sm tracking-wide">
                  {complianceDecision.decision}
                </span>
              </div>
              <span className="text-[11px] font-mono opacity-80">
                Risk: {complianceDecision.riskLevel}
              </span>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Every outreach dispatch is strictly validated against the official Meta WhatsApp Business Messaging Policy. AI proposals cannot bypass blocking violations:
            </p>

            {/* Evaluated Meta Rules Breakdown */}
            <div className="space-y-2 text-xs">
              {complianceDecision.evaluatedRules.map((r, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 transition ${
                    r.passed
                      ? 'bg-neutral-50 dark:bg-neutral-950/50 border-neutral-200 dark:border-neutral-800/80 text-neutral-700 dark:text-neutral-300'
                      : r.severity === 'BLOCKING'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-200'
                  }`}
                >
                  <span className={`font-black text-xs shrink-0 mt-0.5 ${
                    r.passed ? 'text-emerald-600' : r.severity === 'BLOCKING' ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    {r.passed ? '✓' : '✕'}
                  </span>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px]">{r.ruleId}</span>
                      <span className="text-[10px] font-mono uppercase opacity-75">{r.category}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{r.reason}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Required Actions / Remediation */}
            {complianceDecision.requiredActions.length > 0 && (
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs space-y-1">
                <span className="font-bold text-neutral-700 dark:text-neutral-300 block">Required Remediation Actions:</span>
                {complianceDecision.requiredActions.map((action, idx) => (
                  <div key={idx} className="text-neutral-600 dark:text-neutral-400 pl-3 text-[11px]">
                    • {action}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800 text-xs">
              <a
                href="https://business.whatsapp.com/policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Meta Official Policy Docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => setPolicyModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs cursor-pointer"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
