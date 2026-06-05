import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Mic, MicOff, Send, Loader2, CheckCircle, AlertCircle, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getInterviewPublic, respondToInterviewPublic } from '../../api/ai';

// ── helpers ───────────────────────────────────────────────────────────────────
const speak = (text) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
};

// ── Complete screen ───────────────────────────────────────────────────────────
function PublicCompleteScreen({ candidateName, jobTitle }) {
  return (
    <div className="max-w-2xl mx-auto space-y-5 text-center mt-20" data-testid="complete-screen">
      <p className="text-4xl mb-4">🎉</p>
      <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
        Interview Complete
      </h1>
      <p className="text-slate-500 mt-2">
        Thank you, {candidateName}! Your interview for <strong>{jobTitle}</strong> has been successfully submitted.
      </p>
      <p className="text-sm text-slate-400 mt-6">
        You may now close this tab. Our recruitment team will be in touch with you shortly.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PublicInterview() {
  const { sessionId } = useParams();

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [isComplete, setIsComplete]   = useState(false);

  // Interview State
  const [question, setQuestion]       = useState('');
  const [questionCount, setCount]     = useState(1);
  const [transcript, setTranscript]   = useState('');
  const [interimText, setInterimText] = useState('');
  const [textAnswer, setTextAnswer]   = useState('');
  const [useText, setUseText]         = useState(false);
  const [listening, setListening]     = useState(false);
  const [thinking, setThinking]       = useState(false);
  const [history, setHistory]         = useState([]);
  
  const recognitionRef                = useRef(null);
  const historyEndRef                 = useRef(null);

  // Fetch Session Data
  useEffect(() => {
    async function load() {
      try {
        const { data } = await getInterviewPublic(sessionId);
        setSessionData(data);
        if (data.status === 'completed') {
          setIsComplete(true);
        } else {
          const hist = data.conversation_history || [];
          setHistory(hist);
          
          // Find the last question asked by the AI
          const lastAiMsg = [...hist].reverse().find(m => m.role === 'assistant');
          if (lastAiMsg) {
            setQuestion(lastAiMsg.content);
            speak(lastAiMsg.content);
          }
          
          // Calculate question count (each AI message after the first user prompt is a question)
          const aiCount = hist.filter(m => m.role === 'assistant').length;
          setCount(Math.max(1, aiCount));
        }
      } catch (err) {
        setError('Interview session not found or link has expired.');
      } finally {
        setLoading(false);
      }
    }
    if (sessionId) load();
  }, [sessionId]);

  // Auto-scroll history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Speech recognition not supported. Use text input.');
      setUseText(true);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => { setListening(true); };
    rec.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (_) {}
      } else {
        setListening(false);
        setInterimText('');
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      toast.error(`Mic error: ${e.error}`);
      recognitionRef.current = null;
      setListening(false);
      setInterimText('');
    };
    rec.onresult = (e) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalChunk += e.results[i][0].transcript + ' ';
        else interimChunk += e.results[i][0].transcript;
      }
      if (finalChunk) setTranscript((prev) => prev + finalChunk);
      setInterimText(interimChunk);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopListening = () => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    rec?.stop();
    setListening(false);
    setInterimText('');
  };

  const submitAnswer = async () => {
    if (listening) stopListening();
    const answer = useText ? textAnswer.trim() : transcript.trim();
    if (!answer) { toast.error('Please provide an answer'); return; }

    setHistory((h) => [...h, { role: 'candidate', text: answer }]);
    setTranscript('');
    setInterimText('');
    setTextAnswer('');
    setThinking(true);

    try {
      const { data } = await respondToInterviewPublic(sessionId, answer);
      setThinking(false);

      if (data.complete) {
        setIsComplete(true);
      } else {
        setQuestion(data.question);
        setCount((c) => c + 1);
        setHistory((h) => [...h, { role: 'ai', text: data.question }]);
        speak(data.question);
      }
    } catch (err) {
      setThinking(false);
      toast.error(err?.response?.data?.detail || 'Failed to submit answer');
    }
  };

  const activeAnswer = useText ? textAnswer : transcript;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md border border-slate-200">
          <AlertCircle size={40} className="mx-auto text-rose-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <PublicCompleteScreen 
          candidateName={sessionData.candidate_name} 
          jobTitle={sessionData.job_title} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
              AI Interview Room
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {sessionData.candidate_name} · {sessionData.job_title}
            </p>
          </div>
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Mic size={20} />
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Question {questionCount} of 8</span>
            <span>{Math.round((questionCount / 8) * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(questionCount / 8) * 100}%` }}
            />
          </div>
        </div>

        {/* Current question card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-blue-600 font-semibold mb-2">AI Interviewer</p>
          <p className="text-xl font-medium text-slate-900 leading-relaxed" style={{ fontFamily: 'Outfit' }}>
            {question}
          </p>
          <button
            type="button"
            onClick={() => speak(question)}
            className="mt-3 text-xs text-slate-400 hover:text-blue-600 inline-flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={11} /> Replay question
          </button>
        </div>

        {/* Thinking indicator */}
        {thinking && (
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            <span className="text-sm text-slate-500">AI is thinking…</span>
          </div>
        )}

        {/* Answer input */}
        {!thinking && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            {!useText ? (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={listening ? stopListening : startListening}
                    className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-all
                      ${listening ? 'bg-rose-500 hover:bg-rose-600 text-white ring-2 ring-rose-300 ring-offset-1' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    {listening ? <MicOff size={16} /> : <Mic size={16} />}
                    {listening ? '⏹ Stop Recording' : '🎤 Start Speaking'}
                  </button>
                  {listening && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      Mic is live — speak freely
                    </span>
                  )}
                  {!listening && (
                    <button
                      type="button"
                      onClick={() => setUseText(true)}
                      className="text-xs text-slate-400 hover:text-blue-600 underline transition-colors"
                    >
                      Prefer typing?
                    </button>
                  )}
                </div>

                {(transcript || interimText) && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 min-h-[60px]">
                    <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Your answer</p>
                    <p className="text-sm text-slate-800">
                      {transcript}
                      {interimText && <span className="text-slate-400 italic">{interimText}</span>}
                    </p>
                  </div>
                )}
                {transcript && !listening && (
                  <button
                    type="button"
                    onClick={() => { setTranscript(''); setInterimText(''); }}
                    className="text-xs text-slate-400 hover:text-rose-600 underline transition-colors"
                  >
                    Clear and re-record
                  </button>
                )}
              </>
            ) : (
              <>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Type your answer here…"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setUseText(false)}
                  className="text-xs text-slate-400 hover:text-blue-600 underline transition-colors"
                >
                  Switch to voice
                </button>
              </>
            )}

            <button
              type="button"
              onClick={submitAnswer}
              disabled={!activeAnswer || thinking}
              className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Send size={15} /> Submit Answer
            </button>
          </div>
        )}

        {/* Conversation history */}
        {history.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm max-h-64 overflow-y-auto space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold sticky top-0 bg-white pb-1">
              Conversation
            </p>
            {history.map((h, i) => (
              <div key={i} className={`flex gap-2 ${h.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${h.role === 'ai' ? 'bg-blue-50 text-blue-900 border border-blue-100' : 'bg-slate-100 text-slate-800'}`}>
                  {h.role === 'assistant' ? h.content : h.text}
                </div>
              </div>
            ))}
            <div ref={historyEndRef} />
          </div>
        )}
        
      </div>
    </div>
  );
}
