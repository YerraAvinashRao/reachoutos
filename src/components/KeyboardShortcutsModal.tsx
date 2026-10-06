import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'W', description: 'Open WhatsApp official composer with prefilled message' },
    { key: 'E', description: 'Open Email client (mailto) with prefilled subject and body' },
    { key: 'S', description: 'Mark current recipient as User Sent and advance to next' },
    { key: 'K', description: 'Skip current recipient with skip reason and advance' },
    { key: 'B', description: 'Globally block/suppress contact (Never contact again)' },
    { key: 'C', description: 'Copy personalized message body to clipboard' },
    { key: 'N', description: 'Navigate to Next recipient in queue' },
    { key: 'P', description: 'Navigate to Previous recipient in queue' },
    { key: '?', description: 'Open this Keyboard Shortcuts cheat-sheet' }
  ];

  return (
    <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Keyboard Navigation Shortcuts
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-neutral-500">
          In the Manual Sending Workspace, you can review, open, and confirm messages at maximum speed without lifting your hands from the keyboard:
        </p>

        <div className="space-y-2 text-xs">
          {shortcuts.map(s => (
            <div key={s.key} className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800">
              <span className="text-neutral-700 dark:text-neutral-300">{s.description}</span>
              <kbd className="px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs shadow-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
