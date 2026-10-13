
"use strict";

/**
 * surrealscripts.ui
 * Internal module: manifest.js
 *
 * Loads, validates, and manages script manifest data.
 * This module has no UI or DOM dependencies.
 *
 * Dependencies:
 * - config.js
 * - validator.js
 */

(function (root) {
  const state = {
    manifest: null,
    loadedAt: null,
    sourceUrl: null
  };

  function getConfig() {
    return root.SurrealConfig || {};
  }

  function getValidator() {
    return root.SurrealValidator || null;
  }

  function getManifestUrl(customUrl) {
    const config = getConfig();
    const url = customUrl || config.manifestPath || "scripts.json";

    if (typeof url !== "string" || !url.trim()) {
      throw new Error("A valid manifest URL is required.");
    }

    return url;
  }

  function validateManifestData(data) {
    const validator = getValidator();

    if (!validator || typeof validator.validateManifest !== "function") {
      throw new Error(
        "SurrealValidator is unavailable. Load validator.js first."
      );
    }

    const result = validator.validateManifest(data);

    if (result === false) {
      throw new Error("Manifest validation failed.");
    }

    if (result && result.valid === false) {
      const details = Array.isArray(result.errors)
        ? result.errors.join("; ")
        : "The manifest contains invalid data.";

      throw new Error(details);
    }

    return result;
  }

  function normalizeManifest(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Manifest must be a JSON object.");
    }

    if (!Array.isArray(data.scripts)) {
      throw new Error("Manifest must contain a scripts array.");
    }

    // Keep the manifest structure generic. Scripts are identified by ID,
    // not by a hard-coded script name.
    return {
      ...data,
      scripts: data.scripts.map((script) => ({ ...script }))
    };
  }

  async function load(options = {}) {
    if (typeof fetch !== "function") {
      throw new Error("This environment does not support fetch().");
    }

    const url = getManifestUrl(options.url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: options.cache || "no-cache",
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(
        `Manifest request failed: HTTP ${response.status}.`
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Manifest response is not valid JSON.");
    }

    const normalized = normalizeManifest(data);
    validateManifestData(normalized);

    state.manifest = normalized;
    state.loadedAt = new Date().toISOString();
    state.sourceUrl = url;

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("manifest:loaded", {
        count: normalized.scripts.length,
        loadedAt: state.loadedAt,
        sourceUrl: state.sourceUrl
      });
    }

    return get();
  }

  function set(data) {
    const normalized = normalizeManifest(data);
    validateManifestData(normalized);

    state.manifest = normalized;
    state.loadedAt = new Date().toISOString();
    state.sourceUrl = null;

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("manifest:loaded", {
        count: normalized.scripts.length,
        loadedAt: state.loadedAt,
        sourceUrl: null
      });
    }

    return get();
  }

  function get() {
    if (!state.manifest) return null;

    return {
      ...state.manifest,
      scripts: state.manifest.scripts.map((script) => ({ ...script }))
    };
  }

  function getAllScripts() {
    const manifest = get();
    return manifest ? manifest.scripts : [];
  }

  function getScriptById(id) {
    if (typeof id !== "string") {
      throw new TypeError("Script ID must be a string.");
    }

    const script = getAllScripts().find((item) => item.id === id);
    return script || null;
  }

  function getInfo() {
    return {
      loaded: state.manifest !== null,
      loadedAt: state.loadedAt,
      sourceUrl: state.sourceUrl,
      scriptCount: state.manifest
        ? state.manifest.scripts.length
        : 0
    };
  }

  function clear() {
    state.manifest = null;
    state.loadedAt = null;
    state.sourceUrl = null;
  }

  root.SurrealManifest = Object.freeze({
    load,
    set,
    get,
    getAllScripts,
    getScriptById,
    getInfo,
    clear
  });
})(globalThis);
