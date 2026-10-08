import React, { useState } from 'react';
import { History, Shield, Clock, FileText, User, Terminal, Download, ShieldCheck, CheckCircle2, Award, FileCheck } from 'lucide-react';
import { AuditLogEntry } from '../types';
import { exportAuditLogsToCsv } from '../utils/exportService';
import { ConsentLedgerService, ComplianceCertificate } from '../core/compliance/ConsentLedgerService';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [certificate, setCertificate] = useState<ComplianceCertificate | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerateCert = () => {
    setGenerating(true);
    setTimeout(() => {
      const cert = ConsentLedgerService.generateCertificate('ReachOutOS Enterprise Tenant');
      setCertificate(cert);
      setGenerating(false);
    }, 400);
  };

  const ledgerBlocks = ConsentLedgerService.getLedger();
  const chainIntegrity = ConsentLedgerService.verifyLedgerIntegrity();

  return (
    <div className="space-y-6">
      {/* Cryptographic Consent Ledger & Certificate Banner */}
      <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Cryptographic Consent Ledger & DPDP / GDPR Compliance
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  chainIntegrity.isValid 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200' 
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-200'
                }`}>
                  {chainIntegrity.isValid ? '✓ HASH CHAIN VERIFIED' : '⚠ CHAIN INTEGRITY ALERT'}
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Append-only SHA-256 hash linked blocks verifying consent grants, opt-outs, and Meta 2026-10 compliance.
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateCert}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Award className="w-3.5 h-3.5 text-emerald-200" />
            <span>{generating ? 'Verifying Hashes...' : 'Generate Compliance Certificate'}</span>
          </button>
        </div>

        {/* Certificate Modal / Drawer if generated */}
        {certificate && (
          <div className="mt-3 p-3.5 rounded-lg bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-700 text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                <FileCheck className="w-4 h-4" />
                <span>Official Compliance Certificate: {certificate.certificateId}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => ConsentLedgerService.downloadCertificateJson(certificate)}
                  className="px-2.5 py-1 rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download JSON Certificate</span>
                </button>
                <button
                  onClick={() => setCertificate(null)}
                  className="text-neutral-400 hover:text-neutral-600 text-[11px]"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded bg-neutral-50 dark:bg-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Verified Blocks</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{certificate.totalVerifiedBlocks} Blocks</span>
              </div>
              <div className="p-2 rounded bg-neutral-50 dark:bg-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Opt-Out Compliance</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{certificate.optOutComplianceRate}</span>
              </div>
              <div className="p-2 rounded bg-neutral-50 dark:bg-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Active Opt-ins</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{certificate.activeConsentCount}</span>
              </div>
              <div className="p-2 rounded bg-neutral-50 dark:bg-neutral-800 truncate">
                <span className="text-neutral-400 block text-[10px]">Root Digest</span>
                <span className="font-bold text-neutral-700 dark:text-neutral-300 truncate">{certificate.signatureDigest.substring(0, 16)}...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <History className="w-4 h-4 text-neutral-500" />
            <span>Audit Log & Tamper-Evident Trail</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Append-only chronological record of administrative actions, campaign approvals, and communication events
          </p>
        </div>

        <button
          onClick={() => exportAuditLogsToCsv(logs)}
          disabled={logs.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition shadow-sm disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          title="Export audit log trail as CSV"
        >
          <Download className="w-3.5 h-3.5 text-neutral-500" />
          <span>Export Audit Trail ({logs.length})</span>
        </button>
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
