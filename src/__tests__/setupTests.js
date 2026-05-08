/**
 * Jest test setup file.
 */

// Mock matchMedia
global.matchMedia = global.matchMedia || function() {
  return {
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
};

// Mock localStorage
global.localStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

// Mock indexedDB
global.indexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

// Mock window.scrollTo
global.scrollTo = jest.fn();

// Suppress console during tests unless needed
const originalConsole = { ...console };
beforeAll(() => {
  // Keep error logging
});
