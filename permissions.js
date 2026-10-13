
"use strict";

/**
 * surrealscripts.ui
 * Internal module: permissions.js
 *
 * Centralizes client-side feature and visibility checks.
 *
 * IMPORTANT:
 * These checks do not secure files hosted on a public static site.
 * Real authorization requires a trusted backend.
 */

(function (root) {
  const DEFAULT_POLICY = Object.freeze({
    allowPublicScripts: true,
    allowPrivateMetadata: false,
    allowDownloads: true,
    allowSourceViewing: true
  });

  let policy = { ...DEFAULT_POLICY };

  function validatePolicy(nextPolicy) {
    if (
      !nextPolicy ||
      typeof nextPolicy !== "object" ||
      Array.isArray(nextPolicy)
    ) {
      throw new TypeError("Permission policy must be an object.");
    }

    const validated = { ...policy };

    for (const key of Object.keys(DEFAULT_POLICY)) {
      if (nextPolicy[key] !== undefined) {
        if (typeof nextPolicy[key] !== "boolean") {
          throw new TypeError(`${key} must be a boolean.`);
        }

        validated[key] = nextPolicy[key];
      }
    }

    return validated;
  }

  function configure(nextPolicy = {}) {
    policy = validatePolicy(nextPolicy);
    return getPolicy();
  }

  function getPolicy() {
    return { ...policy };
  }

  function canViewScript(script) {
    if (!script || typeof script !== "object") {
      return {
        allowed: false,
        reason: "invalid-script"
      };
    }

    if (script.visibility === "public") {
      return {
        allowed: policy.allowPublicScripts,
        reason: policy.allowPublicScripts
          ? "public-script"
          : "public-scripts-disabled"
      };
    }

    if (script.visibility === "private") {
      return {
        allowed: policy.allowPrivateMetadata,
        reason: policy.allowPrivateMetadata
          ? "private-metadata-enabled-client-side"
          : "private-metadata-disabled"
      };
    }

    return {
      allowed: false,
      reason: "unknown-visibility"
    };
  }

  function canDownload(script) {
    if (!policy.allowDownloads) {
      return { allowed: false, reason: "downloads-disabled" };
    }

    const visibility = canViewScript(script);

    if (!visibility.allowed) {
      return visibility;
    }

    if (!script.downloadUrl) {
      return { allowed: false, reason: "download-url-missing" };
    }

    return { allowed: true, reason: "download-allowed" };
  }

  function canViewSource(script) {
    if (!policy.allowSourceViewing) {
      return { allowed: false, reason: "source-viewing-disabled" };
    }

    const visibility = canViewScript(script);

    if (!visibility.allowed) {
      return visibility;
    }

    if (script.sourceAvailable !== true || !script.sourceUrl) {
      return { allowed: false, reason: "source-unavailable" };
    }

    return { allowed: true, reason: "source-viewing-allowed" };
  }

  function reset() {
    policy = { ...DEFAULT_POLICY };
  }

  root.SurrealPermissions = Object.freeze({
    configure,
    getPolicy,
    canViewScript,
    canDownload,
    canViewSource,
    reset
  });
})(globalThis);
