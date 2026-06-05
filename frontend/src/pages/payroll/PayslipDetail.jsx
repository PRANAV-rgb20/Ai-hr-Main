import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';

const MONTH_LABEL = (m, y) => new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

export default function PayslipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/payroll/${id}`).then((r) => setP(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!p) return <p className="text-sm text-red-600">Payslip not found.</p>;

  const earnings = [
    { label: 'Basic Salary', value: p.basic_salary },
    { label: 'House Rent Allowance', value: p.hra },
    { label: 'Transport Allowance', value: p.transport_allowance },
    { label: 'Medical Allowance', value: p.medical_allowance },
  ];
  const deductions = [
    { label: 'Provident Fund', value: p.pf_deduction },
    { label: 'Tax', value: p.tax_deduction },
    { label: 'Other Deductions', value: p.other_deductions },
  ];

  return (
    <div className="space-y-5 max-w-3xl" data-testid="payslip-detail">
      <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} className="mr-1" /> Back
      </button>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden print:shadow-none">
        <div className="p-6 flex items-start justify-between border-b border-slate-200">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Payslip</p>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>{MONTH_LABEL(p.month, p.year)}</h1>
            <p className="text-sm text-slate-600 mt-1">{p.employee_name}</p>
            <span className={`mt-2 inline-flex text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
              p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>{p.status}</span>
          </div>
          <button onClick={() => window.print()} className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
            <Printer size={14} /> Print
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Earnings</p>
            <ul className="space-y-2">
              {earnings.map((e) => (
                <li key={e.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{e.label}</span>
                  <span className="font-mono text-slate-900">${e.value.toLocaleString()}</span>
                </li>
              ))}
              <li className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-sm font-semibold">
                <span className="text-slate-900">Gross</span>
                <span className="font-mono text-slate-900">${p.gross_salary.toLocaleString()}</span>
              </li>
            </ul>
          </div>
          <div className="p-6">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Deductions</p>
            <ul className="space-y-2">
              {deductions.map((e) => (
                <li key={e.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{e.label}</span>
                  <span className="font-mono text-slate-900">${e.value.toLocaleString()}</span>
                </li>
              ))}
              <li className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-sm font-semibold">
                <span className="text-slate-900">Total</span>
                <span className="font-mono text-slate-900">
                  ${(p.pf_deduction + p.tax_deduction + p.other_deductions).toLocaleString()}
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <p className="text-sm uppercase tracking-wider">Net Salary</p>
          <p className="text-3xl font-semibold" style={{ fontFamily: 'Outfit' }} data-testid="payslip-net">
            ${p.net_salary.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
