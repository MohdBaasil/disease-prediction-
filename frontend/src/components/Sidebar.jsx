import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_MENUS } from '../config/navigation';
import { Menu, X } from 'lucide-react';

export default function Sidebar({ role }) {
  const [open, setOpen] = React.useState(true);
  const menu = NAV_MENUS[role] || [];

  return (
    <aside className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 ${open ? 'w-64' : 'w-16'} hidden md:block`}> 
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <span className="font-bold text-lg hidden md:block">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
        <button onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <nav className="mt-2">
        {menu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-600 font-medium' : ''}`
            }
          >
            {/* Icon placeholder – using lucide-react dynamic import is out of scope; render a generic span */}
            <span className="w-5 h-5 bg-slate-300 dark:bg-slate-600 rounded" />
            <span className="hidden md:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
