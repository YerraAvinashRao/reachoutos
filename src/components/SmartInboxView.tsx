import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Search, 
  Clock, 
  Phone, 
  Mail, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  ExternalLink, 
  Tag, 
  CheckCircle2,
  RefreshCw,
  Zap,
  Bookmark,
  Building,
  User
} from 'lucide-react';
import { ConversationThread, ConversationMessage, CannedResponse, Role } from '../types';
import { apiClient } from '../services/apiClient';
import { IntentClassifierService } from '../core/nlp/IntentClassifierService';
import { SmartReplyGeneratorService } from '../core/nlp/SmartReplyGeneratorService';

interface SmartInboxViewProps {
  userRole: Role;
}

export const SmartInboxView: React.FC<SmartInboxViewProps> = ({ userRole }) => {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [selectedThread, setSelectedThread] = useState<ConversationThread | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [newShortcut, setNewShortcut] = useState('/catalog');
  const [newTitle, setNewTitle] = useState('Product Catalog Link');
  const [newCategory, setNewCategory] = useState<'SALES' | 'SUPPORT' | 'PAYMENTS' | 'SAMPLES' | 'GENERAL'>('SALES');
  const [newBody, setNewBody] = useState('Here is our full wholesale catalog PDF: https://reachoutos.com/catalog.pdf');

  const loadData = async () => {
    setLoading(true);
    try {
      const [threadsRes, cannedRes] = await Promise.all([
        apiClient.getInboxThreads(),
        apiClient.getCannedResponses()
      ]);
      setThreads(threadsRes || []);
      setCannedResponses(cannedRes || []);
      if (!selectedThread && threadsRes && threadsRes.length > 0) {
        setSelectedThread(threadsRes[0]);
      }
    } catch (err) {
      console.warn('Failed to load smart inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedThread || !selectedThread.contactId) {
      setMessages(selectedThread?.messages || []);
      return;
    }
    apiClient.getInboxMessages(selectedThread.contactId)
      .then(res => setMessages(res && res.length > 0 ? res : selectedThread.messages || []))
      .catch(() => setMessages(selectedThread.messages || []));
  }, [selectedThread]);

  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim()) return;
    const body = replyText.trim();
    const tempMsg: ConversationMessage = {
      id: `temp-${Date.now()}`,
      contactId: selectedThread.contactId || 'unknown',
      direction: 'OUTBOUND',
      channel: 'WHATSAPP',
      body,
      status: 'DELIVERED',
      senderAddress: 'Operator',
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMsg]);
    setReplyText('');

    // Open direct WhatsApp Composer
    const digits = (selectedThread.phone || '').replace(/\D/g, '');
    if (digits) {
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Record in database
    if (selectedThread.contactId) {
      apiClient.sendInboxMessage(selectedThread.contactId, body, 'WHATSAPP').catch(console.warn);
    }
  };

  const handleCreateCanned = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiClient.createCannedResponse({
        title: newTitle,
        shortcut: newShortcut,
        category: newCategory,
        body: newBody
      });
      setCannedResponses(prev => [...prev, created]);
      setShowCannedModal(false);
      setNewTitle('');
      setNewShortcut('');
      setNewBody('');
    } catch (err: any) {
      alert(err?.message || 'Failed to create canned response');
    }
  };

  const filteredThreads = threads.filter(t => 
    t.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone.includes(searchTerm) ||
    t.lastMessageSnippet.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>2-Way Smart Inbox & Live Conversation Feed</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Real-time inbound customer replies, 24h Meta service window timers, and 1-click canned trade responses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCannedModal(true)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Canned Snippets ({cannedResponses.length})</span>
          </button>

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition shadow-xs cursor-pointer"
            title="Refresh threads"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Inbox Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-230px)] min-h-[500px]">
        {/* Left Thread List (5 cols) */}
        <div className="md:col-span-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs flex flex-col overflow-hidden">
          {/* Search box */}
          <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-xs focus:outline-hidden"
              />
            </div>
          </div>

          {/* Thread items */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No conversation threads found. Inbound messages from WhatsApp will appear here automatically.
              </div>
            ) : (
              filteredThreads.map((thread, idx) => {
                const isSelected = selectedThread?.phone === thread.phone;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedThread(thread)}
                    className={`w-full text-left p-3.5 transition flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-l-4 border-emerald-600'
                        : 'hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {thread.contactName.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                          {thread.contactName}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          {new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-500 truncate">
                        {thread.companyName} • {thread.phone}
                      </div>

                      <p className="text-xs text-neutral-700 dark:text-neutral-300 truncate font-sans">
                        {thread.lastMessageSnippet}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Conversation View (8 cols) */}
        <div className="md:col-span-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs flex flex-col overflow-hidden">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                    {selectedThread.contactName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <span>{selectedThread.contactName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">
                        {selectedThread.leadStatus}
                      </span>
                    </h3>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {selectedThread.companyName} • {selectedThread.phone}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/${selectedThread.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* 24-Hour Service Window Indicator */}
              <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Meta 24h Customer Service Window Active</span>
                </div>
                <span className="font-mono text-neutral-400">
                  Free-form direct reply permitted
                </span>
              </div>

              {/* AI Lead Intent & Auto-Action Intelligence Banner */}
              {(() => {
                const latestInbound = [...messages].reverse().find(m => m.direction === 'INBOUND') || 
                  (selectedThread.lastMessageDirection === 'INBOUND' ? { body: selectedThread.lastMessageBody } : null);
                
                if (!latestInbound || !latestInbound.body) return null;
                const analysis = IntentClassifierService.classifyMessage(latestInbound.body);
                const badge = IntentClassifierService.getIntentBadge(analysis.intent);

                return (
                  <div className="px-4 py-2.5 bg-purple-50/70 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900/40 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>AI Intent:</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-purple-800 dark:text-purple-300">
                        • {analysis.recommendedAction}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {analysis.suggestedCannedReplyId && (
                        <button
                          onClick={() => {
                            const canned = cannedResponses.find(c => c.id === analysis.suggestedCannedReplyId) || cannedResponses[0];
                            if (canned) setReplyText(canned.body);
                          }}
                          className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                        >
                          <Zap className="w-3 h-3 text-amber-300" />
                          <span>Auto-Fill Suggested Reply</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Message Thread Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-neutral-50/40 dark:bg-neutral-950/40">
                {messages.map((msg, idx) => {
                  const isInbound = msg.direction === 'INBOUND';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isInbound
                            ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-tl-xs'
                            : 'bg-emerald-600 text-white rounded-tr-xs'
                        }`}
                      >
                        <p className="whitespace-pre-line font-sans">{msg.body}</p>
                        <div
                          className={`mt-1 text-[10px] font-mono text-right ${
                            isInbound ? 'text-neutral-400' : 'text-emerald-100'
                          }`}
                        >
                          {new Date(msg.receivedAt || msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Multi-Option Smart Reply Drafts */}
              {(() => {
                const latestInbound = [...messages].reverse().find(m => m.direction === 'INBOUND') || 
                  (selectedThread.lastMessageDirection === 'INBOUND' ? { body: selectedThread.lastMessageBody } : null);
                
                if (!latestInbound || !latestInbound.body) return null;
                const analysis = IntentClassifierService.classifyMessage(latestInbound.body);
                const drafts = SmartReplyGeneratorService.generateDrafts(
                  selectedThread.contactName,
                  selectedThread.companyName || '',
                  latestInbound.body,
                  analysis.intent,
                  analysis.sentiment
                );

                if (!drafts || drafts.length === 0) return null;

                return (
                  <div className="px-3.5 py-2.5 bg-gradient-to-r from-purple-50/60 to-indigo-50/60 dark:from-purple-950/20 dark:to-indigo-950/20 border-t border-purple-100 dark:border-purple-900/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-300 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>AI Smart Reply Drafts (1-Click Insert)</span>
                      </div>
                      <span className="text-[10px] text-purple-700 dark:text-purple-400 font-mono">
                        Context: {analysis.intent.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {drafts.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setReplyText(d.body)}
                          className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-purple-200 dark:border-purple-800/60 hover:border-purple-500 text-left transition shadow-2xs hover:shadow-xs group cursor-pointer flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-[11px] text-purple-950 dark:text-purple-200 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400">
                                {d.title}
                              </span>
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 shrink-0">
                                {d.tone}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-500 line-clamp-2 leading-relaxed font-sans">
                              {d.body}
                            </p>
                          </div>
                          <span className="mt-1.5 text-[9px] text-purple-600 dark:text-purple-400 font-semibold group-hover:underline flex items-center gap-0.5">
                            <span>Insert Draft</span> →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Canned Snippet Quick Drawer */}
              {cannedResponses.length > 0 && (
                <div className="px-3 py-2 bg-neutral-100/70 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-1.5 overflow-x-auto text-xs">
                  <span className="text-[10px] font-bold text-neutral-400 mr-1 shrink-0">
                    Snippets:
                  </span>
                  {cannedResponses.map((cr) => (
                    <button
                      key={cr.id}
                      onClick={() => setReplyText(cr.body)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 hover:border-emerald-500 shrink-0 cursor-pointer shadow-xs"
                      title={cr.body}
                    >
                      <span className="font-mono text-emerald-600">{cr.shortcut}</span>: {cr.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Composer Input Bar */}
              <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  rows={2}
                  placeholder="Type reply or pick canned snippet above (Enter to send)..."
                  className="flex-1 p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-xs focus:outline-hidden resize-none"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-neutral-400">
              Select a conversation thread from the left to view messages
            </div>
          )}
        </div>
      </div>

      {/* CREATE CANNED SNIPPET MODAL */}
      {showCannedModal && (
        <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCanned} className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Create 1-Click Canned Snippet</span>
              </h3>
              <button type="button" onClick={() => setShowCannedModal(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Snippet Title:
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Wholesale Price Slab"
                  className="w-full p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Keyboard Shortcut:
                  </label>
                  <input
                    type="text"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    placeholder="e.g. /pricing"
                    className="w-full p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Category:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs"
                  >
                    <option value="SALES">SALES</option>
                    <option value="PAYMENTS">PAYMENTS</option>
                    <option value="SAMPLES">SAMPLES</option>
                    <option value="SUPPORT">SUPPORT</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Snippet Message Body:
                </label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={4}
                  placeholder="Enter pre-drafted text..."
                  className="w-full p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowCannedModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Save Snippet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
