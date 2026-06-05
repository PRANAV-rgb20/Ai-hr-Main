import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, Calendar, FileText, Wallet, Award, Briefcase,
  Settings, X, FileSearch, Mic, AlertTriangle, Heart, BarChart2, Shield, MessageCircle,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const NAV = {
  management_admin: [
    { to: '/admin',                     label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/admin/employees',           label: 'Employees',      icon: Users           },
    { to: '/admin/departments',         label: 'Departments',    icon: Building2       },
    { to: '/admin/attendance',          label: 'Attendance',     icon: Calendar        },
    { to: '/admin/leave',               label: 'Leave Approvals',icon: FileText        },
    { to: '/admin/payroll',             label: 'Payroll',        icon: Wallet          },
    { to: '/admin/performance',         label: 'Performance',    icon: Award           },
    { to: '/admin/recruitment',         label: 'Recruitment',    icon: Briefcase       },
    { to: '/admin/reports',             label: 'Reports',        icon: LayoutDashboard },
    { to: '/admin/analytics',           label: 'Analytics',      icon: BarChart2       },
    { to: '/admin/settings',            label: 'Settings',       icon: Settings        },
    { to: '/admin/ai/resume-screener',  label: 'Resume Screener',icon: FileSearch      },
    { to: '/admin/ai/interview',        label: 'Interview Bot',  icon: Mic             },
    { to: '/admin/ai/attrition',        label: 'Attrition Risk', icon: AlertTriangle   },
    { to: '/admin/ai/sentiment',        label: 'Sentiment Pulse',icon: Heart           },
    { to: '/admin/ai/audit',            label: 'Audit Logs',     icon: Shield          },
    { to: '/admin/ai/policy',           label: 'Policy Docs',    icon: FileText        },
  ],
  senior_manager: [
    { to: '/manager',                   label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/manager/team',              label: 'My Team',        icon: Users           },
    { to: '/manager/attendance',        label: 'Attendance',     icon: Calendar        },
    { to: '/manager/leave',             label: 'Leave Approvals',icon: FileText        },
    { to: '/manager/performance',       label: 'Performance',    icon: Award           },
    { to: '/manager/ai/attrition',      label: 'Attrition Risk', icon: AlertTriangle   },
    { to: '/manager/ai/sentiment',      label: 'Sentiment Pulse',icon: Heart           },
  ],
  hr_recruiter: [
    { to: '/recruiter',                      label: 'Dashboard',       icon: LayoutDashboard },
    { to: '/recruiter/jobs',                 label: 'Jobs',            icon: Briefcase       },
    { to: '/recruiter/candidates',           label: 'Candidates',      icon: Users           },
    { to: '/recruiter/ai/resume-screener',   label: 'Resume Screener', icon: FileSearch      },
    { to: '/recruiter/ai/interview',         label: 'Interview Bot',   icon: Mic             },
  ],
  employee: [
    { to: '/employee',             label: 'Dashboard',  icon: LayoutDashboard },
    { to: '/employee/attendance',  label: 'Attendance', icon: Calendar        },
    { to: '/employee/leave',       label: 'Leave',      icon: FileText        },
    { to: '/employee/payslips',    label: 'Payslips',   icon: Wallet          },
    { to: '/employee/performance', label: 'Performance',icon: Award           },
  ],
};

export default function Sidebar({ open, onClose }) {
  const { role } = useAuthStore();
  const items = NAV[role] || [];

  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transition-transform duration-300 lg:translate-x-0 flex flex-col overflow-hidden ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        data-testid="app-sidebar"
      >
        {/* Logo header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">H</div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-900" style={{fontFamily:'Outfit'}}>Lumen HR</div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Live</div>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden text-slate-500 hover:text-slate-900"
            onClick={onClose}
            data-testid="sidebar-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable nav — takes all remaining space */}
        <div className="flex-1 overflow-y-auto">
          <nav className="p-3 space-y-1">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                onClick={onClose}
                data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 sidebar-link-active'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Need help — pinned to bottom, never overlaps */}
        <div className="p-3 border-t border-slate-200 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-policy-chatbot'))}
            className="w-full rounded-md bg-blue-50 border border-blue-100 p-3 text-left hover:bg-blue-100 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-blue-600 shrink-0" />
              <p className="text-xs font-medium text-blue-900" style={{fontFamily:'Outfit'}}>Need help?</p>
            </div>
            <p className="text-[11px] text-blue-700/80 mt-0.5">Ask the HR Policy Assistant →</p>
          </button>
        </div>
      </aside>
    </>
  );
}
