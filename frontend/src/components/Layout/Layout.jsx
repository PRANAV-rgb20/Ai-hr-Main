import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50" data-testid="app-layout">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <Navbar onMenu={() => setOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto" data-testid="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
