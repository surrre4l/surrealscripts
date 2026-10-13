
/*========================================================
  SURREALSCRIPTS.UI — BOOTSTRAP MODULE
  File: bootstrap.js

  Responsibilities:
  - Check required internal modules.
  - Initialize modules in dependency order.
  - Report missing modules and startup failures.
  - Prevent duplicate initialization.
  - Expose startup status for the future UI.

  Load this file after the other internal modules.
  This module does not create UI or execute hosted scripts.
========================================================*/

(function (global) {
  "use strict";

  const STATUS = Object.freeze({
    IDLE: "idle",
    STARTING: "starting",
    READY: "ready",
    DEGRADED: "degraded",
    FAILED: "failed"
  });

  /*
   * Modules are listed in dependency order.
   * Optional modules may be absent without stopping startup.
   *
   * Add a module here only when its global API and
   * initialization contract are defined.
   */
  const MODULES = [
    {
      name: "SurrealConfig",
      required: true
    },
    {
      name: "SurrealErrors",
      required: false
    },
    {
      name: "SurrealLogger",
      required: false
    },
    {
      name: "SurrealEvents",
      required: false
    },
    {
      name: "SurrealStorage",
      required: false
    },
    {
      name: "SurrealValidator",
      required: true
    },
    {
      name: "SurrealIntegrity",
      required: false
    },
    {
      name: "SurrealSecurity",
      required: false
    },
    {
      name: "SurrealVersioning",
      required: false
    },
    {
      name: "SurrealAPI",
      required: false
    },
    {
      name: "SurrealManifest",
      required: false
    },
    {
      name: "SurrealRegistry",
      required: false
    },
    {
      name: "SurrealPermissions",
      required: false
    },
    {
      name: "SurrealCache",
      required: false
    },
    {
      name: "SurrealSearch",
      required: false
    },
    {
      name: "SurrealDownloads",
      required: false
    },
    {
      name: "SurrealUpdates",
      required: false
    },
    {
      name: "SurrealSettings",
      required: false
    },
    {
      name: "SurrealNotifications",
      required: false
    },
    {
      name: "SurrealRuntime",
      required: false
    }
  ];

  let status = STATUS.IDLE;
  let startupPromise = null;
  let lastReport = null;

  function timestamp() {
    return new Date().toISOString();
  }

  function log(level, message, details) {
    const logger = global.SurrealLogger;

    if (
      logger &&
      typeof logger[level] === "function"
    ) {
      try {
        logger[level](message, details);
        return;
      } catch (error) {
        // Fall back to the browser console.
      }
    }

    const consoleMethod =
      typeof console[level] === "function"
        ? console[level]
        : console.log;

    consoleMethod.call(console, message, details || "");
  }

  function emit(name, details) {
    const events = global.SurrealEvents;

    if (events && typeof events.emit === "function") {
      try {
        events.emit(name, details);
      } catch (error) {
        log(
          "warn",
          "A bootstrap event listener failed.",
          { event: name }
        );
      }
    }
  }

  function getModuleStatus() {
    return MODULES.map(function (entry) {
      const api = global[entry.name];

      return {
        name: entry.name,
        required: entry.required,
        available: api !== undefined && api !== null,
        type: typeof api
      };
    });
  }

  function getMissingRequiredModules(moduleStatus) {
    return moduleStatus.filter(function (entry) {
      return entry.required && !entry.available;
    });
  }

  function getMissingOptionalModules(moduleStatus) {
    return moduleStatus.filter(function (entry) {
      return !entry.required && !entry.available;
    });
  }

  function makeReport(
    startedAt,
    finishedAt,
    moduleStatus,
    errors
  ) {
    const missingRequired =
      getMissingRequiredModules(moduleStatus);

    const missingOptional =
      getMissingOptionalModules(moduleStatus);

    let resultStatus = STATUS.READY;

    if (missingRequired.length > 0) {
      resultStatus = STATUS.FAILED;
    } else if (
      missingOptional.length > 0 ||
      errors.length > 0
    ) {
      resultStatus = STATUS.DEGRADED;
    }

    return {
      product: "surrealscripts.ui",
      status: resultStatus,
      startedAt,
      finishedAt,
      durationMs:
        Date.parse(finishedAt) - Date.parse(startedAt),
      modules: moduleStatus,
      missingRequired: missingRequired.map(function (item) {
        return item.name;
      }),
      missingOptional: missingOptional.map(function (item) {
        return item.name;
      }),
      errors: errors.map(function (error) {
        return {
          module: error.module,
          message: error.message
        };
      })
    };
  }

  async function start(options = {}) {
    if (status === STATUS.STARTING && startupPromise) {
      return startupPromise;
    }

    if (
      status === STATUS.READY ||
      status === STATUS.DEGRADED
    ) {
      if (options.force !== true) {
        return getReport();
      }
    }

    status = STATUS.STARTING;

    startupPromise = (async function () {
      const startedAt = timestamp();
      const errors = [];

      log("info", "SurrealScripts startup started.");

      emit("bootstrap:starting", {
        startedAt
      });

      /*
       * Give settings a chance to load saved preferences.
       * Other modules are checked for availability only:
       * they do not all share a common init() interface.
       */
      const settings = global.SurrealSettings;

      if (
        settings &&
        typeof settings.load === "function"
      ) {
        try {
          settings.load();
        } catch (error) {
          errors.push({
            module: "SurrealSettings",
            message: error.message || "Settings load failed."
          });
        }
      }

      const moduleStatus = getModuleStatus();

      const report = makeReport(
        startedAt,
        timestamp(),
        moduleStatus,
        errors
      );

      status = report.status;
      lastReport = report;

      if (status === STATUS.FAILED) {
        log(
          "error",
          "SurrealScripts startup failed: required modules are missing.",
          report.missingRequired
        );

        emit("bootstrap:failed", report);
      } else if (status === STATUS.DEGRADED) {
        log(
          "warn",
          "SurrealScripts started with missing optional modules or warnings.",
          report
        );

        emit("bootstrap:degraded", report);
      } else {
        log("info", "SurrealScripts startup completed.");

        emit("bootstrap:ready", report);
      }

      return getReport();
    })();

    try {
      return await startupPromise;
    } finally {
      startupPromise = null;
    }
  }

  function getReport() {
    if (!lastReport) {
      return {
        product: "surrealscripts.ui",
        status,
        modules: getModuleStatus(),
        missingRequired: [],
        missingOptional: [],
        errors: []
      };
    }

    return {
      ...lastReport,
      modules: lastReport.modules.map(function (item) {
        return { ...item };
      }),
      missingRequired: [
        ...lastReport.missingRequired
      ],
      missingOptional: [
        ...lastReport.missingOptional
      ],
      errors: lastReport.errors.map(function (item) {
        return { ...item };
      })
    };
  }

  function getStatus() {
    return status;
  }

  function getModuleDefinitions() {
    return MODULES.map(function (item) {
      return { ...item };
    });
  }

  function isReady() {
    return (
      status === STATUS.READY ||
      status === STATUS.DEGRADED
    );
  }

  function reset() {
    if (status === STATUS.STARTING) {
      throw new Error(
        "Cannot reset bootstrap while startup is running."
      );
    }

    status = STATUS.IDLE;
    startupPromise = null;
    lastReport = null;

    emit("bootstrap:reset", {
      timestamp: timestamp()
    });

    return getReport();
  }

  global.SurrealBootstrap = {
    STATUS,
    start,
    getReport,
    getStatus,
    getModuleDefinitions,
    isReady,
    reset
  };

})(globalThis);
