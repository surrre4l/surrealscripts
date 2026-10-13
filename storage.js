
"use strict";

/**
 * surrealscripts.ui
 * Internal module: storage.js
 *
 * Stores non-secret preferences and cached metadata locally.
 *
 * WARNING:
 * localStorage is not secure storage. Do not store passwords,
 * encryption keys, access tokens, or private source code here.
 */

(function (root) {
  const PREFIX = "surrealscripts.ui:";
  const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
  const MAX_VALUE_LENGTH = 5 * 1024 * 1024;

  function getStorage() {
    try {
      if (!root.localStorage) {
        throw new Error("Local storage is unavailable.");
      }

      const testKey = PREFIX + "__test__";
      root.localStorage.setItem(testKey, "1");
      root.localStorage.removeItem(testKey);

      return root.localStorage;
    } catch {
      throw new Error(
        "Local storage is unavailable or blocked by browser settings."
      );
    }
  }

  function validateKey(key) {
    if (
      typeof key !== "string" ||
      !/^[a-zA-Z0-9._-]{1,120}$/.test(key)
    ) {
      throw new TypeError(
        "Storage keys must be 1–120 letters, numbers, dots, underscores, or hyphens."
      );
    }
  }

  function set(key, value) {
    validateKey(key);

    let serialized;

    try {
      serialized = JSON.stringify(value);
    } catch {
      throw new TypeError("Value could not be serialized as JSON.");
    }

    if (typeof serialized !== "string") {
      throw new TypeError("Unsupported storage value.");
    }

    if (serialized.length > MAX_VALUE_LENGTH) {
      throw new Error("Storage value exceeds the allowed size.");
    }

    const storage = getStorage();

    try {
      storage.setItem(PREFIX + key, serialized);
      return true;
    } catch {
      throw new Error("Could not save the local storage value.");
    }
  }

  function get(key, fallback = null) {
    validateKey(key);

    let raw;

    try {
      raw = getStorage().getItem(PREFIX + key);
    } catch {
      return fallback;
    }

    if (raw === null) {
      return fallback;
    }

    try {
      return JSON.parse(raw);
    } catch {
      remove(key);
      return fallback;
    }
  }

  function remove(key) {
    validateKey(key);

    try {
      getStorage().removeItem(PREFIX + key);
      return true;
    } catch {
      return false;
    }
  }

  function clearNamespace() {
    const storage = getStorage();
    const keysToRemove = [];

    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);

      if (key && key.startsWith(PREFIX)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }

    return keysToRemove.length;
  }

  function cacheSet(key, value, ttlMs = DEFAULT_CACHE_TTL_MS) {
    if (
      !Number.isFinite(ttlMs) ||
      ttlMs < 0 ||
      ttlMs > 30 * 24 * 60 * 60 * 1000
    ) {
      throw new RangeError("Cache TTL must be between 0 and 30 days.");
    }

    return set("cache." + key, {
      expiresAt: Date.now() + ttlMs,
      value
    });
  }

  function cacheGet(key, fallback = null) {
    const entry = get("cache." + key, null);

    if (
      !entry ||
      typeof entry !== "object" ||
      !Number.isFinite(entry.expiresAt) ||
      !Object.prototype.hasOwnProperty.call(entry, "value")
    ) {
      remove("cache." + key);
      return fallback;
    }

    if (Date.now() >= entry.expiresAt) {
      remove("cache." + key);
      return fallback;
    }

    return entry.value;
  }

  root.SurrealStorage = Object.freeze({
    set,
    get,
    remove,
    clearNamespace,
    cacheSet,
    cacheGet
  });
})(globalThis);
