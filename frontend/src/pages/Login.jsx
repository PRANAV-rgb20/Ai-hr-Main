import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, formatApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { roleHome } from '../components/ProtectedRoute';

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
      toast.success(`Welcome back, ${data.full_name.split(' ')[0]}`);
      navigate(roleHome(data.role), { replace: true });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="login-page">

      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)' }}>
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 h-60 w-60 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">H</div>
            <div>
              <p className="text-sm font-semibold text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>Lumen HR</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-blue-300">Workforce Operations OS</p>
            </div>
          </Link>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-semibold text-white leading-tight" style={{ fontFamily: 'Outfit' }}>
            One platform.<br />
            Every employee<br />
            touchpoint.
          </h1>
          <p className="text-blue-200 text-sm leading-relaxed max-w-sm">
            Run attendance, leave, payroll, and performance with a calm, focused interface designed for modern HR teams.
          </p>
          <div className="space-y-2.5">
            {[
              'Real-time attendance & clock tracking',
              'AI-powered resume screening & interviews',
              'Attrition risk scoring with ML models',
              'Complete payroll with anomaly detection',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-blue-100">
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-blue-400/60">
          © {new Date().getFullYear()} Lumen HR · Secure · Real-time · AI-powered
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md space-y-7">

          {/* Back link — mobile only */}
          <Link to="/" className="lg:hidden inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={14} /> Back to home
          </Link>

          <div>
            <div className="flex items-center gap-2 mb-5 lg:hidden">
              <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm">H</div>
              <p className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Lumen HR</p>
            </div>
            <h2 className="text-3xl font-semibold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Sign in
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Welcome back. Enter your credentials to access your workspace.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Work email
              </label>
              <div className="mt-1.5 relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((v) => ({ ...v, email: '' })); }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className={`h-11 w-full rounded-lg border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
                    errors.email ? 'border-red-400 bg-red-50/30' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid="login-email-input"
                />
              </div>
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1.5 relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((v) => ({ ...v, password: '' })); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`h-11 w-full rounded-lg border bg-white pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
                    errors.password ? 'border-red-400 bg-red-50/30' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-all shadow-sm shadow-blue-200"
              data-testid="login-submit-btn"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in to dashboard'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            By signing in you agree to your organisation's policies and terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
