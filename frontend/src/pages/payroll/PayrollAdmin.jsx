import { useEffect, useState } from 'react';
import { Loader2, PlayCircle, Check, AlertTriangle, Search, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import { detectPayrollAnomalies, getPayrollNarrative } from '../../api/ai';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS  = [2024, 2025, 2026, 2027];

export default function PayrollAdmin() {
  const today = new Date();
  const [month, setMonth]           = useState(today.getMonth() + 1);
  const [year, setYear]             = useState(today.getFullYear());
  const [rows, setRows]             = useState([]);
  const [summary, setSummary]       = useState(null);
  const [narrative, setNarrative]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);

  // Anomaly detection state
  const [anomalyResults, setAnomalyResults] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [flaggedMap, setFlaggedMap]         = useState({});  // employee_id → reason

  const load = async () => {
    setLoading(true);
    // Reset anomaly results when period changes
    setAnomalyResults(null);
    setFlaggedMap({});
    setNarrative(null);
    try {
      const [list, sum, story] = await Promise.all([
        api.get(`/payroll/admin/list/${month}/${year}`),
        api.get(`/payroll/summary/${month}/${year}`),
        getPayrollNarrative(month, year).catch(() => ({ data: null })),
      ]);
      setRows(list.data);
      setSummary(sum.data);
      setNarrative(story.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month, year]);

  const runGenerate = async () => {
    setGenerating(true);
    try {
      await api.post(`/payroll/generate/${month}/${year}`);
      toast.success('Payroll generated');
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setGenerating(false);
    }
  };

  const markPaid = async (id) => {
    try {
      await api.put(`/payroll/${id}/mark-paid`);
      toast.success('Marked paid');
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const runAnomalyDetection = async () => {
    setAnomalyLoading(true);
    try {
      const { data } = await detectPayrollAnomalies(month, year);
      setAnomalyResults(data);
      // Build employee_id → reason lookup for inline row badges
      const map = {};
      (data.flagged || []).forEach((f) => { map[f.employee_id] = f.reason; });
      setFlaggedMap(map);
      if (data.flagged_count === 0) {
        toast.success('No anomalies detected in this payroll run');
      } else {
        toast(`${data.flagged_count} anomaly${data.flagged_count > 1 ? 'ies' : ''} flagged`, { icon: '⚠️' });
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setAnomalyLoading(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="payroll-admin-page">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Run</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Payroll</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="payroll-month-select"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' })}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="payroll-year-select"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={runGenerate}
            disabled={generating}
            className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-60"
            data-testid="payroll-generate-btn"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Generate
          </button>
          {/* Anomaly detection button */}
          <button
            onClick={runAnomalyDetection}
            disabled={anomalyLoading || rows.length === 0}
            className="h-10 px-4 rounded-md border border-rose-400 text-rose-600 bg-white text-sm font-medium hover:bg-rose-50 inline-flex items-center gap-2 disabled:opacity-50 transition-colors"
            data-testid="detect-anomalies-btn"
            title={rows.length === 0 ? 'Generate payroll first' : 'Run AI anomaly detection'}
          >
            {anomalyLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <Search size={14} />
            }
            🔍 Detect Anomalies
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Slips',       value: summary.count },
            { label: 'Gross total', value: `$${summary.total_gross.toLocaleString()}` },
            { label: 'Net total',   value: `$${summary.total_net.toLocaleString()}` },
            { label: 'Paid',        value: `${summary.paid_count}/${summary.count}` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
              <p className="text-2xl font-semibold mt-1" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {narrative && (
        <div className="bg-white border border-blue-200 rounded-lg p-5" data-testid="payroll-narrative-card">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Search size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider font-semibold text-blue-700">Payroll Insights</p>
              <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Cost and anomaly narrative</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{narrative.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                  {narrative.employee_count} employees
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                  ${Number(narrative.total_net || 0).toLocaleString()} total net
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${narrative.anomaly_count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {narrative.anomaly_count} anomalies
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No payroll for this period" description="Click Generate to create payslips for all active employees." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="text-left px-5 py-3 font-semibold">Employee</th>
                  <th className="text-right px-5 py-3 font-semibold">Gross</th>
                  <th className="text-right px-5 py-3 font-semibold">Deductions</th>
                  <th className="text-right px-5 py-3 font-semibold">Net</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const anomalyReason = flaggedMap[p.employee_id];
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-100 ${anomalyReason ? 'bg-rose-50/30' : ''}`}
                    >
                      <td className="px-5 py-3 text-sm font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {anomalyReason && (
                            <AlertTriangle
                              size={14}
                              className="text-rose-500 shrink-0"
                              title={anomalyReason}
                            />
                          )}
                          {p.employee_name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono">${p.gross_salary.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-right font-mono">
                        ${(p.pf_deduction + p.tax_deduction + p.other_deductions).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono font-semibold">${p.net_salary.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p.status !== 'paid' && (
                          <button
                            onClick={() => markPaid(p.id)}
                            className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                            data-testid={`mark-paid-${p.id}`}
                          >
                            <Check size={12} /> Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Anomaly results panel */}
      {anomalyResults && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="anomaly-results">
          {anomalyResults.flagged_count === 0 ? (
            <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 border-b border-emerald-100">
              <CheckCircle size={18} className="text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-800">
                ✓ No anomalies detected in {anomalyResults.total_records} payroll records
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-100">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <p className="text-sm font-medium text-amber-800">
                  ⚠ {anomalyResults.flagged_count} anomaly{anomalyResults.flagged_count > 1 ? 'ies' : ''} found
                  in {anomalyResults.total_records} records — review below
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                      <th className="text-left px-5 py-3 font-semibold">Employee</th>
                      <th className="text-left px-5 py-3 font-semibold">Department</th>
                      <th className="text-right px-5 py-3 font-semibold">Net Salary</th>
                      <th className="text-right px-5 py-3 font-semibold">Anomaly Score</th>
                      <th className="text-left px-5 py-3 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalyResults.flagged.map((f, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/40">
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">{f.employee_name}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{f.department || '—'}</td>
                        <td className="px-5 py-3 text-sm text-right font-mono">${Number(f.net_salary).toLocaleString()}</td>
                        <td className="px-5 py-3 text-sm text-right font-mono text-rose-600">{f.anomaly_score}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
