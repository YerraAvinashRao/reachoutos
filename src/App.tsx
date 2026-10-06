import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
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
import { LoginView } from './components/LoginView';
import { apiClient } from './services/apiClient';
import { supabase } from './services/supabaseClient';
import { Tenant, User, Contact, Campaign, MessageTemplate, ContactList, AuditLogEntry, TimelineEvent } from './types';
import { Database, ShieldAlert, ExternalLink, Terminal, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Supabase Database & Auth State
  const [isDatabaseConfigured, setIsDatabaseConfigured] = useState<boolean>(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Core PostgreSQL Data
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Focus and detail states
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactTimeline, setSelectedContactTimeline] = useState<TimelineEvent[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isSendingWorkspaceOpen, setIsSendingWorkspaceOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [aiTemplateSeed, setAiTemplateSeed] = useState<string>('');

  // Fetch all initial data from Supabase via single aggregated bootstrap request
  const loadData = useCallback(async () => {
    try {
      const health = await apiClient.getHealth();
      if (health?.status === 'RATE_LIMITED') {
        setRateLimitNotice('Upstream proxy rate limit reached. Retrying shortly...');
        setTimeout(() => loadData(), 2500);
        return;
      }
      setRateLimitNotice(null);

      if (!health?.isDatabaseConfigured) {
        setIsDatabaseConfigured(false);
        setDatabaseError(health?.message || 'Supabase PostgreSQL database is not configured.');
        setAuthLoading(false);
        return;
      }
      setIsDatabaseConfigured(true);
      setDatabaseError(null);

      // Check real Supabase Auth session directly from official Supabase client
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        setAuthLoading(false);
        return;
      }

      setIsAuthenticated(true);
      setSchemaError(null);

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
        loadData();
      } else {
        setIsAuthenticated(false);
        setAuthLoading(false);
      }
    });

    // 2. Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setIsAuthenticated(true);
          loadData();
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
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
    await apiClient.toggleContactBlock(contactId, reason);
    await loadData();
    if (selectedContact && selectedContact.id === contactId) {
      const updated = await apiClient.getContact(contactId);
      if (updated?.contact) setSelectedContact(updated.contact);
      if (updated?.timeline) setSelectedContactTimeline(updated.timeline);
    }
  };

  const handleAddNote = async (contactId: string, note: string) => {
    await apiClient.addContactNote(contactId, note);
    await loadData();
    if (selectedContact && selectedContact.id === contactId) {
      const updated = await apiClient.getContact(contactId);
      if (updated?.contact) setSelectedContact(updated.contact);
      if (updated?.timeline) setSelectedContactTimeline(updated.timeline);
    }
  };

  const handleToggleKillSwitch = async (reason?: string) => {
    if (!tenant) return;
    await apiClient.toggleKillSwitch(!tenant.isKillSwitchActive, reason);
    await loadData();
  };

  const handleSignOut = async () => {
    await apiClient.logout();
    setIsAuthenticated(false);
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

  useEffect(() => {
    if (selectedCampaignId) {
      apiClient.getCampaign(selectedCampaignId).then(res => {
        if (res?.recipients) setCampaignRecipients(res.recipients);
      });
    }
  }, [selectedCampaignId]);

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
          onToggleKillSwitch={() => handleToggleKillSwitch('Toggled via top navigation bar')}
          onSignOut={handleSignOut}
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
                  <div className="text-neutral-500"># Set in AI Studio Secrets or environment variables</div>
                  <div><span className="text-emerald-400">SUPABASE_URL</span>="https://&lt;project-ref&gt;.supabase.co"</div>
                  <div><span className="text-emerald-400">SUPABASE_ANON_KEY</span>="eyJhbGciOiJIUzI1NiIsInR5cCI6..."</div>
                  <div><span className="text-emerald-400">SUPABASE_SERVICE_ROLE_KEY</span>="eyJhbGciOiJIUzI1Ni..."</div>
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
            />

            {/* Main Workspace Stage */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-xs">
              {/* If Manual Sending Workspace is active */}
              {isSendingWorkspaceOpen && selectedCampaign ? (
                <ManualSendingWorkspace
                  campaign={selectedCampaign}
                  recipients={campaignRecipients}
                  contacts={contacts}
                  onBack={() => setIsSendingWorkspaceOpen(false)}
                  onPrepare={async (recipientId) => {
                    const res = await apiClient.prepareRecipient(selectedCampaign.id, recipientId);
                    const updatedCamp = await apiClient.getCampaign(selectedCampaign.id);
                    if (updatedCamp?.recipients) setCampaignRecipients(updatedCamp.recipients);
                    loadData();
                    return res;
                  }}
                  onMarkSent={async (recipientId) => {
                    const res = await apiClient.markRecipientSent(selectedCampaign.id, recipientId);
                    const updatedCamp = await apiClient.getCampaign(selectedCampaign.id);
                    if (updatedCamp?.recipients) setCampaignRecipients(updatedCamp.recipients);
                    loadData();
                    return res;
                  }}
                  onSkip={async (recipientId, reason) => {
                    await apiClient.skipRecipient(selectedCampaign.id, recipientId, reason);
                    const updatedCamp = await apiClient.getCampaign(selectedCampaign.id);
                    if (updatedCamp?.recipients) setCampaignRecipients(updatedCamp.recipients);
                    loadData();
                  }}
                  onToggleBlock={handleToggleBlock}
                  onPauseCampaign={async () => {
                    await apiClient.updateCampaignStatus(selectedCampaign.id, 'PAUSED');
                    loadData();
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
                    await apiClient.updateCampaignStatus(selectedCampaign.id, newStatus);
                    loadData();
                  }}
                  onEnterSendingWorkspace={() => setIsSendingWorkspaceOpen(true)}
                  onSendTest={async (testPhone, testName) => {
                    return apiClient.sendTest(selectedCampaign.id, testPhone, testName);
                  }}
                />
              ) : activeTab === 'dashboard' ? (
                <DashboardView
                  campaigns={campaigns}
                  stats={stats}
                  onNavigate={setActiveTab}
                  onOpenCampaign={(campId: string) => setSelectedCampaignId(campId)}
                />
              ) : activeTab === 'contacts' ? (
                <ContactsView
                  contacts={contacts}
                  userRole={user?.role || 'VIEWER'}
                  onSelectContact={handleSelectContact}
                  onAddContact={async (contactData: any) => {
                    await apiClient.createContact(contactData);
                    loadData();
                  }}
                  onDeleteContact={async (id: string) => {
                    await apiClient.deleteContact(id);
                    loadData();
                  }}
                />
              ) : activeTab === 'import' ? (
                <ImportWizardView
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
                    await apiClient.createTemplate(data);
                    loadData();
                  }}
                  onUpdateTemplate={async (id, data) => {
                    await apiClient.updateTemplate(id, data);
                    loadData();
                  }}
                  onDeleteTemplate={async (id) => {
                    await apiClient.deleteTemplate(id);
                    loadData();
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
                    const res = await apiClient.createCampaign(data);
                    loadData();
                    if (res?.data?.id) setSelectedCampaignId(res.data.id);
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
              />
            )}
          </div>
        )}

        {/* Global Keyboard Shortcuts Modal (?) */}
        <KeyboardShortcutsModal
          isOpen={shortcutsModalOpen}
          onClose={() => setShortcutsModalOpen(false)}
        />
      </div>
    </div>
  );
}
