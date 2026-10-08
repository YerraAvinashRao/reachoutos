import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { ContactsView } from './components/ContactsView';
import { ContactDrawer } from './components/ContactDrawer';
import { ImportWizardView } from './components/ImportWizardView';
import { ListsView } from './components/ListsView';
import { TemplatesView } from './components/TemplatesView';
import { CampaignsView } from './components/CampaignsView';
import { CampaignDetailView } from './components/CampaignDetailView';
import { ManualSendingWorkspace } from './components/ManualSendingWorkspace';
import { AICopilotView } from './components/AICopilotView';
import { AuditLogView } from './components/AuditLogView';
import { SettingsView } from './components/SettingsView';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { TourEngine } from './components/tour/TourEngine';
import { LoginView } from './components/LoginView';
import { SetPasswordView } from './components/SetPasswordView';
import { apiClient } from './services/apiClient';
import { supabase } from './services/supabaseClient';
import { Tenant, User, Contact, Campaign, MessageTemplate, ContactList, AuditLogEntry, TimelineEvent } from './types';
import { Database, ShieldAlert, ExternalLink, Terminal, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { ReachOut3DLoader } from './components/common/ReachOut3DLoader';
import { LandingPageView } from './components/LandingPageView';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Public Landing Page view state:
  // When ReachOut is opened, the stunning landing page opens by default!
  // It only bypasses to workspace if the URL explicitly targets #app or ?app=true or /app.
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return true;
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const pathname = window.location.pathname;

      if (hash === '#app' || params.get('app') === 'true' || params.get('view') === 'app' || pathname === '/app') {
        return false;
      }
      return true; // Default to opening landing page on root entry
    } catch {
      return true;
    }
  });

  // Sync Landing Page toggle with browser URL navigation and hash changes
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const pathname = window.location.pathname;

      if (hash === '#app' || params.get('app') === 'true' || params.get('view') === 'app' || pathname === '/app') {
        setShowLandingPage(false);
      } else if (hash === '#landing' || params.get('landing') === 'true' || (!hash && pathname === '/')) {
        setShowLandingPage(true);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Supabase Database & Auth State
  const [isDatabaseConfigured, setIsDatabaseConfigured] = useState<boolean>(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false;
      return Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    } catch {
      return false;
    }
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState<boolean>(false);
  const [pendingAuthUser, setPendingAuthUser] = useState<any>(null);

  // Instant SWR Cache Helper: allows 0ms instantaneous UI render on reload
  const [cachedWorkspace] = useState(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('reachout_workspace_cache');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Core PostgreSQL Data (Hydrated instantly from cache for instant first paint)
  const [tenant, setTenant] = useState<Tenant | null>(() => cachedWorkspace?.tenant || null);
  const [user, setUser] = useState<User | null>(() => cachedWorkspace?.user || null);
  const [contacts, setContacts] = useState<Contact[]>(() => cachedWorkspace?.contacts || []);
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => cachedWorkspace?.campaigns || []);
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => cachedWorkspace?.templates || []);
  const [lists, setLists] = useState<ContactList[]>(() => cachedWorkspace?.lists || []);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => cachedWorkspace?.auditLogs || []);
  const [stats, setStats] = useState<any>(() => cachedWorkspace?.stats || null);

  // Focus and detail states
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactTimeline, setSelectedContactTimeline] = useState<TimelineEvent[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isSendingWorkspaceOpen, setIsSendingWorkspaceOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [tourCompleted, setTourCompleted] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('reachout_tour_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [aiTemplateSeed, setAiTemplateSeed] = useState<string>('');

  // Fetch all initial data from Supabase via single aggregated bootstrap request
  const loadData = useCallback(async () => {
    try {
      // Check real Supabase Auth session directly from official Supabase client
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        setNeedsPasswordSetup(false);
        setPendingAuthUser(null);
        setAuthLoading(false);
        return;
      }

      setIsAuthenticated(true);
      setSchemaError(null);

      // Check if user is a Google OAuth user without an account password configured
      const authUser = session.user;
      const isGoogleUser = 
        authUser.app_metadata?.provider === 'google' ||
        authUser.app_metadata?.providers?.includes('google') ||
        authUser.identities?.some((i: any) => i.provider === 'google');
      const hasPasswordSet = Boolean(authUser.user_metadata?.has_password_set);

      if (isGoogleUser && !hasPasswordSet) {
        setNeedsPasswordSetup(true);
        setPendingAuthUser(authUser);
        setAuthLoading(false);
        return;
      }
      setNeedsPasswordSetup(false);

      // Use single aggregated bootstrap endpoint to load workspace state
      try {
        const bootstrap = await apiClient.getWorkspaceBootstrap();
        if (bootstrap) {
          if (bootstrap.tenant) setTenant(bootstrap.tenant);
          if (bootstrap.user) setUser(bootstrap.user);
          if (bootstrap.contacts) setContacts(bootstrap.contacts);
          if (bootstrap.campaigns) setCampaigns(bootstrap.campaigns);
          if (bootstrap.templates) setTemplates(bootstrap.templates);
          if (bootstrap.lists) setLists(bootstrap.lists);
          if (bootstrap.stats) setStats(bootstrap.stats);
          if (bootstrap.auditLogs) setAuditLogs(bootstrap.auditLogs);
          setSchemaError(null);
          setIsDatabaseConfigured(true);
          setDatabaseError(null);

          // Save fresh snapshot to instant cache
          try {
            localStorage.setItem('reachout_workspace_cache', JSON.stringify({
              contacts: bootstrap.contacts,
              campaigns: bootstrap.campaigns,
              templates: bootstrap.templates,
              lists: bootstrap.lists,
              auditLogs: bootstrap.auditLogs,
              stats: bootstrap.stats,
              tenant: bootstrap.tenant,
              user: bootstrap.user,
              timestamp: Date.now()
            }));
          } catch (_) {}
        }
      } catch (bootErr: any) {
        if (bootErr?.code === 'PGRST205' || bootErr?.message?.includes('schema cache')) {
          setSchemaError("Database tables not found in Supabase. Please apply the schema migrations (001_initial_schema.sql and 002_rls_policies.sql) in your Supabase SQL Editor.");
        } else if (bootErr?.code === 'NO_TENANT_MEMBERSHIP') {
          setSchemaError("User authenticated successfully, but no active workspace tenant membership was found in the database.");
        } else {
          throw bootErr;
        }
      }
    } catch (err: any) {
      if (err?.code === 'RATE_LIMITED' || err?.status === 429 || (err?.message && err.message.includes('Rate exceeded'))) {
        setRateLimitNotice('Upstream rate limit reached. Auto-retrying in a few moments...');
        setTimeout(() => loadData(), 3000);
      } else if (err?.code === 'DATABASE_UNCONFIGURED' || err?.status === 503) {
        setIsDatabaseConfigured(false);
        setDatabaseError(err.message || 'Supabase PostgreSQL database is not configured.');
      } else if (err?.code === 'MISSING_AUTHENTICATION_TOKEN' || err?.code === 'INVALID_OR_EXPIRED_TOKEN' || err?.status === 401) {
        setIsAuthenticated(false);
      } else {
        console.warn('Notice loading workspace data:', err?.message || err);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial auth check & session restoration on page load/refresh
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        const authUser = session.user;
        const isGoogleUser = 
          authUser.app_metadata?.provider === 'google' ||
          authUser.app_metadata?.providers?.includes('google') ||
          authUser.identities?.some((i: any) => i.provider === 'google');
        const hasPasswordSet = Boolean(authUser.user_metadata?.has_password_set);

        if (isGoogleUser && !hasPasswordSet) {
          setNeedsPasswordSetup(true);
          setPendingAuthUser(authUser);
          setAuthLoading(false);
        } else {
          setNeedsPasswordSetup(false);
          loadData();
        }
      } else {
        setIsAuthenticated(false);
        setAuthLoading(false);
      }
    });

    // 2. Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session) {
          setIsAuthenticated(true);
          const authUser = session.user;
          const isGoogleUser = 
            authUser.app_metadata?.provider === 'google' ||
            authUser.app_metadata?.providers?.includes('google') ||
            authUser.identities?.some((i: any) => i.provider === 'google');
          const hasPasswordSet = Boolean(authUser.user_metadata?.has_password_set);

          if (isGoogleUser && !hasPasswordSet) {
            setNeedsPasswordSetup(true);
            setPendingAuthUser(authUser);
            setAuthLoading(false);
          } else {
            setNeedsPasswordSetup(false);
            loadData();
          }
        }
      } else if (event === 'SIGNED_OUT') {
        try { localStorage.removeItem('reachout_workspace_cache'); } catch (_) {}
        setIsAuthenticated(false);
        setNeedsPasswordSetup(false);
        setPendingAuthUser(null);
        setUser(null);
        setTenant(null);
        setContacts([]);
        setCampaigns([]);
        setTemplates([]);
        setLists([]);
        setStats(null);
        setSchemaError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadData]);

  // Global key listener for '?'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setShortcutsModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    try {
      const detail = await apiClient.getContact(contact.id);
      if (detail?.timeline) {
        setSelectedContactTimeline(detail.timeline);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBlock = async (contactId: string, reason?: string) => {
    const isCurrentlyBlocked = Boolean(contacts.find(c => c.id === contactId)?.isGloballyBlocked);
    const nextBlocked = !isCurrentlyBlocked;
    // 0ms Optimistic UI updates across contacts, campaign recipients, and selected contact
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isGloballyBlocked: nextBlocked } : c));
    setCampaignRecipients(prev => {
      const next = prev.map(r => r.contactId === contactId ? {
        ...r,
        status: (nextBlocked ? 'BLOCKED' : 'READY') as any,
        policyNotes: nextBlocked ? (reason || 'Globally suppressed') : undefined
      } : r);
      if (selectedCampaignId) recipientsCacheRef.current[selectedCampaignId] = next;
      return next;
    });
    setCampaigns(prev => prev.map(c => c.id === selectedCampaignId ? {
      ...c,
      blockedCount: Math.max(0, (c.blockedCount || 0) + (nextBlocked ? 1 : -1))
    } : c));
    if (selectedContact && selectedContact.id === contactId) {
      setSelectedContact(prev => prev ? { ...prev, isGloballyBlocked: nextBlocked } : null);
    }
    try {
      await apiClient.toggleContactBlock(contactId, reason);
    } catch (err) {
      console.error('Toggle block error, reverting:', err);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isGloballyBlocked: isCurrentlyBlocked } : c));
      setCampaignRecipients(prev => {
        const next = prev.map(r => r.contactId === contactId ? {
          ...r,
          status: (isCurrentlyBlocked ? 'BLOCKED' : 'READY') as any
        } : r);
        if (selectedCampaignId) recipientsCacheRef.current[selectedCampaignId] = next;
        return next;
      });
      if (selectedContact && selectedContact.id === contactId) {
        setSelectedContact(prev => prev ? { ...prev, isGloballyBlocked: isCurrentlyBlocked } : null);
      }
    }
  };

  const handleAddNote = async (contactId: string, note: string) => {
    const timestamp = new Date().toLocaleDateString();
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, notes: `${c.notes ? `${c.notes}\n\n` : ''}[${timestamp}] ${note}` } : c));
    if (selectedContact && selectedContact.id === contactId) {
      setSelectedContact(prev => prev ? { ...prev, notes: `${prev.notes ? `${prev.notes}\n\n` : ''}[${timestamp}] ${note}` } : null);
    }
    try {
      await apiClient.addContactNote(contactId, note);
    } catch (err) {
      console.error('Add note error:', err);
    }
  };

  const handleToggleKillSwitch = async (reason?: string) => {
    if (!tenant) return;
    await apiClient.toggleKillSwitch(!tenant.isKillSwitchActive, reason);
    await loadData();
  };

  const handleSignOut = async () => {
    try { localStorage.removeItem('reachout_workspace_cache'); } catch (_) {}
    await apiClient.logout();
    setIsAuthenticated(false);
    setShowLandingPage(true);
    setUser(null);
    setTenant(null);
    setContacts([]);
    setCampaigns([]);
    setTemplates([]);
    setLists([]);
    setStats(null);
    setSchemaError(null);
  };

  const handleExportContacts = () => {
    if (contacts.length === 0) return;
    const headers = ['ID', 'Name', 'Company', 'Phone', 'Email', 'City', 'State', 'Status', 'Tags', 'Marketing Allowed (WhatsApp)'];
    const rows = contacts.map(c => [
      c.id,
      `"${c.displayName.replace(/"/g, '""')}"`,
      `"${c.companyName.replace(/"/g, '""')}"`,
      c.phone,
      c.email,
      c.city,
      c.state,
      c.status,
      `"${c.tags.join(', ')}"`,
      c.preferences.WHATSAPP?.marketingAllowed ? 'YES' : 'NO'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reachout_os_contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const [campaignRecipients, setCampaignRecipients] = useState<any[]>([]);
  const recipientsCacheRef = useRef<Record<string, any[]>>({});

  useEffect(() => {
    if (selectedCampaignId) {
      const camp = campaigns.find(c => c.id === selectedCampaignId);
      if (camp) {
        // 1. Check in-memory recipient cache for 0ms instant display
        const cached = recipientsCacheRef.current[selectedCampaignId];
        if (cached && cached.length > 0) {
          setCampaignRecipients(cached);
        } else {
          // 2. Synthesize instantly from list contacts so the view is never empty on Frame 1 (0ms)
          const list = lists.find(l => l.id === camp.targetListId);
          const targetContacts = contacts.filter(c => list?.contactIds?.includes(c.id));
          if (targetContacts.length > 0) {
            const initialRecipients = targetContacts.map(c => ({
              id: `rec-${c.id}`,
              campaignId: camp.id,
              contactId: c.id,
              contactName: c.displayName,
              companyName: c.companyName,
              channel: camp.channel,
              channelAddress: camp.channel === 'WHATSAPP' ? c.phone : c.email,
              resolvedMessage: camp.templateSnapshot?.body || '',
              status: 'READY' as const,
              createdAt: new Date().toISOString()
            }));
            recipientsCacheRef.current[selectedCampaignId] = initialRecipients;
            setCampaignRecipients(initialRecipients);
          }
        }

        // 3. Fetch authoritative database records in background and reconcile
        if (!selectedCampaignId.startsWith('temp-')) {
          apiClient.getCampaign(selectedCampaignId).then(res => {
            if (res?.recipients) {
              recipientsCacheRef.current[selectedCampaignId] = res.recipients;
              setCampaignRecipients(res.recipients);
            }
          }).catch(console.warn);
        }
      }
    } else {
      setCampaignRecipients([]);
    }
  }, [selectedCampaignId, campaigns, lists, contacts]);

  // Render stunning public landing page if active
  if (showLandingPage) {
    return (
      <div className={darkMode ? 'dark font-sans' : 'font-sans'}>
        <LandingPageView
          onLaunchApp={() => {
            setShowLandingPage(false);
            try {
              window.history.pushState(null, '', '#app');
            } catch (_) {}
            if (!isAuthenticated) {
              loadData();
            }
          }}
          isAuthenticated={isAuthenticated}
          onSignOut={handleSignOut}
          userEmail={user?.email}
        />
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark font-sans' : 'font-sans'}>
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-neutral-900">
        {/* Top Navbar */}
        <Navbar
          tenant={tenant}
          user={user}
          isDatabaseConfigured={isDatabaseConfigured}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onOpenShortcuts={() => setShortcutsModalOpen(true)}
          onOpenGuide={() => setGuideModalOpen(true)}
          onToggleKillSwitch={() => handleToggleKillSwitch('Toggled via top navigation bar')}
          onSignOut={handleSignOut}
          onOpenLanding={() => {
            setShowLandingPage(true);
            try {
              window.history.pushState(null, '', '#landing');
            } catch (_) {}
          }}
        />

        {/* Upstream Proxy Rate-Limit Notice */}
        {rateLimitNotice && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{rateLimitNotice}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 font-medium transition cursor-pointer"
            >
              Retry Now
            </button>
          </div>
        )}

        {/* Fullscreen 3D Realistic Animated Loader on initial uncached authentication sync */}
        {authLoading && !cachedWorkspace && isAuthenticated && (
          <ReachOut3DLoader
            variant="fullscreen"
            title="ReachOut OS"
            subtitle="Synchronizing Governed Outreach Ledger"
            steps={[
              "Connecting to Supabase PostgreSQL Database...",
              "Verifying Encrypted Tenant Auth Session...",
              "Calibrating Omni-Channel Audience Ledger...",
              "Rendering Autonomous ReachOut Canvas..."
            ]}
          />
        )}

        {/* 1. Supabase Database Unconfigured Gate (Rule 12 & Rule 23: Fail Safely, Zero Fake Fallback) */}
        {!isDatabaseConfigured ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Authoritative Database Configuration Required
                  </h1>
                  <p className="text-sm text-neutral-500">
                    Supabase PostgreSQL is the required source of truth. Local JSON and mock data fallbacks have been permanently removed.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-sm space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Production Database Invariant Enforced</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {databaseError || 'The application detected that Supabase credentials (SUPABASE_URL and SUPABASE_ANON_KEY) are not set. The application will not proceed with fake or local storage.'}
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-neutral-500" />
                  <span>Required Environment Configuration:</span>
                </div>
                <div className="bg-neutral-950 text-neutral-200 p-4 rounded-xl font-mono space-y-1.5 overflow-x-auto">
                  <div className="text-neutral-500"># Required in .env:</div>
                  <div><span className="text-emerald-400">SUPABASE_URL</span></div>
                  <div><span className="text-emerald-400">SUPABASE_ANON_KEY</span></div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Schema & RLS Migrations Ready:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                    📄 database/migrations/001_initial_schema.sql
                  </div>
                  <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                    🛡️ database/migrations/002_rls_policies.sql
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs rounded-lg hover:opacity-90 transition"
                >
                  Retry Connection
                </button>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 transition"
                >
                  <span>Open Supabase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ) : !isAuthenticated ? (
          /* 2. Supabase Authentication Gate (Real Supabase Auth Email/Password & Google OAuth) */
          <LoginView onSuccess={loadData} />
        ) : needsPasswordSetup && pendingAuthUser ? (
          /* 2.5 Google OAuth Password Creation & Profile Link Gate */
          <SetPasswordView
            initialFullName={
              pendingAuthUser.user_metadata?.full_name ||
              pendingAuthUser.user_metadata?.name ||
              ''
            }
            userEmail={pendingAuthUser.email || ''}
            onSuccess={(_updatedName) => {
              setNeedsPasswordSetup(false);
              loadData();
            }}
          />
        ) : schemaError ? (
          /* 3. Schema Setup / Migration Required View */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-xl space-y-6">
              <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-5">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    PostgreSQL Schema Setup Required
                  </h1>
                  <p className="text-sm text-neutral-500">
                    Supabase Auth is connected. Execute database migrations in your Supabase project to instantiate tables and RLS policies.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-300 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{schemaError}</span>
                </div>
                <p className="leading-relaxed opacity-90">
                  Open your Supabase Project Dashboard → SQL Editor, and execute the SQL migration scripts located in database/migrations/:
                </p>
                <div className="font-mono text-[11px] pt-1 space-y-1">
                  <div>1. database/migrations/001_initial_schema.sql (Core Tables, Foreign Keys, Indexes)</div>
                  <div>2. database/migrations/002_rls_policies.sql (Row Level Security & Tenant Isolation)</div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <button
                    onClick={loadData}
                    className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs rounded-lg hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Check Schema Again</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 text-xs font-medium transition cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
                <a
                  href="https://supabase.com/dashboard/project/cxzynykcdxadhhkjsmgs/sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 transition"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* 3. Authoritative Workspace Stage (100% Backed by Supabase PostgreSQL) */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Navigation Sidebar */}
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                setActiveTab(tab);
                setSelectedCampaignId(null);
                setIsSendingWorkspaceOpen(false);
              }}
              activeCampaignsCount={campaigns.filter(c => c.status === 'ACTIVE').length}
              user={user}
              onOpenGuide={() => setGuideModalOpen(true)}
              onOpenLanding={() => {
                setShowLandingPage(true);
                try {
                  window.history.pushState(null, '', '#landing');
                } catch (_) {}
              }}
            />

            {/* Main Workspace Stage */}
            <main className={`flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 ${isSendingWorkspaceOpen ? 'pb-4' : 'pb-24 md:pb-6'} bg-neutral-50/50 dark:bg-neutral-950/50`}>
              {/* If Manual Sending Workspace is active */}
              {isSendingWorkspaceOpen && selectedCampaign ? (
                <ManualSendingWorkspace
                  campaign={selectedCampaign}
                  recipients={campaignRecipients}
                  contacts={contacts}
                  onBack={() => setIsSendingWorkspaceOpen(false)}
                  onPrepare={async (recipientId) => {
                    // Split-second optimistic update: instantly show OPENED in UI
                    setCampaignRecipients(prev => {
                      const next = prev.map(r => r.id === recipientId ? { ...r, status: 'OPENED' } : r);
                      if (selectedCampaign) recipientsCacheRef.current[selectedCampaign.id] = next;
                      return next;
                    });
                    try {
                      const res = await apiClient.prepareRecipient(selectedCampaign.id, recipientId);
                      if (res?.resolvedMessage) {
                        setCampaignRecipients(prev => {
                          const next = prev.map(r => r.id === recipientId ? { ...r, status: 'OPENED', resolvedMessage: res.resolvedMessage } : r);
                          if (selectedCampaign) recipientsCacheRef.current[selectedCampaign.id] = next;
                          return next;
                        });
                      }
                      return res;
                    } catch (err) {
                      console.warn('Background prepare error:', err);
                    }
                  }}
                  onMarkSent={async (recipientId) => {
                    // Split-second optimistic update: instantly mark SENT and increment counter
                    setCampaignRecipients(prev => {
                      const next = prev.map(r => r.id === recipientId ? { ...r, status: 'USER_SENT', sentAt: new Date().toISOString() } : r);
                      if (selectedCampaign) recipientsCacheRef.current[selectedCampaign.id] = next;
                      return next;
                    });
                    setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, sentCount: (c.sentCount || 0) + 1 } : c));
                    setStats((prev: any) => prev ? { ...prev, sentToday: (prev.sentToday || 0) + 1 } : prev);
                    // Background persistence - zero UI lag
                    return apiClient.markRecipientSent(selectedCampaign.id, recipientId);
                  }}
                  onSkip={async (recipientId, reason) => {
                    // Split-second optimistic update: instantly mark SKIPPED and advance
                    setCampaignRecipients(prev => {
                      const next = prev.map(r => r.id === recipientId ? { ...r, status: 'SKIPPED', errorReason: reason || 'Manually skipped' } : r);
                      if (selectedCampaign) recipientsCacheRef.current[selectedCampaign.id] = next;
                      return next;
                    });
                    setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, skippedCount: (c.skippedCount || 0) + 1 } : c));
                    return apiClient.skipRecipient(selectedCampaign.id, recipientId, reason);
                  }}
                  onBlockRecipient={async (recipientId, reason) => {
                    // Split-second optimistic update: instantly mark BLOCKED and advance
                    setCampaignRecipients(prev => {
                      const next = prev.map(r => r.id === recipientId ? { ...r, status: 'BLOCKED' as const, policyNotes: reason || 'Contact globally suppressed' } : r);
                      if (selectedCampaign) recipientsCacheRef.current[selectedCampaign.id] = next;
                      return next;
                    });
                    setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, blockedCount: (c.blockedCount || 0) + 1 } : c));
                    return apiClient.blockRecipient(selectedCampaign.id, recipientId, reason);
                  }}
                  onToggleBlock={handleToggleBlock}
                  onPauseCampaign={async () => {
                    setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, status: 'PAUSED' } : c));
                    return apiClient.updateCampaignStatus(selectedCampaign.id, 'PAUSED');
                  }}
                  userRole={user?.role || 'VIEWER'}
                />
              ) : selectedCampaign ? (
                <CampaignDetailView
                  campaign={selectedCampaign}
                  recipients={campaignRecipients}
                  contacts={contacts}
                  userRole={user?.role || 'VIEWER'}
                  onBack={() => setSelectedCampaignId(null)}
                  onUpdateStatus={async (newStatus) => {
                    setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, status: newStatus as any } : c));
                    await apiClient.updateCampaignStatus(selectedCampaign.id, newStatus);
                  }}
                  onEnterSendingWorkspace={() => setIsSendingWorkspaceOpen(true)}
                  onSendTest={async (testPhone, testName) => {
                    return apiClient.sendTest(selectedCampaign.id, testPhone, testName);
                  }}
                  onSyncTemplate={async () => {
                    const res = await apiClient.syncCampaignTemplate(selectedCampaign.id);
                    const updatedCamp = await apiClient.getCampaign(selectedCampaign.id);
                    if (updatedCamp?.recipients) setCampaignRecipients(updatedCamp.recipients);
                    if (updatedCamp) {
                      setCampaigns(prev => prev.map(c => c.id === selectedCampaign.id ? { ...c, templateSnapshot: updatedCamp.templateSnapshot } : c));
                    }
                    return res;
                  }}
                  onDeleteCampaign={async (id: string) => {
                    setCampaigns(prev => prev.filter(c => c.id !== id));
                    setSelectedCampaignId(null);
                    await apiClient.deleteCampaign(id);
                  }}
                />
              ) : activeTab === 'dashboard' ? (
                <DashboardView
                  campaigns={campaigns}
                  stats={stats}
                  onNavigate={setActiveTab}
                  onOpenCampaign={(campId: string) => setSelectedCampaignId(campId)}
                  user={user}
                  onOpenGuide={() => setGuideModalOpen(true)}
                  tourCompleted={tourCompleted}
                  onDismissTourBanner={() => setTourCompleted(true)}
                />
              ) : activeTab === 'contacts' ? (
                <ContactsView
                  contacts={contacts}
                  lists={lists}
                  userRole={user?.role || 'VIEWER'}
                  onSelectContact={handleSelectContact}
                  onAddContact={async (contactData: any) => {
                    await apiClient.createContact(contactData);
                    loadData();
                  }}
                  onDeleteContact={async (id: string) => {
                    setContacts(prev => prev.filter(c => c.id !== id));
                    await apiClient.deleteContact(id);
                    loadData();
                  }}
                  onBulkDelete={async (ids: string[]) => {
                    const idSet = new Set(ids);
                    setContacts(prev => prev.filter(c => !idSet.has(c.id)));
                    await apiClient.bulkDeleteContacts(ids);
                    loadData();
                  }}
                  onBulkUpdate={async (contactIds: string[], updates: any) => {
                    await apiClient.bulkUpdateContacts(contactIds, updates);
                    loadData();
                  }}
                  onAddToList={async (listId: string, contactIds: string[]) => {
                    await apiClient.addMembersToList(listId, contactIds);
                    loadData();
                  }}
                  onCreateList={async (data: any) => {
                    if (data.syncToDatabase && data.contactIds && data.contactIds.length > 0 && data.leadStatus && data.leadStatus !== 'ALL') {
                      try {
                        await apiClient.bulkUpdateContacts(data.contactIds, {
                          leadStatus: data.leadStatus,
                          ...(data.city && data.city !== 'ALL' ? { city: data.city } : {})
                        });
                      } catch (syncErr) {
                        console.warn('Failed to bulk sync contact segments to DB:', syncErr);
                      }
                    }
                    await apiClient.createContactList(data);
                    loadData();
                  }}
                />
              ) : activeTab === 'import' ? (
                <ImportWizardView
                  contacts={contacts}
                  lists={lists}
                  onCreateList={async (data: any) => {
                    if (data.syncToDatabase && data.contactIds && data.contactIds.length > 0 && data.leadStatus && data.leadStatus !== 'ALL') {
                      try {
                        await apiClient.bulkUpdateContacts(data.contactIds, {
                          leadStatus: data.leadStatus,
                          ...(data.city && data.city !== 'ALL' ? { city: data.city } : {})
                        });
                      } catch (syncErr) {
                        console.warn('Failed to bulk sync contact segments to DB:', syncErr);
                      }
                    }
                    await apiClient.createContactList(data);
                    loadData();
                  }}
                  onImportComplete={() => {
                    setActiveTab('contacts');
                    loadData();
                  }}
                />
              ) : activeTab === 'lists' ? (
                <ListsView
                  lists={lists}
                  contacts={contacts}
                  userRole={user?.role || 'VIEWER'}
                  onCreateList={async (data) => {
                    if (data.syncToDatabase && data.contactIds && data.contactIds.length > 0 && data.leadStatus && data.leadStatus !== 'ALL') {
                      try {
                        await apiClient.bulkUpdateContacts(data.contactIds, {
                          leadStatus: data.leadStatus,
                          ...(data.city && data.city !== 'ALL' ? { city: data.city } : {})
                        });
                      } catch (syncErr) {
                        console.warn('Failed to bulk sync contact segments to DB:', syncErr);
                      }
                    }
                    await apiClient.createContactList(data);
                    loadData();
                  }}
                  onLaunchCampaignForList={(_listId: string) => {
                    setActiveTab('campaigns');
                  }}
                />
              ) : activeTab === 'templates' ? (
                <TemplatesView
                  templates={templates}
                  userRole={user?.role || 'VIEWER'}
                  onCreateTemplate={async (data) => {
                    const res = await apiClient.createTemplate(data);
                    if (res?.data) {
                      setTemplates(prev => [res.data, ...prev]);
                    } else {
                      loadData();
                    }
                  }}
                  onUpdateTemplate={async (id, data) => {
                    // Split-second optimistic template update
                    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
                    // Optimistically cascade snapshot to matching campaigns in memory
                    setCampaigns(prev => prev.map(c => {
                      if (c.templateId === id) {
                        return {
                          ...c,
                          templateSnapshot: {
                            ...c.templateSnapshot,
                            body: data.body !== undefined ? data.body : c.templateSnapshot?.body,
                            name: data.name !== undefined ? data.name : c.templateSnapshot?.name,
                            subject: data.subject !== undefined ? data.subject : c.templateSnapshot?.subject,
                          }
                        };
                      }
                      return c;
                    }));
                    // Server updates template AND cascades re-resolved messages to pending recipients
                    await apiClient.updateTemplate(id, data);
                    // If current campaign uses this template, refresh recipients with updated resolved messages
                    if (selectedCampaignId) {
                      const cur = campaigns.find(c => c.id === selectedCampaignId);
                      if (cur && cur.templateId === id) {
                        const updatedCamp = await apiClient.getCampaign(selectedCampaignId);
                        if (updatedCamp?.recipients) setCampaignRecipients(updatedCamp.recipients);
                      }
                    }
                  }}
                  onDeleteTemplate={async (id) => {
                    setTemplates(prev => prev.filter(t => t.id !== id));
                    await apiClient.deleteTemplate(id);
                  }}
                  onOpenAICopilotWithTemplate={(text: string) => {
                    setAiTemplateSeed(text);
                    setActiveTab('ai');
                  }}
                />
              ) : activeTab === 'campaigns' ? (
                <CampaignsView
                  campaigns={campaigns}
                  lists={lists}
                  templates={templates}
                  userRole={user?.role || 'VIEWER'}
                  onSelectCampaign={(id: string) => setSelectedCampaignId(id)}
                  onCreateCampaign={async (data) => {
                    const targetList = lists.find(l => l.id === data.targetListId);
                    const template = templates.find(t => t.id === data.templateId);
                    const tempId = `temp-${Date.now()}`;
                    const optimisticCampaign: Campaign = {
                      id: tempId,
                      tenantId: tenant?.id || '',
                      name: data.name,
                      description: data.description || '',
                      channel: data.channel || template?.channel || 'WHATSAPP',
                      status: 'DRAFT',
                      targetListId: data.targetListId,
                      targetListName: targetList?.name || 'Target Audience',
                      templateId: data.templateId,
                      templateVersion: template?.version || 1,
                      templateSnapshot: {
                        name: template?.name || '',
                        subject: template?.subject,
                        body: template?.body || '',
                        attachmentName: template?.attachmentName
                      },
                      isDryRun: !!data.isDryRun,
                      assignedOperator: user?.id || '',
                      createdBy: user?.id || '',
                      recipientsCount: targetList?.contactIds?.length || 0,
                      sentCount: 0,
                      openedCount: 0,
                      skippedCount: 0,
                      blockedCount: 0,
                      createdAt: new Date().toISOString()
                    };

                    // 1. Instant optimistic UI update (0ms delay)
                    setCampaigns(prev => [optimisticCampaign, ...prev]);
                    setSelectedCampaignId(tempId);

                    try {
                      // 2. Perform backend campaign creation
                      const created = await apiClient.createCampaign(data);
                      if (created?.id) {
                        setCampaigns(prev => prev.map(c => c.id === tempId ? created : c));
                        setSelectedCampaignId(created.id);

                        // 3. Update local cache
                        try {
                          const raw = localStorage.getItem('reachout_workspace_cache');
                          if (raw) {
                            const cache = JSON.parse(raw);
                            cache.campaigns = [created, ...(cache.campaigns || []).filter((c: any) => c.id !== tempId)];
                            localStorage.setItem('reachout_workspace_cache', JSON.stringify(cache));
                          }
                        } catch (_) {}
                      }
                    } catch (err: any) {
                      // Revert optimistic addition on failure
                      setCampaigns(prev => prev.filter(c => c.id !== tempId));
                      setSelectedCampaignId(null);
                      console.error('Failed to create campaign:', err);
                      alert(err?.message || 'Failed to create campaign.');
                    }
                  }}
                  onDeleteCampaign={async (id: string) => {
                    setCampaigns(prev => prev.filter(c => c.id !== id));
                    await apiClient.deleteCampaign(id);
                  }}
                />
              ) : activeTab === 'ai' ? (
                <AICopilotView
                  initialPromptText={aiTemplateSeed}
                  onApplyToTemplate={(body: string) => {
                    setAiTemplateSeed(body);
                    setActiveTab('templates');
                  }}
                />
              ) : activeTab === 'audit' ? (
                <AuditLogView logs={auditLogs} />
              ) : activeTab === 'settings' ? (
                <SettingsView
                  tenant={tenant}
                  onExportContacts={handleExportContacts}
                  userRole={user?.role || 'VIEWER'}
                  user={user}
                  onToggleKillSwitch={() => handleToggleKillSwitch('Toggled via Settings')}
                />
              ) : null}
            </main>

            {/* Unified Contact Intelligence Drawer */}
            {selectedContact && (
              <ContactDrawer
                contact={selectedContact}
                timeline={selectedContactTimeline}
                onClose={() => setSelectedContact(null)}
                onToggleBlock={handleToggleBlock}
                onAddNote={handleAddNote}
                onUpdatePreferences={async (contactId, channel, allowed) => {
                  const newPrefs = {
                    ...selectedContact.preferences,
                    [channel]: {
                      ...selectedContact.preferences[channel],
                      marketingAllowed: allowed
                    }
                  };
                  await apiClient.updateContact(contactId, { preferences: newPrefs });
                  loadData();
                }}
                onDeleteContact={async (contactId) => {
                  setContacts(prev => prev.filter(c => c.id !== contactId));
                  await apiClient.deleteContact(contactId);
                  setSelectedContact(null);
                  loadData();
                }}
              />
            )}

            {/* Mobile Bottom Navigation Bar (Smartphones only) */}
            {!isSendingWorkspaceOpen && (
              <MobileBottomNav
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  setSelectedCampaignId(null);
                  setIsSendingWorkspaceOpen(false);
                }}
                activeCampaignsCount={campaigns.filter(c => c.status === 'ACTIVE').length}
                user={user}
                tenant={tenant}
                onOpenGuide={() => setGuideModalOpen(true)}
                onSignOut={handleSignOut}
              />
            )}
          </div>
        )}

        {/* Global Keyboard Shortcuts Modal (?) */}
        <KeyboardShortcutsModal
          isOpen={shortcutsModalOpen}
          onClose={() => setShortcutsModalOpen(false)}
        />

        {/* Context-Aware Interactive Product Tour Engine */}
        <TourEngine
          isActive={guideModalOpen}
          onClose={() => setGuideModalOpen(false)}
          activeTab={activeTab}
          onNavigate={(tab) => {
            setActiveTab(tab);
            setSelectedCampaignId(null);
            setIsSendingWorkspaceOpen(false);
          }}
          onComplete={() => setTourCompleted(true)}
        />
      </div>
    </div>
  );
}
