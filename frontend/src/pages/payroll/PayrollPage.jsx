import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';

const MONTH_LABEL = (m, y) => new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

export default function PayrollPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payroll/my').then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5" data-testid="payroll-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Compensation</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Payslips</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {items.length === 0 ? (
          <div className="p-6"><EmptyState icon={Wallet} title="No payslips yet" description="Your monthly payroll runs will appear here once processed." /></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((p) => (
              <li key={p.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{MONTH_LABEL(p.month, p.year)}</p>
                    <p className="text-xs text-slate-500 capitalize">{p.status} · Net ${p.net_salary.toLocaleString()}</p>
                  </div>
                </div>
                <Link
                  to={`/employee/payslips/${p.id}`}
                  className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"
                  data-testid={`payslip-link-${p.id}`}
                >
                  View <ArrowRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
