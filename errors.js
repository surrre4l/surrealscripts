
"use strict";

/**
 * surrealscripts.ui
 * Internal module: errors.js
 *
 * Standardizes errors across internal modules.
 * No UI, DOM, or network dependencies.
 */

(function (root) {
  const ERROR_CODES = Object.freeze({
    UNKNOWN: "UNKNOWN",
    INVALID_INPUT: "INVALID_INPUT",
    VALIDATION_FAILED: "VALIDATION_FAILED",
    MANIFEST_LOAD_FAILED: "MANIFEST_LOAD_FAILED",
    MANIFEST_NOT_LOADED: "MANIFEST_NOT_LOADED",
    SCRIPT_NOT_FOUND: "SCRIPT_NOT_FOUND",
    DUPLICATE_SCRIPT_ID: "DUPLICATE_SCRIPT_ID",
    INVALID_VERSION: "INVALID_VERSION",
    DOWNLOAD_UNAVAILABLE: "DOWNLOAD_UNAVAILABLE",
    INTEGRITY_FAILED: "INTEGRITY_FAILED",
    SECURITY_FAILED: "SECURITY_FAILED",
    STORAGE_FAILED: "STORAGE_FAILED",
    NETWORK_FAILED: "NETWORK_FAILED",
    DEPENDENCY_MISSING: "DEPENDENCY_MISSING"
  });

  class SurrealError extends Error {
    constructor(message, options = {}) {
      super(message);

      this.name = "SurrealError";
      this.code = options.code || ERROR_CODES.UNKNOWN;
      this.module = options.module || "core";
      this.details = options.details ?? null;
      this.recoverable = options.recoverable ?? false;

      if (options.cause !== undefined) {
        this.cause = options.cause;
      }

      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, SurrealError);
      }
    }

    toJSON() {
      return {
        name: this.name,
        message: this.message,
        code: this.code,
        module: this.module,
        details: this.details,
        recoverable: this.recoverable
      };
    }
  }

  function create(code, message, options = {}) {
    if (typeof message !== "string" || !message.trim()) {
      throw new TypeError("An error message is required.");
    }

    return new SurrealError(message, {
      ...options,
      code: Object.values(ERROR_CODES).includes(code)
        ? code
        : ERROR_CODES.UNKNOWN
    });
  }

  function normalize(error, options = {}) {
    if (error instanceof SurrealError) {
      return error;
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "An unexpected error occurred.";

    return create(
      options.code || ERROR_CODES.UNKNOWN,
      message,
      {
        module: options.module || "core",
        details: options.details ?? null,
        recoverable: options.recoverable ?? false,
        cause: error
      }
    );
  }

  function serialize(error) {
    return normalize(error).toJSON();
  }

  function report(error, options = {}) {
    const normalized = normalize(error, options);
    const payload = normalized.toJSON();

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("error:reported", payload);
    }

    return normalized;
  }

  function isCode(error, code) {
    return Boolean(error && error.code === code);
  }

  root.SurrealErrors = Object.freeze({
    ERROR_CODES,
    SurrealError,
    create,
    normalize,
    serialize,
    report,
    isCode
  });
})(globalThis);
