import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Phone, 
  Mail, 
  Tag, 
  ShieldAlert, 
  ArrowUpDown, 
  Download,
  Building,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { Contact, Role } from '../types';
import { DataQualityEngine } from '../core/validation/dataQuality';

interface ContactsViewProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onAddContact: (contactData: any) => void;
  onDeleteContact: (id: string) => void;
  userRole: Role;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onSelectContact,
  onAddContact,
  onDeleteContact,
  userRole
}) => {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

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

  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags)));

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase());

    const matchesTag = selectedTag === 'ALL' || c.tags.includes(selectedTag);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

    return matchesSearch && matchesTag && matchesStatus;
  });

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
            {filteredContacts.length} verified records in workspace
          </p>
        </div>

        <div className="flex items-center gap-2">
          {userRole !== 'VIEWER' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name, company, city, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none placeholder:text-neutral-400"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
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
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-medium">
            <tr>
              <th className="py-2.5 px-3">Contact / Business</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">WhatsApp</th>
              <th className="py-2.5 px-3">Email</th>
              <th className="py-2.5 px-3">Tags</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-neutral-400">
                  No contacts found matching criteria.
                </td>
              </tr>
            ) : (
              filteredContacts.map(contact => {
                const isBlocked = contact.isGloballyBlocked || contact.status === 'BLOCKED';
                return (
                  <tr
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 cursor-pointer transition group"
                  >
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
                        <span className="text-neutral-300 dark:text-neutral-700">•</span>
                        <span className="font-mono text-[10px] text-neutral-400">{contact.leadStatus}</span>
                      </div>
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
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {contact.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 3 && (
                          <span className="text-[10px] text-neutral-400">+{contact.tags.length - 3}</span>
                        )}
                      </div>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectContact(contact);
                        }}
                        className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4">
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
                  <label className="block text-neutral-500 font-medium mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    placeholder="e.g. Nizamabad"
                  />
                </div>
              </div>

              {/* Phone with Data Quality live preview */}
              <div>
                <label className="block text-neutral-500 font-medium mb-1">
                  Mobile / WhatsApp Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  placeholder="e.g. 9848012345 or +919848012345"
                />
                {formData.phone && (
                  <div className={`mt-1 text-[11px] flex items-center gap-1 ${
                    phonePreview.isValid ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    <span>{phonePreview.isValid ? `✓ Canonical: ${phonePreview.canonical}` : `✕ ${phonePreview.error}`}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Email Address (Optional)</label>
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
                  <label className="block text-neutral-500 font-medium mb-1">Lead Segment</label>
                  <select
                    value={formData.leadStatus}
                    onChange={(e) => setFormData({ ...formData, leadStatus: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  >
                    <option value="RETAILER">RETAILER</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                    <option value="WHOLESALE">WHOLESALE</option>
                    <option value="LEAD">LEAD</option>
                    <option value="VIP">VIP</option>
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
        </div>
      )}
    </div>
  );
};
