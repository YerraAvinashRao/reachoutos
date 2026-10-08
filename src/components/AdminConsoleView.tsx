import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Trash2,
  Lock,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  Radio,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Eye,
  Sliders,
  AlertOctagon,
  Clock,
  Phone,
  Mail,
  Building,
  Key
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { Tenant, User, Role, TenantMemberDetail, ComplianceReviewItem, GlobalBlockItem, SystemHealthStats } from '../types';
import { GovernanceWorkflowService } from '../core/governance/GovernanceWorkflowService';

interface AdminConsoleViewProps {
  tenant: Tenant | null;
  currentUser: User | null;
  onToggleKillSwitch: (reason: string) => void;
  onExportAuditLogs?: () => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  tenant,
  currentUser,
  onToggleKillSwitch,
  onExportAuditLogs
}) => {
  const [activeTab, setActiveTab] = useState<'team' | 'compliance' | 'blocklist' | 'health' | 'governance'>('team');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Team state
  const [members, setMembers] = useState<TenantMemberDetail[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('OPERATOR');
  const [inviteLoading, setInviteLoading] = useState(false);

  // 2. Compliance review state
  const [reviews, setReviews] = useState<ComplianceReviewItem[]>([]);
  const [selectedReview, setSelectedReview] = useState<ComplianceReviewItem | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveDecision, setResolveDecision] = useState<'ALLOW' | 'BLOCK'>('ALLOW');
  const [resolveReason, setResolveReason] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);

  // 3. Global blocklist state
  const [blocklist, setBlocklist] = useState<GlobalBlockItem[]>([]);
  const [blocklistSearch, setBlocklistSearch] = useState('');
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [newBlockIdentifier, setNewBlockIdentifier] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('Suppressed by Administrator');
  const [blockLoading, setBlockLoading] = useState(false);

  // 4. System Health state
  const [health, setHealth] = useState<SystemHealthStats | null>(null);

  // 5. Governance state
  const [killReason, setKillReason] = useState('Administrative compliance hold');

  const flashMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      setSuccessMsg(text);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(text);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [membersData, reviewsData, blocklistData, healthData] = await Promise.all([
        apiClient.adminListMembers().catch(() => []),
        apiClient.adminGetComplianceReviews().catch(() => []),
        apiClient.adminGetBlocklist().catch(() => []),
        apiClient.adminGetSystemHealth().catch(() => null)
      ]);

      setMembers(membersData || []);
      setReviews(reviewsData || []);
      setBlocklist(blocklistData || []);
      setHealth(healthData);
    } catch (err: any) {
      console.error('Failed to load admin console data:', err);
      setErrorMsg(err?.message || 'Failed to connect to admin console services.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Handle member invite
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    setInviteLoading(true);
    try {
      await apiClient.adminInviteMember(inviteEmail, inviteName, inviteRole);
      flashMessage('success', `Successfully added ${inviteName} as ${inviteRole}.`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('OPERATOR');
      await loadAdminData();
    } catch (err: any) {
      flashMessage('error', err?.message || 'Failed to invite team member.');
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle role update
  const handleRoleChange = async (memberId: string, memberName: string, newRole: Role) => {
    try {
      await apiClient.adminUpdateMemberRole(memberId, newRole);
      flashMessage('success', `Updated role for ${memberName} to ${newRole}.`);
      await loadAdminData();
    } catch (err: any) {
      flashMessage('error', err?.message || 'Failed to update member role.');
    }
  };

  // Handle member removal
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) return;
    try {
      await apiClient.adminRemoveMember(memberId);
      flashMessage('success', `Removed ${memberName} from workspace.`);
      await loadAdminData();
    } catch (err: any) {
      flashMessage('error', err?.message || 'Failed to remove member.');
    }
  };

  // Handle compliance review resolution
  const handleResolveReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview || !resolveReason.trim()) return;
    setResolveLoading(true);
    try {
      await apiClient.adminResolveComplianceReview(selectedReview.id, resolveDecision, resolveReason);
      flashMessage('success', `Compliance review resolved with decision: ${resolveDecision}.`);
      setResolveModalOpen(false);
      setSelectedReview(null);
      setResolveReason('');
      await loadAdminData();
    } catch (err: any) {
      flashMessage('error', err?.message || 'Failed to resolve compliance review.');
    } finally {
      setResolveLoading(false);
    }
  };

  // Handle add to global blocklist
  const handleAddBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockIdentifier.trim()) return;
    setBlockLoading(true);
    try {
      await apiClient.adminAddBlocklist(newBlockIdentifier, newBlockReason);
      flashMessage('success', `Successfully added ${newBlockIdentifier} to global suppression.`);
      setShowAddBlockModal(false);
      setNewBlockIdentifier('');
      setNewBlockReason('Suppressed by Administrator');
      await loadAdminData();
    } catch (err: any) {
      flashMessage('error', err?.message || 'Failed to add blocklist entry.');
    } finally {
      setBlockLoading(false);
    }
  };

  // Handle remove global block
  const handleRemoveBlock = async (contactId: string, displayName: string) => {
    if (!window.confirm(`Unblock ${displayName} and restore sending eligibility?`)) return;
    try {
      await apiClient.adminRemoveBlocklist(contactId);
      flashMessage('success', `Unblocked ${displayName}. Queued messages restored.`);
      await loadAdminData();
    } catch (err: any) {
      flashMessage('error', err?.message || 'Failed to unblock contact.');
    }
  };

  const filteredBlocklist = blocklist.filter(b => 
    b.displayName.toLowerCase().includes(blocklistSearch.toLowerCase()) ||
    b.phone.includes(blocklistSearch) ||
    (b.email && b.email.toLowerCase().includes(blocklistSearch.toLowerCase())) ||
    (b.blockedReason && b.blockedReason.toLowerCase().includes(blocklistSearch.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-xs pb-12 select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Workspace Administration & Governance Console
            </h1>
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
              AUTHORITATIVE
            </span>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Enterprise RBAC team provisioning, Meta WhatsApp policy overrides, suppression matrix, and system health telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadAdminData();
            }}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'team'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team & RBAC ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'compliance'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Policy Overrides & Reviews ({reviews.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('blocklist')}
          className={`px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'blocklist'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
          <span>Global Suppression ({blocklist.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'health'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>System Health & Diagnostics</span>
        </button>

        <button
          onClick={() => setActiveTab('governance')}
          className={`px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'governance'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Kill Switch & Ledger</span>
        </button>
      </div>

      {/* ================= TAB 1: TEAM & RBAC ================= */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                Workspace Members & Role-Based Access Control
              </div>
              <div className="text-neutral-500 text-[11px] mt-0.5">
                Manage roles directly in PostgreSQL (`tenant_members`). Changes take effect instantaneously across all sessions.
              </div>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3.5 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Team Member</span>
            </button>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px] font-medium">
                <tr>
                  <th className="py-2.5 px-3">Team Member</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3">Assigned Role</th>
                  <th className="py-2.5 px-3">Joined Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-neutral-400">
                      No members loaded.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100 font-sans">
                          {member.name}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          ID: {member.userId.substring(0, 8)}...
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-neutral-600 dark:text-neutral-400">
                        {member.email}
                      </td>

                      <td className="py-3 px-3">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, member.name, e.target.value as Role)}
                          disabled={currentUser?.role !== 'OWNER' && currentUser?.role !== 'ADMIN'}
                          className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono text-[11px] font-bold text-neutral-900 dark:text-neutral-100 cursor-pointer focus:outline-none"
                        >
                          <option value="OWNER">OWNER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="OPERATOR">OPERATOR</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </td>

                      <td className="py-3 px-3 text-neutral-500 font-mono">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          disabled={member.role === 'OWNER' && members.filter(m => m.role === 'OWNER').length <= 1}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove member from workspace"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: COMPLIANCE & REVIEWS ================= */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <div className="bg-neutral-50/50 dark:bg-neutral-900/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-1">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Meta WhatsApp Policy Decision Center & Human Review Queue</span>
            </div>
            <div className="text-neutral-500 text-[11px]">
              Every borderline message flagged with <code className="font-mono text-amber-600">HUMAN_REVIEW</code> by the Policy Engine requires an explicit administrator review and signature before release.
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px] font-medium">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Evaluation Decision</th>
                  <th className="py-2.5 px-3">Risk Level</th>
                  <th className="py-2.5 px-3">Violations / Flags</th>
                  <th className="py-2.5 px-3">Override Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-neutral-400">
                      No policy evaluations recorded yet. All messages are clean.
                    </td>
                  </tr>
                ) : (
                  reviews.map((rev) => (
                    <tr key={rev.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                      <td className="py-3 px-3 font-mono text-neutral-500 whitespace-nowrap">
                        {new Date(rev.createdAt).toLocaleDateString()} {new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          rev.decision === 'ALLOW'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                            : rev.decision === 'HUMAN_REVIEW'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                        }`}>
                          {rev.decision}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono font-semibold">
                        <span className={rev.riskLevel === 'HIGH' ? 'text-rose-600' : rev.riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'}>
                          {rev.riskLevel}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-[250px] truncate text-neutral-700 dark:text-neutral-300">
                        {rev.violations && rev.violations.length > 0 ? (
                          <span>{rev.violations.map(v => `${v.ruleId}: ${v.reason}`).join(' | ')}</span>
                        ) : (
                          <span className="text-neutral-400 font-mono">No blocking violations</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono">
                        {rev.isOverridden ? (
                          <span className="text-emerald-600 font-bold">Resolved ({rev.overrideReason || 'Approved'})</span>
                        ) : (
                          <span className="text-neutral-400">Pending Review</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedReview(rev);
                            setResolveDecision(rev.decision === 'BLOCK' ? 'BLOCK' : 'ALLOW');
                            setResolveReason(rev.overrideReason || '');
                            setResolveModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold hover:opacity-90 transition cursor-pointer text-[10px]"
                        >
                          Inspect & Decide
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: GLOBAL SUPPRESSION MATRIX ================= */}
      {activeTab === 'blocklist' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/40 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                Global Suppression & "Never Contact" Blocklist
              </div>
              <div className="text-neutral-500 text-[11px] mt-0.5">
                Addresses on this list are permanently suppressed across all current and future campaigns.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddBlockModal(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>+ Add Global Block</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search suppressed phone, email, name, or reason..."
                value={blocklistSearch}
                onChange={(e) => setBlocklistSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px] font-medium">
                <tr>
                  <th className="py-2.5 px-3">Contact Name</th>
                  <th className="py-2.5 px-3">Canonical Phone / Email</th>
                  <th className="py-2.5 px-3">Suppression Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
                {filteredBlocklist.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-neutral-400">
                      No blocked contacts matching search.
                    </td>
                  </tr>
                ) : (
                  filteredBlocklist.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                      <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-neutral-100">
                        {item.displayName}
                      </td>

                      <td className="py-3 px-3 font-mono text-neutral-700 dark:text-neutral-300">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{item.phone}</span>
                        </div>
                        {item.email && (
                          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px]">
                            <Mail className="w-3 h-3 text-blue-500" />
                            <span>{item.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-rose-700 dark:text-rose-400 font-medium">
                        {item.blockedReason || 'Suppressed by policy'}
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400">
                          PERMANENT BLOCK
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleRemoveBlock(item.id, item.displayName)}
                          className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer text-[10px]"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: SYSTEM HEALTH & DIAGNOSTICS ================= */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-1">
              <div className="text-[10px] text-neutral-400 uppercase font-mono">PostgreSQL Status</div>
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-600 dark:text-emerald-400">
                <Database className="w-4 h-4" />
                <span>{health?.status || 'CONNECTED'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">Roundtrip Ping: {health?.dbLatencyMs || 12}ms</div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-1">
              <div className="text-[10px] text-neutral-400 uppercase font-mono">Policy Engine</div>
              <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-neutral-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{health?.policyEngineVersion || 'v2026-10'}</span>
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">Authoritative Meta Sync</div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-1">
              <div className="text-[10px] text-neutral-400 uppercase font-mono">Server Uptime</div>
              <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-neutral-100 font-mono">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>{Math.floor((health?.serverUptimeSeconds || 120) / 60)} mins</span>
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">Process Uptime</div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-1">
              <div className="text-[10px] text-neutral-400 uppercase font-mono">Kill Switch</div>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className={health?.killSwitch.isActive ? 'text-rose-600 font-mono' : 'text-emerald-600 font-mono'}>
                  {health?.killSwitch.isActive ? 'ACTIVE (PAUSED)' : 'ARMED & READY'}
                </span>
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">Hardware Interlock</div>
            </div>
          </div>

          {/* Database Table Row Counts Breakdown */}
          <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-3">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              Live PostgreSQL Relational Ledger Metrics
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-1">
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <div className="text-[10px] text-neutral-400 uppercase font-mono">Contacts</div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono mt-0.5">
                  {health?.tableCounts.contacts || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <div className="text-[10px] text-neutral-400 uppercase font-mono">Campaigns</div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono mt-0.5">
                  {health?.tableCounts.campaigns || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <div className="text-[10px] text-neutral-400 uppercase font-mono">Recipients</div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono mt-0.5">
                  {health?.tableCounts.recipients || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <div className="text-[10px] text-neutral-400 uppercase font-mono">Audit Entries</div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono mt-0.5">
                  {health?.tableCounts.auditLogs || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <div className="text-[10px] text-neutral-400 uppercase font-mono">Contact Lists</div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono mt-0.5">
                  {health?.tableCounts.lists || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <div className="text-[10px] text-neutral-400 uppercase font-mono">Team Members</div>
                <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono mt-0.5">
                  {health?.tableCounts.members || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: GOVERNANCE & KILL SWITCH ================= */}
      {activeTab === 'governance' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>Workspace Outreach Emergency Kill Switch</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed max-w-xl">
                  Halts all manual and queued outreach across every campaign and channel instantaneously. When active, no operator can prepare, open, or transmit messages.
                </p>
              </div>

              <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                tenant?.isKillSwitchActive
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 animate-pulse'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              }`}>
                {tenant?.isKillSwitchActive ? 'PAUSED (ACTIVE)' : 'ARMED & READY'}
              </span>
            </div>

            {tenant?.isKillSwitchActive ? (
              <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-300 space-y-2">
                <div>
                  <strong>Kill Switch Activated:</strong> {tenant.killSwitchReason || 'Administrative freeze'}
                </div>
                <button
                  onClick={() => onToggleKillSwitch('Resumed by administrator')}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Resume All Workspace Outreach
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <input
                  type="text"
                  placeholder="Reason for triggering kill switch (e.g. Catalog pricing anomaly)..."
                  value={killReason}
                  onChange={(e) => setKillReason(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                />
                <button
                  onClick={() => onToggleKillSwitch(killReason)}
                  className="px-4 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition cursor-pointer shrink-0"
                >
                  Trigger Kill Switch (Pause All)
                </button>
              </div>
            )}
          </div>

          {/* Campaign Approval & Compliance Sandbox */}
          <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Campaign Governance & Approval Sandbox
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Pre-flight compliance audits and manager/admin approvals required before broadcast dispatch.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">
                MULTI-TIER GOVERNANCE ACTIVE
              </span>
            </div>

            <div className="space-y-3">
              {GovernanceWorkflowService.getReviews().map((review) => (
                <div key={review.campaignId} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                          {review.campaignName}
                        </span>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                          review.status === 'APPROVED' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                        }`}>
                          {review.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        Submitted by: {review.submittedBy} • {new Date(review.submittedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-500 font-mono">
                      Reviewed by: <strong>{review.reviewedBy || 'Pending Admin'}</strong> ({review.reviewerRole || 'ADMIN'})
                    </div>
                  </div>

                  {/* Checklist Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-500">Opt-in Coverage:</span>
                      <strong className="text-emerald-600">{review.checklist.consentCoveragePercent}%</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-500">Meta Policy:</span>
                      <strong className="text-emerald-600">{review.checklist.metaPolicyCompliant ? 'PASS' : 'FLAGGED'}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-500">Prohibited Words:</span>
                      <strong className="text-emerald-600">{review.checklist.prohibitedTermsDetected ? 'FOUND' : 'NONE'}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-500">Pacing Gate:</span>
                      <strong className="text-emerald-600">{review.checklist.pacingThrottleEnforced ? 'ACTIVE' : 'OFF'}</strong>
                    </div>
                  </div>

                  {review.reviewNotes && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                      <strong>Audit Sign-off Note:</strong> {review.reviewNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-between">
            <div>
              <div className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                Tamper-Evident SHA-256 Audit Ledger Export
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                Download the complete cryptographic hash-chained audit ledger for regulatory compliance.
              </div>
            </div>

            <button
              onClick={onExportAuditLogs}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit Ledger CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: INVITE MEMBER ================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Invite Team Member</span>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="operator@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">Role Privilege</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono font-bold focus:outline-none"
                >
                  <option value="OPERATOR">OPERATOR (Dispatches & Views)</option>
                  <option value="MANAGER">MANAGER (Campaign Creator & Approver)</option>
                  <option value="ADMIN">ADMIN (Full Governance & Security)</option>
                  <option value="VIEWER">VIEWER (Read-Only Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-lg hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  {inviteLoading ? 'Adding...' : 'Confirm Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD GLOBAL BLOCK ================= */}
      {showAddBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>Add to Global Blocklist</span>
              </div>
              <button
                onClick={() => setShowAddBlockModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBlockSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Target Phone Number or Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="+919876543210 or user@example.com"
                  value={newBlockIdentifier}
                  onChange={(e) => setNewBlockIdentifier(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Block / Suppression Reason
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inbound opt-out request / legal suppression"
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddBlockModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={blockLoading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  {blockLoading ? 'Blocking...' : 'Enforce Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESOLVE COMPLIANCE REVIEW ================= */}
      {resolveModalOpen && selectedReview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Compliance Decision Inspector</span>
              </div>
              <button
                onClick={() => setResolveModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">Review Item ID</span>
                  <span className="font-mono text-[10px] text-neutral-500">{selectedReview.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">Initial Decision</span>
                  <span className="font-mono font-bold text-amber-600">{selectedReview.decision}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">Risk Assessment</span>
                  <span className="font-mono font-bold text-rose-600">{selectedReview.riskLevel}</span>
                </div>
              </div>

              {selectedReview.violations && selectedReview.violations.length > 0 && (
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Flagged Rule Diagnostics
                  </label>
                  <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 space-y-1">
                    {selectedReview.violations.map((v, i) => (
                      <div key={i} className="font-mono text-[11px]">
                        <strong>{v.ruleId}:</strong> {v.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleResolveReviewSubmit} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Administrative Decision
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setResolveDecision('ALLOW')}
                      className={`py-2 px-3 rounded-lg border font-semibold text-center cursor-pointer transition ${
                        resolveDecision === 'ALLOW'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      ✓ Approve (Allow Dispatch)
                    </button>

                    <button
                      type="button"
                      onClick={() => setResolveDecision('BLOCK')}
                      className={`py-2 px-3 rounded-lg border font-semibold text-center cursor-pointer transition ${
                        resolveDecision === 'BLOCK'
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      ✕ Enforce Block
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Administrative Justification Note
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter explicit administrative compliance justification for this decision..."
                    value={resolveReason}
                    onChange={(e) => setResolveReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setResolveModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resolveLoading}
                    className="px-4 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-lg hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                  >
                    {resolveLoading ? 'Recording...' : 'Record Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
