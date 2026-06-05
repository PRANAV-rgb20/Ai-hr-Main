import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function JobForm() {
  const navigate   = useNavigate();
  const { role }   = useAuthStore();
  const [title, setTitle]             = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState({});

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = 'Title is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/jobs', {
        title:         title.trim(),
        department_id: departmentId || null,
        description:   description.trim(),
        requirements:  requirements.trim(),
      });
      toast.success('Job posting created');
      // Navigate to the correct jobs page based on role
      if (role === 'management_admin') {
        navigate('/admin/recruitment');
      } else {
        navigate('/recruiter/jobs');
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (hasErr) =>
    `mt-1 h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
      hasErr ? 'border-red-500' : 'border-slate-300'
    }`;

  return (
    <div className="space-y-5 max-w-2xl" data-testid="job-form-page">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={14} className="mr-1" /> Back
      </button>

      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">New</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
          Create job posting
        </h1>
      </div>

      <form
        onSubmit={submit}
        className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        data-testid="job-form"
      >
        {/* Title */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Job title <span className="text-red-500">*</span>
          </label>
          <input
            className={inputCls(errors.title)}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            data-testid="job-title-input"
          />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
        </div>

        {/* Department */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Department
          </label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            data-testid="job-dept-select"
          >
            <option value="">— None —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Job description
          </label>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the role, responsibilities, and what the candidate will work on…"
            data-testid="job-description"
          />
        </div>

        {/* Requirements */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Requirements
          </label>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Required skills, experience, qualifications…"
            data-testid="job-requirements"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-10 px-4 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-60"
            data-testid="job-submit-btn"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Creating…' : 'Create job posting'}
          </button>
        </div>
      </form>
    </div>
  );
}
