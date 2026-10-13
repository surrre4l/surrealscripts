
"use strict";

/**
 * surrealscripts.ui
 * Internal module: search.js
 *
 * Searches, filters, and sorts script metadata.
 *
 * Dependency:
 * - registry.js
 *
 * This module does not access the DOM or execute script source.
 */

(function (root) {
  const SORT_OPTIONS = new Set([
    "name-asc",
    "name-desc",
    "version-asc",
    "version-desc",
    "id-asc",
    "id-desc"
  ]);

  function getRegistry() {
    if (!root.SurrealRegistry) {
      throw new Error("SurrealRegistry is unavailable.");
    }

    return root.SurrealRegistry;
  }

  function normalize(value) {
    return String(value ?? "").trim().toLocaleLowerCase();
  }

  function compareText(a, b) {
    return String(a ?? "").localeCompare(
      String(b ?? ""),
      undefined,
      { sensitivity: "base", numeric: true }
    );
  }

  function compareVersions(a, b) {
    if (root.SurrealVersioning) {
      try {
        return root.SurrealVersioning.compare(
          String(a),
          String(b)
        );
      } catch {
        // Invalid or missing versions are handled below.
      }
    }

    return compareText(a, b);
  }

  function matchesQuery(script, query) {
    if (!query) return true;

    const searchableFields = [
      script.id,
      script.name,
      script.description,
      script.type,
      script.version,
      ...(Array.isArray(script.tags) ? script.tags : [])
    ];

    return searchableFields.some((field) =>
      normalize(field).includes(query)
    );
  }

  function matchesFilters(script, filters) {
    if (
      filters.type &&
      normalize(script.type) !== normalize(filters.type)
    ) {
      return false;
    }

    if (
      filters.visibility &&
      normalize(script.visibility) !== normalize(filters.visibility)
    ) {
      return false;
    }

    if (
      typeof filters.sourceAvailable === "boolean" &&
      script.sourceAvailable !== filters.sourceAvailable
    ) {
      return false;
    }

    if (filters.tag) {
      const tags = Array.isArray(script.tags)
        ? script.tags.map(normalize)
        : [];

      if (!tags.includes(normalize(filters.tag))) {
        return false;
      }
    }

    if (filters.id && normalize(script.id) !== normalize(filters.id)) {
      return false;
    }

    return true;
  }

  function sortScripts(scripts, sortBy) {
    const mode = SORT_OPTIONS.has(sortBy) ? sortBy : "name-asc";
    const sorted = [...scripts];

    sorted.sort((a, b) => {
      let result;

      switch (mode) {
        case "name-desc":
          result = compareText(b.name, a.name);
          break;
        case "version-asc":
          result = compareVersions(a.version, b.version);
          break;
        case "version-desc":
          result = compareVersions(b.version, a.version);
          break;
        case "id-asc":
          result = compareText(a.id, b.id);
          break;
        case "id-desc":
          result = compareText(b.id, a.id);
          break;
        case "name-asc":
        default:
          result = compareText(a.name, b.name);
          break;
      }

      // Use the ID as a stable tie-breaker.
      return result || compareText(a.id, b.id);
    });

    return sorted;
  }

  function search(options = {}) {
    const registry = getRegistry();
    const query = normalize(options.query);
    const filters = options.filters || {};

    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
      throw new TypeError("filters must be an object.");
    }

    let results = registry.list().filter((script) => {
      return (
        matchesQuery(script, query) &&
        matchesFilters(script, filters)
      );
    });

    results = sortScripts(results, options.sortBy);

    if (options.limit !== undefined) {
      const limit = Number(options.limit);

      if (!Number.isInteger(limit) || limit < 0) {
        throw new Error("limit must be a non-negative integer.");
      }

      results = results.slice(0, limit);
    }

    return {
      query: options.query || "",
      total: registry.list().filter((script) => {
        return (
          matchesQuery(script, query) &&
          matchesFilters(script, filters)
        );
      }).length,
      count: results.length,
      sortBy: SORT_OPTIONS.has(options.sortBy)
        ? options.sortBy
        : "name-asc",
      results
    };
  }

  function suggest(query, limit = 5) {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) return [];

    const result = search({
      query: normalizedQuery,
      sortBy: "name-asc",
      limit
    });

    return result.results.map((script) => ({
      id: script.id,
      name: script.name,
      version: script.version,
      type: script.type
    }));
  }

  root.SurrealSearch = Object.freeze({
    search,
    suggest,
    sortScripts
  });
})(globalThis);
