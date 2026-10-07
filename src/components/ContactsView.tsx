import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  ShieldAlert, 
  ArrowUpDown, 
  Building, 
  ChevronRight,
  Users,
  CheckSquare,
  Check,
  FolderPlus,
  Loader2,
  Filter,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Contact, Role, ContactList } from '../types';
import { DataQualityEngine } from '../core/validation/dataQuality';
import { CreateSegmentModal } from './CreateSegmentModal';

export const SEGMENT_CONFIGS: Record<string, { label: string; bg: string; text: string; border: string; activeTab: string }> = {
  FAMILY: {
    label: 'FAMILY & RELATIVES',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    activeTab: 'bg-purple-600 text-white'
  },
  LOCAL: {
    label: 'LOCAL CONTACTS',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    activeTab: 'bg-emerald-600 text-white'
  },
  VIP: {
    label: 'VIP (High Priority)',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700 font-bold',
    activeTab: 'bg-amber-600 text-white'
  },
  RETAILER: {
    label: 'RETAILER',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    activeTab: 'bg-blue-600 text-white'
  },
  DISTRIBUTOR: {
    label: 'DISTRIBUTOR',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    activeTab: 'bg-indigo-600 text-white'
  },
  WHOLESALE: {
    label: 'WHOLESALE',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
    activeTab: 'bg-cyan-600 text-white'
  },
  CUSTOMER: {
    label: 'CUSTOMER',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
    activeTab: 'bg-teal-600 text-white'
  },
  LEAD: {
    label: 'LEAD',
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-700 dark:text-neutral-300',
    border: 'border-neutral-200 dark:border-neutral-700',
    activeTab: 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
  }
};

export const getSegmentStyle = (status?: string) => {
  const upper = (status || 'LEAD').toUpperCase();
  return SEGMENT_CONFIGS[upper] || {
    label: upper,
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-700 dark:text-neutral-300',
    border: 'border-neutral-200 dark:border-neutral-700',
    activeTab: 'bg-neutral-700 text-white'
  };
};

interface ContactsViewProps {
  contacts: Contact[];
  lists?: ContactList[];
  onSelectContact: (contact: Contact) => void;
  onAddContact: (contactData: any) => void;
  onDeleteContact: (id: string) => void | Promise<void>;
  onBulkUpdate?: (contactIds: string[], updates: any) => Promise<void>;
  onBulkDelete?: (contactIds: string[]) => Promise<void>;
  onAddToList?: (listId: string, contactIds: string[]) => Promise<void>;
  onCreateList?: (data: any) => Promise<void>;
  userRole: Role;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  lists = [],
  onSelectContact,
  onAddContact,
  onDeleteContact,
  onBulkUpdate,
  onBulkDelete,
  onAddToList,
  onCreateList,
  userRole
}) => {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedSegment, setSelectedSegment] = useState<string>('ALL');
  const [selectedListId, setSelectedListId] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);
  const [stagedSegment, setStagedSegment] = useState<string>('');
  const [stagedListId, setStagedListId] = useState<string>('');

  // Segment counts for classification
  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (contacts || []).forEach(c => {
      const s = (c.leadStatus || 'LEAD').toUpperCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [contacts]);

  // Discovered list of all active or standard segments
  const allDiscoveredSegments = useMemo(() => {
    const standard = ['FAMILY', 'LOCAL', 'VIP', 'RETAILER', 'DISTRIBUTOR', 'WHOLESALE', 'CUSTOMER', 'LEAD'];
    const fromContacts = Array.from(new Set((contacts || []).map(c => (c.leadStatus || '').toUpperCase()).filter(Boolean)));
    const set = new Set([...standard, ...fromContacts]);
    return Array.from(set).filter(s => (segmentCounts[s] || 0) > 0 || standard.includes(s));
  }, [contacts, segmentCounts]);

  // New Contact form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    phone: '',
    email: '',
    city: '',
    leadStatus: 'RETAILER',
    notes: '',
    tags: 'RETAILER, HONEY'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const allTags = useMemo(() => Array.from(new Set(contacts.flatMap(c => c.tags))), [contacts]);

  const filteredContacts = useMemo(() => {
    const s = search.toLowerCase().trim();
    return contacts.filter(c => {
      if (s) {
        const matchesSearch = 
          c.displayName.toLowerCase().includes(s) ||
          c.companyName.toLowerCase().includes(s) ||
          c.city.toLowerCase().includes(s) ||
          c.phone.includes(s) ||
          c.email.toLowerCase().includes(s) ||
          (c.leadStatus || '').toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      if (selectedTag !== 'ALL' && !c.tags.includes(selectedTag)) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (selectedSegment !== 'ALL' && (c.leadStatus || '').toUpperCase() !== selectedSegment.toUpperCase()) return false;
      if (selectedListId !== 'ALL') {
        const targetList = lists?.find(l => l.id === selectedListId);
        if (targetList && !(targetList.contactIds || []).includes(c.id)) return false;
      }
      return true;
    });
  }, [contacts, search, selectedTag, statusFilter, selectedSegment, selectedListId, lists]);

  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      const nameA = (a.displayName || a.companyName || '').trim();
      const nameB = (b.displayName || b.companyName || '').trim();
      const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredContacts, sortOrder]);

  const totalPages = Math.ceil(sortedContacts.length / pageSize) || 1;
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedContacts = useMemo(() => {
    return sortedContacts.slice((validPage - 1) * pageSize, validPage * pageSize);
  }, [sortedContacts, validPage, pageSize]);

  const isAllSelected = sortedContacts.length > 0 && sortedContacts.every(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedContacts.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyBulkMapping = async () => {
    if (selectedIds.size === 0) return;
    if (!stagedSegment && !stagedListId) return;

    setIsBulkOperating(true);
    try {
      const contactIdList = Array.from(selectedIds);
      const appliedDetails: string[] = [];

      // 1. Update Segment (leadStatus) if selected
      if (stagedSegment && onBulkUpdate) {
        await onBulkUpdate(contactIdList, { leadStatus: stagedSegment });
        appliedDetails.push(`Segment: ${stagedSegment}`);
      }

      // 2. Add to Target List if selected
      if (stagedListId && onAddToList) {
        await onAddToList(stagedListId, contactIdList);
        const listName = lists?.find(l => l.id === stagedListId)?.name || 'Target List';
        appliedDetails.push(`List: "${listName}"`);
      }

      setBulkSuccessMsg(`✓ Successfully mapped ${contactIdList.length} contacts (${appliedDetails.join(' & ')})`);
      setTimeout(() => setBulkSuccessMsg(null), 5000);
      setStagedSegment('');
      setStagedListId('');
    } catch (err: any) {
      console.error('Error applying bulk mapping:', err);
      alert(err?.message || 'Failed to apply mapping.');
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddContact({
      ...formData,
      displayName: `${formData.firstName} ${formData.lastName}`.trim() || formData.companyName,
      tags: formData.tags.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
    });
    setShowAddModal(false);
    setFormData({
      firstName: '',
      lastName: '',
      companyName: '',
      phone: '',
      email: '',
      city: '',
      leadStatus: 'RETAILER',
      notes: '',
      tags: 'RETAILER, HONEY'
    });
  };

  const phonePreview = DataQualityEngine.normalizePhone(formData.phone);

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Contacts Intelligence
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {sortedContacts.length} verified records in workspace
          </p>
        </div>

        <div className="flex items-center gap-2">
          {userRole !== 'VIEWER' && (
            <>
              <button
                onClick={() => setShowSegmentModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition shadow-sm"
              >
                <Users className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                <span>Create Segment</span>
              </button>

              <button
                data-tour="contacts.add-btn"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Floating / Sticky Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="p-3.5 rounded-xl bg-neutral-900 dark:bg-neutral-800 text-white shadow-xl flex flex-wrap items-center justify-between gap-3 border border-neutral-700 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-primary-600 text-white border border-primary-500">
                {selectedIds.size}
              </span>
              <span className="text-xs font-semibold">contacts selected</span>
            </div>

            {bulkSuccessMsg && (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                {bulkSuccessMsg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Step 1: Select Target List */}
            <div className="flex items-center gap-1.5 bg-neutral-800/90 px-2.5 py-1.5 rounded-lg border border-neutral-700">
              <span className="text-[11px] text-neutral-300 font-medium whitespace-nowrap">Target List:</span>
              <select
                disabled={isBulkOperating}
                value={stagedListId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__CREATE_NEW__') {
                    setShowSegmentModal(true);
                  } else {
                    setStagedListId(val);
                  }
                }}
                className="bg-transparent text-white font-semibold focus:outline-none text-xs cursor-pointer max-w-[170px] truncate"
              >
                <option value="" className="text-neutral-900">-- Choose List --</option>
                <option value="__CREATE_NEW__" className="text-primary-600 font-bold bg-neutral-100">
                  + Create New Segment / List...
                </option>
                {lists.map(l => (
                  <option key={l.id} value={l.id} className="text-neutral-900">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Customer Segment */}
            <div className="flex items-center gap-1.5 bg-neutral-800/90 px-2.5 py-1.5 rounded-lg border border-neutral-700">
              <span className="text-[11px] text-neutral-300 font-medium whitespace-nowrap">Segment:</span>
              <select
                disabled={isBulkOperating}
                value={stagedSegment}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__CREATE_NEW__') {
                    setShowSegmentModal(true);
                  } else {
                    setStagedSegment(val);
                  }
                }}
                className="bg-transparent text-white font-semibold focus:outline-none text-xs cursor-pointer"
              >
                <option value="" className="text-neutral-900">-- Choose Segment --</option>
                <option value="__CREATE_NEW__" className="text-primary-600 font-bold bg-neutral-100">
                  + Create New Segment...
                </option>
                <option value="FAMILY" className="text-neutral-900">FAMILY & RELATIVES</option>
                <option value="LOCAL" className="text-neutral-900">LOCAL CONTACTS</option>
                <option value="VIP" className="text-neutral-900">VIP (High Priority)</option>
                <option value="RETAILER" className="text-neutral-900">RETAILER</option>
                <option value="DISTRIBUTOR" className="text-neutral-900">DISTRIBUTOR</option>
                <option value="WHOLESALE" className="text-neutral-900">WHOLESALE</option>
                <option value="CUSTOMER" className="text-neutral-900">CUSTOMER</option>
                <option value="LEAD" className="text-neutral-900">LEAD</option>
              </select>
            </div>

            {/* Apply Button */}
            <button
              disabled={isBulkOperating || (!stagedSegment && !stagedListId)}
              onClick={handleApplyBulkMapping}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition shadow-sm ${
                (stagedSegment || stagedListId) && !isBulkOperating
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer ring-1 ring-emerald-400'
                  : 'bg-neutral-700/60 text-neutral-400 cursor-not-allowed'
              }`}
              title="Apply selected segment and/or list to all chosen contacts"
            >
              {isBulkOperating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                {stagedSegment && stagedListId
                  ? `Apply Both to Selected (${selectedIds.size})`
                  : stagedSegment
                  ? `Apply Segment (${selectedIds.size})`
                  : stagedListId
                  ? `Add to List (${selectedIds.size})`
                  : `Select List & Segment`}
              </span>
            </button>

            {/* Direct Create Segment Button */}
            <button
              onClick={() => setShowSegmentModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Create New Segment</span>
            </button>

            {/* Bulk Delete Button */}
            {userRole !== 'VIEWER' && (
              <button
                disabled={isBulkOperating}
                onClick={async () => {
                  const count = selectedIds.size;
                  if (window.confirm(`Are you sure you want to permanently delete ${count} selected contact${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
                    setIsBulkOperating(true);
                    try {
                      const idsArray = Array.from(selectedIds);
                      if (onBulkDelete) {
                        await onBulkDelete(idsArray);
                      } else {
                        for (const id of idsArray) {
                          await onDeleteContact(id);
                        }
                      }
                      setSelectedIds(new Set());
                      setBulkSuccessMsg(`✓ Successfully deleted ${count} contact${count > 1 ? 's' : ''}!`);
                      setTimeout(() => setBulkSuccessMsg(null), 4000);
                    } catch (err) {
                      console.error('Failed to bulk delete contacts:', err);
                    } finally {
                      setIsBulkOperating(false);
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
                title="Permanently delete all selected contacts"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}

            {/* Done / Clear button */}
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setStagedSegment('');
                setStagedListId('');
              }}
              className="text-[11px] text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 transition"
              title="Deselect all contacts"
            >
              Done / Clear
            </button>
          </div>
        </div>
      )}

      {/* Segment Classification Tabs Ribbon: Clearly separating contacts by segment */}
      <div className="space-y-1.5 bg-neutral-50/70 dark:bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Customer Segments ({contacts.length} total):
            </span>
            {selectedSegment !== 'ALL' && (
              <span className="text-[11px] font-medium text-primary-600 dark:text-primary-400 flex items-center gap-1">
                <span>Filtered to {sortedContacts.length} contacts</span>
                <span>•</span>
                <button
                  onClick={() => setSelectedSegment('ALL')}
                  className="underline hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer font-semibold"
                >
                  View All ({contacts.length})
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Horizontal scrollable Segment Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {/* ALL Tab */}
          <button
            onClick={() => setSelectedSegment('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
              selectedSegment === 'ALL'
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Contacts</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              selectedSegment === 'ALL'
                ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-200 dark:text-neutral-800'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
            }`}>
              {contacts.length}
            </span>
          </button>

          {/* Individual Segment Pills */}
          {allDiscoveredSegments.map((segKey) => {
            const style = getSegmentStyle(segKey);
            const count = segmentCounts[segKey] || 0;
            const isSelected = selectedSegment === segKey;

            return (
              <button
                key={segKey}
                onClick={() => setSelectedSegment(segKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? `${style.activeTab} border-transparent shadow-sm ring-1 ring-black/20`
                    : `${style.bg} ${style.text} ${style.border} hover:opacity-90`
                }`}
                title={`Filter to ${style.label} (${count} contacts)`}
              >
                <span>{style.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-black/10 dark:bg-white/10'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name, company, city, phone, segment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none placeholder:text-neutral-400"
          />
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* Alphabetical Sort toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
            title={`Sorted ${sortOrder === 'asc' ? 'Alphabetical (A → Z)' : 'Reverse Alphabetical (Z → A)'}. Click to toggle.`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-medium font-mono">{sortOrder === 'asc' ? 'A → Z' : 'Z → A'}</span>
          </button>

          {/* Segment Filter Dropdown */}
          <select
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
            className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Segments ({contacts.length})</option>
            {allDiscoveredSegments.map(s => (
              <option key={s} value={s}>
                {getSegmentStyle(s).label} ({segmentCounts[s] || 0})
              </option>
            ))}
          </select>

          {/* Target List Filter Dropdown */}
          {lists && lists.length > 0 && (
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs focus:outline-none max-w-[150px] truncate"
            >
              <option value="ALL">All Target Lists</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {/* Tag filter */}
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="BLOCKED">Suppressed (Blocked)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto shadow-sm">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-medium select-none">
            <tr>
              <th className="py-2.5 px-3 w-8 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-neutral-300 text-primary-600 focus:ring-0"
                  title="Select / Deselect all"
                />
              </th>
              <th className="py-2.5 px-2 w-10 text-center text-neutral-400 font-mono text-[11px]">#</th>
              <th 
                className="py-2.5 px-3 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 transition"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                title="Click to toggle alphabetical order"
              >
                <div className="flex items-center gap-1.5">
                  <span>Contact / Business</span>
                  <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                    {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                  </span>
                </div>
              </th>
              <th className="py-2.5 px-3">Segment</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">WhatsApp</th>
              <th className="py-2.5 px-3">Email</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-neutral-400">
                  No contacts found matching criteria.
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact, index) => {
                const isBlocked = contact.isGloballyBlocked || contact.status === 'BLOCKED';
                const isSelected = selectedIds.has(contact.id);
                return (
                  <tr
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 cursor-pointer transition group ${
                      isSelected ? 'bg-primary-50/40 dark:bg-primary-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(contact.id)}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-0"
                      />
                    </td>

                    <td className="py-2.5 px-2 text-center font-mono text-neutral-400 dark:text-neutral-500 text-[11px] font-medium">
                      {(validPage - 1) * pageSize + index + 1}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        <span>{contact.displayName}</span>
                        {isBlocked && (
                          <span title="Globally Suppressed">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <Building className="w-3 h-3 text-neutral-400" />
                        <span>{contact.companyName || '—'}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      {(() => {
                        const style = getSegmentStyle(contact.leadStatus);
                        return (
                          <span className={`inline-flex items-center gap-1 font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${style.bg} ${style.text} ${style.border}`}>
                            <span>{contact.leadStatus || 'LEAD'}</span>
                          </span>
                        );
                      })()}
                    </td>

                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                      <div>{contact.city || '—'}</div>
                      <div className="text-[10px] text-neutral-400">{contact.state}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{contact.phone}</span>
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {contact.preferences.WHATSAPP?.marketingAllowed ? 'Opted-in' : 'Opted-out'}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      {contact.email ? (
                        <div className="flex items-center gap-1 text-[11px] text-neutral-700 dark:text-neutral-300">
                          <Mail className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate max-w-[150px]">{contact.email}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-400 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        isBlocked
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                      }`}>
                        {isBlocked ? 'SUPPRESSED' : 'ACTIVE'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {userRole !== 'VIEWER' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to delete contact "${contact.displayName}"? This action cannot be undone.`)) {
                                await onDeleteContact(contact.id);
                              }
                            }}
                            className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title={`Delete ${contact.displayName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectContact(contact);
                          }}
                          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer"
                          title="View Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Stats Ribbon */}
      {sortedContacts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs">
          <div className="flex items-center gap-3 text-neutral-500 font-mono text-[11px]">
            <span>
              Showing {(validPage - 1) * pageSize + 1}–{Math.min(validPage * pageSize, sortedContacts.length)} of {sortedContacts.length} contacts
            </span>
            <span>•</span>
            <div className="flex items-center gap-1.5 font-sans">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-mono focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={validPage <= 1}
              className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-700 font-mono text-[11px] transition cursor-pointer"
              title="First Page"
            >
              « First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={validPage <= 1}
              className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-700 font-medium text-xs transition cursor-pointer"
            >
              ← Prev
            </button>
            <span className="px-3 py-1 font-mono text-neutral-600 dark:text-neutral-400 text-xs font-semibold">
              Page {validPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={validPage >= totalPages}
              className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-700 font-medium text-xs transition cursor-pointer"
            >
              Next →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={validPage >= totalPages}
              className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-neutral-50 dark:hover:bg-neutral-700 font-mono text-[11px] transition cursor-pointer"
              title="Last Page"
            >
              Last »
            </button>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Add New Contact Record
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    placeholder="e.g. Rajesh"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    placeholder="e.g. Kumar"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Company / Store Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    placeholder="e.g. Rajesh Traders"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">City / Town</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    placeholder="e.g. Nizamabad"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">
                  Phone (WhatsApp / Mobile) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none font-mono"
                  placeholder="e.g. 9848012345 or +919848012345"
                />
                {formData.phone && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                    {phonePreview.isValid ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-mono">
                        ✓ Normalized to canonical E.164: {phonePreview.canonical}
                      </span>
                    ) : (
                      <span className="text-rose-500 flex items-center gap-1">
                        ✗ {phonePreview.error || 'Invalid Indian phone number'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  placeholder="e.g. rajesh@rajeshtraders.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Customer Segment</label>
                  <select
                    value={formData.leadStatus}
                    onChange={(e) => setFormData({ ...formData, leadStatus: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  >
                    <option value="FAMILY">FAMILY & RELATIVES</option>
                    <option value="LOCAL">LOCAL CONTACTS</option>
                    <option value="VIP">VIP</option>
                    <option value="RETAILER">RETAILER</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                    <option value="WHOLESALE">WHOLESALE</option>
                    <option value="LEAD">LEAD</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Initial Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  placeholder="Store background, preferred products, terms..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.phone || !phonePreview.isValid}
                  className="px-4 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium disabled:opacity-50 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Unified Create Segment Modal */}
      <CreateSegmentModal
        isOpen={showSegmentModal}
        onClose={() => setShowSegmentModal(false)}
        contacts={contacts}
        existingLists={lists}
        initialSelectedContactIds={Array.from(selectedIds)}
        initialSegment={stagedSegment || 'FAMILY'}
        initialName={selectedIds.size > 0 ? (stagedSegment ? `YAR ${stagedSegment} CONTACTS` : 'YAR FAMILY CONTACTS') : ''}
        onSave={async (data) => {
          if (onCreateList) {
            await onCreateList(data);
          }
          setBulkSuccessMsg(`✓ Successfully created segment & list "${data.name}" with ${data.contactIds.length} contacts!`);
          setTimeout(() => setBulkSuccessMsg(null), 5000);
          setShowSegmentModal(false);
        }}
      />
    </div>
  );
};
