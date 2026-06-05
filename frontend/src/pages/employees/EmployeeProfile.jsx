import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Building2, BadgeCheck, Calendar, Edit3, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';
import { api } from '../../api/client';
import { getAttritionRisk, getWellnessScore, predictPerformance } from '../../api/ai';
import Spinner from '../../components/Spinner';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function EmployeeProfile() {
  const { id } = useParams();
  const { role } = useAuthStore();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [perfPrediction, setPerfPrediction] = useState(null);
  const [attritionRisk, setAttritionRisk] = useState(null);
  const [wellness, setWellness] = useState(null);

  const canViewAI = role === 'management_admin' || role === 'senior_manager';

  useEffect(() => {
    api.get(`/employees/${id}`)
      .then((r) => {
        setEmp(r.data);
        return getWellnessScore(r.data.id);
      })
      .then((res) => setWellness(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const refreshAI = async () => {
    if (!emp) return;
    setAiLoading(true);
    try {
      const [perf, attr] = await Promise.all([
        predictPerformance(emp.id),
        getAttritionRisk(emp.id),
      ]);
      setPerfPrediction(perf.data);
      setAttritionRisk(attr.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'AI prediction failed');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <Spinner />;
  if (!emp) return <p className="text-sm text-red-600">Employee not found.</p>;

  const backPath = role === 'senior_manager' ? '/manager/team' : '/admin/employees';
  const backLabel = role === 'senior_manager' ? 'Back to my team' : 'Back to employees';
  const initials = (emp.full_name || 'NA').split(' ').map((s) => s[0]).slice(0, 2).join('');

  return (
    <div className="space-y-5" data-testid="employee-profile">
      <Link to={backPath} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900" data-testid="profile-back-btn">
        <ArrowLeft size={14} className="mr-1" /> {backLabel}
      </Link>

      <div className="bg-white border border-slate-200 rounded-lg p-6 flex items-start gap-5 flex-wrap">
        {emp.profile_photo_url ? (
          <img
            src={emp.profile_photo_url}
            alt={emp.full_name}
            className="h-20 w-20 rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-semibold flex items-center justify-center" style={{ fontFamily: 'Outfit' }}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-[220px]">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{emp.employee_code}</p>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>{emp.full_name}</h1>
          <p className="text-sm text-slate-600">{emp.designation || '—'} · {emp.department_name || 'Unassigned'}</p>
          <div className="mt-2 flex gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${emp.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">{emp.role?.replace('_', ' ')}</span>
          </div>
        </div>
        {role === 'management_admin' && (
          <Link
            to={`/admin/employees/${emp.id}/edit`}
            className="inline-flex items-center gap-2 px-3 h-10 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50"
            data-testid="profile-edit-btn"
          >
            <Edit3 size={14} /> Edit
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { icon: Mail, label: 'Email', value: emp.email },
          { icon: Phone, label: 'Phone', value: emp.phone || '—' },
          { icon: MapPin, label: 'Address', value: emp.address || '—' },
          { icon: Building2, label: 'Department', value: emp.department_name || '—' },
          { icon: BadgeCheck, label: 'Emergency contact', value: emp.emergency_contact || '—' },
          { icon: Calendar, label: 'Date of joining', value: emp.date_of_joining || '—' },
        ].map((it) => (
          <div key={it.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-semibold">
              <it.icon size={14} /> {it.label}
            </div>
            <p className="text-sm text-slate-900 mt-2">{it.value}</p>
          </div>
        ))}
      </div>

      {wellness && (
        <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="wellness-score-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Wellness Intelligence</p>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Employee Wellness Score</h3>
              <p className="text-sm text-slate-600 mt-1">Combined attendance, sentiment, leave frequency, and performance trend.</p>
            </div>
            <div className={`h-24 w-24 rounded-full flex items-center justify-center border-8 shrink-0
              ${wellness.color === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                wellness.color === 'amber' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                  'border-rose-300 bg-rose-50 text-rose-700'}`}>
              <div className="text-center">
                <p className="text-3xl font-semibold leading-none" style={{ fontFamily: 'Outfit' }}>{wellness.score}</p>
                <p className="text-[10px] uppercase tracking-wider font-semibold">{wellness.level}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Attendance', wellness.metrics?.attendance_rate],
              ['Sentiment', wellness.metrics?.sentiment_score],
              ['Leave load', wellness.metrics?.leave_frequency],
              ['Performance', wellness.metrics?.performance_score],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
                <p className="text-lg font-semibold text-slate-900 mt-1" style={{ fontFamily: 'Outfit' }}>{value ?? 0}%</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(wellness.drivers || []).map((driver) => (
              <span key={driver} className="text-xs font-medium px-2 py-1 rounded-md bg-blue-50 text-blue-700">
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Predictions — admin & manager only */}
      {canViewAI && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            data-testid="ai-predictions-toggle"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-violet-600" />
              <span className="text-sm font-semibold text-slate-900">AI Predictions</span>
              <span className="text-xs text-slate-400">(ML-based)</span>
            </div>
            {aiOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {aiOpen && (
            <div className="px-5 pb-5 border-t border-slate-100 space-y-4">
              <button
                type="button"
                onClick={refreshAI}
                disabled={aiLoading}
                className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
                data-testid="refresh-ai-btn"
              >
                <RefreshCw size={14} className={aiLoading ? 'animate-spin' : ''} />
                {aiLoading ? 'Running predictions…' : 'Refresh AI Predictions'}
              </button>

              {(perfPrediction || attritionRisk) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {/* Performance prediction */}
                  {perfPrediction && (
                    <div className="border border-slate-200 rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                        Predicted Performance
                      </p>
                      <div className="flex items-center gap-3">
                        <div className={`h-14 w-14 rounded-full ring-4 flex items-center justify-center shrink-0
                          ${perfPrediction.predicted_score >= 7
                            ? 'ring-emerald-400 bg-emerald-50 text-emerald-700'
                            : perfPrediction.predicted_score >= 5
                              ? 'ring-amber-400 bg-amber-50 text-amber-700'
                              : 'ring-rose-400 bg-rose-50 text-rose-700'}`}>
                          <span className="text-xl font-bold" style={{ fontFamily: 'Outfit' }}>
                            {perfPrediction.predicted_score}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">Score / 10</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize
                            ${perfPrediction.risk_level === 'low'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              perfPrediction.risk_level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                        'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {perfPrediction.risk_level} risk
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attrition risk */}
                  {attritionRisk && (
                    <div className="border border-slate-200 rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">
                        Attrition Risk
                      </p>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-14 w-14 rounded-full ring-4 flex items-center justify-center shrink-0
                          ${attritionRisk.risk_level === 'low'
                            ? 'ring-emerald-400 bg-emerald-50 text-emerald-700'
                            : attritionRisk.risk_level === 'medium'
                              ? 'ring-amber-400 bg-amber-50 text-amber-700'
                              : 'ring-rose-400 bg-rose-50 text-rose-700'}`}>
                          <span className="text-base font-bold" style={{ fontFamily: 'Outfit' }}>
                            {Math.round(attritionRisk.risk_score * 100)}%
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">Risk probability</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize
                            ${attritionRisk.risk_level === 'low'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              attritionRisk.risk_level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                       'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {attritionRisk.risk_level}
                          </span>
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {(attritionRisk.top_factors || []).map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                            <AlertTriangle size={10} className="mt-0.5 text-amber-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!perfPrediction && !attritionRisk && !aiLoading && (
                <p className="text-sm text-slate-400 italic mt-2">
                  Click "Refresh AI Predictions" to run the ML models.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
