import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause, 
  Trash2, 
  ExternalLink, 
  Users, 
  Send, 
  Sparkles, 
  ChevronRight, 
  ArrowRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  Layers,
  Check
} from 'lucide-react';
import { CadenceSequence, CadenceStep, ContactList, Contact, Role, MessageTemplate } from '../types';
import { apiClient } from '../services/apiClient';
import { DataQualityEngine } from '../core/validation/dataQuality';
import { DripSequenceEngine } from '../core/cadence/DripSequenceEngine';

interface CadencesViewProps {
  lists: ContactList[];
  contacts: Contact[];
  templates: MessageTemplate[];
  userRole: Role;
  onOpenComposer?: (phone: string, text: string) => void;
}

export const CadencesView: React.FC<CadencesViewProps> = ({
  lists,
  contacts,
  templates,
  userRole,
  onOpenComposer
}) => {
  const [activeTab, setActiveTab] = useState<'due_today' | 'sequences'>('due_today');
  const [cadences, setCadences] = useState<CadenceSequence[]>([]);
  const [dueToday, setDueToday] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCadenceForEnroll, setSelectedCadenceForEnroll] = useState<CadenceSequence | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollSuccessMsg, setEnrollSuccessMsg] = useState<string | null>(null);

  // New Cadence Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formChannel, setFormChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [formSteps, setFormSteps] = useState<CadenceStep[]>([
    { stepNumber: 1, delayDays: 0, title: 'Step 1: Introduction & Product Overview', templateId: templates[0]?.id },
    { stepNumber: 2, delayDays: 3, title: 'Step 2: Margin & Wholesale Catalog Follow-up', templateId: templates[1]?.id || templates[0]?.id },
    { stepNumber: 3, delayDays: 5, title: 'Step 3: Sample Kit & Reconnection Check-in', templateId: templates[2]?.id || templates[0]?.id }
  ]);
  const [formAutoExit, setFormAutoExit] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cadenceRes, dueRes] = await Promise.all([
        apiClient.getCadences(),
        apiClient.getCadenceDueToday()
      ]);
      setCadences(cadenceRes || []);
      setDueToday(dueRes || []);
    } catch (err) {
      console.warn('Failed to load cadence data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCadence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);

    try {
      const populatedSteps = formSteps.map(s => {
        const tpl = templates.find(t => t.id === s.templateId);
        return {
          ...s,
          templateSnapshot: tpl ? {
            name: tpl.name,
            subject: tpl.subject,
            body: tpl.body,
            attachmentName: tpl.attachmentName
          } : { body: 'Hello {{first_name}}, following up on our earlier note.' }
        };
      });

      await apiClient.createCadence({
        name: formName,
        description: formDescription,
        channel: formChannel,
        steps: populatedSteps,
        autoExitOnReply: formAutoExit
      });

      setShowCreateModal(false);
      setFormName('');
      setFormDescription('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create cadence sequence');
    } finally {
      setCreating(false);
    }
  };

  const handleEnrollList = async () => {
    if (!selectedCadenceForEnroll || !selectedListId) return;
    setEnrolling(true);
    try {
      const listContacts = contacts.filter(c => c.status === 'ACTIVE' && !c.isGloballyBlocked);
      const contactIds = listContacts.map(c => c.id);
      const res = await apiClient.enrollContactsInCadence(selectedCadenceForEnroll.id, contactIds);
      setEnrollSuccessMsg(`✓ Enrolled ${res?.enrolledCount || contactIds.length} contacts into sequence!`);
      setTimeout(() => {
        setEnrollSuccessMsg(null);
        setShowEnrollModal(false);
      }, 2000);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to enroll contacts');
    } finally {
      setEnrolling(false);
    }
  };

  const handleAdvance = async (enrollmentId: string) => {
    try {
      // Optimistic UI update: remove from due today immediately
      setDueToday(prev => prev.filter(item => item.id !== enrollmentId));
      await apiClient.advanceCadenceStep(enrollmentId);
    } catch (err: any) {
      console.error('Failed to advance cadence step:', err);
      loadData();
    }
  };

  const handleDispatchStep = (item: any) => {
    const contact = contacts.find(c => c.id === item.contactId);
    const rawBody = item.stepTemplate?.body || 'Hello {{first_name}}, following up on our previous note.';
    const contactData = {
      first_name: contact?.firstName || item.contactName?.split(' ')[0] || '',
      last_name: contact?.lastName || '',
      name: contact?.displayName || item.contactName,
      company: contact?.companyName || item.companyName || '',
      company_name: contact?.companyName || item.companyName || '',
      city: contact?.city || '',
      phone: item.phone,
      email: item.email
    };
    const resolved = DataQualityEngine.resolveTemplateVariables(rawBody, contactData).resolved;

    if (item.channel === 'WHATSAPP') {
      const digits = (item.phone || '').replace(/\D/g, '');
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(resolved)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const url = `mailto:${item.email}?subject=${encodeURIComponent(item.stepTitle)}&body=${encodeURIComponent(resolved)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Auto advance step upon dispatch
    handleAdvance(item.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Multi-Touch Follow-Up Cadences</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Automated multi-step outreach timelines with auto-exit on customer response and unified daily queues
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition shadow-xs cursor-pointer"
            title="Refresh cadence queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {userRole !== 'VIEWER' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Sequence</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          onClick={() => setActiveTab('due_today')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'due_today'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Daily Dispatch Queue</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            activeTab === 'due_today' ? 'bg-indigo-700 text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
          }`}>
            {dueToday.length} Due
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sequences')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'sequences'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Sequence Blueprints</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            activeTab === 'sequences' ? 'bg-indigo-700 text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
          }`}>
            {cadences.length}
          </span>
        </button>
      </div>

      {/* TAB 1: DUE TODAY DAILY DISPATCH QUEUE */}
      {activeTab === 'due_today' && (
        <div className="space-y-3">
          {dueToday.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Daily Cadence Queue Up to Date!
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  All scheduled follow-up steps for today have been dispatched or no contacts are due.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px] font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Contact & Company</th>
                    <th className="py-2.5 px-3">Sequence</th>
                    <th className="py-2.5 px-3">Touchpoint</th>
                    <th className="py-2.5 px-3">Channel & Address</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {dueToday.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100">
                          {item.contactName}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {item.companyName || '—'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {item.cadenceName}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Step {item.currentStep} of {item.totalSteps}
                          </span>
                          <span className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate max-w-[150px]">
                            {item.stepTitle}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span className="text-emerald-600 font-semibold">{item.channel}</span>: {item.phone || item.email}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAdvance(item.id)}
                            className="px-2.5 py-1 rounded text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                          >
                            Skip Step
                          </button>

                          <button
                            onClick={() => handleDispatchStep(item)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>1-Click Open & Advance</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SEQUENCE BLUEPRINTS */}
      {activeTab === 'sequences' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cadences.map((cadence) => (
            <div
              key={cadence.id}
              className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      {cadence.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {cadence.description || 'Multi-touch cadence sequence'}
                    </p>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {cadence.channel}
                  </span>
                </div>

                {/* Steps Visual Timeline */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold">
                    Timeline ({cadence.steps.length} Steps):
                  </span>
                    <div className="space-y-1.5">
                      {cadence.steps.map((s, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center font-mono">
                              {s.stepNumber}
                            </span>
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                              {s.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {idx === 0 ? 'GATE: ALWAYS' : 'GATE: IF NOT REPLIED'}
                            </span>
                            <span className="text-neutral-400">
                              {s.delayDays === 0 ? 'Day 1' : `+${s.delayDays}d`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 font-mono">
                  <span>Enrolled: <strong>{cadence.enrolledCount || 0}</strong> contacts</span>
                  <span>Auto-Exit on Reply: <strong className="text-emerald-600">{cadence.autoExitOnReply ? 'YES' : 'NO'}</strong></span>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setSelectedCadenceForEnroll(cadence);
                    setShowEnrollModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Enroll Contact List</span>
                </button>

                {userRole !== 'VIEWER' && (
                  <button
                    onClick={async () => {
                      if (confirm(`Delete sequence "${cadence.name}"?`)) {
                        await apiClient.deleteCadence(cadence.id);
                        loadData();
                      }
                    }}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 transition"
                    title="Delete sequence"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ENROLL CONTACT LIST MODAL */}
      {showEnrollModal && selectedCadenceForEnroll && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Enroll in Sequence: {selectedCadenceForEnroll.name}</span>
              </h3>
              <button onClick={() => setShowEnrollModal(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-neutral-700 dark:text-neutral-300">
                Select Target Audience / List:
              </label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-hidden"
              >
                <option value="">-- Choose Target List --</option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({contacts.length} contacts)</option>
                ))}
              </select>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 leading-relaxed text-[11px]">
                Enrolling contacts will schedule <strong>Step 1</strong> for dispatch today in the Daily Dispatch Queue. Future steps will automatically trigger based on your defined intervals.
              </div>

              {enrollSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold text-center">
                  {enrollSuccessMsg}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollList}
                disabled={!selectedListId || enrolling}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {enrolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm Enrollment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CADENCE SEQUENCE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCadence} className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-indigo-600" />
                <span>Create Multi-Touch Sequence Blueprint</span>
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Sequence Name:
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Retailer Wholesale Onboarding Cadence"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Description:
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. 3-touch cadence converting raw leads to active sample kit orders"
                  className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-hidden"
                />
              </div>

              {/* Step Builder */}
              <div className="space-y-2 pt-2">
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300">
                  Sequence Steps & Delay Intervals:
                </label>
                {formSteps.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 font-mono text-xs">Step {step.stepNumber}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-neutral-500">Wait Days:</span>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={step.delayDays}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setFormSteps(prev => prev.map((s, i) => i === idx ? { ...s, delayDays: val } : s));
                          }}
                          className="w-16 p-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-center font-mono"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormSteps(prev => prev.map((s, i) => i === idx ? { ...s, title: val } : s));
                      }}
                      className="w-full p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                      placeholder="Step Title"
                    />

                    <select
                      value={step.templateId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormSteps(prev => prev.map((s, i) => i === idx ? { ...s, templateId: val } : s));
                      }}
                      className="w-full p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>Template: {t.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoExitCheck"
                  checked={formAutoExit}
                  onChange={(e) => setFormAutoExit(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="autoExitCheck" className="text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  Auto-Exit Contact on Reply (Stop sequence if customer replies)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Sequence Blueprint</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
