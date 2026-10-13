
"use strict";

/**
 * surrealscripts.ui
 * Internal module: config.js
 *
 * Shared, non-secret configuration.
 * Never put passwords, private keys, or access tokens here.
 */

(function (root) {
  const config = {
    productName: "surrealscripts.ui",
    manifestPath: "./scripts.json",
    schemaPath: "./script.schema.json",

    schemaVersion: 1,

    integrity: {
      algorithm: "SHA-256",
      requireExpectedHashForVerification: true
    },

    encryption: {
      algorithm: "AES-256-GCM",
      keyLengthBits: 256,
      nonceLengthBytes: 12,
      authenticationTagLengthBits: 128
    },

    validation: {
      rejectDuplicateIds: true,
      allowedVisibility: ["public", "private"],
      allowedVersionFormat: "MAJOR.MINOR.PATCH"
    },

    limits: {
      maxManifestBytes: 5 * 1024 * 1024,
      maxScripts: 10000,
      maxDescriptionLength: 10000,
      maxTagsPerScript: 100
    }
  };

  root.SurrealConfig = Object.freeze({
    ...config,
    integrity: Object.freeze({ ...config.integrity }),
    encryption: Object.freeze({ ...config.encryption }),
    validation: Object.freeze({
      ...config.validation,
      allowedVisibility: Object.freeze([
        ...config.validation.allowedVisibility
      ])
    }),
    limits: Object.freeze({ ...config.limits })
  });
})(globalThis);
