import React, { useState } from 'react';
import { 
  Split, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  Loader2, 
  Layers, 
  TrendingUp, 
  FileText 
} from 'lucide-react';
import { MessageTemplate, ContactList, Role } from '../types';
import { apiClient } from '../services/apiClient';

interface ABTestingStudioModalProps {
  isOpen: boolean;
  lists: ContactList[];
  templates: MessageTemplate[];
  onClose: () => void;
  onCreatedSuccess: () => void;
}

export const ABTestingStudioModal: React.FC<ABTestingStudioModalProps> = ({
  isOpen,
  lists,
  templates,
  onClose,
  onCreatedSuccess
}) => {
  const [campaignName, setCampaignName] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [variants, setVariants] = useState<Array<{ name: string; templateId: string }>>([
    { name: 'Variant A (Value Proposition Hook)', templateId: templates[0]?.id || '' },
    { name: 'Variant B (Direct Margin & Price Slab)', templateId: templates[1]?.id || templates[0]?.id || '' }
  ]);
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleAddVariant = () => {
    if (variants.length >= 4) return;
    const nextLetter = String.fromCharCode(65 + variants.length);
    setVariants(prev => [
      ...prev,
      { name: `Variant ${nextLetter} (Custom Hook)`, templateId: templates[0]?.id || '' }
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 2) return;
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || !selectedListId) return;
    setCreating(true);

    try {
      const populatedVariants = variants.map(v => {
        const t = templates.find(item => item.id === v.templateId);
        return {
          name: v.name,
          templateId: v.templateId,
          templateSnapshot: t ? {
            name: t.name,
            subject: t.subject,
            body: t.body,
            attachmentName: t.attachmentName
          } : { name: v.name, body: 'Hello {{first_name}}, inquiry regarding our wholesale products.' }
        };
      });

      await apiClient.createABTestCampaign({
        name: campaignName,
        channel,
        targetListId: selectedListId,
        variants: populatedVariants
      });

      onCreatedSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to launch A/B test campaign');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Launch A/B Variant Test Campaign
              </h3>
              <p className="text-[11px] text-neutral-500">
                Evenly split your target list across 2 to 4 copy variants to identify highest conversion
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white p-1">✕</button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Campaign Name:
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Hyderabad Retailers A/B Pitch Test"
              className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Target Contact List:
              </label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-hidden"
                required
              >
                <option value="">-- Choose Target List --</option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Outreach Channel:
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-hidden"
              >
                <option value="WHATSAPP">WhatsApp Manual Dispatch</option>
                <option value="EMAIL">Email Manual Dispatch</option>
              </select>
            </div>
          </div>

          {/* Variants Builder */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                Split Variants ({variants.length} Allocated {Math.round(100 / variants.length)}% each):
              </label>
              {variants.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Variant</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-indigo-600 font-mono">
                      Allocation: {Math.round(100 / variants.length)}%
                    </span>
                    {variants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(idx)}
                        className="text-neutral-400 hover:text-rose-600 text-xs cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVariants(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                    }}
                    placeholder="Variant Name"
                    className="w-full p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold"
                    required
                  />

                  <select
                    value={v.templateId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVariants(prev => prev.map((item, i) => i === idx ? { ...item, templateId: val } : item));
                    }}
                    className="w-full p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                    required
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>Template: {t.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Split className="w-3.5 h-3.5" />}
            <span>Launch A/B Split Campaign</span>
          </button>
        </div>
      </form>
    </div>
  );
};
