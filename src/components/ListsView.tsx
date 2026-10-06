import React, { useState } from 'react';
import { ListFilter, Plus, Users, Send, CheckCircle2 } from 'lucide-react';
import { ContactList, Contact, Role } from '../types';

interface ListsViewProps {
  lists: ContactList[];
  contacts: Contact[];
  onCreateList: (data: any) => void;
  onLaunchCampaignForList: (listId: string) => void;
  userRole: Role;
}

export const ListsView: React.FC<ListsViewProps> = ({
  lists,
  contacts,
  onCreateList,
  onLaunchCampaignForList,
  userRole
}) => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'DYNAMIC' as 'STATIC' | 'DYNAMIC',
    city: 'Nizamabad',
    leadStatus: 'RETAILER',
    tag: 'HONEY'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For demo dynamic rules
    const matchingContacts = contacts.filter(c => {
      if (formData.type === 'STATIC') return true;
      let match = true;
      if (formData.city && c.city.toLowerCase() !== formData.city.toLowerCase()) match = false;
      if (formData.leadStatus && c.leadStatus !== formData.leadStatus) match = false;
      return match;
    });

    onCreateList({
      name: formData.name,
      description: formData.description,
      type: formData.type,
      rules: {
        city: formData.city,
        leadStatus: formData.leadStatus,
        hasWhatsApp: true,
        marketingAllowed: true
      },
      contactIds: matchingContacts.map(c => c.id)
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Target Audiences & Segments
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Static lead groups and dynamic rule-based filters (City, Channel, Consent)
          </p>
        </div>

        {userRole !== 'VIEWER' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Audience Segment</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lists.map(list => {
          return (
            <div
              key={list.id}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                        {list.name}
                      </h3>
                      <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 font-semibold text-neutral-600 dark:text-neutral-400">
                        {list.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {list.description || 'No description provided'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1 rounded-md border border-neutral-100 dark:border-neutral-800">
                    <Users className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{list.contactIds.length}</span>
                  </div>
                </div>

                {list.rules && (
                  <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-[11px] space-y-1">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-300">Audience Filter Logic:</div>
                    <div className="flex flex-wrap gap-1 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                      {list.rules.city && <span className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">City == "{list.rules.city}"</span>}
                      {list.rules.leadStatus && <span className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">Status == "{list.rules.leadStatus}"</span>}
                      <span className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">WhatsApp == Available</span>
                      <span className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">Consent == Allowed</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-mono">
                  {list.contactIds.length} recipients eligible
                </span>
                {userRole !== 'VIEWER' && (
                  <button
                    onClick={() => onLaunchCampaignForList(list.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm"
                  >
                    <Send className="w-3 h-3" />
                    <span>Launch Campaign</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-neutral-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Create Audience Segment
              </h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 font-medium mb-1">List Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  placeholder="e.g. Hyderabad HORECA Distributors"
                />
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Target City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">Customer Segment</label>
                  <select
                    value={formData.leadStatus}
                    onChange={(e) => setFormData({ ...formData, leadStatus: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="RETAILER">RETAILER</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                    <option value="WHOLESALE">WHOLESALE</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
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
                  className="px-4 py-1.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold"
                >
                  Create Segment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
