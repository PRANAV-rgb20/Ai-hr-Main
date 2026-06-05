import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { screenResume } from '../../api/ai';

// ── helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (score) => {
  if (score >= 70) return { ring: 'ring-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (score >= 50) return { ring: 'ring-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50'   };
  return              { ring: 'ring-rose-500',         text: 'text-rose-600',    bg: 'bg-rose-50'    };
};

const recMeta = {
  hire:   { label: 'Recommended: Hire',        bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', Icon: CheckCircle,  iconCls: 'text-emerald-600' },
  maybe:  { label: 'Recommended: Maybe',       bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-800',   Icon: AlertCircle,  iconCls: 'text-amber-500'   },
  reject: { label: 'Recommended: Do Not Hire', bg: 'bg-rose-50 border-rose-200',       text: 'text-rose-800',    Icon: XCircle,      iconCls: 'text-rose-600'    },
};

// ── component ─────────────────────────────────────────────────────────────────

export default function ResumeScreener() {
  const fileInputRef = useRef(null);
  const [file, setFile]               = useState(null);
  const [jobDesc, setJobDesc]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [errors, setErrors]           = useState({});

  // ── drag-over styling ──
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const validate = () => {
    const e = {};
    if (!file)              e.file    = 'Please upload a PDF resume';
    if (!jobDesc.trim())    e.jobDesc = 'Job description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleScreen = async () => {
    if (!validate()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await screenResume(file, jobDesc);
      setResult(data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Screening failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const colors = result ? scoreColor(result.overall_score) : null;
  const rec    = result ? recMeta[result.recommendation] ?? recMeta.maybe : null;

  return (
    <div className="space-y-5" data-testid="resume-screener-page">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">AI Tools</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
          Resume Screener
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a PDF resume and paste the job description — AI will score and rank the candidate instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ── LEFT: Input panel ── */}
        <div className="space-y-4">
          {/* Drop zone */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Resume (PDF)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={`mt-1 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50' : errors.file ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/30'}`}
              data-testid="resume-dropzone"
            >
              {file ? (
                <>
                  <FileText size={28} className="text-blue-600" />
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-slate-400" />
                  <p className="text-sm text-slate-600 font-medium">Click or drag & drop a PDF</p>
                  <p className="text-xs text-slate-400">PDF only, max 10 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
              data-testid="resume-file-input"
            />
            {errors.file && <p className="text-xs text-rose-600 mt-1">{errors.file}</p>}
          </div>

          {/* Job description */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Job Description
            </label>
            <textarea
              rows={8}
              placeholder="Paste the full job description here — required skills, responsibilities, qualifications…"
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none
                ${errors.jobDesc ? 'border-rose-400' : 'border-slate-300'}`}
              data-testid="job-description-input"
            />
            {errors.jobDesc && <p className="text-xs text-rose-600 mt-1">{errors.jobDesc}</p>}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleScreen}
            disabled={loading}
            className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
            data-testid="screen-btn"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                AI is analyzing the resume…
              </>
            ) : (
              <>
                <FileText size={16} />
                Screen with AI
              </>
            )}
          </button>
        </div>

        {/* ── RIGHT: Results panel ── */}
        <div>
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-slate-200 text-slate-400">
              <FileText size={36} className="mb-2 opacity-40" />
              <p className="text-sm">Results will appear here</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-slate-200 bg-white">
              <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium text-slate-700">AI is analyzing the resume…</p>
              <p className="text-xs text-slate-400 mt-1">This usually takes 5–10 seconds</p>
            </div>
          )}

          {result && colors && rec && (
            <div className="space-y-4" data-testid="screening-results">

              {/* Score + recommendation */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-center gap-5">
                {/* Score circle */}
                <div className={`shrink-0 h-20 w-20 rounded-full ring-4 ${colors.ring} ${colors.bg} flex flex-col items-center justify-center`}>
                  <span className={`text-2xl font-bold ${colors.text}`} style={{ fontFamily: 'Outfit' }}>
                    {result.overall_score}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">/ 100</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">AI Score</p>
                  <p className="text-lg font-semibold text-slate-900 mt-0.5" style={{ fontFamily: 'Outfit' }}>
                    {result.overall_score >= 70 ? 'Strong match' : result.overall_score >= 50 ? 'Partial match' : 'Weak match'}
                  </p>
                </div>
              </div>

              {/* Recommendation banner */}
              <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${rec.bg}`}>
                <rec.Icon size={20} className={rec.iconCls} />
                <p className={`text-sm font-semibold ${rec.text}`}>{rec.label}</p>
              </div>

              {/* Skills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                    ✓ Matched Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.skills_matched || []).length === 0
                      ? <p className="text-xs text-slate-400 italic">None detected</p>
                      : (result.skills_matched || []).map((s) => (
                          <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                            {s}
                          </span>
                        ))}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 mb-2">
                    ✗ Missing Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.skills_missing || []).length === 0
                      ? <p className="text-xs text-slate-400 italic">None identified</p>
                      : (result.skills_missing || []).map((s) => (
                          <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                            {s}
                          </span>
                        ))}
                  </div>
                </div>
              </div>

              {/* Strengths & Concerns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {(result.strengths || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Concerns</p>
                  <ul className="space-y-1.5">
                    {(result.concerns || []).map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Summary */}
              {result.summary && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">AI Summary</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
