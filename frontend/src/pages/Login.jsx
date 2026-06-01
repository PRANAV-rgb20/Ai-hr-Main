import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { roleHome } from '../components/ProtectedRoute';

const DEMO = [
  { email: 'admin@hrms.com', password: 'Admin@123', label: 'Admin' },
  { email: 'manager@hrms.com', password: 'Manager@123', label: 'Manager' },
  { email: 'recruiter@hrms.com', password: 'Recruiter@123', label: 'Recruiter' },
  { email: 'employee1@hrms.com', password: 'Employee@123', label: 'Employee' },
];

export default function Login() {
  const navigate = useNavigate();
  const { token, role, setSession, setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (token && role) navigate(roleHome(role), { replace: true });
  }, [token, role, navigate]);

  const validate = () => {
    const e = {};
    if (!email) e.email = 'Email is required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setSession(data);
      setUser({ id: data.user_id, full_name: data.full_name, role: data.role, email });
      toast.success(`Welcome, ${data.full_name.split(' ')[0]}`);
      navigate(roleHome(data.role), { replace: true });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (d) => {
    setEmail(d.email);
    setPassword(d.password);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="login-page">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(37,99,235,0.6), transparent 60%), radial-gradient(circle at 80% 70%, rgba(99,102,241,0.5), transparent 60%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">H</div>
            <div>
              <p className="text-sm font-semibold tracking-tight" style={{ fontFamily: 'Outfit' }}>Lumen HR</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Workforce Operations OS</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-4 max-w-md">
          <h1 className="text-4xl lg:text-5xl font-semibold leading-tight" style={{ fontFamily: 'Outfit' }}>
            One platform.<br />
            Every employee touchpoint.
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Run attendance, leave, payroll, and performance with a calm, focused interface designed for the people who run HR.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { k: '8', l: 'Modules' },
              { k: '4', l: 'Roles' },
              { k: '24/7', l: 'Available' },
            ].map((m) => (
              <div key={m.l} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-xl font-semibold" style={{ fontFamily: 'Outfit' }}>{m.k}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{m.l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-500">© 2026 Lumen HR · Built for modern teams.</p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900" style={{ fontFamily: 'Outfit' }}>Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Welcome back. Enter your credentials to continue.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Email</label>
              <div className="mt-1 relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={`h-11 w-full rounded-md border bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.email ? 'border-red-500' : 'border-slate-300'
                  }`}
                  data-testid="login-email-input"
                />
              </div>
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</label>
              <div className="mt-1 relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`h-11 w-full rounded-md border bg-white pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.password ? 'border-red-500' : 'border-slate-300'
                  }`}
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  data-testid="login-password-toggle"
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 inline-flex items-center justify-center rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-all active:scale-[0.99]"
              data-testid="login-submit-btn"
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {loading ? 'Signing in…' : 'Sign in to dashboard'}
            </button>
          </form>

          <div>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Demo accounts — one click to autofill</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => fillDemo(d)}
                  className="text-left rounded-md border border-slate-200 px-3 py-2 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                  data-testid={`login-demo-${d.label.toLowerCase()}`}
                >
                  <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">{d.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{d.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
