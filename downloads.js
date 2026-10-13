
"use strict";

/**
 * surrealscripts.ui
 * Internal module: downloads.js
 *
 * Validates download URLs, exposes download metadata,
 * and initiates browser downloads when explicitly requested.
 *
 * Dependencies:
 * - registry.js
 * - integrity.js (optional)
 *
 * Security:
 * - HTTPS URLs only.
 * - Does not execute downloaded content.
 * - A URL's presence does not prove that a file is trustworthy.
 */

(function (root) {
  function getScript(scriptId) {
    if (!root.SurrealRegistry) {
      throw new Error("SurrealRegistry is unavailable.");
    }

    const script = root.SurrealRegistry.getById(scriptId);

    if (!script) {
      throw new Error(`Unknown script ID: ${scriptId}`);
    }

    return script;
  }

  function validateDownloadUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("A download URL is required.");
    }

    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error("The download URL is invalid.");
    }

    if (url.protocol !== "https:") {
      throw new Error("Only HTTPS download URLs are allowed.");
    }

    if (url.username || url.password) {
      throw new Error("URLs containing credentials are not allowed.");
    }

    return url.href;
  }

  function getDownloadInfo(scriptId) {
    const script = getScript(scriptId);

    if (!script.downloadUrl) {
      return {
        available: false,
        scriptId: script.id,
        name: script.name,
        version: script.version,
        url: null,
        sha256: script.sha256 || null
      };
    }

    let url;

    try {
      url = validateDownloadUrl(script.downloadUrl);
    } catch (error) {
      return {
        available: false,
        scriptId: script.id,
        name: script.name,
        version: script.version,
        url: null,
        sha256: script.sha256 || null,
        error: error.message
      };
    }

    return {
      available: true,
      scriptId: script.id,
      name: script.name,
      version: script.version,
      url,
      sha256: script.sha256 || null
    };
  }

  function createFilename(script) {
    const safeId = script.id
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);

    const safeVersion = String(script.version || "unknown")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 40);

    return `${safeId}-${safeVersion}.download`;
  }

  function startDownload(scriptId) {
    if (typeof document === "undefined") {
      throw new Error("Browser document is unavailable.");
    }

    const info = getDownloadInfo(scriptId);

    if (!info.available) {
      throw new Error(
        info.error || "This script has no valid download URL."
      );
    }

    const anchor = document.createElement("a");
    anchor.href = info.url;
    anchor.download = createFilename(getScript(scriptId));
    anchor.rel = "noopener noreferrer";
    anchor.referrerPolicy = "no-referrer";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("download:requested", {
        scriptId: info.scriptId,
        version: info.version
      });
    }

    return {
      requested: true,
      scriptId: info.scriptId,
      version: info.version,
      url: info.url
    };
  }

  root.SurrealDownloads = Object.freeze({
    validateDownloadUrl,
    getDownloadInfo,
    startDownload
  });
})(globalThis);
