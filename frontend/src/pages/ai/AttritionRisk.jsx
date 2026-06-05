import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../api/client';
import { getTeamAttritionRisk } from '../../api/ai';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

// ── helpers ───────────────────────────────────────────────────────────────────

const riskBadge = (level) => {
  if (level === 'high')   return 'bg-rose-50 text-rose-700 border-rose-200';
  if (level === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return                         'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const riskBar = (level) => {
  if (level === 'high')   return 'bg-rose-500';
  if (level === 'medium') return 'bg-amber-400';
  return                         'bg-emerald-500';
};

// Skeleton row
const SkeletonRow = () => (
  <tr className="border-b border-slate-100">
    {[1, 2, 3, 4, 5].map((i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
      </td>
    ))}
  </tr>
);

// ── component ─────────────────────────────────────────────────────────────────

export default function AttritionRisk() {
  const [results, setResults]   = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');   // all | high | medium | low
  const [empId, setEmpId]       = useState(null);

  // Resolve the current user's employee ID first
  useEffect(() => {
    api.get('/dashboard/employee')
      .then((r) => setEmpId(r.data?.employee_id || 'none'))
      .catch(() => setEmpId('none'));
  }, []);

  useEffect(() => {
    if (!empId) return;
    load(empId);
  }, [empId]);

  const load = async (id) => {
    setLoading(true);
    try {
      const { data } = await getTeamAttritionRisk(id);
      setResults(data.results || []);
      setSummary({ team_size: data.team_size, high_risk_count: data.high_risk_count });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load attrition data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all'
    ? results
    : results.filter((r) => r.risk_level === filter);

  const counts = {
    high:   results.filter((r) => r.risk_level === 'high').length,
    medium: results.filter((r) => r.risk_level === 'medium').length,
    low:    results.filter((r) => r.risk_level === 'low').length,
  };

  return (
    <div className="space-y-5" data-testid="attrition-risk-page">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">AI Tools</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            Attrition Risk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ML-powered attrition risk scoring based on attendance, leave, performance trends and tenure.
          </p>
        </div>
        <button
          type="button"
          onClick={() => empId && load(empId)}
          disabled={loading || !empId}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Employees', value: summary.team_size,     dot: 'bg-blue-500'    },
            { label: 'High Risk',       value: counts.high,           dot: 'bg-rose-500'    },
            { label: 'Medium Risk',     value: counts.medium,         dot: 'bg-amber-400'   },
            { label: 'Low Risk',        value: counts.low,            dot: 'bg-emerald-500' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
              </div>
              <p className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Filter:</span>
        {['all', 'high', 'medium', 'low'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors capitalize
              ${filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}
          >
            {f === 'all' ? 'All' : f}
            {f !== 'all' && (
              <span className="ml-1 opacity-70">({counts[f]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="text-left px-5 py-3 font-semibold">Employee</th>
                <th className="text-left px-5 py-3 font-semibold">Department</th>
                <th className="text-left px-5 py-3 font-semibold">Risk Score</th>
                <th className="text-left px-5 py-3 font-semibold">Risk Level</th>
                <th className="text-left px-5 py-3 font-semibold">Top Factors</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={AlertTriangle}
              title="No data found"
              description={filter === 'all' ? 'No team members available.' : `No employees with ${filter} risk level.`}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="attrition-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="text-left px-5 py-3 font-semibold">Employee</th>
                  <th className="text-left px-5 py-3 font-semibold">Department</th>
                  <th className="text-left px-5 py-3 font-semibold">Risk Score</th>
                  <th className="text-left px-5 py-3 font-semibold">Risk Level</th>
                  <th className="text-left px-5 py-3 font-semibold">Top Factors</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.employee_id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                    {/* Employee */}
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-900">{r.employee_name}</p>
                      {r.designation && (
                        <p className="text-xs text-slate-500">{r.designation}</p>
                      )}
                    </td>

                    {/* Department */}
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {r.department_name || '—'}
                    </td>

                    {/* Risk score progress bar */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${riskBar(r.risk_level)}`}
                            style={{ width: `${Math.round(r.risk_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-700 shrink-0">
                          {Math.round(r.risk_score * 100)}%
                        </span>
                      </div>
                    </td>

                    {/* Risk level badge */}
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${riskBadge(r.risk_level)}`}>
                        {r.risk_level === 'high' && <AlertTriangle size={10} />}
                        {r.risk_level}
                      </span>
                    </td>

                    {/* Top factors */}
                    <td className="px-5 py-3">
                      <ul className="space-y-0.5">
                        {(r.top_factors || []).slice(0, 3).map((f, i) => (
                          <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                            <span className="mt-1 h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
