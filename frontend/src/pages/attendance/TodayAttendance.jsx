import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

export default function TodayAttendance() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/attendance/today').then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5" data-testid="today-attendance-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Today</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Who's in today</h1>
      </div>

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
