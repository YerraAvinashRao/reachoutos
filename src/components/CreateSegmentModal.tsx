import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Users, Check, X, Filter, Sparkles, CheckSquare, Square } from 'lucide-react';
import { Contact, ContactList } from '../types';

export interface CreateSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  existingLists?: ContactList[];
  initialSelectedContactIds?: string[];
  initialSegment?: string;
  initialName?: string;
  onSave: (listData: {
    name: string;
    description: string;
    type: 'STATIC' | 'DYNAMIC';
    rules: any;
    contactIds: string[];
    syncToDatabase: boolean;
    leadStatus: string;
    city: string;
  }) => Promise<void>;
}

export const CreateSegmentModal: React.FC<CreateSegmentModalProps> = ({
  isOpen,
  onClose,
  contacts,
  existingLists = [],
  initialSelectedContactIds = [],
  initialSegment = 'FAMILY',
  initialName = '',
  onSave
}) => {
  const availableSegments = [
    { value: 'FAMILY', label: 'FAMILY & RELATIVES' },
    { value: 'LOCAL', label: 'LOCAL CONTACTS' },
    { value: 'VIP', label: 'VIP (High Priority)' },
    { value: 'RETAILER', label: 'RETAILER' },
    { value: 'DISTRIBUTOR', label: 'DISTRIBUTOR' },
    { value: 'WHOLESALE', label: 'WHOLESALE' },
    { value: 'LEAD', label: 'LEAD (Imported Contacts)' },
    { value: 'CUSTOMER', label: 'CUSTOMER' },
    { value: 'PROSPECT', label: 'PROSPECT' },
    { value: 'PARTNER', label: 'PARTNER' },
    { value: 'SUPPLIER', label: 'SUPPLIER' },
    { value: 'HORECA', label: 'HORECA / HOTEL / RESTAURANT' },
    { value: 'ALL', label: '★ FULL EXHAUSTIVE LIST (All Contacts)' },
    { value: 'OTHER', label: 'OTHER' }
  ];

  const existingCities = useMemo(() => {
    return Array.from(
      new Set(contacts.map(c => (c.city || '').trim()).filter(Boolean))
    ).sort();
  }, [contacts]);

  // Mode: 'MANUAL' (hand-pick contacts via search & checkboxes) or 'DYNAMIC' (rule based)
  const [mode, setMode] = useState<'MANUAL' | 'DYNAMIC'>('MANUAL');
  const [name, setName] = useState(initialName || (initialSegment === 'FAMILY' ? 'YAR FAMILY CONTACTS' : ''));
  const [description, setDescription] = useState('');
  const [leadStatus, setLeadStatus] = useState(initialSegment);
  const [city, setCity] = useState('ALL');
  const [syncToDatabase, setSyncToDatabase] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedContactIds));
  const [contactSearch, setContactSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedContactIds));
      if (initialSelectedContactIds.length > 0) {
        setMode('MANUAL');
      }
      if (initialName) {
        setName(initialName);
      } else if (initialSegment === 'FAMILY') {
        setName('YAR FAMILY CONTACTS');
      }
      if (initialSegment) {
        setLeadStatus(initialSegment);
      }
    }
  }, [isOpen, initialSelectedContactIds, initialName, initialSegment]);

  // Filtered contacts in the manual picker
  const filteredPickerContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts || [];
    const q = contactSearch.toLowerCase().trim();
    return (contacts || []).filter(c => 
      (c.displayName || '').toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.leadStatus || '').toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const displayedPickerContacts = useMemo(() => {
    return filteredPickerContacts.slice(0, 100);
  }, [filteredPickerContacts]);

  // Dynamic filter matching
  const dynamicMatchedContacts = useMemo(() => {
    return (contacts || []).filter(c => {
      let match = true;
      const filterCity = (city || '').trim().toLowerCase();
      if (filterCity && filterCity !== 'all' && (c.city || '').toLowerCase() !== filterCity) {
        match = false;
      }
      const filterStatus = (leadStatus || '').trim().toUpperCase();
      if (filterStatus && filterStatus !== 'ALL') {
        const hasStatus = (c.leadStatus || '').toUpperCase() === filterStatus;
        const hasTag = (c.tags || []).some(t => (t || '').toUpperCase() === filterStatus);
        if (!hasStatus && !hasTag) match = false;
      }
      return match;
    });
  }, [contacts, city, leadStatus]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredPickerContacts.forEach(c => next.add(c.id));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredPickerContacts.forEach(c => next.delete(c.id));
      return next;
    });
  };

  const effectiveContactIds = useMemo(() => {
    if (mode === 'MANUAL') {
      return Array.from(selectedIds);
    } else {
      if (dynamicMatchedContacts.length > 0) {
        return dynamicMatchedContacts.map(c => c.id);
      }
      // If 0 match because all imported rows are LEAD, match by city or all
      const targetCity = (city || '').trim().toLowerCase();
      return (contacts || [])
        .filter(c => !targetCity || targetCity === 'all' || (c.city || '').toLowerCase() === targetCity)
        .map(c => c.id);
    }
  }, [mode, selectedIds, dynamicMatchedContacts, contacts, city]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        type: mode === 'MANUAL' ? 'STATIC' : 'DYNAMIC',
        rules: {
          city,
          leadStatus,
          hasWhatsApp: true,
          marketingAllowed: true
        },
        contactIds: effectiveContactIds,
        syncToDatabase,
        leadStatus,
        city
      });
      onClose();
    } catch (err) {
      console.error('Error creating segment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span>Create & Map Audience Segment</span>
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Select specific contacts or define dynamic rules, and synchronize directly to PostgreSQL.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Top Inputs: Name & Segment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">
                Segment / List Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. YAR FAMILY CONTACTS, VIP RETAILERS"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">
                Customer Segment (Category) *
              </label>
              <select
                value={leadStatus}
                onChange={(e) => {
                  setLeadStatus(e.target.value);
                  if (!name || name === 'YAR FAMILY CONTACTS' || name.endsWith('CONTACTS')) {
                    const found = availableSegments.find(s => s.value === e.target.value);
                    if (found && e.target.value !== 'ALL') {
                      setName(`${found.label.split(' ')[0]} CONTACTS`);
                    }
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {availableSegments.map(seg => (
                  <option key={seg.value} value={seg.value}>
                    {seg.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-neutral-600 dark:text-neutral-300 font-medium mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Key personal contacts and local network for direct WhatsApp outreach"
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
            />
          </div>

          {/* Mode Switcher Tabs */}
          <div className="pt-2">
            <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg select-none">
              <button
                type="button"
                onClick={() => setMode('MANUAL')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  mode === 'MANUAL'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-primary-600" />
                <span>Hand-pick Specific Contacts ({selectedIds.size} selected)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('DYNAMIC')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  mode === 'DYNAMIC'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <Filter className="w-3.5 h-3.5 text-neutral-500" />
                <span>Rule-based Filter (By City / Segment)</span>
              </button>
            </div>
          </div>

          {/* TAB 1: MANUAL SELECTION / CONTACTS PICKER */}
          {mode === 'MANUAL' && (
            <div className="space-y-2 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search from 1,881 contacts by name, phone, city..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 hover:underline px-1.5 py-1"
                  >
                    Select All ({filteredPickerContacts.length})
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-700">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="text-[11px] font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 px-1.5 py-1"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Scrollable contacts list */}
              <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800">
                {displayedPickerContacts.length === 0 ? (
                  <div className="text-center py-6 text-neutral-400 text-xs">
                    No contacts found matching "{contactSearch}".
                  </div>
                ) : (
                  <>
                    {displayedPickerContacts.map((c, idx) => {
                      const isChecked = selectedIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleSelect(c.id)}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition select-none hover:bg-neutral-50 dark:hover:bg-neutral-800/60 ${
                            isChecked ? 'bg-primary-50/50 dark:bg-primary-950/20' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent div onClick
                            className="rounded border-neutral-300 text-primary-600 focus:ring-0"
                          />
                          <span className="font-mono text-[10px] text-neutral-400 w-8 text-right">
                            #{idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate text-xs flex items-center gap-1.5">
                              <span>{c.displayName}</span>
                              {c.companyName && (
                                <span className="text-[11px] font-normal text-neutral-400 truncate">
                                  ({c.companyName})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono flex items-center gap-2">
                              <span>{c.phone}</span>
                              {c.city && <span>• {c.city}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shrink-0">
                            {c.leadStatus}
                          </span>
                        </div>
                      );
                    })}
                    {filteredPickerContacts.length > displayedPickerContacts.length && (
                      <div className="text-center py-2 text-[11px] text-neutral-500 bg-neutral-50/80 dark:bg-neutral-800/40 border-t border-neutral-100 dark:border-neutral-800">
                        Showing top 100 of {filteredPickerContacts.length} matching contacts. Type in search box above to narrow down instantly.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC FILTER BY CITY */}
          {mode === 'DYNAMIC' && (
            <div className="space-y-3 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 bg-neutral-50/50 dark:bg-neutral-900/50">
              <div>
                <label className="block text-neutral-600 dark:text-neutral-300 font-semibold mb-1">
                  Target City Filter
                </label>
                <input
                  type="text"
                  list="modal-city-options"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="ALL (Any Location)"
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs"
                />
                <datalist id="modal-city-options">
                  <option value="ALL">ALL (Any Location / All 1,881 Contacts)</option>
                  {existingCities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </datalist>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Leave as "ALL" to include all contacts across all cities in workspace.
                </p>
              </div>
            </div>
          )}

          {/* Live Preview Box */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-300 space-y-1">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Audience Summary:</span>
              </span>
              <span className="font-mono font-bold bg-white dark:bg-neutral-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-xs">
                {effectiveContactIds.length} recipients mapped
              </span>
            </div>
            <p className="text-[11px] text-blue-700 dark:text-blue-400">
              {mode === 'MANUAL'
                ? `Mapped ${effectiveContactIds.length} hand-picked contacts to '${name || 'New Segment'}'.`
                : `Dynamic rule matching ${effectiveContactIds.length} contacts (City: ${city}, Segment: ${leadStatus}).`}
            </p>
          </div>

          {/* Sync to DB Toggle */}
          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncToDatabase}
              onChange={(e) => setSyncToDatabase(e.target.checked)}
              className="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-0"
            />
            <span className="text-[11px] text-neutral-700 dark:text-neutral-300">
              <span className="font-semibold block">Update Customer Segment in PostgreSQL Database</span>
              Permanently set the customer segment for all {effectiveContactIds.length} contacts to <span className="font-mono font-bold">{leadStatus}</span> in Supabase PostgreSQL.
            </span>
          </label>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || effectiveContactIds.length === 0}
              className="px-5 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs shadow-sm hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving to Database...' : 'Create & Map Segment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
