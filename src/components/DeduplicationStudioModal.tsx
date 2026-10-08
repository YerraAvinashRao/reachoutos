import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  UserCheck, 
  Trash2, 
  Check, 
  Loader2,
  Building,
  Phone,
  Mail,
  RefreshCw,
  X
} from 'lucide-react';
import { DuplicateCandidate, Contact } from '../types';
import { apiClient } from '../services/apiClient';

interface DeduplicationStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMergedSuccess: () => void;
}

export const DeduplicationStudioModal: React.FC<DeduplicationStudioModalProps> = ({
  isOpen,
  onClose,
  onMergedSuccess
}) => {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergingIdx, setMergingIdx] = useState<number | null>(null);
  const [mergeSuccessMsg, setMergeSuccessMsg] = useState<string | null>(null);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getDuplicateCandidates();
      setCandidates(res || []);
    } catch (err) {
      console.warn('Failed to load duplicate candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMergePair = async (candidate: DuplicateCandidate, index: number) => {
    setMergingIdx(index);
    try {
      const primary = candidate.primaryContact;
      const duplicate = candidate.duplicateContact;

      // Prefer the most complete name, company, email
      const overrides: Partial<Contact> = {
        displayName: primary.displayName || duplicate.displayName,
        companyName: primary.companyName || duplicate.companyName,
        phone: primary.phone || duplicate.phone,
        email: primary.email || duplicate.email,
        leadStatus: (primary.leadStatus !== 'LEAD' ? primary.leadStatus : duplicate.leadStatus) as any
      };

      await apiClient.mergeContacts(primary.id, duplicate.id, overrides);

      setMergeSuccessMsg(`✓ Merged ${duplicate.displayName} into ${primary.displayName}!`);
      setCandidates(prev => prev.filter((_, i) => i !== index));
      onMergedSuccess();
      setTimeout(() => setMergeSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to merge contacts');
    } finally {
      setMergingIdx(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Smart Deduplication & Contact Merge Studio
              </h3>
              <p className="text-[11px] text-neutral-500">
                Fuzzy matching across normalized phone numbers (+91), email addresses, and company names
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadCandidates}
              className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              title="Re-scan database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-neutral-400 hover:text-white p-1">✕</button>
          </div>
        </div>

        {mergeSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{mergeSuccessMsg}</span>
          </div>
        )}

        {/* Candidate List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Scanning database for duplicate candidates...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-10 text-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Clean Workspace: Zero Duplicates Detected!
              </h4>
              <p className="text-[11px] text-neutral-500">
                All contacts have unique normalized phone numbers and distinct identifiers.
              </p>
            </div>
          ) : (
            candidates.map((candidate, idx) => {
              const primary = candidate.primaryContact;
              const duplicate = candidate.duplicateContact;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-mono">
                      {candidate.matchScore}% Match Confidence • {candidate.matchReason}
                    </span>

                    <button
                      onClick={() => handleMergePair(candidate, idx)}
                      disabled={mergingIdx === idx}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {mergingIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                      <span>1-Click Merge</span>
                    </button>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Primary (Keep) */}
                    <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-neutral-900 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-emerald-600 font-bold">
                        <span>Target Record (Keep)</span>
                        <span>ID: {primary.id.slice(0, 8)}...</span>
                      </div>
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        {primary.displayName}
                      </div>
                      <div className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-0.5">
                        <div>🏢 {primary.companyName || '—'}</div>
                        <div>📞 <span className="font-mono">{primary.phone}</span></div>
                        <div>✉️ {primary.email || '—'}</div>
                        <div>🏷️ {(primary.tags || []).join(', ') || 'None'}</div>
                      </div>
                    </div>

                    {/* Duplicate (To Merge & Archive) */}
                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1.5 opacity-80">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-neutral-400 font-bold">
                        <span>Duplicate to Merge</span>
                        <span>ID: {duplicate.id.slice(0, 8)}...</span>
                      </div>
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        {duplicate.displayName}
                      </div>
                      <div className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-0.5">
                        <div>🏢 {duplicate.companyName || '—'}</div>
                        <div>📞 <span className="font-mono">{duplicate.phone}</span></div>
                        <div>✉️ {duplicate.email || '—'}</div>
                        <div>🏷️ {(duplicate.tags || []).join(', ') || 'None'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500">
          <span>Merging automatically combines tags, appends notes, and preserves campaign histories.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
