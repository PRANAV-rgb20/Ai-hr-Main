import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, CalendarClock, ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

export default function RecruiterDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/recruiter').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return null;

  return (
    <div className="space-y-6" data-testid="recruiter-dashboard">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Talent</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Recruiter Console</h1>
        </div>
        <Link to="/recruiter/jobs/new" className="inline-flex items-center gap-2 px-3 h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          + New Job
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Briefcase, label: 'Open Jobs', value: data.open_jobs, accent: 'bg-blue-50 text-blue-700' },
          { icon: Users, label: 'Candidates', value: data.total_candidates, accent: 'bg-emerald-50 text-emerald-700' },
          { icon: CalendarClock, label: 'In interview', value: data.interviews ?? data.interviews_this_week, accent: 'bg-amber-50 text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                <p className="text-3xl font-semibold mt-2" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center ${s.accent}`}><s.icon size={18} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Funnel</p>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Pipeline by stage</h3>
            </div>
            <Link to="/recruiter/candidates" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
              Open kanban <ArrowRight size={14} />
            </Link>
          </div>
          {data.pipeline.length === 0 ? <p className="text-sm text-slate-500">No candidates yet.</p> : (
            <ul className="space-y-2">
              {data.pipeline.map((p) => (
                <li key={p.stage} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-slate-700">{p.stage}</span>
                  <span className="font-mono font-semibold text-slate-900">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Recent</p>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Job postings</h3>
            </div>
            <Link to="/recruiter/jobs" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {(!data.recent_jobs || data.recent_jobs.length === 0) ? <p className="text-sm text-slate-500">No jobs yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.recent_jobs.map((j) => (
                <li key={j.id} className="py-2 flex items-center justify-between">
                  <p className="text-sm text-slate-900">{j.title}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${j.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{j.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
