/**
 * ReachOutOS Subdomain Environment Switcher Bar
 * Interactive indicator and quick switcher across subdomains (app, landing, tenant, api).
 */

import React from 'react';
import { Globe, ExternalLink, ArrowRight, Server, ShieldCheck, Building } from 'lucide-react';
import { SubdomainRouter, SubdomainType } from '../../core/routing/SubdomainRouter';

interface SubdomainSwitcherBarProps {
  currentSubdomainMode: SubdomainType;
  tenantSlug: string | null;
  onSwitchMode: (mode: SubdomainType, tenantSlug?: string) => void;
}

export const SubdomainSwitcherBar: React.FC<SubdomainSwitcherBarProps> = ({
  currentSubdomainMode,
  tenantSlug,
  onSwitchMode
}) => {
  return (
    <div className="bg-neutral-900 text-neutral-300 border-b border-neutral-800 text-[11px] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 z-50">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 font-mono font-bold text-white">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>Subdomain Architecture:</span>
        </span>
        <span className={`px-2 py-0.2 rounded font-mono font-bold text-[10px] ${
          currentSubdomainMode === 'APP'
            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            : currentSubdomainMode === 'TENANT'
            ? 'bg-purple-950 text-purple-300 border border-purple-800'
            : 'bg-blue-950 text-blue-300 border border-blue-800'
        }`}>
          {currentSubdomainMode === 'APP' 
            ? 'app.reachoutos.com (App Workspace)' 
            : currentSubdomainMode === 'TENANT'
            ? `${tenantSlug || 'tenant'}.reachoutos.com (Dedicated Tenant)`
            : 'reachoutos.com (Marketing Landing)'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-neutral-400 hidden sm:inline">Switch Subdomain:</span>

        {/* 1. Landing Page Button */}
        <button
          onClick={() => onSwitchMode('LANDING')}
          className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer font-medium ${
            currentSubdomainMode === 'LANDING'
              ? 'bg-white text-neutral-900 font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Visit reachoutos.com"
        >
          reachoutos.com
        </button>

        {/* 2. App Workspace Button */}
        <button
          onClick={() => onSwitchMode('APP')}
          className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer font-medium flex items-center gap-1 ${
            currentSubdomainMode === 'APP'
              ? 'bg-emerald-500 text-white font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Visit app.reachoutos.com"
        >
          <span>app.reachoutos.com</span>
        </button>

        {/* 3. Tenant Subdomain Button */}
        <button
          onClick={() => onSwitchMode('TENANT', 'yarhoney')}
          className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer font-medium flex items-center gap-1 ${
            currentSubdomainMode === 'TENANT'
              ? 'bg-purple-600 text-white font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Visit yarhoney.reachoutos.com"
        >
          <Building className="w-3 h-3 text-purple-300" />
          <span>yarhoney.reachoutos.com</span>
        </button>
      </div>
    </div>
  );
};
