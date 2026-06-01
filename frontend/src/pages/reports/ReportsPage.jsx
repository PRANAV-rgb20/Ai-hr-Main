import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, Building2, Briefcase, FileText, TrendingUp, Award } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#A855F7', '#EF4444', '#0EA5E9'];

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/overview').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="No data" />;

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Analytics</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Reports</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { icon: Users, label: 'Employees', value: data.total_employees, accent: 'bg-blue-50 text-blue-700' },
          { icon: Building2, label: 'Departments', value: data.total_departments, accent: 'bg-emerald-50 text-emerald-700' },
          { icon: Briefcase, label: 'Open jobs', value: data.open_jobs, accent: 'bg-amber-50 text-amber-700' },
          { icon: FileText, label: 'Candidates', value: data.total_candidates, accent: 'bg-violet-50 text-violet-700' },
          { icon: TrendingUp, label: 'Approved leaves', value: data.approved_leaves, accent: 'bg-cyan-50 text-cyan-700' },
          { icon: Award, label: 'Pending leaves', value: data.pending_leaves, accent: 'bg-rose-50 text-rose-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className={`h-8 w-8 rounded-md flex items-center justify-center ${s.accent} mb-2`}><s.icon size={14} /></div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
            <p className="text-2xl font-semibold mt-0.5" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">People</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit' }}>Headcount by department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <BarChart data={data.headcount_by_department}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="department" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Pipeline</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit' }}>Candidate stages</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <PieChart>
                <Pie data={data.candidate_pipeline} dataKey="count" nameKey="stage" outerRadius={80} label>
                  {data.candidate_pipeline.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Leave</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit' }}>By type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <BarChart data={data.leave_by_type}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="type" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Top performers</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit' }}>Highest scores</h3>
          {data.top_performers.length === 0 ? <EmptyState title="No reviews yet" /> : (
            <ul className="space-y-3">
              {data.top_performers.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-blue-700">{p.score}/10</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {data.payroll_recent.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Payroll</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit' }}>Recent runs</h3>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left px-4 py-2 font-semibold">Period</th>
                <th className="text-right px-4 py-2 font-semibold">Slips</th>
                <th className="text-right px-4 py-2 font-semibold">Total net</th>
              </tr>
            </thead>
            <tbody>
              {data.payroll_recent.map((p) => (
                <tr key={p.label} className="border-b border-slate-100 text-sm">
                  <td className="px-4 py-2">{p.label}</td>
                  <td className="px-4 py-2 text-right">{p.count}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">${p.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
