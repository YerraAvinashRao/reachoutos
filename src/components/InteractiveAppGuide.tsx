import React, { useState } from 'react';
import { 
  BookOpen, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  LayoutDashboard, 
  Users, 
  UploadCloud, 
  ListFilter, 
  FileText, 
  Send, 
  Sparkles, 
  ShieldAlert, 
  History, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface InteractiveAppGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  initialStepIndex?: number;
}

interface GuideStep {
  title: string;
  tab: NavTab;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  summary: string;
  highlights: string[];
  tips: string;
  actionText: string;
}

export const InteractiveAppGuide: React.FC<InteractiveAppGuideProps> = ({
  isOpen,
  onClose,
  onNavigate,
  initialStepIndex = 0
}) => {
  const [currentStep, setCurrentStep] = useState(initialStepIndex);

  if (!isOpen) return null;

  const steps: GuideStep[] = [
    {
      title: '1. Dashboard & Workspace Overview',
      tab: 'dashboard',
      icon: LayoutDashboard,
      tag: 'Monitoring & KPIs',
      summary: 'Your mission control center. View real-time outreach volume, delivery rates, active campaigns, and workspace health at a glance.',
      highlights: [
        'Live KPI metrics: Total Contacts, Active Campaigns, Delivery & Open Rates.',
        'Quick action shortcuts to import contacts, draft templates, or launch campaigns.',
        'Emergency Kill Switch status indicator in the top navbar for instant workspace-wide pauses.'
      ],
      tips: 'Bookmark this view to review campaign engagement trends before scheduling new outreach.',
      actionText: 'Open Dashboard'
    },
    {
      title: '2. Contacts Management & Compliance',
      tab: 'contacts',
      icon: Users,
      tag: 'Lead Directory',
      summary: 'Manage your verified audience. Maintain canonical phone numbers in international E.164 format and enforce GDPR/consent opt-outs.',
      highlights: [
        'Add single contacts with first name, company, job title, email, and phone.',
        'Strict E.164 phone normalization (e.g., +919876543210 or +12125550199).',
        'Global Blocklist toggle: Mark any contact as Globally Blocked to permanently protect them from all future campaigns.',
        'Custom Fields support for personalized segmentation tags.'
      ],
      tips: 'Always ensure country codes (+91, +1, etc.) are included in phone numbers for flawless WhatsApp routing.',
      actionText: 'Go to Contacts'
    },
    {
      title: '3. CSV & Spreadsheet Import Wizard',
      tab: 'import',
      icon: UploadCloud,
      tag: 'Bulk Ingestion',
      summary: 'Ingest large contact spreadsheets cleanly with bank-grade formula sanitization and automatic column mapping.',
      highlights: [
        'Drag and drop any .csv file into the upload zone.',
        'Formula Injection Defense: Automatically neutralizes malicious spreadsheet prefixes (=, +, -, @).',
        'Auto-maps columns for First Name, Last Name, Phone, Email, Company, and City.',
        'Assign imported records directly to an existing or new Contact List.'
      ],
      tips: 'Ensure your CSV has a "phone" or "email" column header for automatic field recognition.',
      actionText: 'Go to Import Wizard'
    },
    {
      title: '4. Lists & Audience Segmentation',
      tab: 'lists',
      icon: ListFilter,
      tag: 'Targeting',
      summary: 'Group contacts into focused target audiences so you can run hyper-personalized outreach campaigns.',
      highlights: [
        'Create targeted groups (e.g. "Q1 SaaS CXOs", "Bangalore Tech Leads").',
        'View total active members, bounce rates, and linked campaigns per list.',
        'Reuse lists across multiple sequence campaigns over time.'
      ],
      tips: 'Segment by company size or job title to craft much higher-converting message templates.',
      actionText: 'Go to Lists & Segments'
    },
    {
      title: '5. Multi-Channel Message Templates',
      tab: 'templates',
      icon: FileText,
      tag: 'Copywriting',
      summary: 'Build high-converting message templates for WhatsApp and Email using dynamic personalization tags.',
      highlights: [
        'Supports WhatsApp (chat formatting) and Email (Subject + Body).',
        'Dynamic variables: Use {{firstName}}, {{companyName}}, {{jobTitle}} to personalize automatically.',
        'Live preview pane simulates the exact message your recipient will see on their device.'
      ],
      tips: 'Keep WhatsApp templates under 3 sentences for maximum response rates.',
      actionText: 'Go to Templates'
    },
    {
      title: '6. Campaigns & Audience Targeting',
      tab: 'campaigns',
      icon: Send,
      tag: 'Campaign Execution',
      summary: 'Combine your audience list and message template into an active campaign with built-in validation.',
      highlights: [
        'Select Channel (WhatsApp or Email), pick your Template, and choose your Audience List.',
        'Automated recipient verification blocks invalid phones, unsubscribes, or blocked leads before launch.',
        'Tracks real-time progress: Sent, Skipped, Blocked, and Pending queues.'
      ],
      tips: 'Review recipient list before activating to confirm dynamic fields are properly filled.',
      actionText: 'Go to Campaigns'
    },
    {
      title: '7. The Manual Sending Workspace',
      tab: 'campaigns',
      icon: MessageSquare,
      tag: 'Safe Dispatch Engine',
      summary: 'The core engine of ReachOut OS. Rapid, 1-click human-in-the-loop dispatch prevents automated spam penalties and WhatsApp bans.',
      highlights: [
        'Loads one recipient at a time with personalized copy pre-filled.',
        '1-Click "Send via WhatsApp" launches WhatsApp Web/Desktop with message ready to send.',
        '1-Click "Send via Email" opens your default email client.',
        'Rapid Keyboard Controls: Press S for Mark Sent, K for Skip, B for Block.'
      ],
      tips: 'Use keyboard shortcut "S" immediately after sending to auto-advance to the next contact without touching your mouse.',
      actionText: 'Explore Campaigns & Workspace'
    },
    {
      title: '8. AI Copilot & Safety Guardrails',
      tab: 'ai',
      icon: Sparkles,
      tag: 'Intelligent Outreach',
      summary: 'Supercharge your copy with Google Gemini AI and audit draft copy against anti-spam and compliance guardrails.',
      highlights: [
        'Generate personalized outreach pitches, cold openers, or follow-ups by setting desired tone.',
        'AI Guardrails: Scans copy for aggressive claims, spam trigger words, and regulatory risks.',
        'Save generated drafts directly into your Message Templates in 1 click.'
      ],
      tips: 'Use the "Concise" or "Persuasive" tone selector for the highest B2B reply rates.',
      actionText: 'Go to AI Copilot'
    },
    {
      title: '9. Workspace Settings & Kill Switch',
      tab: 'settings',
      icon: ShieldAlert,
      tag: 'Security & Governance',
      summary: 'Manage workspace details, team roles (OWNER, ADMIN, MANAGER, VIEWER), and the Emergency Kill Switch.',
      highlights: [
        'Workspace Details: View tenant ID, slug, timezone, and member roles.',
        'Emergency Kill Switch: 1-click freeze halts all active campaigns across the organization instantly.',
        'Immutable Audit Log: Full audit ledger tracking every action, user, and IP address.'
      ],
      tips: 'If an incorrect campaign link or text is sent by mistake, activate the Kill Switch immediately to pause pending queues.',
      actionText: 'Go to Settings'
    }
  ];

  const current = steps[currentStep];
  const StepIcon = current.icon;

  const handleGoToSection = () => {
    onNavigate(current.tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>ReachOut OS Guided Walkthrough</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-medium">
                  Step {currentStep + 1} of {steps.length}
                </span>
              </h2>
              <p className="text-[11px] text-neutral-500">
                Interactive guide to mastering multi-channel outreach and compliance
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition"
            title="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 pt-3 pb-1 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center gap-1.5 overflow-x-auto">
          {steps.map((s, idx) => (
            <button
              key={s.title}
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentStep 
                  ? 'w-8 bg-neutral-900 dark:bg-white' 
                  : idx < currentStep 
                  ? 'w-4 bg-emerald-500' 
                  : 'w-3 bg-neutral-200 dark:bg-neutral-800'
              }`}
              title={s.title}
            />
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Card Hero */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0 shadow-xs">
              <StepIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                  {current.tag}
                </span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {current.title}
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                {current.summary}
              </p>
            </div>
          </div>

          {/* Key Actions & Highlights */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-200 uppercase tracking-wide">
              Key Capabilities in this Section
            </h4>
            <div className="space-y-2">
              {current.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip Box */}
          <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <span>💡 Pro Tip:</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-95">
              {current.tips}
            </p>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
              disabled={currentStep === steps.length - 1}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGoToSection}
              className="px-4 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs hover:opacity-90 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>{current.actionText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
