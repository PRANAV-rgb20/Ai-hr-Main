import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, FileWarning, TrendingUp, Plus, ArrowRight, AlertTriangle, Loader2, RefreshCw,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { api } from '../../api/client';
import { getAdminAIInsight, getTeamAttritionRisk } from '../../api/ai';
import Spinner from '../../components/Spinner';

const Stat = ({ icon: Icon, label, value, accent, testid }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md hover:-translate-y-0.5 transition-all" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
        <p className="text-3xl font-semibold text-slate-900 mt-2" style={{ fontFamily: 'Outfit' }}>{value}</p>
      </div>
      <div className={`h-10 w-10 rounded-md flex items-center justify-center ${accent}`}>
        <Icon size={18} />
      </div>
    </div>
  </div>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atRisk, setAtRisk] = useState([]);
  const [aiInsight, setAiInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightError, setInsightError] = useState(false);

  const loadInsight = () => {
    setInsightLoading(true);
    setInsightError(false);
    getAdminAIInsight()
      .then((res) => setAiInsight(res.data))
      .catch(() => setInsightError(true))
      .finally(() => setInsightLoading(false));
  };

  useEffect(() => {
    api.get('/dashboard/admin')
      .then((adminRes) => {
        setData(adminRes.data);
        getTeamAttritionRisk('all')
          .then((res) => setAtRisk(res.data?.results?.slice(0, 5) || []))
          .catch(() => {});
        loadInsight();
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const timer = setInterval(() => {
      api.get('/dashboard/admin').then((r) => setData(r.data)).catch(() => {});
    }, 120_000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (!data) return <p className="text-sm text-red-600">Failed to load.</p>;

  const todayRate = data.total_employees > 0 ? Math.round((data.present_today / data.total_employees) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Overview</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Operations Center</h1>
        </div>
        <Link
          to="/admin/employees"
          className="hidden sm:inline-flex items-center gap-2 px-3 h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          data-testid="admin-add-employee-btn"
        >
          <Plus size={16} /> Add Employee
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Total Employees" value={data.total_employees} accent="bg-blue-50 text-blue-700" testid="stat-total-employees" />
        <Stat icon={UserCheck} label="Present Today" value={data.present_today} accent="bg-emerald-50 text-emerald-700" testid="stat-present-today" />
        <Stat icon={FileWarning} label="Pending Leaves" value={data.pending_leaves} accent="bg-amber-50 text-amber-700" testid="stat-pending-leaves" />
        <Stat icon={TrendingUp} label="Attendance Rate" value={`${todayRate}%`} accent="bg-violet-50 text-violet-700" testid="stat-attendance-rate" />
      </div>

      <div className="bg-white border border-blue-200 rounded-lg p-5 shadow-sm" data-testid="admin-ai-insight-card">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
            {insightLoading ? <Loader2 size={18} className="animate-spin" /> : <TrendingUp size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-blue-700">AI Insight</p>
                <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Morning workforce briefing</h3>
              </div>
              <div className="flex items-center gap-2">
                {aiInsight?.generated_at && (
                  <span className="text-[11px] text-slate-500">
                    {new Date(aiInsight.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {!insightLoading && (
                  <button
                    type="button"
                    onClick={loadInsight}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 transition-colors"
                    title="Regenerate insight"
                  >
                    <RefreshCw size={11} />
                  </button>
                )}
              </div>
            </div>

            {insightLoading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Analyzing workforce data across {data?.total_employees ?? '...'} employees…
              </div>
            )}

            {insightError && !insightLoading && (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-sm text-slate-500">Could not generate insight right now.</p>
                <button
                  type="button"
                  onClick={loadInsight}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                >
                  <RefreshCw size={11} /> Retry
                </button>
              </div>
            )}

            {!insightLoading && !insightError && (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {aiInsight?.summary || 'No insight available yet.'}
                </p>
                {aiInsight?.top_drivers?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {aiInsight.top_drivers.map((driver) => (
                      <span key={driver} className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                        {driver}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Trend</p>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Attendance rate · last 6 months</h3>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <LineChart data={data.attendance_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Headcount</p>
          <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit' }}>By department</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <BarChart data={data.headcount_by_department || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="department" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Quick actions</p>
        <h3 className="text-lg font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit' }}>Get things done</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: '/admin/employees', label: 'Add Employee', sub: 'Onboard a new hire' },
            { to: '/admin/departments', label: 'Departments', sub: 'Manage teams' },
            { to: '/admin/attendance', label: 'Attendance', sub: 'Who is in today' },
            { to: '/admin/leave', label: 'Leave Queue', sub: 'Approve requests' },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group rounded-lg border border-slate-200 p-4 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              data-testid={`quick-action-${a.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                {a.label} <ArrowRight size={14} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{a.sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ⚠ At-Risk Employees */}
      {atRisk.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" />
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">AI Insights</p>
                <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>⚠ At-Risk Employees</h3>
              </div>
            </div>
            <Link to="/admin/ai/attrition" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {atRisk.map((r) => (
              <li key={r.employee_id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.employee_name}</p>
                  <p className="text-xs text-slate-500">{r.designation || r.department_name || ''}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize shrink-0
                  ${r.risk_level === 'high'   ? 'bg-rose-50 text-rose-700 border-rose-200'   :
                    r.risk_level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {r.risk_level} · {Math.round(r.risk_score * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
