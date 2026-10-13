
"use strict";

/**
 * surrealscripts.ui
 * Internal module: events.js
 *
 * Lightweight event emitter for internal modules.
 * No UI or DOM dependencies.
 */

(function (root) {
  const listeners = new Map();
  const MAX_EVENT_NAME_LENGTH = 100;

  function validateEventName(name) {
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      name.length > MAX_EVENT_NAME_LENGTH
    ) {
      throw new TypeError(
        "Event name must be a non-empty string of at most 100 characters."
      );
    }
  }

  function on(name, callback) {
    validateEventName(name);

    if (typeof callback !== "function") {
      throw new TypeError("Event callback must be a function.");
    }

    if (!listeners.has(name)) {
      listeners.set(name, new Set());
    }

    const callbacks = listeners.get(name);
    callbacks.add(callback);

    // Return an unsubscribe function.
    return function unsubscribe() {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        listeners.delete(name);
      }
    };
  }

  function once(name, callback) {
    let unsubscribe = null;

    unsubscribe = on(name, function oneTimeListener(payload) {
      unsubscribe();
      callback(payload);
    });

    return unsubscribe;
  }

  function emit(name, payload) {
    validateEventName(name);

    const callbacks = listeners.get(name);

    if (!callbacks || callbacks.size === 0) {
      return {
        emitted: false,
        listenerCount: 0
      };
    }

    // Snapshot the set so listeners may unsubscribe safely.
    const snapshot = Array.from(callbacks);
    const errors = [];

    for (const callback of snapshot) {
      try {
        callback(payload);
      } catch (error) {
        errors.push(error);
      }
    }

    return {
      emitted: true,
      listenerCount: snapshot.length,
      errors
    };
  }

  function off(name, callback) {
    validateEventName(name);

    const callbacks = listeners.get(name);

    if (!callbacks) {
      return false;
    }

    const removed = callbacks.delete(callback);

    if (callbacks.size === 0) {
      listeners.delete(name);
    }

    return removed;
  }

  function clear(name) {
    if (name === undefined) {
      listeners.clear();
      return;
    }

    validateEventName(name);
    listeners.delete(name);
  }

  function listenerCount(name) {
    validateEventName(name);
    return listeners.get(name)?.size ?? 0;
  }

  root.SurrealEvents = Object.freeze({
    on,
    once,
    emit,
    off,
    clear,
    listenerCount
  });
})(globalThis);
