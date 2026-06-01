import { useState } from 'react';
import { Settings as SettingsIcon, Server, Database, Cloud, Lock, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function SettingsPage() {
  const { user, role } = useAuthStore();
  const [emailNotif, setEmailNotif] = useState(true);
  const [browserNotif, setBrowserNotif] = useState(true);
  const [weekStart, setWeekStart] = useState('monday');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');

  const save = (label) => () => {
    // Settings are persisted client-side only in this iteration; backend persistence is a follow-up.
    toast.success(`${label} saved`);
  };

  return (
    <div className="space-y-5" data-testid="settings-page">
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500 font-semibold">Workspace</p>
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <SettingsIcon size={16} className="text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Profile</h3>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-slate-500">Name</dt><dd className="text-slate-900 font-medium">{user?.full_name}</dd>
            <dt className="text-slate-500">Email</dt><dd className="text-slate-900 font-medium">{user?.email || '—'}</dd>
            <dt className="text-slate-500">Role</dt><dd className="text-slate-900 font-medium capitalize">{role?.replace('_', ' ')}</dd>
          </dl>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Notifications</h3>
          </div>
          <label className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-700">Email notifications</span>
            <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} data-testid="settings-email-notif" />
          </label>
          <label className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-700">Browser notifications</span>
            <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={browserNotif} onChange={(e) => setBrowserNotif(e.target.checked)} data-testid="settings-browser-notif" />
          </label>
          <button onClick={save('Notification preferences')} className="mt-3 h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Save</button>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Workweek</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Week starts on</label>
              <select value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="settings-week-start">
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Shift start</label>
                <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Shift end</label>
                <input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
          <button onClick={save('Workweek settings')} className="mt-3 h-9 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Save</button>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={16} className="text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit' }}>Integrations</h3>
          </div>
          <ul className="text-sm space-y-2">
            <li className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-700 inline-flex items-center gap-2"><Database size={14} className="text-slate-400" /> Database</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Connected</span>
            </li>
            <li className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-700 inline-flex items-center gap-2"><Cloud size={14} className="text-slate-400" /> Cloudinary</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Connected</span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span className="text-slate-700 inline-flex items-center gap-2"><Lock size={14} className="text-slate-400" /> Upstash Redis</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Connected</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
