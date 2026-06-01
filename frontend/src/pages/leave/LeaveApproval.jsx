import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

export default function LeaveApproval() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/leave/pending').then((r) => setList(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const decide = async (id, action) => {
    try {
      await api.put(`/leave/${id}/${action}`);
      toast.success(`Leave ${action}d`);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div className="space-y-5" data-testid="leave-approval-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Queue</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Leave Approvals</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? <Spinner /> : list.length === 0 ? (
          <div className="p-6"><EmptyState title="All caught up!" description="No pending leave requests." /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left px-5 py-3 font-semibold">Employee</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Range</th>
                <th className="text-left px-5 py-3 font-semibold">Days</th>
                <th className="text-left px-5 py-3 font-semibold">Reason</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-sm">{l.employee_name}</td>
                  <td className="px-5 py-3 text-sm capitalize">{l.leave_type}</td>
                  <td className="px-5 py-3 text-sm">{l.start_date} → {l.end_date}</td>
                  <td className="px-5 py-3 text-sm">{l.days_count}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">{l.reason || '—'}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button onClick={() => decide(l.id, 'approve')} className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium" data-testid={`approve-${l.id}`}>
                      <Check size={12} /> Approve
                    </button>
                    <button onClick={() => decide(l.id, 'reject')} className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-300" data-testid={`reject-${l.id}`}>
                      <X size={12} /> Reject
                    </button>
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
