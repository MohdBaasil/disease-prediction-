// src/components/NotificationMenu.jsx
import React, { useState } from 'react';
import { Bell } from 'lucide-react';

export default function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Placeholder for future notification API integration
  // e.g., useEffect(() => { fetchNotifications().then(setNotifications); }, []);

  return (
    <div className="relative">
      <button
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell size={20} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 shadow-lg rounded-md z-10">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No notifications
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {notifications.map((n, i) => (
                <li key={i} className="p-2 border-b border-gray-200 dark:border-gray-700">
                  {n.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
