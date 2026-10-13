
"use strict";

/**
 * surrealscripts.ui
 * Internal module: integrity.js
 *
 * SHA-256 hashing and integrity verification.
 * Requires a secure context (HTTPS on GitHub Pages).
 *
 * SHA-256 verifies integrity; it does not encrypt data.
 */

(function (root) {
  const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

  function normalizeHash(hash) {
    if (typeof hash !== "string") {
      throw new TypeError("Expected SHA-256 hash must be a string.");
    }

    const normalized = hash.trim().toLowerCase();

    if (!SHA256_PATTERN.test(normalized)) {
      throw new Error(
        "Invalid SHA-256 digest. Expected exactly 64 hexadecimal characters."
      );
    }

    return normalized;
  }

  function requireCrypto() {
    if (
      !root.crypto ||
      !root.crypto.subtle ||
      typeof root.crypto.subtle.digest !== "function"
    ) {
      throw new Error(
        "Web Crypto is unavailable. Use HTTPS or a supported secure context."
      );
    }

    return root.crypto.subtle;
  }

  async function sha256(data) {
    const subtle = requireCrypto();

    let bytes;

    if (data instanceof ArrayBuffer) {
      bytes = data;
    } else if (ArrayBuffer.isView(data)) {
      bytes = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
    } else if (typeof data === "string") {
      bytes = new TextEncoder().encode(data);
    } else if (typeof Blob !== "undefined" && data instanceof Blob) {
      bytes = await data.arrayBuffer();
    } else {
      throw new TypeError(
        "Input must be a string, Blob, ArrayBuffer, or typed array."
      );
    }

    const digest = await subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function verify(data, expectedHash) {
    const expected = normalizeHash(expectedHash);
    const actual = await sha256(data);

    return {
      valid: actual === expected,
      expected,
      actual,
      algorithm: "SHA-256"
    };
  }

  async function verifyFile(file, expectedHash) {
    if (typeof Blob === "undefined" || !(file instanceof Blob)) {
      throw new TypeError("Expected a browser File or Blob.");
    }

    return verify(file, expectedHash);
  }

  root.SurrealIntegrity = Object.freeze({
    sha256,
    verify,
    verifyFile,
    normalizeHash
  });
})(globalThis);
