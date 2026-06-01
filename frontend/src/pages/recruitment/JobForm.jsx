import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';

export default function JobForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', department_id: '', description: '', requirements: '' });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/jobs', { ...form, department_id: form.department_id || null });
      toast.success('Job created');
      navigate('/recruiter/jobs');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl" data-testid="job-form-page">
      <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} className="mr-1" /> Back
      </button>
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">New</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Create job posting</h1>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4" data-testid="job-form">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Title</label>
          <input className={`mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-500' : 'border-slate-300'}`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="job-title-input" />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Department</label>
          <select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} data-testid="job-dept-select">
            <option value="">— None —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Description</label>
          <textarea rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="job-description" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Requirements</label>
          <textarea rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} data-testid="job-requirements" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate(-1)} className="h-10 px-4 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="h-10 px-5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-60" data-testid="job-submit-btn">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Create job
          </button>
        </div>
      </form>
    </div>
  );
}
