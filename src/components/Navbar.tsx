import React from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Keyboard, 
  Sun, 
  Moon, 
  Radio,
  Building2,
  Database,
  LogOut,
  AlertTriangle,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { Tenant, User, Role } from '../types';

interface NavbarProps {
  tenant: Tenant | null;
  user: User | null;
  isDatabaseConfigured: boolean;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenShortcuts: () => void;
  onOpenGuide: () => void;
  onToggleKillSwitch: () => void;
  onSignOut: () => void;
  onOpenLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  tenant,
  user,
  isDatabaseConfigured,
  darkMode,
  setDarkMode,
  onOpenShortcuts,
  onOpenGuide,
  onToggleKillSwitch,
  onSignOut,
  onOpenLanding
}) => {
  return (
    <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Workspace Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
            RO
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                ReachOut OS
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 sm:hidden ${isDatabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="hidden sm:inline text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">
                PostgreSQL Edition
              </span>
            </div>
            <div className="hidden sm:flex text-[11px] text-neutral-500 dark:text-neutral-400 items-center gap-1.5">
              <Building2 className="w-3 h-3 text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {tenant?.name || 'Workspace'}
              </span>
              <span>•</span>
              {isDatabaseConfigured ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> Supabase Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-2.5 h-2.5" /> Config Required
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Kill Switch & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Emergency Kill Switch Banner / Button */}
        {tenant?.isKillSwitchActive ? (
          <button
            onClick={onToggleKillSwitch}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-rose-600 text-white text-xs font-semibold shadow-sm hover:bg-rose-700 transition animate-pulse"
            title="Emergency Kill Switch is Active. Click to review or resume."
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">OUTREACH PAUSED</span>
            <span className="sm:hidden text-[10px]">PAUSED</span>
          </button>
        ) : (
          <button
            onClick={onToggleKillSwitch}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-neutral-600 dark:text-neutral-400 hover:text-rose-600 text-xs font-medium transition"
            title="Emergency Kill Switch - Halts all outreach instantly"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="hidden sm:inline">Kill Switch Ready</span>
          </button>
        )}

        {/* Database Connection Pill */}
        <div className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border ${
          isDatabaseConfigured
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
            : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400'
        }`}>
          <Database className="w-3 h-3" />
          <span>{isDatabaseConfigured ? 'Supabase RLS' : 'No DB Config'}</span>
        </div>

        {/* User Identity Pill (From Auth context) */}
        {user && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-neutral-100 dark:bg-neutral-800/80 px-2 sm:px-2.5 py-1.5 rounded-md text-xs border border-neutral-200 dark:border-neutral-700">
            <div className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[10px] shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                {user.email}
              </span>
            </div>
            <span className={`hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
              user.role === 'ADMIN' || user.role === 'OWNER' 
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                : user.role === 'OPERATOR'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
            }`}>
              {user.role}
            </span>
            <button
              onClick={onSignOut}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Public Landing Page & Feature Showcase Button */}
        {onOpenLanding && (
          <button
            onClick={onOpenLanding}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            title="View Public Landing Page & Live Simulator"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Landing Page</span>
          </button>
        )}

        {/* Interactive App Guide Button */}
        <button
          onClick={onOpenGuide}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-semibold shadow-xs transition cursor-pointer"
          title="Open ReachOut OS Interactive Guide"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>App Guide</span>
        </button>

        {/* Keyboard Shortcuts Button */}
        <button
          onClick={onOpenShortcuts}
          className="hidden sm:block p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Dark/Light mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          title="Toggle Theme"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
