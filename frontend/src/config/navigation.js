// src/config/navigation.js
export const NAV_MENUS = {
  admin: [
    { label: 'Overview', icon: 'Home', path: '/admin/overview' },
    { label: 'Analytics', icon: 'BarChart2', path: '/admin/analytics' },
    { label: 'Staff', icon: 'Users', path: '/admin/staff' },
    { label: 'Departments', icon: 'Layers', path: '/admin/departments' },
    { label: 'AI Insights', icon: 'Brain', path: '/admin/ai-insights' },
    { label: 'Reports', icon: 'FileText', path: '/admin/reports' },
    { label: 'Settings', icon: 'Settings', path: '/admin/settings' },
  ],
  doctor: [
    { label: 'Dashboard', icon: 'Home', path: '/doctor/dashboard' },
    { label: 'Consultation', icon: 'Stethoscope', path: '/doctor/consultation' },
    { label: 'Clinical Workspace', icon: 'LayoutPanelLeft', path: '/doctor/clinical' },
    { label: 'AI Assistant', icon: 'Bot', path: '/doctor/ai-assistant' },
    { label: 'Prescriptions', icon: 'Prescription', path: '/doctor/prescriptions' },
    { label: 'Medical History', icon: 'FolderArchive', path: '/doctor/history' },
    { label: 'Reports', icon: 'FileChart', path: '/doctor/reports' },
  ],
  reception: [
    { label: 'Dashboard', icon: 'Home', path: '/reception/dashboard' },
    { label: 'Queue', icon: 'ListTodo', path: '/reception/queue' },
    { label: 'Register Patient', icon: 'UserPlus', path: '/reception/register' },
    { label: 'Appointments', icon: 'Calendar', path: '/reception/appointments' },
    { label: 'Search Patient', icon: 'Search', path: '/reception/search' },
    { label: 'Notifications', icon: 'Bell', path: '/reception/notifications' },
  ],
  patient: [
    { label: 'Home', icon: 'Home', path: '/patient/home' },
    { label: 'My Health', icon: 'HeartPulse', path: '/patient/health' },
    { label: 'AI Health Score', icon: 'Activity', path: '/patient/health-score' },
    { label: 'Appointments', icon: 'CalendarCheck', path: '/patient/appointments' },
    { label: 'Prescriptions', icon: 'Pill', path: '/patient/prescriptions' },
    { label: 'Reports', icon: 'FileText', path: '/patient/reports' },
    { label: 'AI Chat', icon: 'MessageCircle', path: '/patient/ai-chat' },
    { label: 'Profile', icon: 'User', path: '/patient/profile' },
  ],
};
