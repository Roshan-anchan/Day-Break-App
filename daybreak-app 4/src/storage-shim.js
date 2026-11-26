// Polyfills the window.storage API (normally provided by the Claude artifact
// runtime) using the browser's localStorage, so the app works unmodified
// outside of Claude.

const storage = {
  async get(key, _shared) {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      // Match the artifact API's behavior of throwing on a missing key.
      throw new Error('key not found: ' + key);
    }
    return { key, value: raw, shared: !!_shared };
  },

  async set(key, value, _shared) {
    localStorage.setItem(key, value);
    return { key, value, shared: !!_shared };
  },

  async delete(key, _shared) {
    localStorage.removeItem(key);
    return { key, deleted: true, shared: !!_shared };
  },

  async list(prefix, _shared) {
    const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared: !!_shared };
  },
};

window.storage = storage;
