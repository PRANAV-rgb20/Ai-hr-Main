import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users, UserCheck, FileWarning, Wallet, Briefcase, Award, Download,
} from 'lucide-react';
import { api } from '../../api/client';
import { exportToCsv } from '../../utils/exportCsv';
import Spinner from '../../components/Spinner';

const PIE_COLORS = ['#2563EB', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── helpers ───────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2" style={{ fontFamily: 'Outfit' }}>
            {value ?? '—'}
          </p>
        </div>
        <div className={`h-10 w-10 rounded-md flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, onExport, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">{subtitle}</p>
          <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>{title}</h3>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50 transition-colors"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-72 bg-slate-50 rounded-lg animate-pulse" />;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [months, setMonths]     = useState(6);
  const [dashboard, setDash]    = useState(null);
  const [headcount, setHc]      = useState([]);
  const [attTrend, setAtt]      = useState([]);
  const [leaveDist, setLeave]   = useState([]);
  const [payTrend, setPay]      = useState([]);
  const [perfDist, setPerf]     = useState([]);
  const [loadingMain, setLM]    = useState(true);
  const [loadingCharts, setLC]  = useState(true);

  // Load summary cards
  useEffect(() => {
    api.get('/dashboard/admin')
      .then((r) => setDash(r.data))
      .finally(() => setLM(false));
    api.get('/reports/headcount/')
      .then((r) => setHc(r.data))
      .catch(() => {});
    api.get('/reports/leave-distribution/')
      .then((r) => setLeave(r.data))
      .catch(() => {});
    api.get('/reports/performance-distribution/')
      .then((r) => setPerf(r.data))
      .catch(() => {});
  }, []);

  // Load trend charts (re-fetch when months toggle changes)
  useEffect(() => {
    setLC(true);
    Promise.all([
      api.get(`/reports/attendance-trend/?months=${months}`),
      api.get(`/reports/payroll-trend/?months=${months}`),
    ])
      .then(([att, pay]) => {
        setAtt(att.data);
        setPay(pay.data);
      })
      .catch(() => {})
      .finally(() => setLC(false));
  }, [months]);

  // Avg performance from perfDist
  const totalReviews = perfDist.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            Analytics & Reports
          </h1>
        </div>

        {/* Time range toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={`h-8 px-4 rounded-md text-sm font-medium transition-colors ${
                months === m
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              data-testid={`months-${m}`}
            >
              {m}M
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {loadingMain ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users}      label="Employees"       value={dashboard?.total_employees}                                   accent="bg-blue-50 text-blue-700" />
          <StatCard icon={UserCheck}  label="Present Today"   value={dashboard?.present_today}                                     accent="bg-emerald-50 text-emerald-700" />
          <StatCard icon={FileWarning}label="Pending Leaves"  value={dashboard?.pending_leaves}                                    accent="bg-amber-50 text-amber-700" />
          <StatCard icon={Wallet}     label="Payroll Total"   value={dashboard?.payroll_total ? `$${Number(dashboard.payroll_total).toLocaleString()}` : '—'} accent="bg-violet-50 text-violet-700" />
          <StatCard icon={Briefcase}  label="Open Jobs"       value={headcount.length > 0 ? headcount.reduce((s, d) => s + d.employee_count, 0) : '—'} accent="bg-cyan-50 text-cyan-700" />
          <StatCard icon={Award}      label="Reviews"         value={totalReviews}                                                 accent="bg-rose-50 text-rose-700" />
        </div>
      )}

      {/* Chart 1 — Headcount by Department */}
      <ChartCard
        title="Headcount by Department"
        subtitle="Workforce"
        onExport={() => exportToCsv(headcount, 'headcount_by_department')}
      >
        {headcount.length === 0 ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={headcount}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="department_name" stroke="#64748B" fontSize={11} />
              <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="employee_count" fill="#2563EB" radius={[6, 6, 0, 0]} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 2 — Attendance Trend */}
      <ChartCard
        title={`Attendance Rate · Last ${months} Months`}
        subtitle="Trend"
        onExport={() => exportToCsv(attTrend, `attendance_trend_${months}m`)}
      >
        {loadingCharts ? <ChartSkeleton /> : attTrend.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-20">No attendance data</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={attTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month_label" stroke="#64748B" fontSize={11} />
              <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Line type="monotone" dataKey="attendance_rate" stroke="#22c55e" strokeWidth={2.5}
                dot={{ r: 4, fill: '#22c55e' }} name="Attendance Rate %" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 3 — Leave Distribution */}
      <ChartCard
        title="Leave Distribution (This Year)"
        subtitle="Time Off"
        onExport={() => exportToCsv(leaveDist, 'leave_distribution')}
      >
        {leaveDist.length === 0 ? <ChartSkeleton /> : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={leaveDist}
                  dataKey="total_days_taken"
                  nameKey="leave_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={({ leave_type, percent }) =>
                    `${leave_type} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {leaveDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} days`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Chart 4 — Payroll Trend */}
      <ChartCard
        title={`Payroll Cost · Last ${months} Months`}
        subtitle="Compensation"
        onExport={() => exportToCsv(payTrend, `payroll_trend_${months}m`)}
      >
        {loadingCharts ? <ChartSkeleton /> : payTrend.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-20">No payroll data</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={payTrend}>
              <defs>
                <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month_label" stroke="#64748B" fontSize={11} />
              <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
              <Legend />
              <Area type="monotone" dataKey="total_cost" stroke="#8b5cf6" strokeWidth={2.5}
                fill="url(#payGrad)" name="Total Net Payroll" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 5 — Performance Distribution */}
      <ChartCard
        title="Performance Score Distribution"
        subtitle="Reviews"
        onExport={() => exportToCsv(perfDist, 'performance_distribution')}
      >
        {perfDist.length === 0 ? <ChartSkeleton /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={perfDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="score_range" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Reviews">
                {perfDist.map((_, i) => (
                  <Cell key={i} fill={['#ef4444', '#f59e0b', '#22c55e', '#2563EB'][i % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
