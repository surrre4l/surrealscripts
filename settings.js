
"use strict";

/**
 * surrealscripts.ui
 * Internal module: settings.js
 *
 * Manages validated application preferences.
 *
 * Dependency:
 * - storage.js (optional)
 *
 * Do not store secrets, passwords, encryption keys,
 * or private script source in settings.
 */

(function (root) {
  const STORAGE_KEY = "surrealscripts:settings";

  const DEFAULTS = Object.freeze({
    theme: "system",
    language: "en",
    itemsPerPage: 12,
    defaultSort: "name-asc",
    rememberSearch: true,
    cacheEnabled: true,
    checkUpdatesOnStart: true,
    showDescriptions: true
  });

  let settings = { ...DEFAULTS };

  function validate(input) {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new TypeError("Settings must be an object.");
    }

    const next = { ...settings };

    if (input.theme !== undefined) {
      if (!["system", "light", "dark"].includes(input.theme)) {
        throw new Error("theme must be system, light, or dark.");
      }
      next.theme = input.theme;
    }

    if (input.language !== undefined) {
      if (
        typeof input.language !== "string" ||
        !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(input.language)
      ) {
        throw new Error("language must be a valid language code.");
      }
      next.language = input.language;
    }

    if (input.itemsPerPage !== undefined) {
      const count = Number(input.itemsPerPage);

      if (!Number.isInteger(count) || count < 4 || count > 100) {
        throw new Error("itemsPerPage must be an integer from 4 to 100.");
      }

      next.itemsPerPage = count;
    }

    if (input.defaultSort !== undefined) {
      const allowedSorts = [
        "name-asc",
        "name-desc",
        "version-asc",
        "version-desc",
        "id-asc",
        "id-desc"
      ];

      if (!allowedSorts.includes(input.defaultSort)) {
        throw new Error("defaultSort is not supported.");
      }

      next.defaultSort = input.defaultSort;
    }

    const booleanKeys = [
      "rememberSearch",
      "cacheEnabled",
      "checkUpdatesOnStart",
      "showDescriptions"
    ];

    for (const key of booleanKeys) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== "boolean") {
          throw new Error(`${key} must be a boolean.`);
        }

        next[key] = input[key];
      }
    }

    return next;
  }

  function getAll() {
    return { ...settings };
  }

  function get(key) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      throw new Error(`Unknown setting: ${key}`);
    }

    return settings[key];
  }

  function set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      throw new Error(`Unknown setting: ${key}`);
    }

    settings = validate({ ...settings, [key]: value });
    emitChanged([key]);

    return get(key);
  }

  function update(values) {
    settings = validate(values);
    emitChanged(Object.keys(values));

    return getAll();
  }

  function emitChanged(keys) {
    if (root.SurrealEvents) {
      root.SurrealEvents.emit("settings:changed", {
        keys,
        settings: getAll()
      });
    }
  }

  function save() {
    if (
      !root.SurrealStorage ||
      typeof root.SurrealStorage.set !== "function"
    ) {
      return {
        saved: false,
        reason: "storage-unavailable"
      };
    }

    try {
      root.SurrealStorage.set(STORAGE_KEY, getAll());

      return { saved: true };
    } catch (error) {
      if (root.SurrealEvents) {
        root.SurrealEvents.emit("storage:error", {
          operation: "settings-save",
          message: error instanceof Error
            ? error.message
            : String(error)
        });
      }

      return {
        saved: false,
        reason: "storage-error"
      };
    }
  }

  function load() {
    if (
      !root.SurrealStorage ||
      typeof root.SurrealStorage.get !== "function"
    ) {
      return {
        loaded: false,
        reason: "storage-unavailable"
      };
    }

    try {
      const saved = root.SurrealStorage.get(STORAGE_KEY);

      if (saved === null || saved === undefined) {
        return {
          loaded: false,
          reason: "no-saved-settings"
        };
      }

      settings = validate(saved);
      emitChanged(Object.keys(settings));

      return {
        loaded: true,
        settings: getAll()
      };
    } catch (error) {
      // Preserve current defaults if stored data is invalid.
      return {
        loaded: false,
        reason: "invalid-or-unreadable-settings",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  function reset(options = {}) {
    settings = { ...DEFAULTS };
    emitChanged(Object.keys(DEFAULTS));

    if (options.persist === true) {
      return save();
    }

    return { reset: true, persisted: false };
  }

  root.SurrealSettings = Object.freeze({
    DEFAULTS,
    getAll,
    get,
    set,
    update,
    save,
    load,
    reset
  });
})(globalThis);
