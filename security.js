
"use strict";

/**
 * surrealscripts.ui
 * Internal module: security.js
 *
 * AES-256-GCM encryption and decryption.
 * Requires Web Crypto in a secure context, such as HTTPS.
 *
 * Keep CryptoKey objects and secret key material out of public repositories.
 */

(function (root) {
  const ALGORITHM = "AES-GCM";
  const KEY_LENGTH = 256;
  const IV_LENGTH = 12;
  const TAG_LENGTH = 128;
  const FORMAT_VERSION = 1;

  function getSubtleCrypto() {
    if (!root.crypto || !root.crypto.subtle) {
      throw new Error(
        "Web Crypto is unavailable. Use a supported HTTPS environment."
      );
    }

    return root.crypto.subtle;
  }

  function toBase64(bytes) {
    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary);
  }

  function fromBase64(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError("Expected a non-empty Base64 string.");
    }

    const binary = atob(value);

    return Uint8Array.from(binary, character =>
      character.charCodeAt(0)
    );
  }

  async function generateKey() {
    return getSubtleCrypto().generateKey(
      {
        name: ALGORITHM,
        length: KEY_LENGTH
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async function exportKey(key) {
    if (!key || key.type !== "secret") {
      throw new TypeError("Expected an AES secret key.");
    }

    const raw = await getSubtleCrypto().exportKey("raw", key);
    return toBase64(new Uint8Array(raw));
  }

  async function importKey(base64Key) {
    const raw = fromBase64(base64Key);

    if (raw.byteLength !== KEY_LENGTH / 8) {
      throw new Error("AES-256 keys must contain exactly 32 bytes.");
    }

    return getSubtleCrypto().importKey(
      "raw",
      raw,
      { name: ALGORITHM },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(plaintext, key) {
    if (typeof plaintext !== "string") {
      throw new TypeError("Plaintext must be a string.");
    }

    if (!key || key.type !== "secret") {
      throw new TypeError("Expected an AES secret key.");
    }

    const iv = root.crypto.getRandomValues(
      new Uint8Array(IV_LENGTH)
    );

    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await getSubtleCrypto().encrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH
      },
      key,
      encoded
    );

    return {
      version: FORMAT_VERSION,
      algorithm: "AES-256-GCM",
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext))
    };
  }

  async function decrypt(encryptedData, key) {
    if (!encryptedData || typeof encryptedData !== "object") {
      throw new TypeError("Encrypted data must be an object.");
    }

    if (encryptedData.version !== FORMAT_VERSION) {
      throw new Error("Unsupported encrypted-data format version.");
    }

    if (encryptedData.algorithm !== "AES-256-GCM") {
      throw new Error("Unsupported encryption algorithm.");
    }

    if (!key || key.type !== "secret") {
      throw new TypeError("Expected an AES secret key.");
    }

    const iv = fromBase64(encryptedData.iv);
    const ciphertext = fromBase64(encryptedData.ciphertext);

    if (iv.byteLength !== IV_LENGTH) {
      throw new Error("Invalid AES-GCM nonce length.");
    }

    const plaintext = await getSubtleCrypto().decrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  }

  root.SurrealSecurity = Object.freeze({
    generateKey,
    exportKey,
    importKey,
    encrypt,
    decrypt
  });
})(globalThis);
