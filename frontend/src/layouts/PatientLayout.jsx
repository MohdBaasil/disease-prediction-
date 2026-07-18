import React from 'react';
import { Outlet } from 'react-router-dom';
import AppShell from './AppShell';

export default function PatientLayout() {
  return (
    <AppShell role="patient">
      <Outlet />
    </AppShell>
  );
}
