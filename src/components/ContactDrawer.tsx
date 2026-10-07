import React, { useState } from 'react';
import { 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Tag, 
  ShieldAlert, 
  Clock, 
  Send, 
  Plus, 
  Calendar,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Contact, TimelineEvent } from '../types';

interface ContactDrawerProps {
  contact: Contact | null;
  timeline: TimelineEvent[];
  onClose: () => void;
  onToggleBlock: (contactId: string, reason?: string) => void;
  onAddNote: (contactId: string, note: string) => void;
  onUpdatePreferences: (contactId: string, channel: 'WHATSAPP' | 'EMAIL', allowed: boolean) => void;
  onDeleteContact?: (contactId: string) => void | Promise<void>;
}

export const ContactDrawer: React.FC<ContactDrawerProps> = ({
  contact,
  timeline,
  onClose,
  onToggleBlock,
  onAddNote,
  onUpdatePreferences,
  onDeleteContact
}) => {
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'timeline' | 'preferences'>('profile');

  if (!contact) return null;

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    onAddNote(contact.id, newNote.trim());
    setNewNote('');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {contact.displayName}
            </h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
              contact.isGloballyBlocked 
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400' 
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
            }`}>
              {contact.isGloballyBlocked ? 'DO NOT CONTACT (SUPPRESSED)' : contact.status}
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
            <Building className="w-3 h-3" />
            <span>{contact.companyName || 'No Company'}</span>
            <span>•</span>
            <MapPin className="w-3 h-3" />
            <span>{contact.city}, {contact.state}</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {onDeleteContact && (
            <button
              onClick={async () => {
                if (window.confirm(`Are you sure you want to permanently delete contact "${contact.displayName}"? This will permanently remove all associated data.`)) {
                  await onDeleteContact(contact.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-md transition font-medium cursor-pointer"
              title="Delete Contact"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-2.5 px-3 border-b-2 transition ${
            activeTab === 'profile'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          Intelligence Profile
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'timeline'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <span>Customer Timeline</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 dark:bg-neutral-800 font-mono">
            {timeline.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`py-2.5 px-3 border-b-2 transition ${
            activeTab === 'preferences'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-semibold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          Consent & Suppression
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Suppression Warning Banner */}
            {contact.isGloballyBlocked && (
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-300 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Global Block Active ("Never Contact")</div>
                  <div>Reason: {contact.blockedReason || 'Suppressed by operator'}</div>
                </div>
              </div>
            )}

            {/* Channels & Verification Status */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Communication Channels
              </label>
              <div className="grid grid-cols-1 gap-2">
                <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <div>
                      <div className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                        {contact.phone}
                      </div>
                      <div className="text-[10px] text-neutral-400">Canonical WhatsApp mobile</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-medium">
                    Verified Mobile
                  </span>
                </div>

                {contact.email && (
                  <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {contact.email}
                        </div>
                        <div className="text-[10px] text-neutral-400">Primary Commercial Email</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium">
                      Deliverable
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Tags & Segments
              </label>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map(t => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-mono font-medium flex items-center gap-1"
                  >
                    <Tag className="w-2.5 h-2.5 text-neutral-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Custom Fields */}
            {Object.keys(contact.customFields).length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Custom Attributes
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(contact.customFields).map(([key, val]) => (
                    <div key={key} className="p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/40">
                      <div className="text-[10px] text-neutral-400 uppercase font-mono">{key}</div>
                      <div className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operator Notes */}
            <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Operator Notes & Background
              </label>
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-xs whitespace-pre-line text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
                {contact.notes || 'No notes added yet.'}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNoteSubmit} className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Add an interaction note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
                />
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium disabled:opacity-50 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition"
                >
                  Add Note
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Customer Timeline (Lightweight CRM foundation) */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="text-xs text-neutral-500">
              Event-sourced log of all imports, tag additions, channel handoffs, and confirmations for this contact.
            </div>

            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
              {timeline.length === 0 ? (
                <div className="text-xs text-neutral-400 py-4">No timeline events recorded.</div>
              ) : (
                timeline.map((event) => (
                  <div key={event.id} className="relative group">
                    {/* Dot */}
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-900 dark:bg-neutral-100" />
                    
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {event.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {new Date(event.createdAt).toLocaleDateString()} {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {event.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                        <span>By: {event.actor}</span>
                        {event.campaignName && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-500 font-medium">Campaign: {event.campaignName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Consent & Suppression */}
        {activeTab === 'preferences' && (
          <div className="space-y-4 text-xs">
            {/* Global Block Switch */}
            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    "Never Contact This Person Again"
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Global suppression override. Overrides all campaigns, channels, and operator dispatches.
                  </div>
                </div>

                <button
                  onClick={() => onToggleBlock(contact.id)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    contact.isGloballyBlocked
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                  }`}
                >
                  {contact.isGloballyBlocked ? 'Remove Global Block' : 'Block Globally'}
                </button>
              </div>
            </div>

            {/* Per-Channel Consent Matrix */}
            <div className="space-y-2">
              <label className="font-semibold text-neutral-500 uppercase tracking-wider text-[11px]">
                Channel-Specific Marketing Consent
              </label>

              <div className="space-y-2">
                {/* WhatsApp */}
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">WhatsApp Outreach</div>
                      <div className="text-[11px] text-neutral-400">
                        {contact.preferences.WHATSAPP?.marketingAllowed ? 'Allowed by opt-in' : 'OPTED OUT / DISABLED'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onUpdatePreferences(contact.id, 'WHATSAPP', !contact.preferences.WHATSAPP?.marketingAllowed)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border ${
                      contact.preferences.WHATSAPP?.marketingAllowed
                        ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-500'
                    }`}
                  >
                    {contact.preferences.WHATSAPP?.marketingAllowed ? 'Allowed ✓' : 'Suppressed ✕'}
                  </button>
                </div>

                {/* Email */}
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">Email Outreach</div>
                      <div className="text-[11px] text-neutral-400">
                        {contact.preferences.EMAIL?.marketingAllowed ? 'Allowed' : 'OPTED OUT'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onUpdatePreferences(contact.id, 'EMAIL', !contact.preferences.EMAIL?.marketingAllowed)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border ${
                      contact.preferences.EMAIL?.marketingAllowed
                        ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'border-neutral-300 dark:border-neutral-700 text-neutral-500'
                    }`}
                  >
                    {contact.preferences.EMAIL?.marketingAllowed ? 'Allowed ✓' : 'Suppressed ✕'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
