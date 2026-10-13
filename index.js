
/*========================================================
  SURREALSCRIPTS.UI — CENTRAL ENTRY POINT
  File: index.js

  Responsibilities:
  - Expose a central API for internal modules.
  - Provide module lookup and availability checks.
  - Start the bootstrap process when requested.
  - Provide diagnostics access.
  - Keep module initialization explicit.

  Load this file after the other internal modules.
  This file does not create UI or execute hosted scripts.
========================================================*/

(function (global) {
  "use strict";

  const MODULE_MAP = Object.freeze({
    config: "SurrealConfig",
    errors: "SurrealErrors",
    logger: "SurrealLogger",
    events: "SurrealEvents",
    storage: "SurrealStorage",
    validator: "SurrealValidator",
    integrity: "SurrealIntegrity",
    security: "SurrealSecurity",
    versioning: "SurrealVersioning",
    api: "SurrealAPI",
    manifest: "SurrealManifest",
    registry: "SurrealRegistry",
    permissions: "SurrealPermissions",
    cache: "SurrealCache",
    search: "SurrealSearch",
    downloads: "SurrealDownloads",
    updates: "SurrealUpdates",
    settings: "SurrealSettings",
    notifications: "SurrealNotifications",
    runtime: "SurrealRuntime",
    bootstrap: "SurrealBootstrap",
    diagnostics: "SurrealDiagnostics"
  });

  function getModule(name) {
    if (
      typeof name !== "string" ||
      !Object.prototype.hasOwnProperty.call(MODULE_MAP, name)
    ) {
      return null;
    }

    const globalName = MODULE_MAP[name];
    const moduleApi = global[globalName];

    if (moduleApi === undefined || moduleApi === null) {
      return null;
    }

    return moduleApi;
  }

  function hasModule(name) {
    return getModule(name) !== null;
  }

  function listModules() {
    return Object.keys(MODULE_MAP).map(function (name) {
      const globalName = MODULE_MAP[name];
      const available =
        global[globalName] !== undefined &&
        global[globalName] !== null;

      return {
        name,
        globalName,
        available
      };
    });
  }

  function getAvailableModules() {
    return listModules()
      .filter(function (module) {
        return module.available;
      })
      .map(function (module) {
        return module.name;
      });
  }

  function getMissingModules() {
    return listModules()
      .filter(function (module) {
        return !module.available;
      })
      .map(function (module) {
        return module.name;
      });
  }

  async function start(options) {
    const bootstrap = getModule("bootstrap");

    if (!bootstrap || typeof bootstrap.start !== "function") {
      throw new Error(
        "SurrealBootstrap is unavailable. Load bootstrap.js first."
      );
    }

    return bootstrap.start(options || {});
  }

  function diagnose() {
    const diagnostics = getModule("diagnostics");

    if (!diagnostics || typeof diagnostics.run !== "function") {
      throw new Error(
        "SurrealDiagnostics is unavailable. Load diagnostics.js first."
      );
    }

    return diagnostics.run();
  }

  function getStatus() {
    const bootstrap = getModule("bootstrap");

    return {
      started: Boolean(
        bootstrap &&
        typeof bootstrap.isReady === "function" &&
        bootstrap.isReady()
      ),
      bootstrapStatus:
        bootstrap &&
        typeof bootstrap.getStatus === "function"
          ? bootstrap.getStatus()
          : "unavailable",
      availableModules: getAvailableModules(),
      missingModules: getMissingModules()
    };
  }

  const Surreal = Object.freeze({
    product: "surrealscripts.ui",
    version: "1.0.0",

    getModule,
    hasModule,
    listModules,
    getAvailableModules,
    getMissingModules,
    getStatus,
    start,
    diagnose
  });

  global.Surreal = Surreal;

})(globalThis);
