import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const labelMap = {
  admin: 'Admin',
  doctor: 'Doctor',
  reception: 'Reception',
  patient: 'Patient',
  overview: 'Overview',
  analytics: 'Analytics',
  staff: 'Staff',
  departments: 'Departments',
  'ai-insights': 'AI Insights',
  settings: 'Settings',
  dashboard: 'Dashboard',
  consultation: 'Consultation',
  clinical: 'Clinical Workspace',
  'ai-assistant': 'AI Assistant',
  prescriptions: 'Prescriptions',
  history: 'Medical History',
  reports: 'Reports',
  queue: 'Queue',
  register: 'Register Patient',
  appointments: 'Appointments',
  search: 'Search Patient',
  notifications: 'Notifications',
  home: 'Home',
  health: 'My Health',
  'health-score': 'AI Health Score',
  'ai-chat': 'AI Chat',
  profile: 'Profile'
};

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((seg, idx) => {
    const to = '/' + segments.slice(0, idx + 1).join('/');
    const name = labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
    return { name, to };
  });

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
      <Link to="/">
        Home
      </Link>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.to}>
          <ChevronRight size={14} className="text-gray-400" />
          {i === crumbs.length - 1 ? (
            <span>{c.name}</span>
          ) : (
            <Link to={c.to}>{c.name}</Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
