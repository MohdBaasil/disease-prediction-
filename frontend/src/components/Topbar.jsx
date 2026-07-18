import React from 'react';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import NotificationMenu from './NotificationMenu';
import { Bell, User } from 'lucide-react';

export default function Topbar({ role }) {
  return (
    <header className="flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
      <div className="flex items-center space-x-3">
        {/* Logo / App name */}
        <span className="font-bold text-xl text-hospital-600 dark:text-hospital-400">AcuraQueue</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{role.charAt(0).toUpperCase() + role.slice(1)} Workspace</span>
      </div>
      <div className="flex items-center space-x-4">
        <ThemeToggle />
        <NotificationMenu />
        <UserMenu />
      </div>
    </header>
  );
}
