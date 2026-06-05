import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, Phone, GripVertical, Bot, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import { screenAllCandidates } from '../../api/ai';
import { useAuthStore } from '../../store/authStore';
import Spinner from '../../components/Spinner';

const STAGES = [
  { key: 'applied',   label: 'Applied',   accent: 'border-slate-300 bg-slate-50'        },
  { key: 'screened',  label: 'Screened',  accent: 'border-blue-300 bg-blue-50/40'        },
  { key: 'interview', label: 'Interview', accent: 'border-amber-300 bg-amber-50/40'      },
  { key: 'offered',   label: 'Offered',   accent: 'border-emerald-300 bg-emerald-50/40'  },
  { key: 'rejected',  label: 'Rejected',  accent: 'border-rose-300 bg-rose-50/40'        },
];

const aiScoreColor = (score) => {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  if (score >= 50) return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-rose-100 text-rose-700 border-rose-300';
};

export default function CandidateKanban() {
  const [params] = useSearchParams();
  const filterJob = params.get('job');
  const { role } = useAuthStore();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [hoverStage, setHoverStage] = useState(null);

  const canUseAI = role === 'hr_recruiter' || role === 'management_admin';

  const load = async () => {
    setLoading(true);
    try {
      const [c, j] = await Promise.all([
        filterJob ? api.get(`/jobs/${filterJob}/candidates`) : api.get('/candidates'),
        api.get('/jobs'),
      ]);
      setCandidates(c.data);
      setJobs(j.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterJob]);

  const handleInterview = (candidate) => {
    const jobTitle = jobs.find((j) => j.id === filterJob)?.title || '';
    const path = role === 'management_admin' ? '/admin/ai/interview' : '/recruiter/ai/interview';
    navigate(path, {
      state: {
        candidateId: candidate.id,
        candidateName: candidate.name,
        jobTitle,
      },
    });
  };

  const handleScreenAll = async () => {    if (!filterJob) {
      toast.error('Select a specific job to use batch screening');
      return;
    }
    setScreening(true);
    const tid = toast.loading('AI is screening all candidates…');
    try {
      const { data } = await screenAllCandidates(filterJob);
      toast.dismiss(tid);
      toast.success(`${data.screened} candidate${data.screened !== 1 ? 's' : ''} screened`);
      await load(); // refresh to show ai_score badges
    } catch (err) {
      toast.dismiss(tid);
      toast.error(formatApiError(err));
    } finally {
      setScreening(false);
    }
  };

  const onDragStart = (id) => setDraggingId(id);
  const onDragOver  = (e, stage) => { e.preventDefault(); setHoverStage(stage); };
  const onDrop = async (stage) => {
    if (!draggingId) return;
    const c = candidates.find((x) => x.id === draggingId);
    setHoverStage(null);
    if (!c || c.status === stage) { setDraggingId(null); return; }
    setCandidates((arr) => arr.map((x) => x.id === draggingId ? { ...x, status: stage } : x));
    try {
      await api.put(`/candidates/${draggingId}/status`, { status: stage });
      toast.success(`Moved to ${stage}`);
    } catch (e) {
      toast.error(formatApiError(e));
      load();
    } finally {
      setDraggingId(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" data-testid="kanban-page">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Pipeline</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Candidates</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {filterJob && (
            <p className="text-xs text-slate-500">
              Filtered to:{' '}
              <span className="font-medium text-slate-800">
                {jobs.find((j) => j.id === filterJob)?.title || filterJob}
              </span>
            </p>
          )}

          {/* AI batch screen button — only for recruiter / admin */}
          {canUseAI && (
            <button
              type="button"
              onClick={handleScreenAll}
              disabled={screening || !filterJob}
              title={!filterJob ? 'Filter by a specific job first' : 'Screen all candidates with AI'}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              data-testid="screen-all-btn"
            >
              <Bot size={15} />
              {screening ? 'Screening…' : '🤖 Screen All with AI'}
            </button>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAGES.map((s) => {
          const items = candidates.filter((c) => c.status === s.key);
          return (
            <div
              key={s.key}
              onDragOver={(e) => onDragOver(e, s.key)}
              onDrop={() => onDrop(s.key)}
              onDragLeave={() => setHoverStage(null)}
              className={`rounded-lg border-2 ${s.accent} ${hoverStage === s.key ? 'ring-2 ring-blue-400' : ''} p-3 min-h-[320px] transition-all`}
              data-testid={`kanban-column-${s.key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">{s.label}</p>
                <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  {items.length}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => onDragStart(c.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={`bg-white border border-slate-200 rounded-md p-3 cursor-move hover:shadow-md transition-all ${draggingId === c.id ? 'opacity-50' : ''}`}
                    data-testid={`candidate-card-${c.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                          {/* AI score badge */}
                          {c.ai_score != null && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${aiScoreColor(c.ai_score)}`}
                              title={`AI score: ${c.ai_score}/100`}
                              data-testid={`ai-score-badge-${c.id}`}
                            >
                              AI: {c.ai_score}
                            </span>
                          )}
                        </div>
                        {c.job_title && (
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{c.job_title}</p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1 truncate">
                          <Mail size={10} /> {c.email}
                        </p>
                        {c.phone && (
                          <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                            <Phone size={10} /> {c.phone}
                          </p>
                        )}
                        {/* AI recommendation pill */}
                        {c.ai_recommendation && (
                          <p className={`mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block border
                            ${c.ai_recommendation === 'hire'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              c.ai_recommendation === 'reject' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                                  'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {c.ai_recommendation}
                          </p>
                        )}
                        {/* Interview button */}
                        {canUseAI && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleInterview(c); }}
                            className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            data-testid={`interview-btn-${c.id}`}
                          >
                            <Video size={9} /> Interview
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-6">Drop candidates here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
