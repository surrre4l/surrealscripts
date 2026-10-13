
"use strict";

/**
 * surrealscripts.ui
 * Internal module: api.js
 *
 * Centralized network requests for static resources and APIs.
 * No UI dependencies.
 *
 * Security:
 * - HTTPS URLs only by default.
 * - No automatic retries.
 * - Does not execute response content.
 */

(function (root) {
  const DEFAULT_TIMEOUT = 15000;
  const MAX_TIMEOUT = 120000;

  function validateUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("A request URL is required.");
    }

    let url;

    try {
      url = new URL(value, root.location?.href);
    } catch {
      throw new Error("The request URL is invalid.");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Only HTTP and HTTPS URLs are supported.");
    }

    if (
      root.location &&
      root.location.protocol === "https:" &&
      url.protocol === "http:"
    ) {
      throw new Error("Insecure HTTP requests are blocked on HTTPS pages.");
    }

    if (url.username || url.password) {
      throw new Error("URLs containing credentials are not allowed.");
    }

    return url.href;
  }

  function validateTimeout(value) {
    const timeout = value === undefined
      ? DEFAULT_TIMEOUT
      : Number(value);

    if (
      !Number.isInteger(timeout) ||
      timeout < 1 ||
      timeout > MAX_TIMEOUT
    ) {
      throw new RangeError(
        `Timeout must be between 1 and ${MAX_TIMEOUT} milliseconds.`
      );
    }

    return timeout;
  }

  async function request(url, options = {}) {
    if (typeof root.fetch !== "function") {
      throw new Error("Fetch API is unavailable.");
    }

    const safeUrl = validateUrl(url);
    const timeout = validateTimeout(options.timeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException("Request aborted.", "AbortError");
      }

      options.signal.addEventListener(
        "abort",
        () => controller.abort(),
        { once: true }
      );
    }

    const headers = new Headers(options.headers || {});
    const method = String(options.method || "GET").toUpperCase();

    const fetchOptions = {
      method,
      headers,
      signal: controller.signal,
      cache: options.cache || "no-cache",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer"
    };

    if (options.body !== undefined) {
      fetchOptions.body = options.body;
    }

    try {
      const response = await root.fetch(safeUrl, fetchOptions);

      if (!response.ok) {
        const error = new Error(
          `Request failed with HTTP ${response.status}.`
        );

        error.code = "HTTP_ERROR";
        error.status = response.status;
        throw error;
      }

      return response;
    } catch (error) {
      if (root.SurrealEvents) {
        root.SurrealEvents.emit("api:request-failed", {
          url: safeUrl,
          method,
          message: error instanceof Error
            ? error.message
            : String(error)
        });
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function getJson(url, options = {}) {
    const response = await request(url, {
      ...options,
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    try {
      return await response.json();
    } catch {
      const error = new Error("Response did not contain valid JSON.");
      error.code = "INVALID_JSON";
      throw error;
    }
  }

  async function getText(url, options = {}) {
    const response = await request(url, {
      ...options,
      method: "GET"
    });

    return response.text();
  }

  root.SurrealAPI = Object.freeze({
    request,
    getJson,
    getText,
    DEFAULT_TIMEOUT
  });
})(globalThis);
