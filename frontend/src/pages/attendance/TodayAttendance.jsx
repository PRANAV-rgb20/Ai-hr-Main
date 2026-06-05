import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

export default function TodayAttendance() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = () => {
    api.get('/attendance/today')
      .then((r) => { setRows(r.data); setLastUpdate(new Date()); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Auto-refresh every 60 seconds — attendance status changes throughout the day
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const presentCount  = rows.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absentCount   = rows.filter((r) => !r.clock_in).length;
  
  // Use the date from the backend data if available, otherwise use today
  const dataDateStr = rows.length > 0 && rows[0].attendance_date ? rows[0].attendance_date : null;
  const isToday = !dataDateStr || dataDateStr === new Date().toISOString().split('T')[0];
  const displayDate = new Date(dataDateStr || Date.now());
  const dateFormatted = displayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <div className="space-y-5" data-testid="today-attendance-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">{dateFormatted}</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            {isToday ? "Who's in today" : "Previous Attendance"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{presentCount} present</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />{absentCount} absent</span>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>
      {lastUpdate && (
        <p className="text-[11px] text-slate-400">
          Last updated: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto-refreshes every minute
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? <Spinner /> : rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No employees" /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left px-5 py-3 font-semibold">Code</th>
                <th className="text-left px-5 py-3 font-semibold">Name</th>
                <th className="text-left px-5 py-3 font-semibold">Department</th>
                <th className="text-left px-5 py-3 font-semibold">Clock In</th>
                <th className="text-left px-5 py-3 font-semibold">Clock Out</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee_id} className="border-b border-slate-100">
                  <td className="px-5 py-3 text-sm font-mono">{r.employee_code}</td>
                  <td className="px-5 py-3 text-sm font-medium">{r.full_name}</td>
                  <td className="px-5 py-3 text-sm">{r.department_name || '—'}</td>
                  <td className="px-5 py-3 text-sm">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-5 py-3 text-sm">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      r.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                      r.status === 'late' ? 'bg-amber-50 text-amber-700' :
                      r.status === 'absent' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                    }`}>{r.status.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
