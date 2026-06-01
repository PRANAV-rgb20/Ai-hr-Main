import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Building2, BadgeCheck, Calendar, Edit3 } from 'lucide-react';
import { api } from '../../api/client';
import Spinner from '../../components/Spinner';
import { useAuthStore } from '../../store/authStore';

export default function EmployeeProfile() {
  const { id } = useParams();
  const { role } = useAuthStore();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/employees/${id}`).then((r) => setEmp(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!emp) return <p className="text-sm text-red-600">Employee not found.</p>;

  return (
    <div className="space-y-5" data-testid="employee-profile">
      <Link to="/admin/employees" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900" data-testid="profile-back-btn">
        <ArrowLeft size={14} className="mr-1" /> Back to employees
      </Link>

      <div className="bg-white border border-slate-200 rounded-lg p-6 flex items-start gap-5 flex-wrap">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-semibold flex items-center justify-center" style={{ fontFamily: 'Outfit' }}>
          {(emp.full_name || 'NA').split(' ').map((s) => s[0]).slice(0, 2).join('')}
        </div>
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
    </div>
  );
}
