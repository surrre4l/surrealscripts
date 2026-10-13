
"use strict";

/**
 * surrealscripts.ui
 * Internal module: validator.js
 *
 * Validates the manifest structure and script metadata.
 * No UI or DOM dependencies.
 */

(function (root) {
  const SHA256_RE = /^(?:[a-fA-F0-9]{64})?$/;
  const VERSION_RE = /^\d+\.\d+\.\d+$/;
  const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const REQUIRED_SCRIPT_FIELDS = [
    "id",
    "name",
    "version",
    "type",
    "description",
    "visibility",
    "sourceAvailable"
  ];

  const ALLOWED_VISIBILITY = new Set([
    "public",
    "private"
  ]);

  const ALLOWED_ENCRYPTION_ALGORITHMS = new Set([
    "AES-256-GCM"
  ]);

  function isObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isHttpsUrlOrEmpty(value) {
    if (value === "") return true;
    if (typeof value !== "string") return false;

    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  function validateScript(script, index) {
    const errors = [];
    const warnings = [];
    const location = `scripts[${index}]`;

    if (!isObject(script)) {
      return {
        valid: false,
        errors: [`${location} must be an object.`],
        warnings
      };
    }

    for (const field of REQUIRED_SCRIPT_FIELDS) {
      if (!hasOwn(script, field)) {
        errors.push(`${location}.${field} is required.`);
      }
    }

    if (!isNonEmptyString(script.id)) {
      errors.push(`${location}.id must be a non-empty string.`);
    } else if (!ID_RE.test(script.id)) {
      errors.push(
        `${location}.id must use lowercase letters, numbers, and hyphens.`
      );
    }

    for (const field of ["name", "type"]) {
      if (!isNonEmptyString(script[field])) {
        errors.push(`${location}.${field} must be a non-empty string.`);
      }
    }

    if (typeof script.description !== "string") {
      errors.push(`${location}.description must be a string.`);
    }

    if (
      typeof script.version !== "string" ||
      !VERSION_RE.test(script.version)
    ) {
      errors.push(
        `${location}.version must follow MAJOR.MINOR.PATCH, such as 1.0.0.`
      );
    }

    if (!ALLOWED_VISIBILITY.has(script.visibility)) {
      errors.push(
        `${location}.visibility must be "public" or "private".`
      );
    }

    if (typeof script.sourceAvailable !== "boolean") {
      errors.push(`${location}.sourceAvailable must be a boolean.`);
    }

    for (const field of ["sourceUrl", "downloadUrl"]) {
      if (hasOwn(script, field) && !isHttpsUrlOrEmpty(script[field])) {
        errors.push(
          `${location}.${field} must be empty or a valid HTTPS URL.`
        );
      }
    }

    if (
      hasOwn(script, "sha256") &&
      (
        typeof script.sha256 !== "string" ||
        !SHA256_RE.test(script.sha256)
      )
    ) {
      errors.push(
        `${location}.sha256 must be empty or exactly 64 hexadecimal characters.`
      );
    }

    if (hasOwn(script, "tags")) {
      if (
        !Array.isArray(script.tags) ||
        !script.tags.every(isNonEmptyString)
      ) {
        errors.push(
          `${location}.tags must be an array of non-empty strings.`
        );
      } else if (new Set(script.tags).size !== script.tags.length) {
        errors.push(`${location}.tags must not contain duplicates.`);
      }
    }

    if (hasOwn(script, "metadata") && !isObject(script.metadata)) {
      errors.push(`${location}.metadata must be an object.`);
    }

    if (hasOwn(script, "encryption")) {
      const encryption = script.encryption;

      if (!isObject(encryption)) {
        errors.push(`${location}.encryption must be an object.`);
      } else {
        if (typeof encryption.enabled !== "boolean") {
          errors.push(
            `${location}.encryption.enabled must be a boolean.`
          );
        }

        if (
          !ALLOWED_ENCRYPTION_ALGORITHMS.has(encryption.algorithm)
        ) {
          errors.push(
            `${location}.encryption.algorithm must be "AES-256-GCM".`
          );
        }

        if (
          hasOwn(encryption, "keyReference") &&
          typeof encryption.keyReference !== "string"
        ) {
          errors.push(
            `${location}.encryption.keyReference must be a string.`
          );
        }

        if (
          isObject(encryption) &&
          encryption.enabled === true &&
          !isNonEmptyString(encryption.keyReference)
        ) {
          warnings.push(
            `${location} enables encryption but has no key reference.`
          );
        }
      }
    }

    if (
      script.visibility === "private"
    ) {
      warnings.push(
        `${location} is marked private; this label does not enforce access control.`
      );
    }

    if (
      script.sourceAvailable === false &&
      isNonEmptyString(script.sourceUrl)
    ) {
      warnings.push(
        `${location} says source is unavailable but specifies a source URL.`
      );
    }

    if (
      script.sourceAvailable === false &&
      isNonEmptyString(script.downloadUrl)
    ) {
      warnings.push(
        `${location} has a download URL even though sourceAvailable is false. Verify what the URL provides.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  function validateManifest(manifest) {
    const errors = [];
    const warnings = [];

    if (!isObject(manifest)) {
      return {
        valid: false,
        errors: ["Manifest must be a JSON object."],
        warnings,
        scriptCount: 0
      };
    }

    const allowedRootFields = new Set([
      "schemaVersion",
      "scripts"
    ]);

    for (const key of Object.keys(manifest)) {
      if (!allowedRootFields.has(key)) {
        errors.push(`Unknown manifest field: "${key}".`);
      }
    }

    if (manifest.schemaVersion !== 1) {
      errors.push("schemaVersion must be 1.");
    }

    if (!Array.isArray(manifest.scripts)) {
      errors.push('Manifest "scripts" must be an array.');

      return {
        valid: false,
        errors,
        warnings,
        scriptCount: 0
      };
    }

    const seenIds = new Set();

    manifest.scripts.forEach((script, index) => {
      const result = validateScript(script, index);

      errors.push(...result.errors);
      warnings.push(...result.warnings);

      if (isObject(script) && isNonEmptyString(script.id)) {
        if (seenIds.has(script.id)) {
          errors.push(`Duplicate script ID: "${script.id}".`);
        } else {
          seenIds.add(script.id);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      scriptCount: manifest.scripts.length
    };
  }

  root.SurrealValidator = Object.freeze({
    validateScript,
    validateManifest
  });
})(globalThis);
