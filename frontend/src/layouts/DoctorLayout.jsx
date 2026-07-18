import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Breadcrumb from '../components/Breadcrumb';
import ErrorBoundary from '../components/ErrorBoundary';
import LoadingSkeleton from '../components/LoadingSkeleton';

// Role is fixed for this layout: doctor
const role = 'doctor';

export default function DoctorLayout() {
  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
        {/* Sidebar */}
        <Sidebar role={role} />
        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar role={role} />
          <div className="px-4 py-2">
            <Breadcrumb />
          </div>
          <main className="flex-1 overflow-auto p-4">
            {/* Show a loading skeleton while nested routes load */}
            <React.Suspense fallback={<LoadingSkeleton />}>
              <Outlet />
            </React.Suspense>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
