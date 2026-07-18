// src/layouts/AppShell.jsx
import React from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Breadcrumb from '../components/Breadcrumb';
import NotificationMenu from '../components/NotificationMenu';
import UserMenu from '../components/UserMenu';
import ThemeToggle from '../components/ThemeToggle';

export default function AppShell({ role, children }) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <Sidebar role={role} />
      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <Topbar role={role} />
        {/* Header utilities */}
        <div className="flex items-center justify-end px-4 py-2 space-x-4">
          <NotificationMenu />
          <UserMenu />
          <ThemeToggle />
        </div>
        {/* Breadcrumb */}
        <div className="px-4 py-2">
          <Breadcrumb />
        </div>
        {/* Page content */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
