
/*========================================================
  SURREALSCRIPTS.UI — DIAGNOSTICS MODULE
  File: diagnostics.js

  Responsibilities:
  - Inspect registered internal module availability.
  - Collect browser capability information.
  - Read bootstrap status when available.
  - Report diagnostic warnings and errors.
  - Export a safe, JSON-compatible diagnostic report.

  This module does not change settings, repair modules,
  execute hosted scripts, or collect private user data.
========================================================*/

(function (global) {
  "use strict";

  const MODULE_NAMES = [
    "SurrealConfig",
    "SurrealErrors",
    "SurrealLogger",
    "SurrealEvents",
    "SurrealStorage",
    "SurrealValidator",
    "SurrealIntegrity",
    "SurrealSecurity",
    "SurrealVersioning",
    "SurrealAPI",
    "SurrealManifest",
    "SurrealRegistry",
    "SurrealPermissions",
    "SurrealCache",
    "SurrealSearch",
    "SurrealDownloads",
    "SurrealUpdates",
    "SurrealSettings",
    "SurrealNotifications",
    "SurrealRuntime",
    "SurrealBootstrap"
  ];

  function getModuleReport() {
    return MODULE_NAMES.map(function (name) {
      const available =
        global[name] !== undefined &&
        global[name] !== null;

      return {
        name,
        available,
        type: available ? typeof global[name] : "undefined"
      };
    });
  }

  function checkCapabilities() {
    const cryptoObject = global.crypto;

    return {
      fetch: typeof global.fetch === "function",
      promise: typeof global.Promise === "function",
      json: typeof global.JSON === "object",
      localStorage: checkLocalStorage(),
      webCrypto: Boolean(
        cryptoObject &&
        cryptoObject.subtle &&
        typeof cryptoObject.subtle.digest === "function"
      ),
      textEncoder: typeof global.TextEncoder === "function",
      blob: typeof global.Blob === "function",
      urlObject: typeof global.URL === "function",
      document: typeof global.document === "object",
      secureContext:
        typeof global.isSecureContext === "boolean"
          ? global.isSecureContext
          : null
    };
  }

  function checkLocalStorage() {
    try {
      if (!global.localStorage) {
        return false;
      }

      const key =
        "__surreal_diagnostic_" + Date.now();

      global.localStorage.setItem(key, "test");
      global.localStorage.removeItem(key);

      return true;
    } catch (error) {
      return false;
    }
  }

  function getBootstrapReport() {
    const bootstrap = global.SurrealBootstrap;

    if (
      !bootstrap ||
      typeof bootstrap.getReport !== "function"
    ) {
      return {
        available: false,
        status: "unavailable"
      };
    }

    try {
      const report = bootstrap.getReport();

      return {
        available: true,
        status:
          typeof report.status === "string"
            ? report.status
            : "unknown",
        missingRequired: Array.isArray(report.missingRequired)
          ? report.missingRequired.slice()
          : [],
        missingOptional: Array.isArray(report.missingOptional)
          ? report.missingOptional.slice()
          : [],
        errors: Array.isArray(report.errors)
          ? report.errors.map(function (error) {
              return {
                module: String(error.module || "unknown"),
                message: String(error.message || "Unknown error")
              };
            })
          : []
      };
    } catch (error) {
      return {
        available: true,
        status: "error",
        error: error.message || "Could not read bootstrap report."
      };
    }
  }

  function collectWarnings(modules, capabilities, bootstrap) {
    const warnings = [];

    const missingModules = modules
      .filter(function (module) {
        return !module.available;
      })
      .map(function (module) {
        return module.name;
      });

    if (missingModules.length > 0) {
      warnings.push({
        code: "MODULES_MISSING",
        message: "Some internal modules are not loaded.",
        details: missingModules
      });
    }

    if (!capabilities.fetch) {
      warnings.push({
        code: "FETCH_UNAVAILABLE",
        message: "Network requests are unavailable."
      });
    }

    if (!capabilities.webCrypto) {
      warnings.push({
        code: "WEB_CRYPTO_UNAVAILABLE",
        message: "Web Crypto is unavailable; integrity and encryption features may not work."
      });
    }

    if (!capabilities.localStorage) {
      warnings.push({
        code: "LOCAL_STORAGE_UNAVAILABLE",
        message: "Persistent browser storage is unavailable."
      });
    }

    if (
      capabilities.secureContext === false
    ) {
      warnings.push({
        code: "INSECURE_CONTEXT",
        message: "Some browser security APIs may require HTTPS or another secure context."
      });
    }

    if (
      bootstrap.available &&
      bootstrap.status === "failed"
    ) {
      warnings.push({
        code: "BOOTSTRAP_FAILED",
        message: "Bootstrap reported a startup failure."
      });
    }

    if (
      bootstrap.available &&
      bootstrap.status === "degraded"
    ) {
      warnings.push({
        code: "BOOTSTRAP_DEGRADED",
        message: "Bootstrap reported missing optional modules or startup warnings."
      });
    }

    return warnings;
  }

  function run() {
    const startedAt = new Date().toISOString();

    const modules = getModuleReport();
    const capabilities = checkCapabilities();
    const bootstrap = getBootstrapReport();

    const warnings = collectWarnings(
      modules,
      capabilities,
      bootstrap
    );

    const availableCount = modules.filter(function (module) {
      return module.available;
    }).length;

    const report = {
      product: "surrealscripts.ui",
      diagnosticVersion: 1,
      generatedAt: startedAt,
      summary: {
        modulesAvailable: availableCount,
        modulesChecked: modules.length,
        warningCount: warnings.length,
        status: warnings.length === 0 ? "ok" : "warning"
      },
      modules,
      capabilities,
      bootstrap,
      warnings
    };

    const events = global.SurrealEvents;

    if (events && typeof events.emit === "function") {
      try {
        events.emit("diagnostics:completed", {
          status: report.summary.status,
          warningCount: warnings.length,
          modulesAvailable: availableCount,
          modulesChecked: modules.length
        });
      } catch (error) {
        // Diagnostics should still return its report.
      }
    }

    return report;
  }

  function getSummary() {
    const report = run();
    return { ...report.summary };
  }

  function exportJson() {
    return JSON.stringify(run(), null, 2);
  }

  function getModule(name) {
    if (
      typeof name !== "string" ||
      !MODULE_NAMES.includes(name)
    ) {
      return null;
    }

    const module = global[name];

    return {
      name,
      available: module !== undefined && module !== null,
      type: module === undefined || module === null
        ? "undefined"
        : typeof module
    };
  }

  global.SurrealDiagnostics = {
    run,
    getSummary,
    getModule,
    exportJson
  };

})(globalThis);
