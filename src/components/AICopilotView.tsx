import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  Languages, 
  Wand2, 
  RefreshCw,
  Coins
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface AICopilotViewProps {
  initialPromptText?: string;
  onApplyToTemplate?: (text: string) => void;
}

export const AICopilotView: React.FC<AICopilotViewProps> = ({
  initialPromptText = '',
  onApplyToTemplate
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'polish' | 'guardrails'>('generate');
  
  // Generation inputs
  const [productName, setProductName] = useState('');
  const [senderBrand, setSenderBrand] = useState('');
  const [audienceType, setAudienceType] = useState('Retail & Wholesale Buyers');
  const [targetCity, setTargetCity] = useState('');
  const [tone, setTone] = useState<'professional' | 'warm' | 'direct' | 'festive'>('professional');
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [benefits, setBenefits] = useState('');
  
  const [generatedDrafts, setGeneratedDrafts] = useState<any[]>([]);
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  // Polish / Rewrite inputs
  const [currentMessage, setCurrentMessage] = useState(
    initialPromptText ||
    'Hello {{first_name}},\n\nWe are pleased to introduce our product catalog to distributors and retail partners in {{city}}.\n\nWould you like a product sample kit delivered to {{company_name}} this week?\n\nBest regards,\nOutreach Team'
  );
  const [loadingRewrite, setLoadingRewrite] = useState(false);

  // Guardrails state
  const [guardrailReport, setGuardrailReport] = useState<any>(null);
  const [loadingGuardrails, setLoadingGuardrails] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setLoadingGenerate(true);
    try {
      const res = await apiClient.aiGenerateDrafts({
        productName,
        senderBrand,
        audienceType,
        targetCity,
        tone,
        channel,
        keyBenefits: benefits.split(',').map(b => b.trim())
      });
      if (res?.data?.drafts) {
        setGeneratedDrafts(res.data.drafts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handleRewrite = async (mode: any) => {
    setLoadingRewrite(true);
    try {
      const res = await apiClient.aiRewrite({
        message: currentMessage,
        mode
      });
      if (res?.data?.rewritten) {
        setCurrentMessage(res.data.rewritten);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRewrite(false);
    }
  };

  // Compliance Policy Engine state
  const [complianceDecision, setComplianceDecision] = useState<any>(null);
  const [policyMetadata, setPolicyMetadata] = useState<any>(null);

  React.useEffect(() => {
    apiClient.getCompliancePolicy().then(res => {
      if (res?.data?.metadata) {
        setPolicyMetadata(res.data.metadata);
      }
    }).catch(err => console.error('Failed to load compliance policy metadata', err));
  }, []);

  const handleCheckGuardrails = async () => {
    setLoadingGuardrails(true);
    try {
      const [aiRes, compRes] = await Promise.allSettled([
        apiClient.aiGuardrails(currentMessage),
        apiClient.evaluateCompliance({
          channel: 'WHATSAPP',
          isMarketing: true,
          messageBody: currentMessage,
          consentStatus: 'GRANTED',
          withinCustomerServiceWindow: false,
          templateCategory: 'MARKETING',
          templateStatus: 'APPROVED'
        })
      ]);

      if (aiRes.status === 'fulfilled' && aiRes.value?.data) {
        setGuardrailReport(aiRes.value.data);
      }
      if (compRes.status === 'fulfilled' && compRes.value?.data) {
        setComplianceDecision(compRes.value.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGuardrails(false);
    }
  };

  const copyToClipboard = (text: string, index?: number) => {
    navigator.clipboard.writeText(text);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>AI Message Copilot</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Powered by server-side Gemini 3.8 Flash • Deterministic Guardrails & Telemetry Safe
          </p>
        </div>

        {/* Cost Control Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
          <Coins className="w-3.5 h-3.5 text-amber-500" />
          <span>Cost Control Active: ~₹0.08 / generation</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('generate')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'generate'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-neutral-500'
          }`}
        >
          1. Generate Outreach Copy (3 Variations)
        </button>
        <button
          onClick={() => setActiveTab('polish')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'polish'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-neutral-500'
          }`}
        >
          2. Polish, Shorten & Translate
        </button>
        <button
          onClick={() => {
            setActiveTab('guardrails');
            if (!guardrailReport) handleCheckGuardrails();
          }}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'guardrails'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-neutral-500'
          }`}
        >
          3. Compliance & Spam Guardrails
        </button>
      </div>

      {/* TAB 1: GENERATE DRAFTS */}
      {activeTab === 'generate' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 text-xs">
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100">
              Commercial Brief Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-neutral-500 font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Target Audience</label>
                <input
                  type="text"
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Target City / Region</label>
                <input
                  type="text"
                  value={targetCity}
                  onChange={(e) => setTargetCity(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-neutral-500 font-medium mb-1">Tone of Voice</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="warm">Warm & Respectful (Indian B2B)</option>
                  <option value="direct">Direct & Margin-Focused</option>
                  <option value="professional">Formal Wholesale Buyer</option>
                  <option value="festive">Festive / Seasonal Offer</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Channel Focus</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="WHATSAPP">WhatsApp (Concise, Mobile Spacing)</option>
                  <option value="EMAIL">Email (Formal Body & Subject)</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 font-medium mb-1">Sender Brand</label>
                <input
                  type="text"
                  value={senderBrand}
                  onChange={(e) => setSenderBrand(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-500 font-medium mb-1">Key Selling Points & Commercial Hooks</label>
              <input
                type="text"
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={loadingGenerate}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loadingGenerate ? 'Thinking with Gemini 3.8 Flash...' : 'Generate 3 Outreach Drafts'}</span>
              </button>
            </div>
          </div>

          {/* Generated Drafts Output */}
          {generatedDrafts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {generatedDrafts.map((d, i) => (
                <div key={i} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 text-xs flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">
                        {d.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 font-mono font-medium">
                        Option #{i + 1}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-400 italic">
                      Hook: "{d.hook}"
                    </div>

                    <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-800/40 text-neutral-800 dark:text-neutral-200 whitespace-pre-line text-xs font-sans leading-relaxed max-h-48 overflow-y-auto">
                      {d.body}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <button
                      onClick={() => copyToClipboard(d.body, i)}
                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1"
                    >
                      {copiedIndex === i ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedIndex === i ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentMessage(d.body);
                        setActiveTab('polish');
                      }}
                      className="text-purple-600 dark:text-purple-400 font-semibold hover:underline"
                    >
                      Use in Polish Lab →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POLISH & TRANSLATE */}
      {activeTab === 'polish' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-bold text-neutral-900 dark:text-neutral-100">
                Outreach Message Editor
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {currentMessage.length} characters • ~{Math.ceil(currentMessage.split(/\s+/).length)} words
              </span>
            </div>

            <textarea
              rows={7}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-sans focus:outline-none leading-relaxed text-xs"
            />

            {/* Quick Rewrite Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => handleRewrite('shorten')}
                disabled={loadingRewrite}
                className="px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
              >
                ✂️ Shorten (&lt;50 words)
              </button>
              <button
                onClick={() => handleRewrite('persuasive')}
                disabled={loadingRewrite}
                className="px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
              >
                📈 More Persuasive (Margins)
              </button>
              <button
                onClick={() => handleRewrite('professional')}
                disabled={loadingRewrite}
                className="px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
              >
                👔 Formal B2B Tone
              </button>
              <button
                onClick={() => handleRewrite('telugu')}
                disabled={loadingRewrite}
                className="px-2.5 py-1.5 rounded border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition"
              >
                🇮🇳 Translate to Telugu (తెలుగు)
              </button>
              <button
                onClick={() => handleRewrite('hindi')}
                disabled={loadingRewrite}
                className="px-2.5 py-1.5 rounded border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition"
              >
                🇮🇳 Translate to Hindi (हिंदी)
              </button>
              <button
                onClick={() => handleRewrite('hinglish')}
                disabled={loadingRewrite}
                className="px-2.5 py-1.5 rounded border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition"
              >
                💬 Adapt to Hinglish
              </button>
            </div>

            {loadingRewrite && (
              <div className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Rewriting message with Gemini 3.8 Flash...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COMPLIANCE & GUARDRAILS */}
      {activeTab === 'guardrails' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100">
                  Policy & Compliance Guardrail Evaluation
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Screens against spam phrasing, hyperbole, unverified medical claims, and ensures respectful CTAs.
                </p>
              </div>
              <button
                onClick={handleCheckGuardrails}
                disabled={loadingGuardrails}
                className="px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold"
              >
                {loadingGuardrails ? 'Scanning...' : 'Re-scan Message'}
              </button>
            </div>

            {guardrailReport && (
              <div className="space-y-3 pt-2">
                {/* Score bar */}
                <div className="p-3.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 flex items-center justify-between">
                  <div>
                    <div className="text-neutral-500 text-[11px]">Outreach Quality & Safety Score</div>
                    <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {guardrailReport.score} / 100
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-neutral-400 text-[10px]">Estimated Reading Time</div>
                    <div className="font-mono text-neutral-700 dark:text-neutral-300 font-medium">
                      ~{guardrailReport.estimatedReadTimeSec} seconds
                    </div>
                  </div>
                </div>

                {/* Spam Triggers */}
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
                  <div className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    {guardrailReport.spamTriggers.length === 0 ? (
                      <span className="text-emerald-600 flex items-center gap-1">✓ No aggressive spam triggers detected</span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Spam Risks Detected:</span>
                    )}
                  </div>
                  {guardrailReport.spamTriggers.map((s: string, i: number) => (
                    <div key={i} className="text-rose-600 pl-4 text-[11px]">• {s}</div>
                  ))}
                </div>

                {/* Unsupported Claims */}
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
                  <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {guardrailReport.unsupportedClaims.length === 0 ? (
                      <span className="text-emerald-600 flex items-center gap-1">✓ No unsupported medical/miracle claims</span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Unsupported Claims Detected:</span>
                    )}
                  </div>
                  {guardrailReport.unsupportedClaims.map((c: string, i: number) => (
                    <div key={i} className="text-rose-600 pl-4 text-[11px]">• {c}</div>
                  ))}
                </div>

                {/* Recommendations */}
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-1">
                  <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Deliverability Recommendations:
                  </div>
                  {guardrailReport.recommendations.map((r: string, i: number) => (
                    <div key={i} className="text-neutral-600 dark:text-neutral-400 pl-4 text-[11px]">• {r}</div>
                  ))}
                </div>
              </div>
            )}

            {/* META WHATSAPP POLICY ENGINE EVALUATION */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Meta Official Authority
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Policy v{policyMetadata?.version || '2026-10'}
                    </span>
                  </div>
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm mt-1">
                    Meta WhatsApp Business Policy Engine
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Source of truth: <a href="https://business.whatsapp.com/policy" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">Meta Official Business Messaging Policy</a>. Invariant: <em>The AI proposes. The policy engine decides.</em>
                  </p>
                </div>
                {complianceDecision && (
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    complianceDecision.decision === 'ALLOW'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : complianceDecision.decision === 'HUMAN_REVIEW'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}>
                    <span>{complianceDecision.decision === 'ALLOW' ? '🟢' : complianceDecision.decision === 'HUMAN_REVIEW' ? '🟡' : '🔴'}</span>
                    <span>{complianceDecision.decision}</span>
                  </div>
                )}
              </div>

              {complianceDecision ? (
                <div className="space-y-2.5 pt-1">
                  {complianceDecision.violations.length > 0 && (
                    <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/20 space-y-1.5">
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Violations Detected ({complianceDecision.violations.length})
                      </div>
                      {complianceDecision.violations.map((v: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-rose-600 dark:text-rose-300">
                          <span className="font-mono font-bold mr-1.5">[{v.ruleId}]</span>
                          {v.reason}
                        </div>
                      ))}
                      {complianceDecision.requiredActions?.length > 0 && (
                        <div className="text-[10px] text-rose-500 pt-1 border-t border-rose-200/50 dark:border-rose-900/30">
                          <strong>Required Action:</strong> {complianceDecision.requiredActions.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rule Evaluation Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {complianceDecision.ruleEvaluations?.map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-[11px] ${
                          r.passed
                            ? 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                            : r.severity === 'BLOCKING'
                            ? 'border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20'
                            : 'border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono font-semibold">
                          <span className="text-neutral-700 dark:text-neutral-300">{r.ruleId}</span>
                          <span className={r.passed ? 'text-emerald-600' : r.severity === 'BLOCKING' ? 'text-rose-600' : 'text-amber-600'}>
                            {r.passed ? '✓ PASSED' : r.severity === 'BLOCKING' ? '✕ BLOCKED' : '⚠ REVIEW'}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">
                          {r.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-400 italic py-2">
                  Click "Re-scan Message" above to evaluate this message against the full Meta WhatsApp Business Policy rule suite.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safety Notice Footer */}
      <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 text-[11px] text-neutral-500 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-neutral-700 dark:text-neutral-300">AI Guardrail Architecture:</strong> AI functions exclusively as a drafting copilot. It cannot independently authorize dispatches, override suppression flags, or alter recipient consent records.
        </div>
      </div>
    </div>
  );
};
