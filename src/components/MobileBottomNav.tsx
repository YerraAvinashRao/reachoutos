import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Send, 
  FileText, 
  MoreHorizontal, 
  UploadCloud, 
  ListFilter, 
  Sparkles, 
  History, 
  Settings, 
  BookOpen, 
  LogOut, 
  X,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  GitMerge,
  Building2
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { User, Tenant } from '../types';

interface MobileBottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeCampaignsCount: number;
  user: User | null;
  tenant: Tenant | null;
  onOpenGuide: () => void;
  onSignOut: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  activeCampaignsCount,
  user,
  tenant,
  onOpenGuide,
  onSignOut
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainTabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Inbox', icon: MessageSquare },
    { id: 'campaigns', label: 'Campaigns', icon: Send },
    { id: 'contacts', label: 'Contacts', icon: Users },
  ];

  const moreTabs: { id: NavTab; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'cadences', label: 'Follow-Up Cadences', desc: 'Multi-touch sequences & daily queues', icon: GitMerge },
    { id: 'templates', label: 'Templates', desc: 'Commercial message blueprints & categories', icon: FileText },
    { id: 'analytics', label: 'Funnel Analytics', desc: 'Conversion funnel & operator velocity', icon: TrendingUp },
    { id: 'admin', label: 'Admin Console', desc: 'Team RBAC, policy reviews & suppression', icon: ShieldCheck },
    { id: 'lists', label: 'Lists & Segments', desc: 'Audience filtering & customer groupings', icon: ListFilter },
    { id: 'import', label: 'Import Wizard', desc: 'CSV & Excel spreadsheet ingestion', icon: UploadCloud },
    { id: 'ai', label: 'AI Copilot', desc: 'Gemini template writer & campaign assistant', icon: Sparkles },
    { id: 'audit', label: 'Audit Log', desc: 'Immutable compliance & security logs', icon: History },
    { id: 'settings', label: 'Settings & Security', desc: 'API keys, team roles & workspace config', icon: Settings },
  ];

  const isMoreActive = moreTabs.some(t => t.id === activeTab);

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Slide-Up "More" Sheet Modal */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsMoreOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          />

          {/* Sheet Body */}
          <div className="relative bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 shadow-2xl animate-in slide-in-from-bottom duration-300 space-y-4">
            {/* Sheet Handle & Header */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs shadow-xs">
                  RO
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                    ReachOut OS Menu
                  </h3>
                  <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    <span>{tenant?.name || 'Workspace'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Mini Card */}
            {user && (
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                      {user.email}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
                  {user.role}
                </span>
              </div>
            )}

            {/* Grid of More Workspace Views */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-1">
                Workspace Tools
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {moreTabs.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition ${
                        isActive
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                          : 'bg-neutral-50/60 dark:bg-neutral-800/40 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-100 dark:border-neutral-800'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        isActive
                          ? 'bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900'
                          : 'bg-neutral-200/60 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-300'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs leading-snug">
                          {item.label}
                        </div>
                        <div className={`text-[10px] truncate ${isActive ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-500'}`}>
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* App Guide & Actions */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenGuide();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Launch Interactive App Guide</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                  Tutorial
                </span>
              </button>

              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of ReachOut OS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar (Visible strictly on mobile screens < md) */}
      <nav 
        aria-label="Mobile Navigation" 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 px-2 py-1.5 flex items-center justify-around select-none shadow-lg pb-[calc(env(safe-area-inset-bottom)+0.35rem)]"
      >
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition cursor-pointer relative min-w-[56px] ${
                isActive
                  ? 'text-neutral-900 dark:text-white font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.id === 'campaigns' && activeCampaignsCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-emerald-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {activeCampaignsCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'font-bold' : 'font-normal'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-neutral-900 dark:bg-white mt-0.5" />
              )}
            </button>
          );
        })}

        {/* More Tab */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition cursor-pointer relative min-w-[56px] ${
            isMoreActive || isMoreOpen
              ? 'text-neutral-900 dark:text-white font-bold'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium'
          }`}
        >
          <MoreHorizontal className={`w-5 h-5 transition-transform ${isMoreActive || isMoreOpen ? 'scale-110' : ''}`} />
          <span className={`text-[10px] tracking-tight mt-0.5 ${isMoreActive ? 'font-bold' : 'font-normal'}`}>
            More
          </span>
          {isMoreActive && (
            <span className="w-1 h-1 rounded-full bg-neutral-900 dark:bg-white mt-0.5" />
          )}
        </button>
      </nav>
    </>
  );
};
