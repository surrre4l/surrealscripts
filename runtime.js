
"use strict";

/**
 * surrealscripts.ui
 * Internal module: runtime.js
 *
 * Detects browser capabilities required by internal modules.
 * This module does not modify the environment or access the DOM UI.
 */

(function (root) {
  function checkCapabilities() {
    const isBrowser =
      typeof window !== "undefined" &&
      typeof document !== "undefined";

    const secureContext =
      typeof root.isSecureContext === "boolean"
        ? root.isSecureContext
        : false;

    const checks = {
      browser: isBrowser,
      fetch: typeof root.fetch === "function",
      promises: typeof root.Promise === "function",
      url: typeof root.URL === "function",
      textEncoder: typeof root.TextEncoder === "function",
      webCrypto: Boolean(root.crypto && root.crypto.subtle),
      secureContext,
      localStorage: false,
      abortController: typeof root.AbortController === "function"
    };

    if (isBrowser) {
      try {
        const key = "__surreal_runtime_test__";
        root.localStorage.setItem(key, "1");
        root.localStorage.removeItem(key);
        checks.localStorage = true;
      } catch {
        checks.localStorage = false;
      }
    }

    return checks;
  }

  function getReport() {
    const capabilities = checkCapabilities();

    const required = ["promises", "url"];
    const missingRequired = required.filter(
      (name) => !capabilities[name]
    );

    const warnings = [];

    if (!capabilities.fetch) {
      warnings.push("Fetch API is unavailable.");
    }

    if (!capabilities.webCrypto || !capabilities.secureContext) {
      warnings.push(
        "Web Crypto features may be unavailable; HTTPS is normally required."
      );
    }

    if (!capabilities.localStorage) {
      warnings.push(
        "Local storage is unavailable or blocked; persistent browser caching may fail."
      );
    }

    return {
      supported: missingRequired.length === 0,
      capabilities,
      missingRequired,
      warnings
    };
  }

  function requireCapabilities(names) {
    if (!Array.isArray(names)) {
      throw new TypeError("Capability names must be provided as an array.");
    }

    const capabilities = checkCapabilities();
    const missing = names.filter((name) => !capabilities[name]);

    if (missing.length > 0) {
      const error = new Error(
        `Missing required capabilities: ${missing.join(", ")}`
      );

      error.code = "RUNTIME_CAPABILITY_MISSING";
      error.details = { missing };

      throw error;
    }

    return true;
  }

  root.SurrealRuntime = Object.freeze({
    checkCapabilities,
    getReport,
    requireCapabilities
  });
})(globalThis);
