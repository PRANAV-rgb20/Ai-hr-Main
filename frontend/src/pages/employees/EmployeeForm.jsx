import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { api, formatApiError } from '../../api/client';

const ROLES = [
  { v: 'employee', l: 'Employee' },
  { v: 'senior_manager', l: 'Senior Manager' },
  { v: 'hr_recruiter', l: 'HR Recruiter' },
  { v: 'management_admin', l: 'Management Admin' },
];

export default function EmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({
    employee_code: '',
    email: '',
    full_name: '',
    password: '',
    role: 'employee',
    department_id: '',
    designation: '',
    phone: '',
    address: '',
    emergency_contact: '',
    date_of_joining: '',
  });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
    if (isEdit) {
      api.get(`/employees/${id}`).then((r) => {
        const e = r.data;
        setForm({
          employee_code: e.employee_code,
          email: e.email || '',
          full_name: e.full_name || '',
          password: '',
          role: e.role || 'employee',
          department_id: e.department_id || '',
          designation: e.designation || '',
          phone: e.phone || '',
          address: e.address || '',
          emergency_contact: e.emergency_contact || '',
          date_of_joining: e.date_of_joining || '',
        });
      });
    }
  }, [id, isEdit]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadPhoto = async (employeeId) => {
    if (!photoFile) return;
    const fd = new FormData();
    fd.append('file', photoFile);
    await api.post(`/employees/${employeeId}/photo`, fd, {
      headers: { 'Content-Type': undefined },
    });
  };

  const validate = () => {
    const e = {};
    if (!isEdit) {
      if (!form.employee_code) e.employee_code = 'Required';
      if (!form.email) e.email = 'Required';
      if (!form.full_name) e.full_name = 'Required';
      if (!form.password || form.password.length < 6) e.password = 'Min 6 chars';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (isEdit) {
        const payload = {
          department_id: form.department_id || null,
          designation: form.designation,
          phone: form.phone,
          address: form.address,
          emergency_contact: form.emergency_contact,
          date_of_joining: form.date_of_joining || null,
        };
        await api.put(`/employees/${id}`, payload);
        await uploadPhoto(id);
        toast.success('Employee updated');
      } else {
        const payload = {
          ...form,
          department_id: form.department_id || null,
          date_of_joining: form.date_of_joining || null,
        };
        const { data } = await api.post('/employees', payload);
        employeeId = data.id;
        await uploadPhoto(employeeId);
        toast.success('Employee created');
      }
      navigate('/admin/employees');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, error, children }) => (
    <div>
      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );

  const inputCls = (err) =>
    `h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-500' : 'border-slate-300'}`;

  return (
    <div className="space-y-5 max-w-3xl" data-testid="employee-form-page">
      <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} className="mr-1" /> Back
      </button>
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{isEdit ? 'Update' : 'New'}</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>{isEdit ? 'Edit employee' : 'Add employee'}</h1>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4" data-testid="employee-form">
        {!isEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Employee code" error={errors.employee_code}>
              <input className={inputCls(errors.employee_code)} value={form.employee_code} onChange={(e) => upd('employee_code', e.target.value)} data-testid="form-employee-code" />
            </Field>
            <Field label="Full name" error={errors.full_name}>
              <input className={inputCls(errors.full_name)} value={form.full_name} onChange={(e) => upd('full_name', e.target.value)} data-testid="form-full-name" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" className={inputCls(errors.email)} value={form.email} onChange={(e) => upd('email', e.target.value)} data-testid="form-email" />
            </Field>
            <Field label="Initial password" error={errors.password}>
              <input type="password" className={inputCls(errors.password)} value={form.password} onChange={(e) => upd('password', e.target.value)} data-testid="form-password" />
            </Field>
            <Field label="Role">
              <select className={inputCls(false)} value={form.role} onChange={(e) => upd('role', e.target.value)} data-testid="form-role">
                {ROLES.map((r) => (<option key={r.v} value={r.v}>{r.l}</option>))}
              </select>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Department">
            <select className={inputCls(false)} value={form.department_id} onChange={(e) => upd('department_id', e.target.value)} data-testid="form-department">
              <option value="">— None —</option>
              {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </Field>
          <Field label="Designation">
            <input className={inputCls(false)} value={form.designation} onChange={(e) => upd('designation', e.target.value)} data-testid="form-designation" />
          </Field>
          <Field label="Phone">
            <input className={inputCls(false)} value={form.phone} onChange={(e) => upd('phone', e.target.value)} data-testid="form-phone" />
          </Field>
          <Field label="Date of joining">
            <input type="date" className={inputCls(false)} value={form.date_of_joining} onChange={(e) => upd('date_of_joining', e.target.value)} data-testid="form-doj" />
          </Field>
          <Field label="Emergency contact">
            <input className={inputCls(false)} value={form.emergency_contact} onChange={(e) => upd('emergency_contact', e.target.value)} data-testid="form-emergency" />
          </Field>
        </div>
        <Field label="Address">
          <textarea rows={2} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.address} onChange={(e) => upd('address', e.target.value)} data-testid="form-address" />
        </Field>

        <Field label="Profile photo">
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-sm file:font-medium file:bg-slate-50 file:hover:bg-slate-100"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            data-testid="form-photo"
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="h-10 px-4 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="h-10 px-5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-60" data-testid="form-submit-btn">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
