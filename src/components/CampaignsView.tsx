import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Plus, CheckCircle2, Clock, Play, Pause, AlertCircle, Eye, ArrowRight, Trash2, Loader2, Split } from 'lucide-react';
import { Campaign, ContactList, MessageTemplate, Role, ChannelType } from '../types';
import { ReachOut3DLoader } from './common/ReachOut3DLoader';
import { ABTestingStudioModal } from './ABTestingStudioModal';

interface CampaignsViewProps {
  campaigns: Campaign[];
  lists: ContactList[];
  templates: MessageTemplate[];
  onSelectCampaign: (id: string) => void;
  onCreateCampaign: (data: any) => Promise<any> | void;
  onDeleteCampaign?: (id: string) => Promise<void>;
  onRefresh?: () => void;
  userRole: Role;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  lists,
  templates,
  onSelectCampaign,
  onCreateCampaign,
  onDeleteCampaign,
  userRole
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showABModal, setShowABModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    channel: ChannelType;
    targetListId: string;
    templateId: string;
    isDryRun: boolean;
  }>({
    name: '',
    description: '',
    channel: 'WHATSAPP',
    targetListId: lists[0]?.id || '',
    templateId: templates[0]?.id || '',
    isDryRun: false
  });

  // Auto-sync initial select values when lists or templates load
  React.useEffect(() => {
    if (!formData.targetListId && lists.length > 0) {
      setFormData(prev => ({ ...prev, targetListId: lists[0].id }));
    }
  }, [lists, formData.targetListId]);

  React.useEffect(() => {
    if (!formData.templateId && templates.length > 0) {
      setFormData(prev => ({ ...prev, templateId: templates[0].id, channel: templates[0].channel || prev.channel }));
    }
  }, [templates, formData.templateId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTargetListId = formData.targetListId || lists[0]?.id;
    const finalTemplateId = formData.templateId || templates[0]?.id;

    if (!finalTargetListId || !finalTemplateId) {
      alert('Please select both an audience segment and a message template.');
      return;
    }

    const payload = {
      ...formData,
      targetListId: finalTargetListId,
      templateId: finalTemplateId
    };

    setIsCreating(true);
    setShowCreateModal(false);
    try {
      await onCreateCampaign(payload);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Outreach Campaigns
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Governed communication sequences with immutable snapshots, review gates, and manual dispatches
          </p>
        </div>

        {userRole !== 'VIEWER' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowABModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition shadow-xs cursor-pointer"
            >
              <Split className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>A/B Split Test</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Campaign</span>
            </button>
          </div>
        )}
      </div>

      {/* Campaigns List */}
      <div className="space-y-3">
        {campaigns.map(c => {
          const pct = Math.round((c.sentCount / (c.recipientsCount || 1)) * 100);
          return (
            <div
              key={c.id}
              onClick={() => onSelectCampaign(c.id)}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 transition">
                    {c.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    c.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                      : c.status === 'APPROVED'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                      : c.status === 'REVIEW'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                      : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}>
                    {c.status}
                  </span>
                  {c.isDryRun && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 font-mono font-bold">
                      DRY RUN
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-500 line-clamp-1">
                  {c.description || 'Targeting verified commercial network leads'}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 pt-0.5">
                  <span>Channel: <strong className="text-neutral-600 dark:text-neutral-300">{c.channel}</strong></span>
                  <span>•</span>
                  <span>Target: <strong className="text-neutral-600 dark:text-neutral-300">{c.targetListName}</strong></span>
                  <span>•</span>
                  <span>Template: <strong className="text-neutral-600 dark:text-neutral-300">{c.templateSnapshot.name} (v{c.templateVersion})</strong></span>
                </div>
              </div>

              {/* Progress & Quick Enter */}
              <div className="flex items-center gap-5">
                <div className="w-36 space-y-1 text-right">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 text-[11px]">Confirmed Sent</span>
                    <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {c.sentCount} / {c.recipientsCount}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-neutral-900 dark:bg-neutral-100 h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <button className="px-3 py-1.5 rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900 transition">
                  <span>Inspect</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {userRole !== 'VIEWER' && onDeleteCampaign && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete campaign "${c.name}"? This action will permanently remove all recipients and campaign metrics.`)) {
                        setDeletingId(c.id);
                        try {
                          await onDeleteCampaign(c.id);
                        } finally {
                          setDeletingId(null);
                        }
                      }
                    }}
                    disabled={deletingId === c.id}
                    className="p-1.5 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50 cursor-pointer"
                    title="Delete Campaign"
                  >
                    {deletingId === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3D Realistic Animated Loader for Campaign Initialization */}
      {isCreating && (
        <ReachOut3DLoader
          variant="modal"
          title="Initializing Campaign"
          subtitle={`Compiling Audience & Message Queue for ${formData.name || 'New Campaign'}`}
          steps={[
            "Resolving Dynamic Liquid Tags & Personalization...",
            "Validating WhatsApp E.164 Phone Normalization...",
            "Enforcing Opt-Out & Regulatory Guardrails...",
            "Registering Governed Campaign in PostgreSQL..."
          ]}
        />
      )}

      {/* Modal: Create Campaign */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Create Governed Outreach Campaign
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Snapshots the chosen template and builds the recipient queue in DRAFT state.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-400">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 font-medium mb-1">Campaign Title *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  placeholder="e.g. Telangana Moringa Bulk Distributor Outreach"
                />
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Operational Goal / Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  placeholder="Introduce product offerings to qualified retail and distribution partners..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Audience Segment *</label>
                  <select
                    value={formData.targetListId}
                    onChange={(e) => setFormData({ ...formData, targetListId: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  >
                    {lists.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.contactIds.length} leads)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Message Template *</label>
                  <select
                    value={formData.templateId}
                    onChange={(e) => {
                      const sel = templates.find(t => t.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        templateId: e.target.value,
                        channel: sel ? sel.channel : formData.channel
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (v{t.version}) - {t.channel}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDryRun}
                    onChange={(e) => setFormData({ ...formData, isDryRun: e.target.checked })}
                    className="rounded"
                  />
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Campaign Dry-Run Mode
                  </span>
                </label>
                <p className="text-[11px] text-neutral-500 pl-5">
                  Pre-generates all variable resolutions and policy validations without opening any external composer.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold shadow-sm"
                >
                  Initialize Campaign
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: A/B Testing Split Studio */}
      <ABTestingStudioModal
        isOpen={showABModal}
        lists={lists}
        templates={templates}
        onClose={() => setShowABModal(false)}
        onCreatedSuccess={() => {
          setShowABModal(false);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
