import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserCheck, FileWarning, TrendingUp, Plus, ArrowRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { api } from '../../api/client';
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

  useEffect(() => {
    api.get('/dashboard/admin').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (!data) return <p className="text-sm text-red-600">Failed to load.</p>;

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
        <Stat icon={TrendingUp} label="Attendance Rate" value={`${data.attendance_trend?.at?.(-1)?.rate ?? 0}%`} accent="bg-violet-50 text-violet-700" testid="stat-attendance-rate" />
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
            <ResponsiveContainer width="100%" height="100%">
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
            <ResponsiveContainer width="100%" height="100%">
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
    </div>
  );
}
