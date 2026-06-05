import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Briefcase, Users as UsersIcon, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

export default function JobsList() {
  const [jobs, setJobs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const { role }            = useAuthStore();

  // Resolve correct base path based on role
  const base = role === 'management_admin' ? '/admin' : '/recruiter';

  const load = () => {
    setLoading(true);
    api.get('/jobs').then((r) => setJobs(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleStatus = async (j) => {
    try {
      await api.put(`/jobs/${j.id}`, { status: j.status === 'open' ? 'closed' : 'open' });
      toast.success(`Job ${j.status === 'open' ? 'closed' : 'reopened'}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div className="space-y-5" data-testid="jobs-list-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Talent</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Job Postings</h1>
        </div>
        {/* New Job button — uses role-aware path */}
        <Link
          to={`${base}/recruitment/new`}
          className="inline-flex items-center gap-2 px-3 h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          data-testid="job-create-btn"
        >
          <Plus size={16} /> New Job
        </Link>
      </div>

      {loading ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Create your first job posting to start receiving applications."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400 transition-colors"
              data-testid={`job-card-${j.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    {j.department_name || 'No department'}
                  </p>
                  <h3
                    className="text-lg font-semibold text-slate-900 mt-0.5"
                    style={{ fontFamily: 'Outfit' }}
                  >
                    {j.title}
                  </h3>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  j.status === 'open'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {j.status}
                </span>
              </div>

              <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                {j.description || 'No description provided.'}
              </p>

              <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <UsersIcon size={12} />
                  {j.candidate_count} candidate{j.candidate_count === 1 ? '' : 's'}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStatus(j)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    data-testid={`job-toggle-${j.id}`}
                  >
                    {j.status === 'open' ? 'Close' : 'Reopen'}
                  </button>
                  <Link
                    to={`/apply/${j.id}`}
                    target="_blank"
                    className="text-xs font-medium text-blue-700 hover:underline inline-flex items-center gap-1"
                    data-testid={`job-public-${j.id}`}
                  >
                    Public page <ExternalLink size={10} />
                  </Link>
                  {/* Candidates pipeline — role-aware path */}
                  <Link
                    to={`${base}/recruitment/candidates?job=${j.id}`}
                    className="text-xs font-medium text-blue-700 hover:underline"
                    data-testid={`job-candidates-${j.id}`}
                  >
                    View pipeline →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
