
/*========================================================
  SURREALSCRIPTS.UI — NOTIFICATIONS MODULE
  File: notifications.js

  Responsibilities:
  - Store and manage notifications.
  - Support info, success, warning, and error types.
  - Notify subscribers when the queue changes.
  - Integrate with SurrealEvents when available.
  - Keep notification content as plain text.

  This module does not create UI elements or HTML.
========================================================*/

(function (global) {
  "use strict";

  const TYPES = new Set([
    "info",
    "success",
    "warning",
    "error"
  ]);

  let notifications = [];
  let nextId = 1;

  const subscribers = new Set();

  const config = {
    maxItems: 50,
    defaultType: "info"
  };

  function createId() {
    const id = `notification-${Date.now()}-${nextId}`;
    nextId += 1;
    return id;
  }

  function normalizeType(type) {
    return TYPES.has(type) ? type : config.defaultType;
  }

  function normalizeMessage(message) {
    if (typeof message === "string") {
      return message.trim();
    }

    if (message === null || message === undefined) {
      return "";
    }

    return String(message).trim();
  }

  function emitEvent(name, detail) {
    const events = global.SurrealEvents;

    if (events && typeof events.emit === "function") {
      try {
        events.emit(name, detail);
      } catch (error) {
        // Notification management should continue even if
        // an optional event listener fails.
      }
    }
  }

  function notifySubscribers(event) {
    const snapshot = getAll();

    for (const subscriber of subscribers) {
      try {
        subscriber({
          event,
          notifications: snapshot
        });
      } catch (error) {
        // One subscriber must not block the others.
      }
    }
  }

  function getAll() {
    return notifications.map(function (item) {
      return { ...item };
    });
  }

  function getById(id) {
    const item = notifications.find(function (entry) {
      return entry.id === id;
    });

    return item ? { ...item } : null;
  }

  function push(message, options = {}) {
    const text = normalizeMessage(message);

    if (!text) {
      throw new TypeError(
        "Notification message must not be empty."
      );
    }

    const type = normalizeType(options.type);
    const now = new Date().toISOString();

    const item = {
      id: createId(),
      type,
      message: text,
      title:
        typeof options.title === "string"
          ? options.title.trim()
          : "",
      createdAt: now,
      dismissed: false,
      metadata:
        options.metadata &&
        typeof options.metadata === "object" &&
        !Array.isArray(options.metadata)
          ? { ...options.metadata }
          : {}
    };

    notifications.push(item);

    while (notifications.length > config.maxItems) {
      notifications.shift();
    }

    const result = { ...item };

    emitEvent("notification:added", result);
    notifySubscribers("added");

    return result;
  }

  function dismiss(id) {
    const index = notifications.findIndex(function (item) {
      return item.id === id;
    });

    if (index === -1) {
      return false;
    }

    const removed = notifications.splice(index, 1)[0];

    emitEvent("notification:dismissed", {
      id: removed.id,
      type: removed.type,
      message: removed.message
    });

    notifySubscribers("dismissed");

    return true;
  }

  function clear() {
    if (notifications.length === 0) {
      return 0;
    }

    const count = notifications.length;
    notifications = [];

    emitEvent("notification:cleared", { count });
    notifySubscribers("cleared");

    return count;
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      throw new TypeError(
        "Notification subscriber must be a function."
      );
    }

    subscribers.add(callback);

    return function unsubscribe() {
      subscribers.delete(callback);
    };
  }

  function getConfig() {
    return { ...config };
  }

  function configure(options = {}) {
    if (
      options.maxItems !== undefined &&
      Number.isInteger(options.maxItems) &&
      options.maxItems >= 1
    ) {
      config.maxItems = options.maxItems;
    }

    if (
      options.defaultType !== undefined &&
      TYPES.has(options.defaultType)
    ) {
      config.defaultType = options.defaultType;
    }

    while (notifications.length > config.maxItems) {
      notifications.shift();
    }

    notifySubscribers("configured");

    return getConfig();
  }

  function getCount() {
    return notifications.length;
  }

  function getTypes() {
    return Array.from(TYPES);
  }

  const SurrealNotifications = {
    push,
    getAll,
    getById,
    dismiss,
    clear,
    subscribe,
    configure,
    getConfig,
    getCount,
    getTypes
  };

  global.SurrealNotifications = SurrealNotifications;

})(globalThis);
