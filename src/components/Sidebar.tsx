import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UploadCloud, 
  ListFilter, 
  FileText, 
  Send, 
  Sparkles, 
  History, 
  Settings,
  ShieldCheck,
  BookOpen,
  TrendingUp,
  MessageSquare,
  GitMerge
} from 'lucide-react';

import { Tenant, User, Role } from '../types';

export type NavTab = 
  | 'dashboard'
  | 'inbox'
  | 'cadences'
  | 'contacts'
  | 'import'
  | 'lists'
  | 'templates'
  | 'campaigns'
  | 'analytics'
  | 'ai'
  | 'audit'
  | 'admin'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeCampaignsCount: number;
  user?: User | null;
  onOpenGuide?: () => void;
  onOpenLanding?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeCampaignsCount,
  user,
  onOpenGuide,
  onOpenLanding
}) => {
  const isAdminOrOwner = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox' as NavTab, label: 'Smart Inbox', icon: MessageSquare, badge: 'Live' },
    { id: 'cadences' as NavTab, label: 'Follow-Up Cadences', icon: GitMerge },
    { id: 'contacts' as NavTab, label: 'Contacts', icon: Users },
    { id: 'import' as NavTab, label: 'Import Wizard', icon: UploadCloud },
    { id: 'lists' as NavTab, label: 'Lists & Segments', icon: ListFilter },
    { id: 'templates' as NavTab, label: 'Templates', icon: FileText },
    { 
      id: 'campaigns' as NavTab, 
      label: 'Campaigns', 
      icon: Send, 
      badge: activeCampaignsCount > 0 ? `${activeCampaignsCount} Active` : undefined 
    },
    { id: 'analytics' as NavTab, label: 'Funnel Analytics', icon: TrendingUp },
    { id: 'ai' as NavTab, label: 'AI Copilot', icon: Sparkles },
    { id: 'audit' as NavTab, label: 'Audit Log', icon: History },
    ...(isAdminOrOwner ? [{ id: 'admin' as NavTab, label: 'Admin Console', icon: ShieldCheck, badge: 'PRO' }] : []),
    { id: 'settings' as NavTab, label: 'Settings & Security', icon: Settings }
  ];

  return (
    <aside className="hidden md:flex w-56 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex-col justify-between p-3 select-none shrink-0">
      <div className="space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              data-tour={`sidebar.${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
                isActive
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-neutral-900' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                  isActive 
                    ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Profile Card */}
      {user && (
        <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2.5 shadow-xs mb-2">
          <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs shrink-0">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
              {user.name || 'Workspace User'}
            </div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate font-mono">
              {user.email}
            </div>
          </div>
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {user.role}
          </span>
        </div>
      )}

      {/* Interactive App Guide Launch Button */}
      {onOpenGuide && (
        <button
          onClick={onOpenGuide}
          className="w-full mb-2 p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Interactive Guide</span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
            Tour
          </span>
        </button>
      )}

      {/* Landing Page Showcase Button */}
      {onOpenLanding && (
        <button
          onClick={onOpenLanding}
          className="w-full mb-2 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Public Landing Page</span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
            Showcase
          </span>
        </button>
      )}

      {/* Compliance & Policy Footnote */}
      <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[11px] text-neutral-500 space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Human-in-the-Loop</span>
        </div>
        <p className="text-[10px] leading-tight text-neutral-400 dark:text-neutral-500">
          Zero automated DOM clicking. All dispatches verified by operator review.
        </p>
      </div>
    </aside>
  );
};
