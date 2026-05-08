/**
 * Hook for synchronizing state with localStorage.
 * Provides a useState-like API with automatic persistence.
 *
 * @module useLocalStorage
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Use a state value that persists to localStorage.
 *
 * @param {string} key - localStorage key
 * @param {*} initialValue - Default value if key not in localStorage
 * @returns {[*, Function]} - [value, setValue]
 */
export function useLocalStorage(key, initialValue) {
  if (!key || typeof key !== 'string') {
    throw new TypeError('localStorage key must be a non-empty string');
  }

  // Read from localStorage on init
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
      // Initialize with initial value
      const valueToStore = initialValue instanceof Function ? initialValue() : initialValue;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      return valueToStore;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
  });

  // Track initialization
  const isInitialized = useRef(false);

  useEffect(() => {
    isInitialized.current = true;
  }, []);

  // Persist to localStorage whenever value changes
  useEffect(() => {
    if (!isInitialized.current) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        console.warn(`localStorage quota exceeded for key "${key}"`);
        // Try to free space by removing old backup data
        try {
          const backups = JSON.parse(localStorage.getItem('notes-backup') || '{}');
          const keys = Object.keys(backups);
          if (keys.length > 0) {
            delete backups[keys[0]];
            localStorage.setItem('notes-backup', JSON.stringify(backups));
            // Retry
            window.localStorage.setItem(key, JSON.stringify(storedValue));
          }
        } catch (e) {
          console.error('Failed to free localStorage space:', e);
        }
      } else {
        console.error(`Error writing localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue]);

  // Listen for changes from other tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  return [storedValue, setStoredValue];
}

/**
 * Hook for a localStorage-backed toggle.
 *
 * @param {string} key
 * @param {boolean} defaultValue
 * @returns {[boolean, Function, Function]} - [value, toggle, setValue]
 */
export function useLocalStorageToggle(key, defaultValue = false) {
  const [value, setValue] = useLocalStorage(key, defaultValue);

  const toggle = useCallback(() => {
    setValue(v => !v);
  }, [setValue]);

  const setTrue = useCallback(() => setValue(true), [setValue]);
  const setFalse = useCallback(() => setValue(false), [setValue]);

  return [!!value, toggle, setValue, setTrue, setFalse];
}

/**
 * Hook for reading a localStorage value without state sync.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function useReadLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === key) {
        try {
          setValue(e.newValue ? JSON.parse(e.newValue) : defaultValue);
        } catch {
          setValue(defaultValue);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key, defaultValue]);

  return value;
}
