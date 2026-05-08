/**
 * Theme management hook for dark/light mode.
 * Supports system preference detection, localStorage persistence, and smooth transitions.
 *
 * @module useTheme
 */

import { useState, useEffect, useCallback } from 'react';

const THEME_STORAGE_KEY = 'notes-theme';
const THEME_ATTRIBUTE = 'data-theme';

/**
 * @returns {['light' | 'dark', Function, boolean]}
 */
export function useTheme() {
  // Initialize from localStorage or system preference
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      // Fall back to system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // Track if theme was explicitly set (not system-default)
  const [isSystemDefault, setIsSystemDefault] = useState(() => {
    try {
      return !localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return true;
    }
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, theme);

    // Also set meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a2e' : '#fafafa');
    }

    // Set class for smooth transitions
    document.body.classList.add('theme-transition');
    requestAnimationFrame(() => {
      document.body.classList.remove('theme-transition');
    });
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!isSystemDefault) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setThemeState(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isSystemDefault]);

  const setTheme = useCallback((newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark') {
      console.warn(`Invalid theme: ${newTheme}. Use 'light' or 'dark'.`);
      return;
    }

    setIsSystemDefault(false);
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Failed to persist theme preference:', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const resetToSystem = useCallback(() => {
    setIsSystemDefault(true);
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setThemeState(systemDark ? 'dark' : 'light');
  }, []);

  return {
    theme,
    setTheme,
    toggleTheme,
    resetToSystem,
    isSystemDefault,
    isDark: theme === 'dark'
  };
}
