import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Target, TrendingUp, Award } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

const STATUS_BADGE = {
  completed: 'bg-emerald-50 text-emerald-700',
  in_progress: 'bg-blue-50 text-blue-700',
  pending: 'bg-slate-100 text-slate-700',
};

export default function PerformancePage() {
  const [reviews, setReviews] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/performance/my'), api.get('/performance/my-goals')]).then(([r, g]) => {
      setReviews(r.data);
      setGoals(g.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const trend = reviews
    .slice()
    .reverse()
    .map((r) => ({ label: `${r.period} ${r.year}`, score: r.overall_score }));
  const latest = reviews[0];

  return (
    <div className="space-y-5" data-testid="performance-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Growth</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Performance</h1>
      </div>

      {latest ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { label: 'Overall', value: latest.overall_score, icon: Award, accent: 'bg-violet-50 text-violet-700' },
            { label: 'Goals', value: latest.goals_score, icon: Target, accent: 'bg-blue-50 text-blue-700' },
            { label: 'Skills', value: latest.skills_score, icon: TrendingUp, accent: 'bg-emerald-50 text-emerald-700' },
            { label: 'Attitude', value: latest.attitude_score, icon: Award, accent: 'bg-amber-50 text-amber-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
                  <p className="text-3xl font-semibold mt-1" style={{ fontFamily: 'Outfit' }}>{s.value}<span className="text-sm text-slate-500 font-normal">/10</span></p>
                </div>
                <div className={`h-10 w-10 rounded-md flex items-center justify-center ${s.accent}`}><s.icon size={18} /></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Award} title="No reviews yet" description="Your latest performance review will appear here." />
      )}

      {trend.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Trend</p>
          <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Score over time</h3>
          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 5, fill: '#2563EB' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Quarter</p>
        <h3 className="text-lg font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit' }}>Goals</h3>
        {goals.length === 0 ? <EmptyState icon={Target} title="No goals yet" description="Goals created by your manager (or yourself) will appear here." /> : (
          <ul className="space-y-4" data-testid="goals-list">
            {goals.map((g) => (
              <li key={g.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{g.title}</p>
                    {g.description && <p className="text-xs text-slate-500 mt-0.5">{g.description}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[g.status] || 'bg-slate-100 text-slate-700'}`}>
                    {g.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${g.progress_percent}%` }} />
                  </div>
                  <span className="text-xs font-mono text-slate-700">{g.progress_percent}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reviews.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">History</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit' }}>Past reviews</h3>
          <ul className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{r.period} {r.year}</p>
                  <span className="text-xs font-mono">Overall {r.overall_score}/10</span>
                </div>
                {r.comments && <p className="text-xs text-slate-600 mt-1">{r.comments}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
