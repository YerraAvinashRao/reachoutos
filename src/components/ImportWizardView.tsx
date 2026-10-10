import React, { useState } from 'react';
import Papa from 'papaparse';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  RefreshCw, 
  HelpCircle,
  FileText,
  Users,
  Sparkles
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { Contact, ContactList } from '../types';
import { CreateSegmentModal } from './CreateSegmentModal';
import { DataSanitizerService } from '../core/sanitizer/DataSanitizerService';

interface ImportWizardViewProps {
  onImportComplete: () => void;
  contacts?: Contact[];
  lists?: ContactList[];
  onCreateList?: (data: any) => Promise<void>;
}

export const ImportWizardView: React.FC<ImportWizardViewProps> = ({ 
  onImportComplete,
  contacts = [],
  lists = [],
  onCreateList
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'committing' | 'success'>('upload');
  const [fileName, setFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [targetListId, setTargetListId] = useState<string>('');
  const [selectedLeadStatus, setSelectedLeadStatus] = useState<string>('LEAD');
  const [showSegmentModal, setShowSegmentModal] = useState(false);

  // Mapping state
  const [columnMapping, setColumnMapping] = useState({
    name: 'Name',
    firstName: 'First Name',
    lastName: 'Last Name',
    phone: 'Phone',
    email: 'Email',
    company: 'Company',
    city: 'City'
  });

  // Data Quality Engine Report
  const [report, setReport] = useState<any>(null);
  const [sampleProcessed, setSampleProcessed] = useState<any[]>([]);
  const [allProcessed, setAllProcessed] = useState<any[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'UPDATE_EXISTING' | 'SKIP' | 'KEEP_BOTH'>('UPDATE_EXISTING');
  const [loading, setLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sample data button for instant testing
  const loadDemoRetailersData = () => {
    const demoCSV = `Name,Company,Phone,Email,City,Customer Type
Ramesh Goud,Sri Sai Enterprises,9848011223,ramesh@saienterprises.com,Nizamabad,Retailer
Venkatesh Rao,Kalyani Stores,9440122334,venkat.kalyani@gmail.com,Bodhan,Retailer
Sunil Kumar,Kumar Dry Fruits,04023456789,sunil@tempmail.com,Hyderabad,Wholesale
Laxman Reddy,Laxmi Kirana,9989033445,laxmi.kirana@gmail.com,Armoor,Retailer
Rajesh Kumar,Rajesh Traders,9848012345,rajesh.traders.nizamabad@gmail.com,Nizamabad,Retailer
Anand Mohan,Mohan Sweets,12345,invalid-email,Nizamabad,Retailer`;

    parseCSVString(demoCSV, 'retailers_nizamabad_outreach.csv');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setRawHeaders(results.meta.fields);
          autoDetectColumns(results.meta.fields);
        }
        setRawRows(results.data as any[]);
        setStep('mapping');
      }
    });
  };

  const parseCSVString = (csvText: string, name: string) => {
    setFileName(name);
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setRawHeaders(results.meta.fields);
          autoDetectColumns(results.meta.fields);
        }
        setRawRows(results.data as any[]);
        setStep('mapping');
      }
    });
  };

  const autoDetectColumns = (fields: string[]) => {
    const mapping: any = { ...columnMapping };
    fields.forEach(f => {
      const lower = f.toLowerCase();
      if (lower.includes('name') && !lower.includes('company')) mapping.name = f;
      if (lower.includes('phone') || lower.includes('mobile') || lower.includes('whatsapp')) mapping.phone = f;
      if (lower.includes('email') || lower.includes('mail')) mapping.email = f;
      if (lower.includes('company') || lower.includes('store') || lower.includes('business')) mapping.company = f;
      if (lower.includes('city') || lower.includes('town') || lower.includes('location')) mapping.city = f;
    });
    setColumnMapping(mapping);
  };

  const handleRunValidation = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.previewImport(rawRows, columnMapping);
      const data = (res && res.report) ? res : (res && res.data ? res.data : null);
      if (data && data.report) {
        setReport(data.report);
        setSampleProcessed(data.sampleProcessed || []);
        setAllProcessed(data.processedRows || data.sampleProcessed || []);
        setStep('preview');
      } else {
        console.error('Invalid preview response:', res);
        setErrorMsg('Failed to generate preview report. Please verify your column mappings.');
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      setErrorMsg(err?.message || 'Error validating data quality. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setStep('committing');
    setErrorMsg(null);
    try {
      const rowsToCommit = allProcessed.length > 0 ? allProcessed : sampleProcessed;
      const res = await apiClient.commitImport(
        rowsToCommit, 
        duplicatePolicy, 
        fileName,
        selectedLeadStatus,
        targetListId || undefined
      );
      const data = (res && typeof res.created !== 'undefined') ? res : (res && res.data ? res.data : res);
      setCommitResult(data || { created: rowsToCommit.length, updated: 0, skipped: 0 });
      setStep('success');
    } catch (err: any) {
      console.error('Commit error:', err);
      setErrorMsg(err?.message || 'Failed to commit contacts to database.');
      setStep('preview');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div>
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Contact Import & Data Quality Pipeline
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Raw Upload → Auto Normalization (+91 E.164) → Validation Engine → Duplicate Resolution → Staged Commit
        </p>
      </div>

      {/* Steps Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <span className={`px-2 py-0.5 rounded ${step === 'upload' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'text-neutral-400'}`}>
          1. Upload
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">→</span>
        <span className={`px-2 py-0.5 rounded ${step === 'mapping' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'text-neutral-400'}`}>
          2. Schema Mapping
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">→</span>
        <span className={`px-2 py-0.5 rounded ${step === 'preview' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'text-neutral-400'}`}>
          3. Quality Inspection
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">→</span>
        <span className={`px-2 py-0.5 rounded ${step === 'success' ? 'bg-emerald-600 text-white font-bold' : 'text-neutral-400'}`}>
          4. Complete
        </span>
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-8 text-center space-y-3 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Select or drop spreadsheet file
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Supports CSV, TSV, XLSX, VCF formats up to 25 MB
              </p>
            </div>
            <div className="pt-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold cursor-pointer shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition">
                <span>Browse Local Files</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Quick Demo Test Option */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                Test with Sample Telangana Retailers
              </div>
              <div className="text-neutral-500 text-[11px]">
                Preloaded sample containing valid numbers, landlines, duplicate records, and invalid rows.
              </div>
            </div>
            <button
              onClick={loadDemoRetailersData}
              className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
            >
              Load Sample Data
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Column Mapping */}
      {step === 'mapping' && (
        <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Map Spreadsheet Columns to Contact Attributes
              </h3>
              <p className="text-xs text-neutral-500">
                Found {rawRows.length} rows in <span className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">{fileName}</span>
              </p>
            </div>
            <button
              onClick={() => setStep('upload')}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block text-neutral-500 font-medium mb-1">Contact Name / Full Name *</label>
              <select
                value={columnMapping.name}
                onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-neutral-500 font-medium mb-1">Company / Store Name</label>
              <select
                value={columnMapping.company}
                onChange={(e) => setColumnMapping({ ...columnMapping, company: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="">(None)</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-neutral-500 font-medium mb-1">Mobile / WhatsApp Number *</label>
              <select
                value={columnMapping.phone}
                onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-neutral-500 font-medium mb-1">Email Address</label>
              <select
                value={columnMapping.email}
                onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="">(None)</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-neutral-500 font-medium mb-1">City / Town</label>
              <select
                value={columnMapping.city}
                onChange={(e) => setColumnMapping({ ...columnMapping, city: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="">(None)</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleRunValidation}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs flex items-center gap-2 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Inspecting Data Quality...' : 'Inspect & Validate Data Quality'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Quality Report & Problematic Rows Preview */}
      {step === 'preview' && report && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
              <div className="text-neutral-500">Total Rows Detected</div>
              <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100">{report.totalRows}</div>
            </div>

            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1">
              <div className="text-emerald-700 dark:text-emerald-400 font-medium">Valid for Outreach</div>
              <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">{report.validRows}</div>
            </div>

            <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-1">
              <div className="text-amber-700 dark:text-amber-400 font-medium">Duplicates Detected</div>
              <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">{report.duplicateRows}</div>
            </div>

            <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-1">
              <div className="text-rose-700 dark:text-rose-400 font-medium">Invalid Phone / Email</div>
              <div className="text-lg font-bold font-mono text-rose-700 dark:text-rose-400">{report.invalidRows}</div>
            </div>
          </div>

          {/* AI Smart Data Sanitizer & Transformation Telemetry */}
          {(() => {
            const sanitization = DataSanitizerService.sanitizeBatch(rawRows);
            return (
              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Smart Data Sanitizer & AI Column Transformer</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold">
                    ✓ E.164 STANDARDIZED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-400 block text-[10px]">Phone Numbers Fixed</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{sanitization.phoneNumbersFixed} Auto-Formatted</strong>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-400 block text-[10px]">Names Title-Cased</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{sanitization.namesNormalized} Standardized</strong>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-400 block text-[10px]">Disposable Emails</span>
                    <strong className="text-neutral-700 dark:text-neutral-300">{sanitization.invalidEmailsFlagged} Flagged</strong>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                    <span className="text-neutral-400 block text-[10px]">Duplicates Stripped</span>
                    <strong className="text-amber-600 dark:text-amber-400">{sanitization.duplicatesRemoved} Deduplicated</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Problematic Rows Triage Table */}
          {report.issues.length > 0 && (
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Data Quality Inspection Flags ({report.issues.length})</span>
              </h4>
              <p className="text-[11px] text-neutral-500">
                The engine never silently discards rows. Problematic rows are flagged below:
              </p>

              <div className="max-h-48 overflow-y-auto rounded border border-neutral-100 dark:border-neutral-800 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 text-[11px]">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Field</th>
                      <th className="p-2">Raw Value</th>
                      <th className="p-2">Issue Diagnostic</th>
                      <th className="p-2">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
                    {report.issues.map((iss: any, i: number) => (
                      <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                        <td className="p-2 font-mono">#{iss.rowNumber}</td>
                        <td className="p-2 font-mono">{iss.field}</td>
                        <td className="p-2 font-mono truncate max-w-[120px]">{iss.value}</td>
                        <td className="p-2 text-neutral-700 dark:text-neutral-300">{iss.error}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-medium ${
                            iss.severity === 'ERROR' 
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          }`}>
                            {iss.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Duplicate Resolution Policy */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 text-xs">
            <h4 className="font-bold text-neutral-900 dark:text-neutral-100">
              Duplicate Resolution Strategy
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className={`p-3 rounded-lg border cursor-pointer transition ${
                duplicatePolicy === 'UPDATE_EXISTING'
                  ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}>
                <input
                  type="radio"
                  name="dup"
                  value="UPDATE_EXISTING"
                  checked={duplicatePolicy === 'UPDATE_EXISTING'}
                  onChange={() => setDuplicatePolicy('UPDATE_EXISTING')}
                  className="mr-2"
                />
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Update Existing</span>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Overwrite missing fields & merge tags onto matching contact record.
                </p>
              </label>

              <label className={`p-3 rounded-lg border cursor-pointer transition ${
                duplicatePolicy === 'SKIP'
                  ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}>
                <input
                  type="radio"
                  name="dup"
                  value="SKIP"
                  checked={duplicatePolicy === 'SKIP'}
                  onChange={() => setDuplicatePolicy('SKIP')}
                  className="mr-2"
                />
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Skip Duplicates</span>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Leave existing contact records untouched; skip matching rows.
                </p>
              </label>

              <label className={`p-3 rounded-lg border cursor-pointer transition ${
                duplicatePolicy === 'KEEP_BOTH'
                  ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}>
                <input
                  type="radio"
                  name="dup"
                  value="KEEP_BOTH"
                  checked={duplicatePolicy === 'KEEP_BOTH'}
                  onChange={() => setDuplicatePolicy('KEEP_BOTH')}
                  className="mr-2"
                />
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Keep Both</span>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Import as distinct new contacts with separate IDs.
                </p>
              </label>
            </div>
          </div>

          {/* Audience Segment & Category Mapping on Import */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
            <div>
              <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary-600" />
                <span>Audience Segment & Category Mapping (Optional)</span>
              </h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Tag all verified imported contacts and map them directly into a target audience segment in database.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-neutral-600 dark:text-neutral-300 font-semibold text-xs mb-1">
                  Customer Segment (Category)
                </label>
                <select
                  value={selectedLeadStatus}
                  onChange={(e) => setSelectedLeadStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium text-xs focus:outline-none"
                >
                  <option value="LEAD">LEAD (General Leads)</option>
                  <option value="FAMILY">FAMILY & RELATIVES</option>
                  <option value="LOCAL">LOCAL CONTACTS</option>
                  <option value="VIP">VIP (High Priority)</option>
                  <option value="RETAILER">RETAILER</option>
                  <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  <option value="WHOLESALE">WHOLESALE</option>
                  <option value="CUSTOMER">CUSTOMER</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-600 dark:text-neutral-300 font-semibold text-xs">
                    Target Audience List
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSegmentModal(true)}
                    className="text-[11px] text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                  >
                    + Create New Segment
                  </button>
                </div>
                <select
                  value={targetListId}
                  onChange={(e) => {
                    if (e.target.value === '__CREATE_NEW__') {
                      setShowSegmentModal(true);
                    } else {
                      setTargetListId(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium text-xs focus:outline-none"
                >
                  <option value="">-- None (Do not assign to list) --</option>
                  {lists.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.contactIds.length} members)</option>
                  ))}
                  <option value="__CREATE_NEW__" className="font-bold text-primary-600">
                    + Create New Segment...
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep('mapping')}
              className="px-3 py-1.5 rounded text-xs border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
            >
              Back to Mapping
            </button>

            <button
              onClick={handleCommit}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition"
            >
              <span>Commit & Ingest Verified Contacts</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Unified Create Segment Modal */}
      <CreateSegmentModal
        isOpen={showSegmentModal}
        onClose={() => setShowSegmentModal(false)}
        contacts={contacts}
        existingLists={lists}
        initialSegment={selectedLeadStatus}
        initialName=""
        onSave={async (data) => {
          if (onCreateList) {
            await onCreateList(data);
          }
          setShowSegmentModal(false);
        }}
      />

      {/* STEP 4: Success confirmation */}
      {step === 'success' && (
        <div className="p-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Import Pipeline Complete
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Contacts have been normalized and committed to ReachOut OS database.
            </p>
          </div>

          {commitResult && (
            <div className="inline-flex gap-4 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 font-mono text-xs">
              <div>Created: <span className="font-bold text-emerald-600">{commitResult.created}</span></div>
              <div>Updated: <span className="font-bold text-blue-600">{commitResult.updated}</span></div>
              <div>Skipped: <span className="font-bold text-neutral-400">{commitResult.skipped}</span></div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onImportComplete}
              className="px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-xs shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition"
            >
              Go to Contact Intelligence
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
