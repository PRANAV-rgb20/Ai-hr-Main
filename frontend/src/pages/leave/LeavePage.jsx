import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { useAuthStore } from '../../store/authStore';

const TYPES = ['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid'];

export default function LeavePage() {
  const { user } = useAuthStore();
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
  const [errors, setErrors] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const me = await api.get('/auth/me');
      const meRes = await api.get('/employees', { params: { search: me.data.email } });
      const empId = meRes.data?.items?.[0]?.id;
      const [lr, br] = await Promise.all([
        api.get('/leave/my'),
        empId ? api.get(`/leave/balance/${empId}`) : Promise.resolve({ data: [] }),
      ]);
      setLeaves(lr.data);
      setBalances(br.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.start_date) e.start_date = 'Required';
    if (!form.end_date) e.end_date = 'Required';
    if (form.start_date && form.end_date && form.end_date < form.start_date) e.end_date = 'End must be after start';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/leave/apply', form);
      toast.success('Leave application submitted');
      setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" data-testid="leave-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Time off</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Leave Management</h1>
      </div>

      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {balances.map((b) => {
            const pct = b.total_days ? Math.round((b.remaining_days / b.total_days) * 100) : 0;
            return (
              <div key={b.leave_type} className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold capitalize">{b.leave_type}</p>
                <p className="text-2xl font-semibold mt-1" style={{ fontFamily: 'Outfit' }}>
                  {b.remaining_days}<span className="text-sm text-slate-500 font-normal"> / {b.total_days}</span>
                </p>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4" data-testid="leave-apply-form">
          <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Apply for leave</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Type</label>
              <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.leave_type} onChange={(e) => upd('leave_type', e.target.value)} data-testid="leave-type-select">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Start date</label>
              <input type="date" className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.start_date ? 'border-red-500' : 'border-slate-300'}`} value={form.start_date} onChange={(e) => upd('start_date', e.target.value)} data-testid="leave-start-date" />
              {errors.start_date && <p className="text-xs text-red-600 mt-1">{errors.start_date}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">End date</label>
              <input type="date" className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.end_date ? 'border-red-500' : 'border-slate-300'}`} value={form.end_date} onChange={(e) => upd('end_date', e.target.value)} data-testid="leave-end-date" />
              {errors.end_date && <p className="text-xs text-red-600 mt-1">{errors.end_date}</p>}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Reason</label>
            <textarea rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.reason} onChange={(e) => upd('reason', e.target.value)} data-testid="leave-reason" />
          </div>
          <button type="submit" disabled={submitting} className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-60" data-testid="leave-submit-btn">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Submit application
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit' }}>Your leave history</h3>
          {leaves.length === 0 ? <EmptyState title="No leaves yet" description="Your applications will appear here." /> : (
            <ul className="divide-y divide-slate-100">
              {leaves.map((l) => (
                <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">{l.leave_type} · {l.days_count} days</p>
                    <p className="text-xs text-slate-500">{l.start_date} → {l.end_date}</p>
                    {l.reason && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{l.reason}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    l.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    l.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                  }`}>{l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
