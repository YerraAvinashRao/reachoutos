import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Paperclip, 
  Clock, 
  Eye, 
  Edit3, 
  Trash2, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { MessageTemplate, Role, ChannelType } from '../types';
import { DataQualityEngine } from '../core/validation/dataQuality';

interface TemplatesViewProps {
  templates: MessageTemplate[];
  onCreateTemplate: (data: any) => void;
  onUpdateTemplate: (id: string, data: any) => void;
  onDeleteTemplate: (id: string) => void;
  userRole: Role;
  onOpenAICopilotWithTemplate: (text: string) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  userRole,
  onOpenAICopilotWithTemplate
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    channel: ChannelType;
    category: any;
    subject: string;
    body: string;
    attachmentName: string;
  }>({
    name: '',
    channel: 'WHATSAPP',
    category: 'INTRODUCTION',
    subject: '',
    body: '',
    attachmentName: ''
  });

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      channel: 'WHATSAPP',
      category: 'INTRODUCTION',
      subject: '',
      body: 'Hello {{first_name}},\n\nWe would like to introduce our products to your business in {{city}}.\n\nWould you like a sample kit delivered to {{company_name}} this week?\n\nBest regards,\nOutreach Team',
      attachmentName: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (t: MessageTemplate) => {
    setEditingTemplate(t);
    setFormData({
      name: t.name,
      channel: t.channel,
      category: t.category,
      subject: t.subject || '',
      body: t.body,
      attachmentName: t.attachmentName || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, formData);
    } else {
      onCreateTemplate(formData);
    }
    setShowModal(false);
  };

  // Preview data
  const sampleData = {
    first_name: 'Rajesh',
    last_name: 'Kumar',
    company_name: 'Rajesh Traders',
    city: 'Nizamabad'
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Message Templates & Versions
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Immutable versioned copy with dynamic placeholders and attachment definitions
          </p>
        </div>

        {userRole !== 'VIEWER' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Template</span>
          </button>
        )}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(tpl => {
          const { resolved } = DataQualityEngine.resolveTemplateVariables(tpl.body, sampleData);
          return (
            <div
              key={tpl.id}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                        {tpl.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 font-semibold text-neutral-700 dark:text-neutral-300">
                        v{tpl.version}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Channel: {tpl.channel} • Category: {tpl.category}
                    </div>
                  </div>

                  {userRole !== 'VIEWER' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(tpl)}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                        title="Edit (creates new version)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteTemplate(tpl.id)}
                        className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {tpl.subject && (
                  <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 border-l-2 border-neutral-300 dark:border-neutral-700 pl-2 py-0.5">
                    Subject: {tpl.subject}
                  </div>
                )}

                {/* Body Preview */}
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 text-xs font-sans whitespace-pre-line text-neutral-700 dark:text-neutral-300 leading-relaxed max-h-36 overflow-y-auto">
                  {tpl.body}
                </div>

                {/* Attachment Badge */}
                {tpl.attachmentName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono bg-neutral-100/60 dark:bg-neutral-800/40 px-2 py-1 rounded">
                    <Paperclip className="w-3 h-3 text-neutral-400" />
                    <span>{tpl.attachmentName}</span>
                    {tpl.attachmentSize && <span className="text-neutral-400">({tpl.attachmentSize})</span>}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-neutral-400">
                  Updated: {new Date(tpl.updatedAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => onOpenAICopilotWithTemplate(tpl.body)}
                  className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Improve with Copilot</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create or Edit Template */}
      {showModal && (
        <div className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {editingTemplate ? `Update Template (Bumps to v${editingTemplate.version + 1})` : 'Create Reusable Template'}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Versioned templates prevent retrospective corruption of past campaigns.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-neutral-400">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  placeholder="e.g. YAR Honey Retailer Introduction"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Channel</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="INTRODUCTION">INTRODUCTION</option>
                    <option value="FOLLOW_UP">FOLLOW UP</option>
                    <option value="PRICING">PRICING</option>
                    <option value="CATALOG">CATALOG</option>
                    <option value="FESTIVE">FESTIVE</option>
                  </select>
                </div>
              </div>

              {formData.channel === 'EMAIL' && (
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Email Subject Line</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    placeholder="e.g. Wholesale Supply Partnership Inquiry"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-500 font-medium">Message Body & Variables</label>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    Supported: &#123;&#123;first_name&#125;&#125;, &#123;&#123;company_name&#125;&#125;, &#123;&#123;city&#125;&#125;
                  </div>
                </div>
                <textarea
                  rows={6}
                  required
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-sans focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Attachment File Name (Optional)</label>
                <input
                  type="text"
                  value={formData.attachmentName}
                  onChange={(e) => setFormData({ ...formData, attachmentName: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  placeholder="e.g. yar_honey_catalog_2026.pdf"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold shadow-sm"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
