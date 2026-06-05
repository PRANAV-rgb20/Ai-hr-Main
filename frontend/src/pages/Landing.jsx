import { Link } from 'react-router-dom';
import {
  Users, Calendar, Wallet, Award, Briefcase, FileText,
  BarChart2, Shield, Brain, ArrowRight, CheckCircle,
} from 'lucide-react';

const FEATURES = [
  { icon: Users,     title: 'Employee Management',   desc: 'Complete employee lifecycle — onboarding, profiles, departments, org chart.' },
  { icon: Calendar,  title: 'Attendance Tracking',   desc: 'Clock-in/out, monthly calendar, team view, real-time presence status.' },
  { icon: FileText,  title: 'Leave Management',       desc: 'Apply, approve, track balances. Smart AI suggests optimal leave windows.' },
  { icon: Wallet,    title: 'Payroll Processing',     desc: 'Auto-calculate salaries, generate payslips, mark payments with one click.' },
  { icon: Award,     title: 'Performance Reviews',   desc: 'Structured reviews, goal tracking, trend charts for every employee.' },
  { icon: Briefcase, title: 'Recruitment Pipeline',  desc: 'Job postings, Kanban candidate board, AI resume screening, video interviews.' },
  { icon: Brain,     title: 'AI-Powered Insights',   desc: 'Attrition risk scores, sentiment heatmaps, payroll anomaly detection.' },
  { icon: BarChart2, title: 'Analytics & Reports',   desc: 'Real-time charts across all modules. Export to CSV in one click.' },
];

const STATS = [
  { value: '8',    label: 'Core Modules'       },
  { value: '4',    label: 'Role-Based Portals' },
  { value: '8+',   label: 'AI Features'        },
  { value: '100%', label: 'Real-Time Data'     },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-[Inter]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm">H</div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none" style={{ fontFamily: 'Outfit' }}>Lumen HR</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Workforce OS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="h-9 px-5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1.5 transition-colors"
            >
              Sign in <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          Live real-time data across all modules
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold text-slate-900 leading-tight tracking-tight max-w-3xl mx-auto" style={{ fontFamily: 'Outfit' }}>
          The HR platform that<br />
          <span className="text-blue-600">actually works</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
          Manage your entire workforce — attendance, leave, payroll, performance, and recruitment — from one calm, focused platform powered by real-time data and AI.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/login"
            className="h-12 px-7 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 inline-flex items-center gap-2 transition-colors shadow-sm shadow-blue-200"
          >
            Get started free <ArrowRight size={16} />
          </Link>
          <a
            href="#features"
            className="h-12 px-7 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 inline-flex items-center gap-2 transition-colors"
          >
            See all features
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-5 text-center border border-slate-100">
              <p className="text-3xl font-semibold text-blue-600" style={{ fontFamily: 'Outfit' }}>{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-50 border-t border-b border-slate-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold mb-2">Everything included</p>
            <h2 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
              All the modules your HR team needs
            </h2>
            <p className="text-slate-500 mt-2 max-w-lg mx-auto">
              Every feature talks to every other feature. No siloed tools, no manual syncing.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-5 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group">
                <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <f.icon size={18} />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold mb-2">Role-based access</p>
          <h2 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>
            The right view for every person
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { role: 'Admin',     color: 'bg-blue-600',   desc: 'Full access — employees, payroll, reports, AI tools, audit logs.' },
            { role: 'Manager',   color: 'bg-emerald-600', desc: 'Team attendance, leave approvals, performance, attrition risk.' },
            { role: 'Recruiter', color: 'bg-amber-500',   desc: 'Job postings, candidate pipeline, AI resume screening, interview bot.' },
            { role: 'Employee',  color: 'bg-slate-600',   desc: 'Personal attendance, payslips, leave, performance, wellbeing check-in.' },
          ].map((r) => (
            <div key={r.role} className="rounded-xl border border-slate-200 p-5 space-y-3">
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${r.color}`}>
                {r.role}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{r.desc}</p>
              <div className="space-y-1.5">
                {['Real-time data', 'Role-tailored view', 'AI-powered insights'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-semibold mb-4" style={{ fontFamily: 'Outfit' }}>
            Ready to see it in action?
          </h2>
          <p className="text-slate-400 mb-8">
            Sign in to explore the full platform with real data. All 4 role portals are live.
          </p>
          <Link
            to="/login"
            className="h-12 px-8 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 inline-flex items-center gap-2 transition-colors"
          >
            Sign in to dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">H</div>
            <span className="font-medium text-slate-600">Lumen HR</span>
            <span>— Workforce Operations Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <Shield size={12} className="text-emerald-500" />
            <span>Secure · Real-time · AI-powered</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
