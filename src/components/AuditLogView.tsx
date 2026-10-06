import React from 'react';
import { History, Shield, Clock, FileText, User, Terminal } from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <History className="w-4 h-4 text-neutral-500" />
          <span>Audit Log & Tamper-Evident Trail</span>
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Append-only chronological record of administrative actions, campaign approvals, and communication events
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm text-xs">
        <table className="w-full text-left">
          <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px] font-medium">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Actor & Role</th>
              <th className="py-2.5 px-3">Action Event</th>
              <th className="py-2.5 px-3">Scope</th>
              <th className="py-2.5 px-3">Event Metadata</th>
              <th className="py-2.5 px-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono text-[11px]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-neutral-400">
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                  <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-neutral-800 dark:text-neutral-200 font-sans">
                      {log.actorName}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono">
                      {log.actorRole}
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.action.includes('KILL_SWITCH')
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                        : log.action.includes('SENT') || log.action.includes('APPROVED')
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                        : log.action.includes('IMPORTED')
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                        : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}>
                      {log.action}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                    <span className="font-bold">{log.entityType}</span>: {log.entityId}
                  </td>

                  <td className="py-2.5 px-3 text-neutral-500 font-mono truncate max-w-[200px]">
                    {JSON.stringify(log.metadata)}
                  </td>

                  <td className="py-2.5 px-3 text-neutral-400">
                    {log.ipAddress}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
