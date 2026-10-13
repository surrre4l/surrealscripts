
"use strict";

/**
 * surrealscripts.ui
 * Internal module: cache.js
 *
 * Provides expiring caches for manifests and script metadata.
 *
 * Dependencies:
 * - storage.js (optional; uses memory-only caching if unavailable)
 *
 * Cache data is not a source of truth and must be revalidated
 * before being trusted for security-sensitive decisions.
 */

(function (root) {
  const NAMESPACE = "surrealscripts:cache:";
  const DEFAULT_TTL = 5 * 60 * 1000;
  const MAX_TTL = 7 * 24 * 60 * 60 * 1000;

  const memory = new Map();

  function validateKey(key) {
    if (typeof key !== "string" || !key.trim()) {
      throw new TypeError("Cache key must be a non-empty string.");
    }

    return key.trim();
  }

  function validateTtl(ttl) {
    const value = ttl === undefined ? DEFAULT_TTL : Number(ttl);

    if (!Number.isFinite(value) || value < 0 || value > MAX_TTL) {
      throw new RangeError(
        `Cache TTL must be between 0 and ${MAX_TTL} milliseconds.`
      );
    }

    return value;
  }

  function storageAvailable() {
    return Boolean(
      root.SurrealStorage &&
      typeof root.SurrealStorage.set === "function" &&
      typeof root.SurrealStorage.get === "function" &&
      typeof root.SurrealStorage.remove === "function"
    );
  }

  function fullKey(key) {
    return NAMESPACE + validateKey(key);
  }

  function writePersistent(key, entry) {
    if (!storageAvailable()) return false;

    try {
      root.SurrealStorage.set(fullKey(key), entry);
      return true;
    } catch (error) {
      if (root.SurrealEvents) {
        root.SurrealEvents.emit("storage:error", {
          operation: "cache-write",
          key,
          message: error instanceof Error
            ? error.message
            : String(error)
        });
      }

      return false;
    }
  }

  function readPersistent(key) {
    if (!storageAvailable()) return null;

    try {
      return root.SurrealStorage.get(fullKey(key));
    } catch (error) {
      if (root.SurrealEvents) {
        root.SurrealEvents.emit("storage:error", {
          operation: "cache-read",
          key,
          message: error instanceof Error
            ? error.message
            : String(error)
        });
      }

      return null;
    }
  }

  function set(key, value, ttl) {
    const normalizedKey = validateKey(key);
    const duration = validateTtl(ttl);

    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration
    };

    memory.set(normalizedKey, entry);
    writePersistent(normalizedKey, entry);

    return {
      key: normalizedKey,
      expiresAt: entry.expiresAt
    };
  }

  function get(key) {
    const normalizedKey = validateKey(key);

    let entry = memory.get(normalizedKey) ||
      readPersistent(normalizedKey);

    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.expiresAt !== "number" ||
      !Object.prototype.hasOwnProperty.call(entry, "value")
    ) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      remove(normalizedKey);
      return null;
    }

    memory.set(normalizedKey, entry);
    return entry.value;
  }

  function has(key) {
    return get(key) !== null;
  }

  function remove(key) {
    const normalizedKey = validateKey(key);
    memory.delete(normalizedKey);

    if (storageAvailable()) {
      try {
        root.SurrealStorage.remove(fullKey(normalizedKey));
      } catch {
        // Memory cache is still cleared if persistent storage fails.
      }
    }
  }

  function clearMemory() {
    memory.clear();
  }

  function clearAll() {
    const keys = new Set(memory.keys());

    // Remove persistent entries known to this module.
    for (const key of keys) {
      remove(key);
    }

    memory.clear();
  }

  function getStats() {
    let expired = 0;
    const now = Date.now();

    for (const entry of memory.values()) {
      if (entry.expiresAt <= now) expired++;
    }

    return {
      memoryEntries: memory.size,
      expiredMemoryEntries: expired,
      persistentStorageAvailable: storageAvailable()
    };
  }

  function setManifest(manifest, ttl) {
    return set("manifest", manifest, ttl);
  }

  function getManifest() {
    return get("manifest");
  }

  function setScriptMetadata(scriptId, metadata, ttl) {
    if (typeof scriptId !== "string" || !scriptId.trim()) {
      throw new TypeError("A valid script ID is required.");
    }

    return set(`script:${scriptId}`, metadata, ttl);
  }

  function getScriptMetadata(scriptId) {
    if (typeof scriptId !== "string" || !scriptId.trim()) {
      throw new TypeError("A valid script ID is required.");
    }

    return get(`script:${scriptId}`);
  }

  root.SurrealCache = Object.freeze({
    set,
    get,
    has,
    remove,
    clearMemory,
    clearAll,
    getStats,
    setManifest,
    getManifest,
    setScriptMetadata,
    getScriptMetadata,
    DEFAULT_TTL
  });
})(globalThis);
