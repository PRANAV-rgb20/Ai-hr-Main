import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ArrowRight, PlayCircle, StopCircle, Heart, Loader2, RefreshCw, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import { getLearningRecommendations, getMySentiment, submitSentimentCheckin } from '../../api/ai';
import Spinner from '../../components/Spinner';

/* ── Isolated LiveClock — only this tiny component re-renders every second ── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const liveTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const liveDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className="mb-4">
      <p className="text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight text-white" style={{ fontFamily: 'Outfit' }}>
        {liveTime}
      </p>
      <p className="text-blue-200 text-sm mt-1">{liveDate}</p>
    </div>
  );
}

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null); // last data refresh time

  // Sentiment check-in state
  const [sentimentHistory, setSentimentHistory] = useState([]);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [moodText, setMoodText] = useState('');
  const [submittingSentiment, setSubmittingSentiment] = useState(false);
  const [latestLabel, setLatestLabel] = useState(null);
  const [learning, setLearning] = useState(null);

  // Determine current ISO week number
  const currentWeek = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  };

  const load = () => {
    setLoading(true);
    api.get('/dashboard/employee').then((r) => { setData(r.data); setLastRefresh(new Date()); }).finally(() => setLoading(false));
  };

  const loadSentiment = async () => {
    try {
      const { data: history } = await getMySentiment();
      setSentimentHistory(history);
      const wk = currentWeek();
      const year = new Date().getFullYear();
      const thisWeek = history.find((c) => c.week_number === wk && c.year === year);
      if (thisWeek) {
        setAlreadyCheckedIn(true);
        setLatestLabel(thisWeek.sentiment_label);
      }
    } catch (_) {
      // non-critical — silently skip
    }
  };

  useEffect(() => {
    // Parallelize dashboard + sentiment fetch on mount
    Promise.all([load(), loadSentiment()]);
    getLearningRecommendations().then((res) => setLearning(res.data)).catch(() => {});
    // Auto-refresh dashboard data every 120 seconds
    const refreshTimer = setInterval(() => {
      api.get('/dashboard/employee')
        .then((r) => { setData(r.data); setLastRefresh(new Date()); })
        .catch(() => {});
    }, 120_000);
    return () => clearInterval(refreshTimer);
  }, []);

  const clock = async (action) => {
    setActing(true);
    try {
      await api.post(`/attendance/${action}`);
      toast.success(action === 'clock-in' ? 'Clocked in' : 'Clocked out');
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setActing(false);
    }
  };

  const handleSentimentSubmit = async () => {
    if (!moodText.trim()) { toast.error('Please share how you feel first'); return; }
    setSubmittingSentiment(true);
    try {
      const { data: result } = await submitSentimentCheckin(moodText.trim());
      setAlreadyCheckedIn(true);
      setLatestLabel(result.sentiment_label);
      setMoodText('');
      toast.success(`Check-in recorded — feeling ${result.sentiment_label} 💙`);
    } catch (err) {
      // Handle already-submitted gracefully
      if (err?.response?.status === 400) {
        setAlreadyCheckedIn(true);
        toast('You already checked in this week', { icon: 'ℹ️' });
      } else {
        toast.error(formatApiError(err));
      }
    } finally {
      setSubmittingSentiment(false);
    }
  };

  const sentimentBadge = (label) => {
    const m = {
      positive: 'bg-green-100 text-green-800',
      neutral:  'bg-yellow-100 text-yellow-800',
      negative: 'bg-orange-100 text-orange-800',
      burnout:  'bg-red-100 text-red-800',
    };
    return m[label] ?? 'bg-slate-100 text-slate-700';
  };

  if (loading) return <Spinner />;
  if (!data) return null;
  const clockedIn = data.clocked_in;
  const time = data.clock_in_time ? new Date(data.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="space-y-6" data-testid="employee-dashboard">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Your day</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Today at a glance</h1>
      </div>

      {/* Clock-in card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl p-6 sm:p-8 shadow-lg relative overflow-hidden" data-testid="clock-card">
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute top-6 right-6 h-2 w-2 rounded-full bg-emerald-400 pulse-ring" />

        {/* Live time display — isolated component, won't re-render parent */}
        <LiveClock />

        <p className="text-xs uppercase tracking-[0.12em] text-blue-200 mb-1">Status</p>
        <h2 className="text-xl sm:text-2xl font-semibold" style={{ fontFamily: 'Outfit' }}>
          {clockedIn ? `Clocked in since ${time}` : 'Not clocked in yet'}
        </h2>
        <p className="text-blue-100 text-sm mt-1">
          {clockedIn ? 'Remember to clock out at the end of your shift.' : 'Tap the button below to start your shift.'}
        </p>
        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <button
            type="button"
            disabled={acting}
            onClick={() => clock(clockedIn ? 'clock-out' : 'clock-in')}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-md bg-white text-blue-700 font-medium hover:bg-blue-50 transition-colors disabled:opacity-70"
            data-testid="clock-action-btn"
          >
            {clockedIn ? <StopCircle size={18} /> : <PlayCircle size={18} />}
            {clockedIn ? 'Clock out' : 'Clock in now'}
          </button>
          {lastRefresh && (
            <p className="text-[11px] text-blue-300/70">
              Data refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {learning && (
        <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="learning-recommendations-card">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Learning Recommendations</p>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Personal growth plan</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-line">{learning.summary}</p>
              {learning.items?.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {learning.items.map((item) => (
                    <div key={item.area} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-900">{item.area}</p>
                      <p className="text-xs text-slate-500 mt-1">Score signal: {item.score}/10</p>
                      <p className="text-xs text-slate-600 mt-2">{item.resource}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leave balance cards */}
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Leave balance</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(data.leave_balances || []).map((b) => {
            const pct = b.total_days ? Math.round((b.remaining_days / b.total_days) * 100) : 0;
            return (
              <div key={b.leave_type} className="bg-white border border-slate-200 rounded-lg p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{b.leave_type}</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1" style={{ fontFamily: 'Outfit' }}>
                  {b.remaining_days}<span className="text-sm text-slate-500 font-normal"> / {b.total_days} days</span>
                </p>
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">{b.used_days} used</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent leaves */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Recent</p>
            <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Leave history</h3>
          </div>
          <Link to="/employee/leave" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {(!data.recent_leaves || data.recent_leaves.length === 0) ? (
          <p className="text-sm text-slate-500 py-4">No leave records yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recent_leaves.map((l) => (
              <li key={l.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">{l.leave_type} · {l.days_count} days</p>
                    <p className="text-xs text-slate-500">{l.start_date} → {l.end_date}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  l.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                  l.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                  'bg-amber-50 text-amber-700'
                }`}>{l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Weekly Wellbeing Check-in */}
      <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="sentiment-checkin-card">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={16} className="text-rose-500" />
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Weekly</p>
            <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
              Wellbeing Check-in
            </h3>
          </div>
        </div>

        {alreadyCheckedIn ? (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-lg">✓</span>
            <div>
              <p className="text-sm font-medium text-slate-900">Check-in submitted this week</p>
              {latestLabel && (
                <span className={`mt-1 inline-flex text-xs font-medium px-2 py-0.5 rounded-full capitalize ${sentimentBadge(latestLabel)}`}>
                  {latestLabel}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              How are you feeling at work this week? Your response is anonymous to your team.
            </p>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="e.g. Feeling great this week — finished a big project and got good feedback from the team…"
              value={moodText}
              onChange={(e) => setMoodText(e.target.value)}
              data-testid="mood-textarea"
            />
            <button
              type="button"
              onClick={handleSentimentSubmit}
              disabled={submittingSentiment || !moodText.trim()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-60 transition-colors"
              data-testid="submit-sentiment-btn"
            >
              {submittingSentiment
                ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
                : <><Heart size={14} /> Submit check-in</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
