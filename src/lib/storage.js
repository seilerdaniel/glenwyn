// Local persistence shim for Glenwyn.
//
// This mirrors the get/set/delete/list interface Glenwyn was originally built
// against inside the Claude artifact sandbox (`window.storage`). Keeping the
// same shape here means that when we wire up Supabase later, we only need to
// swap what's inside these functions — nothing in App.jsx has to change.

const STORE_KEY = 'glenwyn:store';

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export const storage = {
  async get(key) {
    const store = readStore();
    if (!(key in store)) return null;
    return { key, value: store[key], shared: false };
  },

  async set(key, value) {
    const store = readStore();
    store[key] = value;
    writeStore(store);
    return { key, value, shared: false };
  },

  async delete(key) {
    const store = readStore();
    const existed = key in store;
    delete store[key];
    writeStore(store);
    return { key, deleted: existed, shared: false };
  },

  async list(prefix = '') {
    const store = readStore();
    return { keys: Object.keys(store).filter((k) => k.startsWith(prefix)), prefix, shared: false };
  },
};
