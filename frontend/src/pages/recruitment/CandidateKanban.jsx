import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Phone, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import Spinner from '../../components/Spinner';

const STAGES = [
  { key: 'applied', label: 'Applied', accent: 'border-slate-300 bg-slate-50' },
  { key: 'screened', label: 'Screened', accent: 'border-blue-300 bg-blue-50/40' },
  { key: 'interview', label: 'Interview', accent: 'border-amber-300 bg-amber-50/40' },
  { key: 'offered', label: 'Offered', accent: 'border-emerald-300 bg-emerald-50/40' },
  { key: 'rejected', label: 'Rejected', accent: 'border-rose-300 bg-rose-50/40' },
];

export default function CandidateKanban() {
  const [params] = useSearchParams();
  const filterJob = params.get('job');
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState(null);
  const [hoverStage, setHoverStage] = useState(null);

  const load = async () => {
    setLoading(true);
    const [c, j] = await Promise.all([
      filterJob ? api.get(`/jobs/${filterJob}/candidates`) : api.get('/candidates'),
      api.get('/jobs'),
    ]);
    setCandidates(c.data);
    setJobs(j.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filterJob]);

  const onDragStart = (id) => setDraggingId(id);
  const onDragOver = (e, stage) => {
    e.preventDefault();
    setHoverStage(stage);
  };
  const onDrop = async (stage) => {
    if (!draggingId) return;
    const c = candidates.find((x) => x.id === draggingId);
    setHoverStage(null);
    if (!c || c.status === stage) { setDraggingId(null); return; }
    // optimistic update
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
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Pipeline</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Candidates</h1>
        </div>
        {filterJob && (
          <p className="text-xs text-slate-500">
            Filtered to: <span className="font-medium text-slate-800">{jobs.find((j) => j.id === filterJob)?.title || filterJob}</span>
          </p>
        )}
      </div>

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
                <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{items.length}</span>
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
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{c.name}</p>
                        {c.job_title && <p className="text-[11px] text-slate-500 mt-0.5">{c.job_title}</p>}
                        <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
                          <Mail size={10} /> {c.email}
                        </p>
                        {c.phone && (
                          <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                            <Phone size={10} /> {c.phone}
                          </p>
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
