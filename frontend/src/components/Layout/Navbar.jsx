import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, User, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import toast from 'react-hot-toast';

const ROLE_LABEL = {
  management_admin: { text: 'Administrator', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  senior_manager: { text: 'Manager', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  hr_recruiter: { text: 'Recruiter', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  employee: { text: 'Employee', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function Navbar({ onMenu }) {
  const { user, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const unread = notifs.filter((n) => !n.is_read).length;
  const badge = ROLE_LABEL[role] || ROLE_LABEL.employee;

  useEffect(() => {
    api.get('/notifications/my').then((r) => setNotifs(r.data || [])).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login', { replace: true });
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifs((arr) => arr.map((n) => ({ ...n, is_read: true })));
    } catch (e) {}
  };

  return (
    <header
      className="sticky top-0 z-30 h-16 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6"
      data-testid="app-navbar"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden text-slate-600 hover:text-slate-900"
          onClick={onMenu}
          data-testid="navbar-menu-btn"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Welcome back</p>
          <h2 className="text-base font-semibold text-slate-900" style={{fontFamily:'Outfit'}}>{user?.full_name || 'User'}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${badge.cls}`}
          data-testid="navbar-role-badge"
        >
          {badge.text}
        </span>

        <div className="relative">
          <button
            type="button"
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            onClick={() => setNotifOpen((v) => !v)}
            data-testid="navbar-notif-btn"
            aria-label="Notifications"
          >
            <Bell size={16} className="text-slate-600" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
              data-testid="navbar-notif-panel"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <button
                  className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                  onClick={markAllRead}
                  data-testid="navbar-notif-mark-all-read"
                >
                  <Check size={12} /> Mark all read
                </button>
              </div>
              {notifs.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No notifications yet.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notifs.slice(0, 10).map((n) => (
                    <li key={n.id} className={`px-3 py-3 ${!n.is_read ? 'bg-blue-50/40 border-l-2 border-blue-500' : ''}`}>
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="h-9 w-9 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
            {(user?.full_name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('')}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
          data-testid="navbar-logout-btn"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
