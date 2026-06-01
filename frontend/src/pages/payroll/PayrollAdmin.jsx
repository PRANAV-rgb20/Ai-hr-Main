import { useEffect, useState } from 'react';
import { Loader2, PlayCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = [2024, 2025, 2026, 2027];

export default function PayrollAdmin() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        api.get(`/payroll/admin/list/${month}/${year}`),
        api.get(`/payroll/summary/${month}/${year}`),
      ]);
      setRows(list.data);
      setSummary(sum.data);
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

  return (
    <div className="space-y-5" data-testid="payroll-admin-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Run</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Payroll</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="payroll-month-select">
            {MONTHS.map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' })}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="payroll-year-select">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={runGenerate} disabled={generating} className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-60" data-testid="payroll-generate-btn">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Generate
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Slips', value: summary.count },
            { label: 'Gross total', value: `$${summary.total_gross.toLocaleString()}` },
            { label: 'Net total', value: `$${summary.total_net.toLocaleString()}` },
            { label: 'Paid', value: `${summary.paid_count}/${summary.count}` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
              <p className="text-2xl font-semibold mt-1" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? <Spinner /> : rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No payroll for this period" description="Click Generate to create payslips for all active employees." /></div>
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
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-5 py-3 text-sm font-medium">{p.employee_name}</td>
                    <td className="px-5 py-3 text-sm text-right font-mono">${p.gross_salary.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-right font-mono">${(p.pf_deduction + p.tax_deduction + p.other_deductions).toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-right font-mono font-semibold">${p.net_salary.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{p.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.status !== 'paid' && (
                        <button onClick={() => markPaid(p.id)} className="inline-flex items-center gap-1 px-3 h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium" data-testid={`mark-paid-${p.id}`}>
                          <Check size={12} /> Mark paid
                        </button>
                      )}
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
