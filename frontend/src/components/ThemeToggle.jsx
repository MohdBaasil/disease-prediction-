// src/components/ThemeToggle.jsx
import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    // Resolve theme from localStorage or system preference on first render
    const stored = localStorage.getItem('theme');
    if (stored) {
      return stored === 'dark';
    }
    // If not set, follow OS preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply theme class and persist to localStorage whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  return (
    <button
      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
      onClick={() => setDark(!dark)}
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
