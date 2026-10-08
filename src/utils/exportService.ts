/**
 * ReachOut OS - Enterprise Export & Reporting Engine
 * 
 * Supports RFC 4180-compliant CSV generation with UTF-8 BOM encoding for Microsoft Excel & Google Sheets.
 * Automatically sanitizes spreadsheet cells to prevent formula injection attacks (=, +, -, @).
 */

import { Contact, CampaignRecipient, Campaign } from '../types';

/**
 * Escapes and sanitizes a cell value for CSV output:
 * - Neutralizes formula injection (=, +, -, @)
 * - Quotes strings containing commas, quotes, or newlines
 * - Replaces double quotes with escaped double quotes ("")
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Formula injection prevention
  if (['=', '+', '-', '@', '\t', '\r'].includes(str.charAt(0))) {
    str = `'${str}`;
  }

  // If the cell contains quotes, commas, or line breaks, wrap in double quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts a 2D array of headers and rows into a CSV string
 */
export function convertToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows.map(row => row.map(sanitizeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Triggers a client-side file download with UTF-8 BOM for proper multi-lingual Excel rendering
 */
export function triggerFileDownload(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  // \uFEFF is UTF-8 Byte Order Mark for Excel
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports contacts to CSV
 */
export function exportContactsToCsv(contacts: Contact[], filename = `reachout_contacts_${Date.now()}.csv`): void {
  const headers = [
    'Contact ID',
    'Display Name',
    'First Name',
    'Last Name',
    'Company Name',
    'Job Title',
    'Phone',
    'Email',
    'City',
    'State',
    'Country',
    'Lead Status / Segment',
    'Source',
    'Tags',
    'Status',
    'WhatsApp Allowed',
    'Email Allowed',
    'Globally Blocked',
    'Created At'
  ];

  const rows = contacts.map(c => [
    c.id,
    c.displayName || `${c.firstName} ${c.lastName}`.trim(),
    c.firstName || '',
    c.lastName || '',
    c.companyName || '',
    c.jobTitle || '',
    c.phone || '',
    c.email || '',
    c.city || '',
    c.state || '',
    c.country || '',
    c.leadStatus || 'LEAD',
    c.source || '',
    (c.tags || []).join('; '),
    c.status || 'ACTIVE',
    c.preferences?.WHATSAPP?.marketingAllowed ? 'YES' : 'NO',
    c.preferences?.EMAIL?.marketingAllowed ? 'YES' : 'NO',
    c.isGloballyBlocked ? 'YES' : 'NO',
    c.createdAt || ''
  ]);

  const csv = convertToCsv(headers, rows);
  triggerFileDownload(csv, filename);
}

/**
 * Exports campaign recipients & outreach dispatch log to CSV
 */
export function exportCampaignRecipientsToCsv(
  campaign: Campaign,
  recipients: CampaignRecipient[],
  contacts: Contact[] = [],
  filename?: string
): void {
  const safeFilename = filename || `campaign_${campaign.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_outreach_log_${Date.now()}.csv`;

  const headers = [
    'Recipient ID',
    'Contact ID',
    'Contact Name',
    'Company',
    'Channel',
    'Address (Phone/Email)',
    'Dispatch Status',
    'Policy Compliance Status',
    'Resolved Subject',
    'Resolved Message Preview',
    'Attachment Name',
    'Last Updated At'
  ];

  const rows = recipients.map(r => {
    const contact = contacts.find(c => c.id === r.contactId);
    return [
      r.id,
      r.contactId,
      r.contactName || contact?.displayName || '',
      r.companyName || contact?.companyName || '',
      r.channel,
      r.channelAddress,
      r.status,
      contact?.isGloballyBlocked ? 'SUPPRESSED_GLOBALLY' : r.policyNotes || 'APPROVED',
      r.resolvedSubject || '',
      r.resolvedMessage ? r.resolvedMessage.replace(/\n/g, ' ') : '',
      r.attachmentName || '',
      r.updatedAt || ''
    ];
  });

  const csv = convertToCsv(headers, rows);
  triggerFileDownload(csv, safeFilename);
}

/**
 * Exports compliance and security audit logs to CSV
 */
export function exportAuditLogsToCsv(auditLogs: any[], filename = `compliance_audit_log_${Date.now()}.csv`): void {
  const headers = [
    'Log ID',
    'Timestamp',
    'Actor Name',
    'Actor Role',
    'Action Type',
    'Entity Type',
    'Entity ID',
    'IP Address',
    'Details'
  ];

  const rows = auditLogs.map(l => [
    l.id,
    l.createdAt || l.created_at || '',
    l.actorName || l.actor_name || '',
    l.actorRole || l.actor_role || '',
    l.action || '',
    l.entityType || l.entity_type || '',
    l.entityId || l.entity_id || '',
    l.ipAddress || l.ip_address || '',
    l.metadata ? JSON.stringify(l.metadata) : ''
  ]);

  const csv = convertToCsv(headers, rows);
  triggerFileDownload(csv, filename);
}

/**
 * Exports analytics funnel & operator summary to CSV
 */
export function exportAnalyticsToCsv(data: any, campaignName = 'Aggregate', filename = `analytics_summary_${Date.now()}.csv`): void {
  const headers = [
    'Metric Category',
    'Metric Name',
    'Value',
    'Percentage / Rate'
  ];

  const funnel = data?.funnel || {};
  const total = funnel.totalRecipients || 0;

  const rows: (string | number)[][] = [
    ['Scope', 'Campaign Scope', campaignName, '—'],
    ['Funnel', 'Total Recipients Targeted', total, '100%'],
    ['Funnel', '1. Prepared & Opened in Composer', funnel.openedInComposer || 0, total > 0 ? `${Math.round(((funnel.openedInComposer || 0) / total) * 100)}%` : '0%'],
    ['Funnel', '2. Confirmed Sent by Operator', funnel.confirmedSent || 0, total > 0 ? `${Math.round(((funnel.confirmedSent || 0) / total) * 100)}%` : '0%'],
    ['Funnel', '3. Inbound Responses Received', funnel.replied || 0, total > 0 ? `${Math.round(((funnel.replied || 0) / total) * 100)}%` : '0%'],
    ['Funnel', '4. Qualified / Converted Leads', funnel.qualified || 0, total > 0 ? `${Math.round(((funnel.qualified || 0) / total) * 100)}%` : '0%'],
    ['Suppression', 'Suppressed / Blocked Count', funnel.suppressed || 0, total > 0 ? `${Math.round(((funnel.suppressed || 0) / total) * 100)}%` : '0%'],
    ['Suppression', 'Skipped by Operator', funnel.skipped || 0, total > 0 ? `${Math.round(((funnel.skipped || 0) / total) * 100)}%` : '0%'],
    ['Suppression', 'Opted Out / Unsubscribed', funnel.optedOut || 0, total > 0 ? `${Math.round(((funnel.optedOut || 0) / total) * 100)}%` : '0%']
  ];

  if (Array.isArray(data?.operatorPerformance)) {
    data.operatorPerformance.forEach((op: any) => {
      rows.push(['Operator Leaderboard', `${op.operatorName} (${op.role})`, `${op.sentCount} sent (${op.openedCount} opened)`, `${op.avgSpeedPerHour} msg/hr`]);
    });
  }

  const csv = convertToCsv(headers, rows);
  triggerFileDownload(csv, filename);
}
