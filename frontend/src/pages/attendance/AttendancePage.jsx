import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

const STATUS_COLOR = {
  present: 'bg-emerald-500',
  late: 'bg-amber-400',
  absent: 'bg-rose-400',
  half_day: 'bg-blue-300',
};

export default function AttendancePage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/attendance/my', { params: { month, year } })
      .then((r) => setRecs(r.data))
      .finally(() => setLoading(false));
  }, [month, year]);

  const grid = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = recs.find((r) => r.date === iso);
      const dow = new Date(year, month - 1, d).getDay();
      cells.push({ day: d, iso, rec, weekend: dow === 0 || dow === 6 });
    }
    return cells;
  }, [recs, month, year]);

  const summary = useMemo(() => {
    return {
      present: recs.filter((r) => r.status === 'present').length,
      late: recs.filter((r) => r.status === 'late').length,
      absent: recs.filter((r) => r.status === 'absent').length,
      hours: recs.reduce((s, r) => s + (r.work_hours || 0), 0).toFixed(1),
    };
  }, [recs]);

  const moveMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5" data-testid="attendance-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Time</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Attendance</h1>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md h-10 px-2">
          <button onClick={() => moveMonth(-1)} className="h-7 w-7 rounded hover:bg-slate-100 flex items-center justify-center" data-testid="attendance-prev-month"><ChevronLeft size={14} /></button>
          <p className="text-sm font-medium px-2 text-slate-800 min-w-[140px] text-center">{monthLabel}</p>
          <button onClick={() => moveMonth(1)} className="h-7 w-7 rounded hover:bg-slate-100 flex items-center justify-center" data-testid="attendance-next-month"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present', value: summary.present, dot: 'bg-emerald-500' },
          { label: 'Late', value: summary.late, dot: 'bg-amber-400' },
          { label: 'Absent', value: summary.absent, dot: 'bg-rose-400' },
          { label: 'Hours', value: summary.hours, dot: 'bg-blue-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
            </div>
            <p className="text-2xl font-semibold mt-1" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>{monthLabel}</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Present</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Late</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Absent</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> Weekend</span>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <>
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-wider text-slate-400 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (<div key={d}>{d}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-2" data-testid="attendance-calendar">
              {grid.map((c, i) => {
                if (!c) return <div key={i} />;
                const color = c.rec ? STATUS_COLOR[c.rec.status] : (c.weekend ? 'bg-slate-200' : 'bg-slate-100');
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-md flex flex-col items-center justify-center text-[11px] font-medium text-slate-700 ${color} ${c.rec ? 'text-white' : ''}`}
                    title={c.rec ? `${c.rec.status} · ${c.rec.work_hours || 0}h` : (c.weekend ? 'Weekend' : 'No record')}
                    data-testid={`day-${c.iso}`}
                  >
                    <span>{c.day}</span>
                    {c.rec?.work_hours ? <span className="text-[9px] opacity-90">{c.rec.work_hours}h</span> : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
