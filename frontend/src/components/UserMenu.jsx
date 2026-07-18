// src/components/UserMenu.jsx
import React, { useState } from 'react';
import { User } from 'lucide-react';
import { authService } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const userName = currentUser?.username || 'User';
  const role = currentUser?.role || 'Unknown Role';

  const handleLogout = () => {
    authService.logout();
    // After logout, redirect to login page
    navigate('/login');
  };

  return (
    <div className="relative">
      <button
        className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={() => setOpen(!open)}
        aria-label="User menu"
      >
        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
          <User size={20} />
        </div>
        <span className="hidden md:inline">{userName}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-md z-10">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <p className="font-medium">{userName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{role}</p>
          </div>
          <ul className="py-1">
            <li>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                Profile
              </button>
            </li>
            <li>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
