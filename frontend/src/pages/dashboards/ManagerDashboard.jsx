import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, FileWarning, Check, X, AlertTriangle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import { getLeaveConflict, getTeamAttritionRisk } from '../../api/ai';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [atRisk, setAtRisk] = useState([]);
  const [conflict, setConflict] = useState(null);
  const [pendingApprovalId, setPendingApprovalId] = useState(null);

  // Polling-safe loader: only fetches dashboard + leave data (no AI calls)
  const loadDashboard = async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    try {
      const [d, p] = await Promise.all([api.get('/dashboard/manager'), api.get('/leave/pending')]);
      setData(d.data);
      setPending(p.data);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load: dashboard + leaves + attrition risk (once)
    const init = async () => {
      setLoading(true);
      try {
        const [d, p] = await Promise.all([
          api.get('/dashboard/manager'),
          api.get('/leave/pending'),
        ]);
        setData(d.data);
        setPending(p.data);
        // Load attrition risk once on mount — not polled
        api.get('/dashboard/employee')
          .then((empRes) => {
            const empId = empRes.data?.employee_id;
            if (!empId) return null;
            return getTeamAttritionRisk(empId);
          })
          .then((res) => {
            if (res) setAtRisk(res.data?.results?.slice(0, 5) || []);
          })
          .catch(() => {});
      } finally {
        setLoading(false);
      }
    };
    init();
    // Auto-refresh dashboard + leaves every 120 seconds (no AI calls)
    const timer = setInterval(() => loadDashboard({ showSpinner: false }), 120_000);
    return () => clearInterval(timer);
  }, []);

  const finishDecision = async (id, action) => {
    try {
      await api.put(`/leave/${id}/${action}`);
      toast.success(`Leave ${action}d`);
      loadDashboard({ showSpinner: false });
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const decide = async (id, action) => {
    if (action !== 'approve') {
      finishDecision(id, action);
      return;
    }
    try {
      const { data: check } = await getLeaveConflict(id);
      if (check.threshold_exceeded) {
        setPendingApprovalId(id);
        setConflict(check);
        return;
      }
      finishDecision(id, action);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) return <Spinner />;
  if (!data) return null;

  return (
    <div className="space-y-6" data-testid="manager-dashboard">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Team</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Manager Console</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users, label: 'Team Size', value: data.team_size, accent: 'bg-blue-50 text-blue-700' },
          { icon: UserCheck, label: 'Present Today', value: data.present_today, accent: 'bg-emerald-50 text-emerald-700' },
          { icon: FileWarning, label: 'Pending Approvals', value: data.pending_approvals, accent: 'bg-amber-50 text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                <p className="text-3xl font-semibold text-slate-900 mt-2" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center ${s.accent}`}><s.icon size={18} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Pending leave requests</p>
          <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Approve or reject</h3>
        </div>
        {pending.length === 0 ? (
          <div className="p-6"><EmptyState title="All caught up!" description="No pending requests at the moment." /></div>
        ) : (
          <table className="w-full" data-testid="manager-pending-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left px-5 py-3 font-semibold">Employee</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Dates</th>
                <th className="text-left px-5 py-3 font-semibold">Days</th>
                <th className="text-left px-5 py-3 font-semibold">Reason</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-sm text-slate-800">{l.employee_name}</td>
                  <td className="px-5 py-3 text-sm capitalize">{l.leave_type}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">{l.start_date} → {l.end_date}</td>
                  <td className="px-5 py-3 text-sm">{l.days_count}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">{l.reason || '—'}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      onClick={() => decide(l.id, 'approve')}
                      className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                      data-testid={`leave-approve-${l.id}`}
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      onClick={() => decide(l.id, 'reject')}
                      className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300"
                      data-testid={`leave-reject-${l.id}`}
                    >
                      <X size={12} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Your team</p>
        <h3 className="text-lg font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit' }}>Direct reports</h3>
        {data.team.length === 0 ? (
          <EmptyState title="No team members yet" description="Assigned reports will appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.team.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.full_name}</p>
                  <p className="text-xs text-slate-500">{t.designation}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ⚠ At-Risk Team Members */}
      {atRisk.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" />
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">AI Insights</p>
                <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>⚠ At-Risk Team Members</h3>
              </div>
            </div>
            <Link to="/manager/ai/attrition" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {atRisk.map((r) => (
              <li key={r.employee_id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.employee_name}</p>
                  <p className="text-xs text-slate-500">{r.designation || ''}</p>
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

      {conflict && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-lg border border-amber-200 shadow-xl p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-amber-700">Scheduling Conflict</p>
                <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Coverage risk detected</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{conflict.message}</p>
                {conflict.project_deadline && (
                  <p className="mt-2 text-sm text-slate-700">
                    Project deadline: <span className="font-medium">{conflict.project_deadline.name}</span> is on {conflict.project_deadline.date}.
                  </p>
                )}
                <p className="mt-2 text-sm font-medium text-amber-800">{conflict.suggestion}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setConflict(null); setPendingApprovalId(null); }}
                className="h-9 px-3 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50"
              >
                Review later
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = pendingApprovalId;
                  setConflict(null);
                  setPendingApprovalId(null);
                  if (id) finishDecision(id, 'approve');
                }}
                className="h-9 px-3 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
              >
                Approve anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
