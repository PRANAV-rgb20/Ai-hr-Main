import { useEffect, useState } from 'react';
import { Shield, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { getAuditLogs } from '../../api/ai';
import EmptyState from '../../components/EmptyState';

// ── colour maps ───────────────────────────────────────────────────────────────

const ACTION_BADGE = {
  login:              'bg-blue-50 text-blue-700 border-blue-200',
  employee_created:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  employee_updated:   'bg-amber-50 text-amber-700 border-amber-200',
  payroll_generated:  'bg-violet-50 text-violet-700 border-violet-200',
  leave_approved:     'bg-green-50 text-green-700 border-green-200',
  leave_rejected:     'bg-rose-50 text-rose-700 border-rose-200',
};

const ACTIONS = [
  'login',
  'employee_created',
  'employee_updated',
  'payroll_generated',
  'leave_approved',
  'leave_rejected',
];

const fmt = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── skeleton ──────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr className="border-b border-slate-100">
    {[120, 160, 90, 100, 110, 80].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

// ── component ─────────────────────────────────────────────────────────────────

export default function AuditLogs() {
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);

  // filters
  const [action, setAction]         = useState('');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [applied, setApplied]       = useState({});   // what was last fetched

  const PAGE_SIZE = 20;

  const load = async (pg = 1, filters = applied) => {
    setLoading(true);
    try {
      const params = { page: pg, page_size: PAGE_SIZE };
      if (filters.action)    params.action     = filters.action;
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate)   params.end_date   = filters.endDate;
      const { data } = await getAuditLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setPage(pg);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, {}); }, []);

  const handleFilter = () => {
    const f = { action, startDate, endDate };
    setApplied(f);
    load(1, f);
  };

  const handlePageChange = (pg) => load(pg, applied);

  return (
    <div className="space-y-5" data-testid="audit-logs-page">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
          Audit Logs
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Track every significant action taken in the system.
        </p>
      </div>

      {/* Filter row */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="mt-1 h-9 rounded-md border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="filter-action"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 h-9 rounded-md border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="filter-start-date"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 h-9 rounded-md border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="filter-end-date"
          />
        </div>

        <button
          type="button"
          onClick={handleFilter}
          className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 transition-colors"
          data-testid="filter-btn"
        >
          <Filter size={13} /> Filter
        </button>

        {(applied.action || applied.startDate || applied.endDate) && (
          <button
            type="button"
            onClick={() => {
              setAction(''); setStartDate(''); setEndDate('');
              const f = {};
              setApplied(f);
              load(1, f);
            }}
            className="h-9 px-3 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">{total.toLocaleString()} records</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                {['Timestamp', 'User Email', 'Action', 'Resource Type', 'Resource ID', 'IP Address'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Shield}
              title="No audit logs found"
              description="Actions will be recorded here as users interact with the system."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="audit-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Timestamp</th>
                  <th className="text-left px-4 py-3 font-semibold">User Email</th>
                  <th className="text-left px-4 py-3 font-semibold">Action</th>
                  <th className="text-left px-4 py-3 font-semibold">Resource Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Resource ID</th>
                  <th className="text-left px-4 py-3 font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((lg) => (
                  <tr key={lg.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(lg.timestamp)}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{lg.user_email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border capitalize
                        ${ACTION_BADGE[lg.action] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {lg.action?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{lg.resource_type || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 max-w-[160px] truncate">
                      {lg.resource_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{lg.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors"
            data-testid="prev-page-btn"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors"
            data-testid="next-page-btn"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
