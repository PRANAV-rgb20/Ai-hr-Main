import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { useAuthStore } from '../../store/authStore';

export default function EmployeeList() {
  const { role } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 10 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, page_size: 10 };
    if (search) params.search = search;
    if (dept) params.department_id = dept;
    api.get('/employees', { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [page, search, dept]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <div className="space-y-5" data-testid="employee-list-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">People</p>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Employees</h1>
        </div>
        {role === 'management_admin' && (
          <Link
            to="/admin/employees/new"
            className="inline-flex items-center gap-2 px-3 h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            data-testid="employees-add-btn"
          >
            <Plus size={16} /> Add Employee
          </Link>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search name, email or code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="employees-search-input"
          />
        </div>
        <select
          value={dept}
          onChange={(e) => { setDept(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="employees-dept-filter"
        >
          <option value="">All departments</option>
          {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? <Spinner /> : data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Building2} title="No employees found" description="Try adjusting filters or add a new employee to get started." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="employees-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="text-left px-5 py-3 font-semibold">Code</th>
                  <th className="text-left px-5 py-3 font-semibold">Name</th>
                  <th className="text-left px-5 py-3 font-semibold">Department</th>
                  <th className="text-left px-5 py-3 font-semibold">Designation</th>
                  <th className="text-left px-5 py-3 font-semibold">Email</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => navigate(`/admin/employees/${e.id}`)}
                    className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                    data-testid={`employee-row-${e.id}`}
                  >
                    <td className="px-5 py-3 text-sm font-mono text-slate-700">{e.employee_code}</td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-semibold">
                          {(e.full_name || 'NA').split(' ').map((s) => s[0]).slice(0, 2).join('')}
                        </div>
                        <span className="font-medium text-slate-900">{e.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm">{e.department_name || '—'}</td>
                    <td className="px-5 py-3 text-sm">{e.designation || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{e.email}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {e.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.items.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">Page {data.page} of {totalPages} · {data.total} total</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"
                data-testid="employees-prev-page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"
                data-testid="employees-next-page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
