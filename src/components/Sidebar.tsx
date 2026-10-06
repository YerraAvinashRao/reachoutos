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
  ShieldCheck
} from 'lucide-react';

export type NavTab = 
  | 'dashboard'
  | 'contacts'
  | 'import'
  | 'lists'
  | 'templates'
  | 'campaigns'
  | 'ai'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeCampaignsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeCampaignsCount
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
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
    { id: 'ai' as NavTab, label: 'AI Copilot', icon: Sparkles },
    { id: 'audit' as NavTab, label: 'Audit Log', icon: History },
    { id: 'settings' as NavTab, label: 'Settings & Security', icon: Settings }
  ];

  return (
    <aside className="w-56 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col justify-between p-3 select-none">
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
