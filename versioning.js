
"use strict";

/**
 * surrealscripts.ui
 * Internal module: versioning.js
 *
 * Semantic version parsing, comparison, and update detection.
 * Supports MAJOR.MINOR.PATCH versions, such as 1.2.3.
 */

(function (root) {
  const VERSION_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

  function parse(version) {
    if (typeof version !== "string") {
      throw new TypeError("Version must be a string.");
    }

    const match = VERSION_PATTERN.exec(version.trim());

    if (!match) {
      throw new Error(
        `Invalid version "${version}". Expected MAJOR.MINOR.PATCH.`
      );
    }

    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      raw: version.trim()
    };
  }

  function compare(a, b) {
    const left = parse(a);
    const right = parse(b);

    for (const field of ["major", "minor", "patch"]) {
      if (left[field] > right[field]) return 1;
      if (left[field] < right[field]) return -1;
    }

    return 0;
  }

  function isNewer(candidate, current) {
    return compare(candidate, current) > 0;
  }

  function isOlder(candidate, current) {
    return compare(candidate, current) < 0;
  }

  function getUpdateStatus(currentVersion, latestVersion) {
    const comparison = compare(latestVersion, currentVersion);

    if (comparison > 0) {
      return {
        updateAvailable: true,
        status: "update-available",
        currentVersion,
        latestVersion
      };
    }

    if (comparison < 0) {
      return {
        updateAvailable: false,
        status: "current-is-newer",
        currentVersion,
        latestVersion
      };
    }

    return {
      updateAvailable: false,
      status: "up-to-date",
      currentVersion,
      latestVersion
    };
  }

  function findUpdates(installedScripts, availableScripts) {
    if (!Array.isArray(installedScripts)) {
      throw new TypeError("installedScripts must be an array.");
    }

    if (!Array.isArray(availableScripts)) {
      throw new TypeError("availableScripts must be an array.");
    }

    const installedById = new Map();

    for (const script of installedScripts) {
      if (!script || typeof script.id !== "string") {
        throw new Error("Every installed script must have an ID.");
      }

      if (installedById.has(script.id)) {
        throw new Error(`Duplicate installed script ID: ${script.id}`);
      }

      installedById.set(script.id, script);
    }

    const seenAvailableIds = new Set();
    const updates = [];

    for (const available of availableScripts) {
      if (!available || typeof available.id !== "string") {
        throw new Error("Every available script must have an ID.");
      }

      if (seenAvailableIds.has(available.id)) {
        throw new Error(`Duplicate available script ID: ${available.id}`);
      }

      seenAvailableIds.add(available.id);

      const installed = installedById.get(available.id);

      if (!installed) continue;

      const status = getUpdateStatus(
        installed.version,
        available.version
      );

      if (status.updateAvailable) {
        updates.push({
          id: available.id,
          name: available.name || available.id,
          ...status
        });
      }
    }

    return updates;
  }

  root.SurrealVersioning = Object.freeze({
    parse,
    compare,
    isNewer,
    isOlder,
    getUpdateStatus,
    findUpdates
  });
})(globalThis);
