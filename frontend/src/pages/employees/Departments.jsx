import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Building2 } from 'lucide-react';
import { api, formatApiError } from '../../api/client';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { useAuthStore } from '../../store/authStore';

export default function Departments() {
  const { role } = useAuthStore();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/departments').then((r) => setList(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/departments', { name: name.trim() });
      setName('');
      toast.success('Department added');
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-5" data-testid="departments-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Org</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Departments</h1>
      </div>

      {role === 'management_admin' && (
        <form onSubmit={add} className="bg-white border border-slate-200 rounded-lg p-4 flex gap-2" data-testid="department-add-form">
          <input
            placeholder="New department name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="department-name-input"
          />
          <button type="submit" className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2" data-testid="department-add-btn">
            <Plus size={14} /> Add
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState icon={Building2} title="No departments yet" />
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="departments-list">
            {list.map((d) => (
              <li key={d.id} className="py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <p className="text-sm font-medium text-slate-900">{d.name}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
