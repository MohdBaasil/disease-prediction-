import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Sun, Moon, LogOut, Activity } from 'lucide-react';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { authService } from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check dark mode preference
    const isDark = localStorage.getItem('theme') === 'dark' || 
                   (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check logged in user
    const curUser = authService.getCurrentUser();
    if (curUser.token) {
      setUser(curUser);
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    window.location.hash = '/login';
  };

  // Protected Route component
  const ProtectedRoute = ({ children, allowedRoles }) => {
    const curUser = authService.getCurrentUser();
    if (!curUser.token) {
      return <Navigate to="/login" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(curUser.role)) {
      // Redirect to correct dashboard if unauthorized
      return <Navigate to={`/${curUser.role.toLowerCase()}`} replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        
        {/* Navigation Bar */}
        <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center space-x-3">
                <div className="bg-hospital-500 text-white p-2 rounded-lg shadow-md animate-pulse">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-hospital-600 to-hospital-400 bg-clip-text text-transparent">
                    AcuraQueue
                  </span>
                  <span className="text-xs block text-slate-500 dark:text-slate-400 font-medium">Smart Queue Management</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Theme Toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                {user && (
                  <div className="flex items-center space-x-4 border-l border-slate-200 dark:border-slate-800 pl-4">
                    <div className="hidden sm:block text-right">
                      <span className="text-sm font-semibold block">{user.username}</span>
                      <span className="text-xs text-hospital-500 dark:text-hospital-400 font-bold uppercase">{user.role}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-rose-200 text-rose-600 dark:border-rose-900/50 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route 
              path="/login" 
              element={user ? <Navigate to={`/${user.role.toLowerCase()}`} replace /> : <Login onLoginSuccess={setUser} />} 
            />
            
            <Route 
              path="/patient" 
              element={
                <ProtectedRoute allowedRoles={["Patient"]}>
                  <PatientDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/receptionist" 
              element={
                <ProtectedRoute allowedRoles={["Receptionist", "Admin"]}>
                  <ReceptionistDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/doctor" 
              element={
                <ProtectedRoute allowedRoles={["Doctor"]}>
                  <DoctorDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={["Admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Catch-all redirect */}
            <Route 
              path="*" 
              element={<Navigate to={user ? `/${user.role.toLowerCase()}` : "/login"} replace />} 
            />
          </Routes>
        </main>
        
        {/* Footer */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          &copy; {new Date().getFullYear()} AcuraQueue AI-Powered Patient Flow. All rights reserved.
        </footer>
      </div>
    </Router>
  );
}

export default App;
