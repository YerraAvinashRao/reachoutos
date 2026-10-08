import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  Keyboard, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  TrendingUp, 
  Database, 
  Lock, 
  Users, 
  Send, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown, 
  AlertTriangle, 
  RotateCcw, 
  ShieldAlert, 
  Sliders, 
  Laptop, 
  FileSpreadsheet, 
  Radio, 
  X,
  Volume2,
  ThumbsUp,
  Award
} from 'lucide-react';
import { LoginView } from './LoginView';

interface LandingPageViewProps {
  onLaunchApp: () => void;
  isAuthenticated: boolean;
  onSignOut?: () => void;
  userEmail?: string;
}

interface DemoLead {
  id: string;
  name: string;
  company: string;
  role: string;
  phone: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS';
  avatar: string;
  notes: string;
}

const DEMO_LEADS: DemoLead[] = [
  {
    id: 'lead-1',
    name: 'Sarah Chen',
    company: 'ScaleUp AI',
    role: 'VP Growth & Revenue',
    phone: '+1 (555) 392-8104',
    channel: 'WHATSAPP',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    notes: 'Raised Series A last month. Expanding outbound pipeline in North America.'
  },
  {
    id: 'lead-2',
    name: 'Alex Rivera',
    company: 'CloudSync Technologies',
    role: 'Head of Business Development',
    phone: '+1 (555) 842-1920',
    channel: 'WHATSAPP',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    notes: 'Looking for a reliable high-volume WhatsApp outreach solution for 10 SDRs.'
  },
  {
    id: 'lead-3',
    name: 'Elena Rostova',
    company: 'Nexus Creative Studio',
    role: 'Founder & Managing Director',
    phone: '+44 7700 900142',
    channel: 'WHATSAPP',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    notes: 'Reaching out to enterprise retail clients with customized lookbooks.'
  },
  {
    id: 'lead-4',
    name: 'Marcus Vance',
    company: 'FinTech Flow',
    role: 'Director of Outbound Operations',
    phone: '+1 (555) 621-7788',
    channel: 'WHATSAPP',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    notes: 'Previously had two phone numbers banned using unofficial Python bots.'
  }
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onLaunchApp,
  isAuthenticated,
  onSignOut,
  userEmail
}) => {
  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Live Interactive Simulator State
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [simSentCount, setSimSentCount] = useState(128);
  const [simSkippedCount, setSimSkippedCount] = useState(14);
  const [simBlockedCount, setSimBlockedCount] = useState(3);
  const [lastActionFeedback, setLastActionFeedback] = useState<string | null>(null);
  const [activeTemplateType, setActiveTemplateType] = useState<'intro' | 'event' | 'roi'>('intro');

  // ROI Calculator State
  const [monthlyLeads, setMonthlyLeads] = useState<number>(2500);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const currentLead = DEMO_LEADS[currentLeadIndex % DEMO_LEADS.length];

  // Resolve template text dynamically
  const getSimTemplateBody = () => {
    if (activeTemplateType === 'intro') {
      return `Hey ${currentLead.name}, saw your expansion at ${currentLead.company}! We built a 0ms human-in-the-loop WhatsApp dispatch workflow that helped teams in ${currentLead.role.split(' ')[0]} 5x reply rates without ban risks. Would you be open to a 2-min preview?`;
    } else if (activeTemplateType === 'event') {
      return `Hi ${currentLead.name}! Hosting a private roundtable for ${currentLead.role} leaders at ${currentLead.company} this Thursday on outbound deliverability. Saved a VIP seat for you if interested!`;
    } else {
      return `Hi ${currentLead.name}, quick question: how is ${currentLead.company} protecting your WhatsApp outreach numbers from bans? We engineered ReachOutOS to guarantee 0% ban rates with 500 msgs/hr. Should I send the deck?`;
    }
  };

  // Keyboard shortcut listener for Simulator (<kbd>W</kbd>, <kbd>S</kbd>, <kbd>K</kbd>, <kbd>B</kbd>)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs or when auth modal is open
      if (
        showAuthModal || 
        ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      if (key === 'W') {
        e.preventDefault();
        handleSimSendWhatsApp();
      } else if (key === 'S') {
        e.preventDefault();
        handleSimMarkSent();
      } else if (key === 'K') {
        e.preventDefault();
        handleSimSkip();
      } else if (key === 'B') {
        e.preventDefault();
        handleSimBlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLeadIndex, showAuthModal]);

  const handleSimSendWhatsApp = () => {
    setSimSentCount(prev => prev + 1);
    setLastActionFeedback(`⚡ Dispatched WhatsApp to ${currentLead.name} (${currentLead.phone})!`);
    setCurrentLeadIndex(prev => (prev + 1) % DEMO_LEADS.length);
    setTimeout(() => setLastActionFeedback(null), 3000);
  };

  const handleSimMarkSent = () => {
    setSimSentCount(prev => prev + 1);
    setLastActionFeedback(`✓ Marked as Sent: ${currentLead.name}`);
    setCurrentLeadIndex(prev => (prev + 1) % DEMO_LEADS.length);
    setTimeout(() => setLastActionFeedback(null), 2500);
  };

  const handleSimSkip = () => {
    setSimSkippedCount(prev => prev + 1);
    setLastActionFeedback(`⏭ Skipped: ${currentLead.name}`);
    setCurrentLeadIndex(prev => (prev + 1) % DEMO_LEADS.length);
    setTimeout(() => setLastActionFeedback(null), 2500);
  };

  const handleSimBlock = () => {
    setSimBlockedCount(prev => prev + 1);
    setLastActionFeedback(`🛑 Suppressed & Blocked: ${currentLead.name} added to global blacklist`);
    setCurrentLeadIndex(prev => (prev + 1) % DEMO_LEADS.length);
    setTimeout(() => setLastActionFeedback(null), 2500);
  };

  // ROI computations
  const manualHoursPerMonth = Math.round((monthlyLeads * 3.5) / 60); // 3.5 mins per manual lead copy-paste
  const reachoutHoursPerMonth = Math.round((monthlyLeads * 0.15) / 60); // 8-10 seconds per lead with keyboard shortcuts
  const hoursSaved = manualHoursPerMonth - reachoutHoursPerMonth;
  const costSavingsDollars = Math.round(hoursSaved * 35); // $35/hr average SDR rate
  const projectedRepliesWhatsApp = Math.round(monthlyLeads * 0.54); // 54% WhatsApp reply rate
  const projectedRepliesEmail = Math.round(monthlyLeads * 0.12); // 12% Cold email reply rate

  const faqs = [
    {
      q: 'Why doesn\'t WhatsApp ban ReachOutOS users?',
      a: 'Automated headless bot scripts are detected because they emulate non-standard browser signatures and send hundreds of messages programmatically without human interaction. ReachOutOS uses official, native WhatsApp Web and Desktop sessions. Every dispatch is confirmed by a real human keystroke (0ms keyboard muscle memory), preserving 100% compliance with WhatsApp terms of service.'
    },
    {
      q: 'Do I need expensive WhatsApp Business Cloud API credits?',
      a: 'No! ReachOutOS operates with standard WhatsApp Web and WhatsApp Desktop accounts as well as WhatsApp Business. You do not need to pay per-template fees, wait for 48-hour template approvals, or deal with rigid Cloud API restrictions.'
    },
    {
      q: 'How fast can an operator dispatch messages?',
      a: 'Experienced operators using our split-second keyboard shortcuts (W for WhatsApp send, S for Sent, K for Skip, B for Block) routinely dispatch 400 to 600 highly personalized messages per hour without touching a mouse. That is over 10x faster than traditional manual copy-pasting.'
    },
    {
      q: 'Can multiple SDRs or operators work on the same campaign?',
      a: 'Yes. ReachOutOS is built on Supabase PostgreSQL with real-time Row Level Security and lock-free concurrency. Multiple operators can dispatch leads simultaneously without duplicating sends or colliding on the same contact.'
    },
    {
      q: 'How does ReachOutOS handle opt-outs and unsubscribes?',
      a: 'With a single tap of the B key, an operator can instantly add a contact to the global suppression list. Any future campaigns across your entire workspace will automatically skip and suppress that contact, protecting your brand reputation and compliance.'
    },
    {
      q: 'Is my prospect data secure?',
      a: 'All data is stored inside enterprise Supabase PostgreSQL protected by Row Level Security (RLS) and cryptographic isolation. Your data is never shared, used for AI training, or accessed by third parties.'
    }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-neutral-950">
      
      {/* Dynamic Background Glows & Subtle Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-emerald-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/3 -left-48 w-[600px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-2/3 -right-48 w-[600px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Sticky Top Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-neutral-950/80 border-b border-neutral-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Version Pill */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center font-black text-sm tracking-tighter text-emerald-400">
                RO
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">
                  ReachOut<span className="text-emerald-400">OS</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.4 PostgreSQL
                </span>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
            <a href="#simulator" className="hover:text-white transition">Live Simulator</a>
            <a href="#anti-ban" className="hover:text-white transition">Anti-Ban Matrix</a>
            <a href="#features" className="hover:text-white transition">Core Features</a>
            <a href="#calculator" className="hover:text-white transition">ROI Calculator</a>
            <a href="#architecture" className="hover:text-white transition">Architecture</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Zero-Ban Engine Active</span>
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onLaunchApp}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Enter Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="hidden sm:block px-3 py-2 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    Sign Out
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white transition cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Launch Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="relative z-10 flex-1">

        {/* HERO SECTION */}
        <section className="pt-16 pb-20 px-4 sm:px-6 max-w-7xl mx-auto text-center">
          
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6 animate-pulse-glow">
            <ShieldCheck className="w-4 h-4" />
            <span>100% Policy-Safe • Zero Ban Risk • 0ms Optimistic UI</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-[1.08] mb-6">
            The Outreach Operating System That{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Never Gets Banned.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-neutral-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Automated WhatsApp bots get banned in 48 hours. ReachOutOS gives growth teams 
            split-second human-in-the-loop keyboard dispatch (<kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-mono">W</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-mono">S</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-mono">K</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-mono">B</kbd>) 
            to dispatch 500+ personalized messages per hour with zero account risk.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => {
                if (isAuthenticated) onLaunchApp();
                else setShowAuthModal(true);
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold text-sm shadow-xl shadow-emerald-500/30 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-neutral-950" />
              <span>{isAuthenticated ? 'Open Outreach Workspace' : 'Launch Workspace Free'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#simulator"
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-emerald-400" />
              <span>Try Interactive Simulator</span>
            </a>
          </div>

          {/* Trust Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-neutral-800/80">
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-sm">
              <div className="text-3xl font-black text-emerald-400 tracking-tight">0.00%</div>
              <div className="text-xs text-neutral-400 mt-1 font-medium">WhatsApp Ban Rate</div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-sm">
              <div className="text-3xl font-black text-white tracking-tight">0 ms</div>
              <div className="text-xs text-neutral-400 mt-1 font-medium">Optimistic Queue Advance</div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-sm">
              <div className="text-3xl font-black text-cyan-400 tracking-tight">500+</div>
              <div className="text-xs text-neutral-400 mt-1 font-medium">Msgs / Hr per Operator</div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60 backdrop-blur-sm">
              <div className="text-3xl font-black text-indigo-400 tracking-tight">58%</div>
              <div className="text-xs text-neutral-400 mt-1 font-medium">Average Response Rate</div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE DISPATCH SIMULATOR SANDBOX */}
        <section id="simulator" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800 text-neutral-300 text-xs font-semibold mb-3 border border-neutral-700">
              <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live In-Browser Simulator</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Test-Drive the 0ms Dispatch Cockpit
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto mt-2">
              Press keys on your keyboard: <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs font-mono text-emerald-400 font-bold">W</kbd> to Send, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs font-mono text-blue-400 font-bold">S</kbd> to Mark Sent, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs font-mono text-amber-400 font-bold">K</kbd> to Skip, or <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-xs font-mono text-rose-400 font-bold">B</kbd> to Suppress. Feel the instant 0ms advance.
            </p>
          </div>

          {/* Interactive Sandbox Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-xl shadow-2xl p-5 sm:p-8 relative overflow-hidden">
            
            {/* Header / Telemetry Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-semibold">
                  Queue Active: Lead { (currentLeadIndex % DEMO_LEADS.length) + 1 } of {DEMO_LEADS.length}
                </span>
              </div>

              {/* Template Persona Selector */}
              <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
                <button
                  onClick={() => setActiveTemplateType('intro')}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${activeTemplateType === 'intro' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
                >
                  Cold Intro
                </button>
                <button
                  onClick={() => setActiveTemplateType('event')}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${activeTemplateType === 'event' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
                >
                  VIP Event
                </button>
                <button
                  onClick={() => setActiveTemplateType('roi')}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${activeTemplateType === 'roi' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
                >
                  Anti-Ban Pitch
                </button>
              </div>

              {/* Live Ticker Stats */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sent: {simSentCount}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  <span>Skipped: {simSkippedCount}</span>
                </div>
                <div className="flex items-center gap-1 text-rose-400">
                  <span>Suppressed: {simBlockedCount}</span>
                </div>
              </div>
            </div>

            {/* Action Feedback Banner */}
            {lastActionFeedback && (
              <div className="my-4 py-2 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between animate-fadeIn">
                <span>{lastActionFeedback}</span>
                <span className="text-[10px] text-emerald-400/80">0ms optimistic sync</span>
              </div>
            )}

            {/* Main Prospect & Message Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
              
              {/* Prospect Intelligence Card (Left) */}
              <div className="lg:col-span-5 bg-neutral-950/70 rounded-xl p-5 border border-neutral-800/80 space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={currentLead.avatar}
                    alt={currentLead.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      {currentLead.name}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {currentLead.channel}
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-400">{currentLead.role}</p>
                    <p className="text-xs font-semibold text-emerald-400">{currentLead.company}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-neutral-900 text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Direct Phone:</span>
                    <span className="font-mono text-neutral-200">{currentLead.phone}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Account Ban Risk:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> 0.00% (Human Session)
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-300">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase block mb-1">CRM Context Notes:</span>
                  {currentLead.notes}
                </div>
              </div>

              {/* Dynamic Interpolated Message Box (Right) */}
              <div className="lg:col-span-7 bg-neutral-950/70 rounded-xl p-5 border border-neutral-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Dynamic Liquid Message Preview
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Personalized 1:1
                    </span>
                  </div>
                  <div className="p-4 rounded-lg bg-neutral-900 text-neutral-100 text-sm leading-relaxed border border-neutral-800 font-sans whitespace-pre-wrap">
                    {getSimTemplateBody()}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-900 flex items-center justify-between text-xs text-neutral-500">
                  <span>Characters: {getSimTemplateBody().length}</span>
                  <span>Variables: <code className="text-emerald-400 font-mono">First_Name</code>, <code className="text-cyan-400 font-mono">Company</code>, <code className="text-indigo-400 font-mono">Role</code></span>
                </div>
              </div>
            </div>

            {/* Tactical Keyboard Dispatch Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              
              {/* WhatsApp Send (W) */}
              <button
                onClick={handleSimSendWhatsApp}
                className="group relative p-3 sm:p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
              >
                <kbd className="px-2 py-1 rounded bg-emerald-800 text-emerald-100 border border-emerald-400 text-xs font-mono font-black group-hover:scale-110 transition">
                  W
                </kbd>
                <div className="text-center sm:text-left">
                  <div className="leading-tight">Send WhatsApp</div>
                  <div className="text-[10px] text-emerald-200 font-normal">Official session</div>
                </div>
              </button>

              {/* Mark Sent (S) */}
              <button
                onClick={handleSimMarkSent}
                className="group relative p-3 sm:p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-2 border border-neutral-700 transition-all cursor-pointer active:scale-95"
              >
                <kbd className="px-2 py-1 rounded bg-neutral-900 text-neutral-300 border border-neutral-600 text-xs font-mono font-black group-hover:scale-110 transition">
                  S
                </kbd>
                <div className="text-center sm:text-left">
                  <div className="leading-tight">Mark As Sent</div>
                  <div className="text-[10px] text-neutral-400 font-normal">Advance queue</div>
                </div>
              </button>

              {/* Skip (K) */}
              <button
                onClick={handleSimSkip}
                className="group relative p-3 sm:p-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-300 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-2 border border-neutral-800 hover:border-amber-500/40 transition-all cursor-pointer active:scale-95"
              >
                <kbd className="px-2 py-1 rounded bg-neutral-950 text-amber-400 border border-neutral-700 text-xs font-mono font-black group-hover:scale-110 transition">
                  K
                </kbd>
                <div className="text-center sm:text-left">
                  <div className="leading-tight">Skip Contact</div>
                  <div className="text-[10px] text-neutral-400 font-normal">Review later</div>
                </div>
              </button>

              {/* Block / Suppress (B) */}
              <button
                onClick={handleSimBlock}
                className="group relative p-3 sm:p-4 rounded-xl bg-neutral-900 hover:bg-rose-950/40 text-rose-300 font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-2 border border-neutral-800 hover:border-rose-500/40 transition-all cursor-pointer active:scale-95"
              >
                <kbd className="px-2 py-1 rounded bg-neutral-950 text-rose-400 border border-neutral-700 text-xs font-mono font-black group-hover:scale-110 transition">
                  B
                </kbd>
                <div className="text-center sm:text-left">
                  <div className="leading-tight">Suppress Contact</div>
                  <div className="text-[10px] text-neutral-400 font-normal">Global opt-out</div>
                </div>
              </button>
            </div>

            <div className="mt-4 text-center text-xs text-neutral-500 font-mono">
              💡 Tip: Click inside this window and use your keyboard keys directly for instantaneous 0ms muscle memory.
            </div>
          </div>
        </section>

        {/* WHY REACHOUTOS: ANTI-BAN COMPARISON MATRIX */}
        <section id="anti-ban" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-800/80">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>The Anti-Ban Matrix</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Why Unofficial Automation Bots Always Get Banned
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto mt-2">
              WhatsApp employs advanced behavioral telemetry and pattern matching. Here is how ReachOutOS's Human-In-The-Loop architecture keeps you permanently safe.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/60 text-xs uppercase font-mono">
                  <th className="p-4 sm:p-5 text-neutral-400 font-semibold">Capability</th>
                  <th className="p-4 sm:p-5 text-rose-400 font-semibold bg-rose-950/10">Traditional Automated Bots</th>
                  <th className="p-4 sm:p-5 text-emerald-400 font-bold bg-emerald-950/20">ReachOutOS Human-In-The-Loop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-xs sm:text-sm">
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-neutral-200">Account Ban Probability</td>
                  <td className="p-4 sm:p-5 text-rose-400 bg-rose-950/10 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>95% banned within 48–72 hours</span>
                  </td>
                  <td className="p-4 sm:p-5 text-emerald-400 bg-emerald-950/20 font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>0.00% Ban Rate — 100% Policy-Safe</span>
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-neutral-200">WhatsApp Protocol</td>
                  <td className="p-4 sm:p-5 text-neutral-400 bg-rose-950/10">
                    Reverse-engineered headless Chromium scripts (instantly flagged by Meta telemetry)
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-200 bg-emerald-950/20 font-medium">
                    Official WhatsApp Web & Desktop sessions with native human click confirmation
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-neutral-200">Dispatch Speed</td>
                  <td className="p-4 sm:p-5 text-neutral-400 bg-rose-950/10">
                    High burst speed followed by immediate account suspension
                  </td>
                  <td className="p-4 sm:p-5 text-emerald-400 bg-emerald-950/20 font-semibold">
                    Sustained 500+ personalized messages/hour via keyboard muscle memory (<kbd>W</kbd>, <kbd>S</kbd>)
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-neutral-200">Personalization Nuance</td>
                  <td className="p-4 sm:p-5 text-neutral-400 bg-rose-950/10">
                    Rigid template strings; breaks and sends blank fields on missing data
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-200 bg-emerald-950/20">
                    Dynamic liquid variables with smart fallback handling and split-second preview
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-neutral-200">Opt-Out & Suppression</td>
                  <td className="p-4 sm:p-5 text-neutral-400 bg-rose-950/10">
                    Ignores STOP replies; triggers repeated spam reports and domain blacklisting
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-200 bg-emerald-950/20">
                    One-key instantaneous suppression (<kbd>B</kbd>) updates global blacklist across all team members
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-neutral-200">Database & Security</td>
                  <td className="p-4 sm:p-5 text-neutral-400 bg-rose-950/10">
                    Plaintext CSVs, shared credentials on untrusted servers
                  </td>
                  <td className="p-4 sm:p-5 text-neutral-200 bg-emerald-950/20 font-semibold">
                    Enterprise Supabase PostgreSQL with strict Row Level Security (RLS) & immutable audit trail
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 6 CORE ARCHITECTURE PILLARS */}
        <section id="features" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full-Stack Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Engineered for Enterprise Growth Velocity
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto mt-2">
              Every feature in ReachOutOS is fine-tuned for high throughput, data hygiene, and zero operational downtime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-emerald-500/40 transition-all group backdrop-blur-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">0ms Optimistic UI Engine</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Advance through thousands of recipients in split seconds. All actions are optimistically processed in browser memory on Frame 1, while PostgreSQL database mutations persist in non-blocking background workers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/40 transition-all group backdrop-blur-sm">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Keyboard className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Keyboard Muscle Memory</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Never reach for your mouse. Execute your entire outreach pipeline with dedicated ergonomic keys (<kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">W</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">S</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">K</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px]">B</kbd>), hitting 500+ messages per hour effortlessly.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-indigo-500/40 transition-all group backdrop-blur-sm">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Liquid Variable Templating</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Personalize effortlessly with liquid dynamic variables (<code className="text-indigo-400 font-mono">{`{{First_Name}}`}</code>, <code className="text-indigo-400 font-mono">{`{{Company_Name}}`}</code>). Includes fallback logic to avoid embarrassing blank spaces in real dispatches.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 transition-all group backdrop-blur-sm">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Bulletproof CSV Ingestion</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Ingest 100,000+ lead spreadsheets in seconds. ReachOutOS automatically normalizes international phone numbers (E.164), dedupes duplicate entries, and verifies data quality before creating campaigns.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-rose-500/40 transition-all group backdrop-blur-sm">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Emergency Kill Switch</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Halt all outbound activity across your entire enterprise with one click. If an unintended template error is discovered, the kill switch instantly locks the queue across all operators.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-purple-500/40 transition-all group backdrop-blur-sm">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Enterprise Supabase PostgreSQL</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                100% strict multi-tenant database architecture with Row-Level Security (RLS). Every dispatch, suppression, skip, and export is recorded in an immutable, cryptographically verifiable audit log.
              </p>
            </div>
          </div>
        </section>

        {/* INTERACTIVE ROI & VELOCITY CALCULATOR */}
        <section id="calculator" className="py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-neutral-800/80">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold mb-3">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Interactive ROI Calculator</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              See How Much Time & Money You Save
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto mt-2">
              Move the slider to calculate the hours saved and replies gained by switching from manual copy-paste to ReachOutOS.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 sm:p-10 backdrop-blur-xl">
            {/* Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-neutral-300">
                  Monthly Leads Reached:
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {monthlyLeads.toLocaleString()} leads
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="15000"
                step="250"
                value={monthlyLeads}
                onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1">
                <span>500</span>
                <span>5,000</span>
                <span>10,000</span>
                <span>15,000</span>
              </div>
            </div>

            {/* Calculations Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-neutral-800">
              
              <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800">
                <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Time Saved Per Month</span>
                </div>
                <div className="text-3xl font-extrabold text-white">
                  {hoursSaved} hrs
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  From {manualHoursPerMonth} hrs manual to {reachoutHoursPerMonth} hrs in ReachOutOS
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800">
                <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Estimated Dollar Savings</span>
                </div>
                <div className="text-3xl font-extrabold text-emerald-400 font-mono">
                  ${costSavingsDollars.toLocaleString()}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Based on standard $35/hr SDR labor costs
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800">
                <div className="text-xs text-neutral-400 mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Projected Replies (54%)</span>
                </div>
                <div className="text-3xl font-extrabold text-cyan-400 font-mono">
                  ~{projectedRepliesWhatsApp.toLocaleString()}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Vs. only ~{projectedRepliesEmail.toLocaleString()} from cold email (12%)
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
              <button
                onClick={() => {
                  if (isAuthenticated) onLaunchApp();
                  else setShowAuthModal(true);
                }}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                Scale Your Outreach With ReachOutOS →
              </button>
            </div>
          </div>
        </section>

        {/* 4-STEP VELOCITY WORKFLOW */}
        <section id="architecture" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-800/80">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold mb-3">
              <Laptop className="w-3.5 h-3.5" />
              <span>Simple 4-Step Velocity</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              From Raw Spreadsheet to 500 Sent in 20 Minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                  STEP 01
                </span>
                <h3 className="text-base font-bold text-white mt-4 mb-2">Ingest & Auto-Map</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Drop your CSV file. ReachOutOS automatically maps names, phone numbers, and company attributes with international phone sanitization.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-900 text-[11px] font-mono text-neutral-500">
                Auto-Deduplication
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20">
                  STEP 02
                </span>
                <h3 className="text-base font-bold text-white mt-4 mb-2">Compose Template</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Draft liquid message templates with personalized variables and smart fallbacks. AI Copilot optimizes tone and hooks.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-900 text-[11px] font-mono text-neutral-500">
                Liquid Syntax Preview
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-400 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                  STEP 03
                </span>
                <h3 className="text-base font-bold text-white mt-4 mb-2">Tactile Dispatch</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Hit <kbd className="px-1 bg-neutral-800 rounded font-mono text-white">W</kbd> and <kbd className="px-1 bg-neutral-800 rounded font-mono text-white">S</kbd> in rapid sequence. Every contact loads instantly with zero UI latency and zero risk of automated bans.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-900 text-[11px] font-mono text-neutral-500">
                500+ Msgs / Hour
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-purple-400 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                  STEP 04
                </span>
                <h3 className="text-base font-bold text-white mt-4 mb-2">Track & Convert</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Monitor conversions in real-time. View recipient timeline audits, follow-up queues, and team activity logs directly in PostgreSQL.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-900 text-[11px] font-mono text-neutral-500">
                Real-Time Telemetry
              </div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF TESTIMONIALS */}
        <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-800/80">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Trusted by Top Outbound & Growth Operators
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 flex flex-col justify-between">
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed italic mb-6">
                "We had three WhatsApp business accounts permanently blocked by Meta while using Python selenium bots. ReachOutOS completely saved our outreach. We dispatch 1,200 leads a day with zero ban warnings."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                  DJ
                </div>
                <div>
                  <div className="text-xs font-bold text-white">David J.</div>
                  <div className="text-[11px] text-neutral-500">Head of Outbound, FinScale</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 flex flex-col justify-between">
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed italic mb-6">
                "The keyboard shortcuts (W, S, K, B) are an absolute game changer. Our SDRs went from 40 manual WhatsApps an hour to over 450 per hour. The 0ms optimistic UI feels faster than native desktop apps."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                  ML
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Maya Lindqvist</div>
                  <div className="text-[11px] text-neutral-500">Director of Sales Ops, RevLaunch</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 flex flex-col justify-between">
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed italic mb-6">
                "Having strict Supabase PostgreSQL Row Level Security plus the instant suppression button means we never violate GDPR or WhatsApp anti-spam policies. It gives our legal team complete peace of mind."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-xs">
                  AK
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Arun K.</div>
                  <div className="text-[11px] text-neutral-500">Founder & CEO, GrowthEngineers</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ ACCORDION */}
        <section id="faq" className="py-20 px-4 sm:px-6 max-w-4xl mx-auto border-t border-neutral-800/80">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-neutral-400 mt-2">
              Everything you need to know about compliance, deliverability, and keyboard velocity.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div 
                key={idx}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden transition"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-sm font-bold text-neutral-100 hover:text-white transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {openFaqIndex === idx ? (
                    <ChevronDown className="w-4 h-4 text-emerald-400 shrink-0 transform rotate-180 transition-transform" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0 transition-transform" />
                  )}
                </button>
                {openFaqIndex === idx && (
                  <div className="px-4 pb-5 sm:px-5 sm:pb-5 text-xs sm:text-sm text-neutral-400 leading-relaxed border-t border-neutral-800/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM HIGH-CONVERSION CTA BANNER */}
        <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-tr from-emerald-950/80 via-neutral-900 to-neutral-950 border border-emerald-500/30 p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
            
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
              Stop Burning Phone Numbers.{' '}
              <span className="text-emerald-400">Start Closing Deals.</span>
            </h2>
            <p className="text-sm sm:text-base text-neutral-300 max-w-2xl mx-auto mb-8 leading-relaxed">
              Equip your SDRs with the ultimate high-velocity, human-in-the-loop outreach cockpit. Zero ban risk, 0ms latency, and full enterprise compliance.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  if (isAuthenticated) onLaunchApp();
                  else setShowAuthModal(true);
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold text-sm shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-neutral-950" />
                <span>{isAuthenticated ? 'Enter Workspace' : 'Launch Workspace Free'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#simulator"
                className="w-full sm:w-auto px-6 py-4 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white font-semibold text-sm transition flex items-center justify-center gap-2"
              >
                <span>Play With Simulator</span>
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950/90 py-10 px-4 sm:px-6 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-neutral-950 font-black text-xs flex items-center justify-center">
              RO
            </div>
            <div>
              <div className="font-bold text-white text-sm">ReachOut OS</div>
              <div className="text-[11px] text-neutral-500">Secure Human-In-The-Loop Outreach & Contact Intelligence</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-neutral-400 font-mono">PostgreSQL Cloud: Operational</span>
            </div>
            <span>•</span>
            <button
              onClick={() => {
                if (isAuthenticated) onLaunchApp();
                else setShowAuthModal(true);
              }}
              className="text-neutral-400 hover:text-white transition cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-6 pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between text-[11px] gap-2">
          <div>
            © {new Date().getFullYear()} ReachOut OS. All rights reserved. Compliant with WhatsApp terms of service.
          </div>
          <div className="font-mono text-neutral-600">
            End-To-End Encrypted • Row-Level Security Enabled
          </div>
        </div>
      </footer>

      {/* MODAL: Supabase Auth Modal (Email/Password & Google OAuth) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md">
            {/* Close button */}
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Embedded Login View */}
            <LoginView
              onSuccess={() => {
                setShowAuthModal(false);
                onLaunchApp();
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};
