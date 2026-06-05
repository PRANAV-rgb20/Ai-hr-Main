import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import { chatWithPolicy } from '../api/ai';

// ── Defined at MODULE level — never inside another component ──────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
        }`}>
          {msg.text}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.sources.map((s, i) => (
              <span key={i} className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                📄 {s.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PolicyChatbot() {
  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Listen for sidebar "Need help?" button click
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-policy-chatbot', handler);
    return () => window.removeEventListener('open-policy-chatbot', handler);
  }, []);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const { data } = await chatWithPolicy(q);
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: data.answer, sources: data.sources || [] },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Something went wrong. Try again.';
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Sorry, I had trouble answering that. Please try again.', sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {/* Closed state — floating button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 relative"
          title="Ask HR Policy Assistant"
          aria-label="Open HR Policy Chatbot"
        >
          <MessageCircle size={24} />
          {/* Pulse ring to draw attention */}
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-400 rounded-full border-2 border-white" />
        </button>
      )}

      {/* Open state — chat panel */}
      {isOpen && (
        <div className="w-80 md:w-96 h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 mb-2 ml-auto">
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">HR Policy Assistant</p>
                <p className="text-[11px] text-blue-200">Ask about leave, benefits & policies</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Close chatbot"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <MessageCircle size={22} className="text-blue-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">HR Policy Assistant</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Ask me about leave entitlements, benefits, code of conduct, remote work, or any company policy.
                </p>
                <div className="mt-4 space-y-2 w-full">
                  {[
                    'How many annual leave days do I get?',
                    'What is the WFH policy?',
                    'How do I claim health insurance?',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="w-full text-left text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-3 flex items-center gap-2 shrink-0 bg-white">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about company policies…"
              disabled={loading}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 bg-slate-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0"
              aria-label="Send message"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
