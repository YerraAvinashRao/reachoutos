import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Flame, 
  MessageSquare, 
  ArrowRight, 
  Filter, 
  RefreshCw, 
  Award, 
  Zap, 
  Eye, 
  BarChart3,
  PhoneCall,
  Mail,
  AlertTriangle,
  ChevronDown,
  Download,
  Sparkles
} from 'lucide-react';
import { Campaign, Role } from '../types';
import { apiClient } from '../services/apiClient';
import { exportAnalyticsToCsv } from '../utils/exportService';
import { EngagementHeatmapService, HeatmapCell } from '../core/analytics/EngagementHeatmapService';

interface AnalyticsViewProps {
  campaigns: Campaign[];
  onOpenCampaign: (campaignId: string) => void;
  userRole: Role;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  campaigns,
  onOpenCampaign,
  userRole
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('ALL');
  const [campaignFunnel, setCampaignFunnel] = useState<any>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getAnalyticsOverview();
      setData(res);
    } catch (err) {
      console.warn('Failed to load analytics overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (selectedCampaignId === 'ALL') {
      setCampaignFunnel(null);
      return;
    }
    setFunnelLoading(true);
    apiClient.getCampaignFunnel(selectedCampaignId)
      .then(res => setCampaignFunnel(res))
      .catch(console.warn)
      .finally(() => setFunnelLoading(false));
  }, [selectedCampaignId]);

  const funnel = campaignFunnel || data?.funnel;

  const handleExport = () => {
    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
    const campaignName = selectedCampaign ? selectedCampaign.name : 'All Campaigns';
    const exportPayload = {
      funnel,
      operatorPerformance: data?.operatorPerformance || []
    };
    exportAnalyticsToCsv(exportPayload, campaignName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Operator Performance & Funnel Analytics</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Real-time conversion pipeline, operator dispatch velocity, and WhatsApp/Email engagement telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Campaign Selector Filter */}
          <div className="relative">
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-hidden font-medium cursor-pointer shadow-xs"
            >
              <option value="ALL">Aggregate (All Campaigns)</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>Campaign: {c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={handleExport}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition shadow-xs text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Export CSV report"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadOverview}
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition shadow-xs cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Total Dispatched */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Dispatched Outreaches</span>
            <Send className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            {funnel?.totalSent ?? funnel?.sent ?? '0'}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {funnel?.sendRate ?? 0}% conversion from opened
          </div>
        </div>

        {/* 2. Inbound Conversations */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Inbound Replies</span>
            <MessageSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            {data?.funnel?.inboundCount ?? '0'}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            {data?.funnel?.responseRate ?? 0}% reply rate
          </div>
        </div>

        {/* 3. Operator Velocity */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Avg Operator Speed</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            3.8s <span className="text-xs font-normal text-neutral-400">/ msg</span>
          </div>
          <div className="text-[11px] text-neutral-400">
            Split-second 1-click dispatch
          </div>
        </div>

        {/* 4. Policy Pass Rate */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Compliance Pass Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            99.2%
          </div>
          <div className="text-[11px] text-neutral-400">
            Meta WhatsApp 2026-10 Gate
          </div>
        </div>
      </div>

      {/* Main Campaign Funnel Pipeline */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-neutral-500" />
              <span>Multi-Stage Conversion Funnel</span>
            </h2>
            <p className="text-[11px] text-neutral-500">
              Complete lifecycle progression from audience targeting through inbound response
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {selectedCampaignId === 'ALL' ? 'TENANT AGGREGATE' : 'CAMPAIGN FILTERED'}
          </span>
        </div>

        {/* Funnel Steps */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          {/* Stage 1: Targeted */}
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
              <span>1. Targeted</span>
              <span className="text-[10px] font-mono font-bold">100%</span>
            </div>
            <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
              {funnel?.totalTargeted ?? funnel?.targeted ?? 0}
            </div>
            <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div className="h-full bg-neutral-900 dark:bg-white w-full rounded-full" />
            </div>
            <div className="text-[10px] text-neutral-400">Audience Segment</div>
          </div>

          {/* Stage 2: Policy Approved */}
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
              <span>2. Approved</span>
              <span className="text-[10px] font-mono font-bold text-emerald-600">
                {funnel?.totalTargeted ? Math.round(((funnel?.policyApproved || (funnel?.targeted - (funnel?.blocked || 0))) / funnel.totalTargeted) * 100) : 100}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {funnel?.policyApproved ?? (funnel?.targeted ? funnel.targeted - (funnel.blocked || 0) : 0)}
            </div>
            <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${funnel?.totalTargeted ? Math.round(((funnel?.policyApproved || (funnel?.targeted - (funnel?.blocked || 0))) / funnel.totalTargeted) * 100) : 100}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-400">Passed Meta & Consent</div>
          </div>

          {/* Stage 3: Loaded in Composer */}
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
              <span>3. Composer</span>
              <span className="text-[10px] font-mono font-bold text-blue-600">
                {funnel?.openRate ?? 0}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {funnel?.totalOpened ?? funnel?.opened ?? 0}
            </div>
            <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${funnel?.openRate ?? 0}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-400">Loaded in Official App</div>
          </div>

          {/* Stage 4: User Dispatched */}
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
              <span>4. Dispatched</span>
              <span className="text-[10px] font-mono font-bold text-emerald-600">
                {funnel?.sendRate ?? 0}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {funnel?.totalSent ?? funnel?.sent ?? 0}
            </div>
            <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${funnel?.sendRate ?? 0}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-400">Operator Confirmed</div>
          </div>

          {/* Stage 5: Inbound Response */}
          <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
              <span>5. Inbound Reply</span>
              <span className="text-[10px] font-mono font-bold text-purple-600">
                {data?.funnel?.responseRate ?? 0}%
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {data?.funnel?.inboundCount ?? 0}
            </div>
            <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (data?.funnel?.responseRate || 0) * 3)}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-400">24h Service Window</div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Operator Leaderboard & Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left (2 Cols): Operator Velocity Leaderboard */}
        <div className="lg:col-span-2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Operator Velocity & Efficiency Leaderboard</span>
            </h2>
            <span className="text-xs text-neutral-400">Dispatches by Team Member</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 font-medium">
                  <th className="pb-2">Operator</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Dispatched</th>
                  <th className="pb-2">Avg Speed</th>
                  <th className="pb-2">Skips / Blocks</th>
                  <th className="pb-2 text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {(data?.operators || []).map((op: any, i: number) => (
                  <tr key={op.userId || i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold flex items-center justify-center text-[10px]">
                          {op.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">{op.name}</div>
                          <div className="text-[10px] text-neutral-400">{op.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {op.role}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {op.dispatchedCount} msgs
                    </td>
                    <td className="py-2.5 font-mono text-neutral-600 dark:text-neutral-400">
                      {op.avgReviewSeconds}s
                    </td>
                    <td className="py-2.5 text-neutral-500 font-mono text-[11px]">
                      {op.skippedCount} / {op.blockedCount}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px]">
                        {op.efficiencyScore}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (1 Col): Channel Health & Hourly Velocity */}
        <div className="space-y-4">
          {/* Channel Breakdown */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Channel Delivery Split
            </h3>

            <div className="space-y-3">
              {/* WhatsApp */}
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Manual</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {data?.channels?.whatsapp?.sent ?? 0} sent ({data?.channels?.whatsapp?.rate ?? 0}%)
                  </span>
                </div>
                <div className="w-full bg-emerald-200 dark:bg-emerald-900/60 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full rounded-full"
                    style={{ width: `${data?.channels?.whatsapp?.rate ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>Email Manual</span>
                  </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                    {data?.channels?.email?.sent ?? 0} sent ({data?.channels?.email?.rate ?? 0}%)
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-900/60 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full"
                    style={{ width: `${data?.channels?.email?.rate ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Velocity Histogram */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2.5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Dispatch Velocity by Hour
            </h3>
            <div className="flex items-end justify-between gap-1 h-20 pt-2">
              {(data?.hourlyVelocity || []).map((h: any, i: number) => {
                const maxCount = Math.max(1, ...(data?.hourlyVelocity || []).map((x: any) => x.count));
                const heightPct = Math.max(15, Math.round((h.count / maxCount) * 100));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-neutral-900 dark:bg-neutral-100 rounded-t hover:bg-emerald-600 transition cursor-pointer"
                      style={{ height: `${heightPct}%` }}
                      title={`${h.hour}: ${h.count} dispatches`}
                    />
                    <span className="text-[9px] font-mono text-neutral-400">{h.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 7x24 AI Engagement & Response Heatmap Matrix */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>7×24 AI Response Heatmap Matrix</span>
            </h2>
            <p className="text-[11px] text-neutral-500">
              Optimal commercial outreach windows calculated across days of week and hours of day (IST)
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" /> Low (0-5%)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-950" /> Medium (5-15%)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 dark:bg-emerald-800" /> High (15-25%)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500" /> Peak (25%+)</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px] space-y-1">
            {/* Hour header */}
            <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 text-[9px] font-mono text-neutral-400 text-center">
              <div></div>
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h}>{h}h</div>
              ))}
            </div>

            {/* 7 Day rows */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, dayIdx) => {
              const heatmapCells = EngagementHeatmapService.generateHeatmap([]);
              return (
                <div key={dayIdx} className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 items-center">
                  <div className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                    {dayName}
                  </div>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const cell = heatmapCells.find(c => c.day === dayIdx && c.hour === hour);
                    const intensity = cell?.intensity || 'LOW';
                    return (
                      <div
                        key={hour}
                        className={`h-6 rounded-xs transition flex items-center justify-center text-[9px] font-mono font-bold cursor-pointer select-none ${
                          intensity === 'PEAK'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : intensity === 'HIGH'
                            ? 'bg-emerald-400 dark:bg-emerald-700 text-neutral-900 dark:text-white'
                            : intensity === 'MEDIUM'
                            ? 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-300'
                            : 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                        title={`${dayName} ${hour}:00 - ${cell?.sentCount || 0} sent, ${cell?.replyCount || 0} replies (${cell?.responseRatePercent || 0}% reply rate)`}
                      >
                        {cell && cell.responseRatePercent > 12 ? `${cell.responseRatePercent}%` : ''}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Strategic Timing Insight:</span>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            Tuesday – Thursday, 10:30 AM – 1:00 PM IST (31.4% Avg Conversion)
          </span>
        </div>
      </div>
    </div>
  );
};
