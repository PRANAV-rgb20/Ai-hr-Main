import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Send, Loader2, CheckCircle, XCircle, AlertCircle,
  ChevronRight, MessageSquare, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { startInterview, respondToInterview } from '../../api/ai';
import { useAuthStore } from '../../store/authStore';

// ── helpers ───────────────────────────────────────────────────────────────────

const scoreColor = (s) => {
  if (s >= 7) return 'text-emerald-600 bg-emerald-50 ring-emerald-400';
  if (s >= 5) return 'text-amber-600 bg-amber-50 ring-amber-400';
  return 'text-rose-600 bg-rose-50 ring-rose-400';
};

const recMeta = {
  hire:   { label: 'Recommended: Hire',        bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800', Icon: CheckCircle  },
  maybe:  { label: 'Recommended: Maybe',       bg: 'bg-amber-50 border-amber-300',     text: 'text-amber-800',   Icon: AlertCircle  },
  reject: { label: 'Recommended: Do Not Hire', bg: 'bg-rose-50 border-rose-300',       text: 'text-rose-800',    Icon: XCircle      },
};

const speak = (text) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
};

// ── Setup screen ──────────────────────────────────────────────────────────────

function SetupScreen({ onStart, prefill }) {
  const [form, setForm] = useState({
    candidateName: prefill?.candidateName || '',
    jobTitle: prefill?.jobTitle || '',
    jobDescription: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.candidateName.trim()) e.candidateName = 'Required';
    if (!form.jobTitle.trim())      e.jobTitle      = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleStart = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onStart(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8 space-y-5">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-3">
            <Mic size={26} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            AI Interview Room
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            The AI will ask 8 structured questions. Answer by voice or text.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Candidate Name
            </label>
            <input
              className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                ${errors.candidateName ? 'border-rose-400' : 'border-slate-300'}`}
              value={form.candidateName}
              onChange={(e) => upd('candidateName', e.target.value)}
              placeholder="e.g. Alex Rivera"
              data-testid="setup-candidate-name"
            />
            {errors.candidateName && <p className="text-xs text-rose-600 mt-1">{errors.candidateName}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Job Title
            </label>
            <input
              className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                ${errors.jobTitle ? 'border-rose-400' : 'border-slate-300'}`}
              value={form.jobTitle}
              onChange={(e) => upd('jobTitle', e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              data-testid="setup-job-title"
            />
            {errors.jobTitle && <p className="text-xs text-rose-600 mt-1">{errors.jobTitle}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Job Description <span className="text-slate-400 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.jobDescription}
              onChange={(e) => upd('jobDescription', e.target.value)}
              placeholder="Paste key requirements to tailor the questions…"
              data-testid="setup-job-description"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
          data-testid="start-interview-btn"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
          {loading ? 'Starting interview…' : 'Start Interview'}
        </button>
      </div>
    </div>
  );
}

// ── Interview screen ──────────────────────────────────────────────────────────

function InterviewScreen({ sessionId, firstQuestion, onComplete }) {
  const [question, setQuestion]       = useState(firstQuestion);
  const [questionCount, setCount]     = useState(1);
  const [transcript, setTranscript]   = useState('');
  const [interimText, setInterimText] = useState('');  // live partial words
  const [textAnswer, setTextAnswer]   = useState('');
  const [useText, setUseText]         = useState(false);
  const [listening, setListening]     = useState(false);
  const [thinking, setThinking]       = useState(false);
  const [history, setHistory]         = useState([{ role: 'ai', text: firstQuestion }]);
  const recognitionRef                = useRef(null);
  const historyEndRef                 = useRef(null);

  // Speak first question on mount
  useEffect(() => { speak(firstQuestion); }, [firstQuestion]);

  // Auto-scroll history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Speech recognition not supported in this browser. Use text input.');
      setUseText(true);
      return;
    }

    // Stop any existing session first
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const rec = new SR();
    // continuous = true → mic stays ON until user clicks Stop
    rec.continuous = true;
    // interimResults = true → show partial words live while speaking
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => { setListening(true); };

    // Only fires if the browser auto-stops (e.g. network timeout) — we restart it
    rec.onend = () => {
      // If we're still supposed to be listening (user hasn't clicked Stop),
      // restart automatically so it never cuts off mid-sentence
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (_) {}
      } else {
        setListening(false);
        setInterimText('');
      }
    };

    rec.onerror = (e) => {
      // 'no-speech' is harmless — the rec will auto-restart via onend
      if (e.error === 'no-speech') return;
      // 'aborted' fires when we manually stop — ignore it
      if (e.error === 'aborted') return;
      toast.error(`Mic error: ${e.error}`);
      recognitionRef.current = null;
      setListening(false);
      setInterimText('');
    };

    rec.onresult = (e) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalChunk += text + ' ';
        } else {
          interimChunk += text;
        }
      }
      // Append confirmed words to transcript, show live partial text separately
      if (finalChunk) setTranscript((prev) => prev + finalChunk);
      setInterimText(interimChunk);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopListening = () => {
    // Setting ref to null tells onend NOT to restart
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    rec?.stop();
    setListening(false);
    setInterimText('');
  };

  const submitAnswer = async () => {
    // Stop mic before submitting
    if (listening) stopListening();
    const answer = useText ? textAnswer.trim() : transcript.trim();
    if (!answer) { toast.error('Please provide an answer first'); return; }

    setHistory((h) => [...h, { role: 'candidate', text: answer }]);
    setTranscript('');
    setInterimText('');
    setTextAnswer('');
    setThinking(true);

    try {
      const { data } = await respondToInterview(sessionId, answer);
      setThinking(false);

      if (data.complete) {
        onComplete(data.assessment);
      } else {
        const nextQ = data.question;
        setQuestion(nextQ);
        setCount((c) => c + 1);
        setHistory((h) => [...h, { role: 'ai', text: nextQ }]);
        speak(nextQ);
      }
    } catch (err) {
      setThinking(false);
      toast.error(err?.response?.data?.detail || 'Failed to get response');
    }
  };

  const activeAnswer = useText ? textAnswer : transcript;

  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-testid="interview-screen">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-semibold uppercase tracking-wider">Question {questionCount} of 8</span>
          <span>{Math.round((questionCount / 8) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-blue-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          <span className="text-sm text-slate-500">AI is thinking…</span>
        </div>
      )}

      {/* Answer input */}
      {!thinking && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          {!useText ? (
            <>
              {/* Voice controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-all
                    ${listening
                      ? 'bg-rose-500 hover:bg-rose-600 text-white ring-2 ring-rose-300 ring-offset-1'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  data-testid="mic-btn"
                >
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  {listening ? '⏹ Stop Recording' : '🎤 Start Speaking'}
                </button>
                {listening && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    Mic is live — speak freely, click Stop when done
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

              {/* Live transcript box — shows both confirmed + interim text */}
              {(transcript || interimText) && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 min-h-[60px]">
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Your answer</p>
                  <p className="text-sm text-slate-800">
                    {transcript}
                    {interimText && (
                      <span className="text-slate-400 italic">{interimText}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Clear button when there's content */}
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
                data-testid="text-answer-input"
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

          {/* Submit */}
          <button
            type="button"
            onClick={submitAnswer}
            disabled={!activeAnswer || thinking}
            className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            data-testid="submit-answer-btn"
          >
            <Send size={15} /> Submit Answer
          </button>
        </div>
      )}

      {/* Conversation history */}
      {history.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 max-h-64 overflow-y-auto space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold sticky top-0 bg-white pb-1">
            Conversation
          </p>
          {history.map((h, i) => (
            <div key={i} className={`flex gap-2 ${h.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm
                ${h.role === 'ai'
                  ? 'bg-blue-50 text-blue-900 border border-blue-100'
                  : 'bg-slate-100 text-slate-800'}`}>
                {h.text}
              </div>
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>
      )}
    </div>
  );
}

// ── Complete screen ───────────────────────────────────────────────────────────

function CompleteScreen({ assessment, candidateName, jobTitle }) {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const backPath = role === 'management_admin' ? '/admin/recruitment/candidates' : '/recruiter/candidates';

  const scores = assessment?.scores || {};
  const rec = recMeta[assessment?.recommendation] ?? recMeta.maybe;

  const scoreCards = [
    { label: 'Communication', key: 'communication' },
    { label: 'Technical',     key: 'technical'     },
    { label: 'Culture Fit',   key: 'culture_fit'   },
    { label: 'Overall',       key: 'overall'       },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5" data-testid="complete-screen">
      <div className="text-center">
        <p className="text-4xl mb-2">🎉</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
          Interview Complete
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {candidateName} · {jobTitle}
        </p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-3">
        {scoreCards.map(({ label, key }) => {
          const val = scores[key] ?? 0;
          const cls = scoreColor(val);
          return (
            <div key={key} className={`bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4`}>
              <div className={`h-14 w-14 rounded-full ring-4 flex items-center justify-center shrink-0 ${cls}`}>
                <span className="text-xl font-bold" style={{ fontFamily: 'Outfit' }}>{val}</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
                <p className="text-sm text-slate-700 mt-0.5">out of 10</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendation */}
      <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${rec.bg}`}>
        <rec.Icon size={22} className={rec.text} />
        <p className={`text-base font-semibold ${rec.text}`}>{rec.label}</p>
      </div>

      {/* Strengths & Concerns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Strengths</p>
          <ul className="space-y-1.5">
            {(assessment?.strengths || []).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Concerns</p>
          <ul className="space-y-1.5">
            {(assessment?.concerns || []).map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(backPath)}
        className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
        data-testid="back-to-candidates-btn"
      >
        <ChevronRight size={16} /> Return to Candidates
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InterviewRoom() {
  const location = useLocation();
  const prefill  = location.state || {};

  const [screen, setScreen]           = useState('setup');   // 'setup' | 'interview' | 'complete'
  const [sessionId, setSessionId]     = useState(null);
  const [firstQuestion, setFirstQ]    = useState('');
  const [assessment, setAssessment]   = useState(null);
  const [meta, setMeta]               = useState({ candidateName: '', jobTitle: '' });

  const handleStart = async ({ candidateName, jobTitle, jobDescription }) => {
    try {
      const { data } = await startInterview({
        candidate_id: prefill.candidateId || '00000000-0000-0000-0000-000000000000',
        candidate_name: candidateName,
        job_title: jobTitle,
        job_description: jobDescription,
      });
      setSessionId(data.session_id);
      setFirstQ(data.question);
      setMeta({ candidateName, jobTitle });
      setScreen('interview');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to start interview');
      throw err;
    }
  };

  const handleComplete = (result) => {
    setAssessment(result);
    setScreen('complete');
    window.speechSynthesis?.cancel();
  };

  return (
    <div className="space-y-5" data-testid="interview-room">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">AI Tools</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
          Interview Bot
        </h1>
      </div>

      {screen === 'setup' && (
        <SetupScreen onStart={handleStart} prefill={prefill} />
      )}
      {screen === 'interview' && (
        <InterviewScreen
          sessionId={sessionId}
          firstQuestion={firstQuestion}
          onComplete={handleComplete}
        />
      )}
      {screen === 'complete' && (
        <CompleteScreen
          assessment={assessment}
          candidateName={meta.candidateName}
          jobTitle={meta.jobTitle}
        />
      )}
    </div>
  );
}
