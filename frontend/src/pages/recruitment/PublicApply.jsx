import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Briefcase, CheckCircle2, FileUp } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { formatApiError, API_BASE } from '../../api/client';

const publicApi = axios.create({ baseURL: API_BASE });

export default function PublicApply() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [resumeFile, setResumeFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.get(`/jobs/${jobId}`).then((r) => setJob(r.data)).catch(() => setJob(null)).finally(() => setLoading(false));
  }, [jobId]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Invalid email';
    if (resumeFile && resumeFile.type && !resumeFile.type.includes('pdf')) {
      e.resume = 'Resume must be a PDF';
    }
    if (resumeFile && resumeFile.size > 5 * 1024 * 1024) {
      e.resume = 'Resume must be 5 MB or smaller';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (resumeFile) {
        const fd = new FormData();
        fd.append('name', form.name.trim());
        fd.append('email', form.email.trim());
        fd.append('phone', form.phone.trim());
        fd.append('resume', resumeFile);
        await publicApi.post(`/jobs/${jobId}/apply`, fd);
      } else {
        await publicApi.post(`/jobs/${jobId}/apply`, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          resume_url: '',
        });
      }
      toast.success('Application submitted!');
      setSuccess(true);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!job) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-lg p-8 max-w-md text-center">
        <Briefcase className="h-12 w-12 mx-auto text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-900 mt-3" style={{ fontFamily: 'Outfit' }}>Job not found</h1>
        <p className="text-sm text-slate-500 mt-1">This posting may have been removed.</p>
      </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-lg p-8 max-w-md text-center" data-testid="apply-success">
        <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
        <h1 className="text-2xl font-semibold text-slate-900 mt-3" style={{ fontFamily: 'Outfit' }}>Thank you!</h1>
        <p className="text-sm text-slate-600 mt-2">Your application for <span className="font-medium">{job.title}</span> has been received. Our recruiting team will be in touch shortly.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50" data-testid="public-apply-page">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold">H</div>
          <p className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Lumen HR · Careers</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{job.department_name || 'Open role'}</p>
          <h1 className="text-3xl font-semibold text-slate-900 mt-1" style={{ fontFamily: 'Outfit' }}>{job.title}</h1>
          <div className="mt-4 prose prose-sm max-w-none">
            <p className="text-sm text-slate-700 whitespace-pre-line">{job.description}</p>
            {job.requirements && (
              <>
                <h3 className="text-base font-semibold text-slate-900 mt-4" style={{ fontFamily: 'Outfit' }}>Requirements</h3>
                <p className="text-sm text-slate-700 whitespace-pre-line">{job.requirements}</p>
              </>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-8 space-y-4" data-testid="public-apply-form">
          <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Apply for this role</h2>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Full name</label>
            <input className={`mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-slate-300'}`} value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} data-testid="apply-name" />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Email</label>
            <input type="email" className={`mt-1 h-11 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-slate-300'}`} value={form.email} onChange={(ev) => setForm({ ...form, email: ev.target.value })} data-testid="apply-email" />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Phone</label>
            <input className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.phone} onChange={(ev) => setForm({ ...form, phone: ev.target.value })} data-testid="apply-phone" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Resume (PDF, optional)</label>
            <label className={`mt-1 flex items-center gap-3 h-11 w-full rounded-md border px-3 text-sm cursor-pointer hover:bg-slate-50 ${errors.resume ? 'border-red-500' : 'border-slate-300'}`}>
              <FileUp size={16} className="text-slate-500 shrink-0" />
              <span className="truncate text-slate-600">{resumeFile ? resumeFile.name : 'Choose PDF file…'}</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(ev) => setResumeFile(ev.target.files?.[0] || null)}
                data-testid="apply-resume"
              />
            </label>
            {errors.resume && <p className="text-xs text-red-600 mt-1">{errors.resume}</p>}
            <p className="text-xs text-slate-500 mt-1">Uploaded to secure storage. Max 5 MB.</p>
          </div>
          <button type="submit" disabled={submitting} className="w-full h-11 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center justify-center gap-2 disabled:opacity-60" data-testid="apply-submit-btn">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Submit application
          </button>
        </form>
      </div>
    </div>
  );
}
