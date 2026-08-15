/*
 * SaveBite
 * Main Application Bootstrap
 *
 * Responsibilities:
 * - Load global configuration
 * - Register PWA service worker
 * - Handle global JavaScript errors
 * - Handle unhandled Promise errors
 * - Dispatch application lifecycle events
 * - Initialize common DOM hooks
 * - Provide a small global app controller
 *
 * Authentication:
 * Firebase Auth remains the source of truth.
 *
 * Storage:
 * Browser storage is only for non-sensitive UI state.
 */


/* =========================================================
   IMPORTS
========================================================= */

import {
  CONFIG,
  APP,
  FEATURES,
  PWA
} from "./config.js";

import {
  getErrorMessage
} from "./utils.js";

import {
  getTheme
} from "./storage.js";


/* =========================================================
   APP STATE
========================================================= */

const state = {
  initialized: false,

  domReady: false,

  serviceWorkerRegistered:
    false,

  installPromptEvent:
    null,

  online:
    navigator.onLine,

  errors:
    []
};


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_ERROR_HISTORY = 20;


/* =========================================================
   CUSTOM EVENTS
========================================================= */

const EVENTS = Object.freeze({

  READY:
    "savebite:ready",

  INITIALIZED:
    "savebite:initialized",

  ONLINE:
    "savebite:online",

  OFFLINE:
    "savebite:offline",

  INSTALL_AVAILABLE:
    "savebite:installavailable",

  INSTALL_COMPLETED:
    "savebite:installcompleted",

  ERROR:
    "savebite:error"

});


/* =========================================================
   EVENT DISPATCHER
========================================================= */

function emit(
  eventName,
  detail = {}
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      eventName,
      {
        detail
      }
    )
  );
}


/* =========================================================
   APP ERROR
========================================================= */

function recordError(
  error,
  context = "unknown"
) {
  const message =
    getErrorMessage(
      error
    );

  const entry = {
    message,

    context,

    timestamp:
      new Date().toISOString()
  };

  state.errors.push(
    entry
  );

  if (
    state.errors.length >
    MAX_ERROR_HISTORY
  ) {
    state.errors.shift();
  }

  emit(
    EVENTS.ERROR,
    entry
  );

  return entry;
}


/* =========================================================
   GLOBAL ERROR HANDLING
========================================================= */

function setupGlobalErrorHandling() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.addEventListener(
    "error",
    event => {
      const error =
        event.error ||
        new Error(
          event.message ||
          "Unknown JavaScript error."
        );

      recordError(
        error,
        "window-error"
      );
    }
  );


  window.addEventListener(
    "unhandledrejection",
    event => {
      const reason =
        event.reason ||
        new Error(
          "Unhandled Promise rejection."
        );

      recordError(
        reason,
        "unhandled-rejection"
      );
    }
  );
}


/* =========================================================
   NETWORK STATUS
========================================================= */

function setupNetworkMonitoring() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const updateStatus =
    online => {

      state.online =
        Boolean(
          online
        );

      emit(
        online
          ? EVENTS.ONLINE
          : EVENTS.OFFLINE,
        {
          online:
            state.online
        }
      );

      updateNetworkIndicator();
    };


  window.addEventListener(
    "online",
    () => {
      updateStatus(
        true
      );
    }
  );


  window.addEventListener(
    "offline",
    () => {
      updateStatus(
        false
      );
    }
  );


  state.online =
    navigator.onLine;
}


/* =========================================================
   NETWORK UI
========================================================= */

function updateNetworkIndicator() {
  const indicator =
    document.querySelector(
      "[data-network-status]"
    );

  if (!indicator) {
    return;
  }

  indicator.textContent =
    state.online
      ? "Online"
      : "Offline";

  indicator.dataset.status =
    state.online
      ? "online"
      : "offline";
}


/* =========================================================
   THEME
========================================================= */

function getSystemTheme() {
  if (
    typeof window ===
    "undefined" ||
    !window.matchMedia
  ) {
    return "light";
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches
    ? "dark"
    : "light";
}


function applyTheme(
  theme
) {
  const root =
    document.documentElement;

  if (!root) {
    return;
  }

  const selected =
    theme === "system"
      ? getSystemTheme()
      : theme;

  root.dataset.theme =
    selected;

  root.style.colorScheme =
    selected;
}


function initializeTheme() {
  let theme =
    "system";

  try {
    theme =
      getTheme();
  } catch {
    theme =
      "system";
  }

  applyTheme(
    theme
  );


  if (
    typeof window !==
      "undefined" &&
    window.matchMedia
  ) {
    const media =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      );

    const listener =
      () => {
        let current =
          "system";

        try {
          current =
            getTheme();
        } catch {
          current =
            "system";
        }

        if (
          current ===
          "system"
        ) {
          applyTheme(
            "system"
          );
        }
      };

    if (
      typeof media.addEventListener ===
      "function"
    ) {
      media.addEventListener(
        "change",
        listener
      );
    } else if (
      typeof media.addListener ===
      "function"
    ) {
      media.addListener(
        listener
      );
    }
  }
}


/* =========================================================
   PWA SERVICE WORKER
========================================================= */

async function registerServiceWorker() {
  if (
    !PWA.enabled ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  if (
    !window.isSecureContext &&
    location.hostname !==
      "localhost"
  ) {
    return null;
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        PWA.serviceWorker,
        {
          scope: "/"
        }
      );

    state.serviceWorkerRegistered =
      true;

    return registration;

  } catch (error) {

    recordError(
      error,
      "service-worker-registration"
    );

    return null;
  }
}


/* =========================================================
   PWA INSTALL PROMPT
========================================================= */

function setupInstallPrompt() {
  if (
    !PWA.installPromptEnabled
  ) {
    return;
  }

  window.addEventListener(
    "beforeinstallprompt",
    event => {

      event.preventDefault();

      state.installPromptEvent =
        event;

      emit(
        EVENTS.INSTALL_AVAILABLE
      );
    }
  );


  window.addEventListener(
    "appinstalled",
    () => {

      state.installPromptEvent =
        null;

      emit(
        EVENTS.INSTALL_COMPLETED
      );
    }
  );
}


/* =========================================================
   SHOW INSTALL PROMPT
========================================================= */

async function promptInstall() {
  const event =
    state.installPromptEvent;

  if (!event) {
    return {
      available: false,
      outcome: null
    };
  }

  try {
    const result =
      await event.prompt();

    state.installPromptEvent =
      null;

    return {
      available: true,

      outcome:
        result?.outcome ||
        null
    };

  } catch (error) {

    recordError(
      error,
      "pwa-install"
    );

    state.installPromptEvent =
      null;

    return {
      available: true,
      outcome: null
    };
  }
}


/* =========================================================
   PWA DISPLAY MODE
========================================================= */

function isStandaloneMode() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  if (
    window.matchMedia &&
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches
  ) {
    return true;
  }

  return Boolean(
    window.navigator.standalone
  );
}


/* =========================================================
   DOM INITIALIZATION
========================================================= */

function initializeDom() {
  state.domReady =
    true;

  document.documentElement.dataset.app =
    "savebite";

  document.documentElement.dataset.environment =
    APP.environment;

  updateNetworkIndicator();

  emit(
    EVENTS.READY,
    {
      version:
        APP.version,

      environment:
        APP.environment
    }
  );
}


/* =========================================================
   GLOBAL APP MARKERS
========================================================= */

function setAppMetadata() {
  if (
    typeof document ===
    "undefined"
  ) {
    return;
  }

  const root =
    document.documentElement;

  root.dataset.appName =
    APP.name;

  root.dataset.appVersion =
    APP.version;

  root.dataset.appEnvironment =
    APP.environment;
}


/* =========================================================
   FEATURE CHECK
========================================================= */

function isFeatureEnabled(
  feature
) {
  return Boolean(
    FEATURES[
      feature
    ]
  );
}


/* =========================================================
   APP INFO
========================================================= */

function getAppInfo() {
  return Object.freeze({

    name:
      APP.name,

    shortName:
      APP.shortName,

    version:
      APP.version,

    environment:
      APP.environment,

    online:
      state.online,

    standalone:
      isStandaloneMode(),

    serviceWorkerRegistered:
      state.serviceWorkerRegistered
  });
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initialize() {
  if (
    state.initialized
  ) {
    return getAppInfo();
  }

  try {

    /*
     * Global handlers should be installed
     * before other initialization.
     */

    setupGlobalErrorHandling();

    setupNetworkMonitoring();

    setupInstallPrompt();

    setAppMetadata();

    initializeTheme();

    initializeDom();

    /*
     * Service worker registration can happen
     * after the basic application is ready.
     */

    await registerServiceWorker();

    state.initialized =
      true;

    emit(
      EVENTS.INITIALIZED,
      getAppInfo()
    );

    return getAppInfo();

  } catch (error) {

    recordError(
      error,
      "app-initialize"
    );

    throw error;
  }
}


/* =========================================================
   DOM READY
========================================================= */

function startOnDomReady() {
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initialize().catch(
          () => {
            /*
             * Global error handling already
             * recorded the actual error.
             */
          }
        );
      },
      {
        once: true
      }
    );

  } else {
    initialize().catch(
      () => {}
    );
  }
}


/* =========================================================
   APP CONTROLLER
========================================================= */

const SaveBiteApp =
  Object.freeze({

    initialize,

    emit,

    promptInstall,

    isStandaloneMode,

    isFeatureEnabled,

    getAppInfo,

    getState() {
      return {
        ...state,
        errors:
          [
            ...state.errors
          ]
      };
    },

    getEvents() {
      return EVENTS;
    }

  });


/* =========================================================
   GLOBAL ACCESS
========================================================= */

if (
  typeof window !==
  "undefined"
) {
  window.SaveBiteApp =
    SaveBiteApp;
}


/* =========================================================
   START
========================================================= */

startOnDomReady();


/* =========================================================
   EXPORT
========================================================= */

export {
  EVENTS,
  SaveBiteApp,

  initialize,

  promptInstall,

  isStandaloneMode,

  isFeatureEnabled,

  getAppInfo
};
