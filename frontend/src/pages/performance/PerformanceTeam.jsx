import { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'Annual'];

export default function PerformanceTeam() {
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    period: 'Q1',
    year: new Date().getFullYear(),
    goals_score: 7,
    skills_score: 7,
    attitude_score: 7,
    comments: '',
  });

  const load = async () => {
    setLoading(true);
    const [r, e] = await Promise.all([
      api.get('/performance/team'),
      api.get('/employees', { params: { page_size: 100 } }),
    ]);
    setReviews(r.data);
    setEmployees(e.data.items);
    if (e.data.items[0] && !form.employee_id) {
      setForm((f) => ({ ...f, employee_id: e.data.items[0].id }));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employee_id) return toast.error('Select an employee');
    setSubmitting(true);
    try {
      await api.post('/performance/review', form);
      toast.success('Review created');
      setForm((f) => ({ ...f, comments: '' }));
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;
  const overall = ((form.goals_score + form.skills_score + form.attitude_score) / 3).toFixed(2);

  return (
    <div className="space-y-5" data-testid="performance-team-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Team</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Performance Reviews</h1>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4" data-testid="review-form">
        <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Create review</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Employee</label>
            <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} data-testid="review-employee-select">
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Period</label>
            <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} data-testid="review-period-select">
              {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Year</label>
            <input type="number" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} data-testid="review-year-input" />
          </div>
        </div>

        {['goals_score', 'skills_score', 'attitude_score'].map((key) => (
          <div key={key}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">{key.replace('_', ' ').replace('score', '').trim()} score</label>
              <span className="text-sm font-mono text-blue-700">{form[key]}/10</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              className="w-full mt-2 accent-blue-600"
              data-testid={`review-slider-${key}`}
            />
          </div>
        ))}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Comments</label>
          <textarea rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} data-testid="review-comments" />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-sm text-slate-600">Overall: <span className="font-semibold text-blue-700">{overall}/10</span></p>
          <button type="submit" disabled={submitting} className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-60" data-testid="review-submit-btn">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Save review
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Recent reviews</h3>
        </div>
        {reviews.length === 0 ? (
          <div className="p-6"><EmptyState title="No reviews yet" description="Submitted reviews will appear here." /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left px-5 py-3 font-semibold">Employee</th>
                <th className="text-left px-5 py-3 font-semibold">Period</th>
                <th className="text-right px-5 py-3 font-semibold">Goals</th>
                <th className="text-right px-5 py-3 font-semibold">Skills</th>
                <th className="text-right px-5 py-3 font-semibold">Attitude</th>
                <th className="text-right px-5 py-3 font-semibold">Overall</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-5 py-3 text-sm font-medium">{r.employee_name}</td>
                  <td className="px-5 py-3 text-sm">{r.period} {r.year}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono">{r.goals_score}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono">{r.skills_score}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono">{r.attitude_score}</td>
                  <td className="px-5 py-3 text-sm text-right font-mono font-semibold text-blue-700">{r.overall_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
