import React, { useState } from 'react';
import { ListFilter, Plus, Users, Send, Sparkles, RefreshCw, Zap } from 'lucide-react';
import { ContactList, Contact, Role } from '../types';
import { CreateSegmentModal } from './CreateSegmentModal';
import { SegmentRuleEngine } from '../core/segmentation/SegmentRuleEngine';

interface ListsViewProps {
  lists: ContactList[];
  contacts: Contact[];
  onCreateList: (data: any) => Promise<void>;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Target Audiences & Smart Segments
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Static contact groups and live dynamic rule-based filters auto-evaluating in real-time
          </p>
        </div>

        {userRole !== 'VIEWER' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Audience Segment</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lists.map(list => {
          const isDynamic = list.type === 'DYNAMIC';
          // Compute live members if dynamic rules exist
          const dynamicMatchingContacts = isDynamic && list.rules
            ? (list.rules.rules && Array.isArray(list.rules.rules)
                ? SegmentRuleEngine.filterContacts(contacts, list.rules)
                : contacts.filter(c => {
                    let match = true;
                    if (list.rules.city && list.rules.city !== 'ALL' && (c.city || '').toLowerCase() !== list.rules.city.toLowerCase()) match = false;
                    if (list.rules.leadStatus && list.rules.leadStatus !== 'ALL' && (c.leadStatus || '').toUpperCase() !== list.rules.leadStatus.toUpperCase()) match = false;
                    return match;
                  })
              )
            : [];
          const effectiveCount = isDynamic ? dynamicMatchingContacts.length : list.contactIds.length;

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
                      {isDynamic ? (
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-purple-100 dark:bg-purple-950 font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-purple-500" />
                          <span>LIVE DYNAMIC</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 font-semibold text-neutral-600 dark:text-neutral-400">
                          STATIC
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {list.description || 'Target audience segment for governed dispatches'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1 rounded-md border border-neutral-100 dark:border-neutral-800">
                    <Users className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{effectiveCount}</span>
                  </div>
                </div>

                {list.rules && (
                  <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-[11px] space-y-1">
                    <div className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-500" />
                      <span>Live Filter Rules:</span>
                    </div>
                    <div className="flex flex-wrap gap-1 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                      {list.rules.city && <span className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">City == "{list.rules.city}"</span>}
                      {list.rules.leadStatus && <span className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">Segment == "{list.rules.leadStatus}"</span>}
                      {list.rules.rules && Array.isArray(list.rules.rules) && list.rules.rules.map((r: any, idx: number) => (
                        <span key={idx} className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                          {r.field} {r.operator} {String(r.value)}
                        </span>
                      ))}
                      <span className="bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">WhatsApp == Verified</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400 font-mono">
                  {effectiveCount} members auto-synced
                </span>
                {userRole !== 'VIEWER' && (
                  <button
                    onClick={() => onLaunchCampaignForList(list.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm cursor-pointer"
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

      {/* Unified Create Segment Modal */}
      <CreateSegmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        contacts={contacts}
        existingLists={lists}
        initialSegment="FAMILY"
        initialName="YAR FAMILY CONTACTS"
        onSave={async (data) => {
          await onCreateList(data);
          setShowModal(false);
        }}
      />
    </div>
  );
};
