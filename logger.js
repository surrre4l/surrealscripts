
"use strict";

/**
 * surrealscripts.ui
 * Internal module: logger.js
 *
 * Configurable diagnostic logger.
 * No UI or DOM dependencies.
 *
 * Levels, from least to most severe:
 * debug, info, warn, error
 */

(function (root) {
  const LEVELS = Object.freeze({
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
  });

  let currentLevel = "info";
  let enabled = true;
  let includeTimestamp = true;
  let includeModule = true;

  function setLevel(level) {
    if (!Object.prototype.hasOwnProperty.call(LEVELS, level)) {
      throw new Error(
        `Invalid log level "${level}". Use debug, info, warn, or error.`
      );
    }

    currentLevel = level;
  }

  function configure(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Logger options must be an object.");
    }

    if (options.level !== undefined) {
      setLevel(options.level);
    }

    if (options.enabled !== undefined) {
      if (typeof options.enabled !== "boolean") {
        throw new TypeError("enabled must be a boolean.");
      }

      enabled = options.enabled;
    }

    if (options.includeTimestamp !== undefined) {
      includeTimestamp = Boolean(options.includeTimestamp);
    }

    if (options.includeModule !== undefined) {
      includeModule = Boolean(options.includeModule);
    }

    return getConfig();
  }

  function getConfig() {
    return {
      level: currentLevel,
      enabled,
      includeTimestamp,
      includeModule
    };
  }

  function shouldLog(level) {
    return enabled && LEVELS[level] >= LEVELS[currentLevel];
  }

  function safeConsoleMethod(level) {
    if (typeof console === "undefined") return null;

    const method = level === "debug" ? "debug" : level;

    return typeof console[method] === "function"
      ? console[method].bind(console)
      : typeof console.log === "function"
        ? console.log.bind(console)
        : null;
  }

  function log(level, message, context = {}) {
    if (!Object.prototype.hasOwnProperty.call(LEVELS, level)) {
      throw new Error(`Unknown log level: ${level}`);
    }

    if (!shouldLog(level)) return false;

    const details =
      context && typeof context === "object" && !Array.isArray(context)
        ? context
        : { value: context };

    const prefix = [];

    if (includeTimestamp) {
      prefix.push(new Date().toISOString());
    }

    prefix.push(`[${level.toUpperCase()}]`);

    if (includeModule && details.module) {
      prefix.push(`[${String(details.module)}]`);
    }

    const output = prefix.join(" ");

    const method = safeConsoleMethod(level);

    if (method) {
      method(output, message, details.data ?? "");
    }

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("log:entry", {
        level,
        message: String(message),
        context: details,
        timestamp: new Date().toISOString()
      });
    }

    return true;
  }

  function debug(message, context) {
    return log("debug", message, context);
  }

  function info(message, context) {
    return log("info", message, context);
  }

  function warn(message, context) {
    return log("warn", message, context);
  }

  function error(message, context) {
    return log("error", message, context);
  }

  function reset() {
    currentLevel = "info";
    enabled = true;
    includeTimestamp = true;
    includeModule = true;
  }

  root.SurrealLogger = Object.freeze({
    LEVELS,
    configure,
    getConfig,
    log,
    debug,
    info,
    warn,
    error,
    reset
  });
})(globalThis);
