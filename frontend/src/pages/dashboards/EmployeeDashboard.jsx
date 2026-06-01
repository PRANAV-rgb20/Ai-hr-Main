import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ArrowRight, PlayCircle, StopCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import Spinner from '../../components/Spinner';

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/dashboard/employee').then((r) => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

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
        <p className="text-xs uppercase tracking-[0.12em] text-blue-200">Clock</p>
        <h2 className="text-3xl sm:text-4xl font-semibold mt-1" style={{ fontFamily: 'Outfit' }}>
          {clockedIn ? `You're clocked in${time ? ` since ${time}` : ''}` : 'Ready to start the day?'}
        </h2>
        <p className="text-blue-100 text-sm mt-1">
          {clockedIn ? 'Remember to clock out at the end of your shift.' : 'Tap the button to begin your shift.'}
        </p>
        <button
          type="button"
          disabled={acting}
          onClick={() => clock(clockedIn ? 'clock-out' : 'clock-in')}
          className="mt-5 inline-flex items-center gap-2 px-5 h-11 rounded-md bg-white text-blue-700 font-medium hover:bg-blue-50 transition-colors disabled:opacity-70"
          data-testid="clock-action-btn"
        >
          {clockedIn ? <StopCircle size={18} /> : <PlayCircle size={18} />}
          {clockedIn ? 'Clock out' : 'Clock in now'}
        </button>
      </div>

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
    </div>
  );
}
