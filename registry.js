
"use strict";

/**
 * surrealscripts.ui
 * Internal module: registry.js
 *
 * Provides in-memory script lookup, searching, and filtering.
 *
 * Dependency:
 * - manifest.js (optional; can also accept an array directly)
 *
 * This module does not execute or download script source code.
 */

(function (root) {
  let scripts = [];
  let indexById = new Map();

  function cloneScript(script) {
    return {
      ...script,
      tags: Array.isArray(script.tags) ? [...script.tags] : [],
      metadata:
        script.metadata &&
        typeof script.metadata === "object" &&
        !Array.isArray(script.metadata)
          ? { ...script.metadata }
          : script.metadata
    };
  }

  function rebuildIndex() {
    indexById = new Map();

    for (const script of scripts) {
      if (indexById.has(script.id)) {
        throw new Error(`Duplicate script ID: ${script.id}`);
      }

      indexById.set(script.id, script);
    }
  }

  function setScripts(input) {
    if (!Array.isArray(input)) {
      throw new TypeError("Registry input must be an array.");
    }

    const nextScripts = input.map((script) => {
      if (!script || typeof script !== "object" || Array.isArray(script)) {
        throw new Error("Every registry entry must be an object.");
      }

      if (typeof script.id !== "string" || !script.id.trim()) {
        throw new Error("Every registry entry must have a valid ID.");
      }

      if (typeof script.name !== "string" || !script.name.trim()) {
        throw new Error(`Script "${script.id}" must have a name.`);
      }

      return cloneScript(script);
    });

    const nextIds = new Set();

    for (const script of nextScripts) {
      if (nextIds.has(script.id)) {
        throw new Error(`Duplicate script ID: ${script.id}`);
      }

      nextIds.add(script.id);
    }

    scripts = nextScripts;
    rebuildIndex();

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("registry:updated", {
        count: scripts.length
      });
    }

    return list();
  }

  function syncFromManifest() {
    if (!root.SurrealManifest) {
      throw new Error("SurrealManifest is unavailable.");
    }

    const manifest = root.SurrealManifest.get();

    if (!manifest) {
      throw new Error("No manifest has been loaded.");
    }

    return setScripts(manifest.scripts);
  }

  function list() {
    return scripts.map(cloneScript);
  }

  function getById(id) {
    if (typeof id !== "string") {
      throw new TypeError("Script ID must be a string.");
    }

    const script = indexById.get(id);
    return script ? cloneScript(script) : null;
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function search(query, options = {}) {
    const term = normalizeText(query);
    const type = normalizeText(options.type);
    const visibility = normalizeText(options.visibility);
    const tag = normalizeText(options.tag);

    return scripts
      .filter((script) => {
        const searchableText = [
          script.id,
          script.name,
          script.description,
          ...(Array.isArray(script.tags) ? script.tags : [])
        ]
          .map(normalizeText)
          .join(" ");

        if (term && !searchableText.includes(term)) return false;
        if (type && normalizeText(script.type) !== type) return false;

        if (
          visibility &&
          normalizeText(script.visibility) !== visibility
        ) {
          return false;
        }

        if (tag) {
          const tags = Array.isArray(script.tags)
            ? script.tags.map(normalizeText)
            : [];

          if (!tags.includes(tag)) return false;
        }

        if (
          typeof options.sourceAvailable === "boolean" &&
          script.sourceAvailable !== options.sourceAvailable
        ) {
          return false;
        }

        return true;
      })
      .map(cloneScript);
  }

  function getByTag(tag) {
    const normalizedTag = normalizeText(tag);

    if (!normalizedTag) {
      throw new Error("A tag is required.");
    }

    return search("", { tag: normalizedTag });
  }

  function count() {
    return scripts.length;
  }

  function has(id) {
    return indexById.has(id);
  }

  function clear() {
    scripts = [];
    indexById.clear();

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("registry:updated", { count: 0 });
    }
  }

  root.SurrealRegistry = Object.freeze({
    setScripts,
    syncFromManifest,
    list,
    getById,
    search,
    getByTag,
    count,
    has,
    clear
  });
})(globalThis);
