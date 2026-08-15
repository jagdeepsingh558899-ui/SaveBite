/*
 * SaveBite Service Worker
 * Version: 1.0.0
 *
 * Responsibilities:
 * - PWA app-shell caching
 * - Offline navigation fallback
 * - Safe static-asset caching
 * - Cache version management
 * - Old-cache cleanup
 *
 * IMPORTANT:
 * - Firebase/Firestore user data is NOT cached here.
 * - Authentication tokens are NOT cached here.
 * - Backblaze B2 credentials/files are NOT cached here.
 * - Payment information is NOT cached here.
 */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const CACHE_VERSION = "savebite-v1";

const STATIC_CACHE = `${CACHE_VERSION}-static`;

const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const OFFLINE_PAGE = "./404.html";


/*
 * Only cache files that are guaranteed to exist
 * at the time the service worker is installed.
 *
 * Additional assets can be added after their files
 * are actually created in the repository.
 */
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener(
  "install",
  function (event) {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then(function (cache) {
          return cache.addAll(STATIC_ASSETS);
        })
        .then(function () {
          /*
           * Make the new worker available immediately.
           *
           * Existing pages are still controlled by the
           * previous worker until navigation/reload.
           */
          return self.skipWaiting();
        })
        .catch(function (error) {
          console.error(
            "[SaveBite SW] Install failed:",
            error
          );
        })
    );
  }
);


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener(
  "activate",
  function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (cacheNames) {
          return Promise.all(
            cacheNames.map(function (cacheName) {

              /*
               * Remove only SaveBite caches that no longer
               * belong to the current version.
               *
               * Never delete unrelated application caches.
               */
              if (
                cacheName.startsWith("savebite-") &&
                cacheName !== STATIC_CACHE &&
                cacheName !== RUNTIME_CACHE
              ) {
                return caches.delete(cacheName);
              }

              return Promise.resolve(false);
            })
          );
        })
        .then(function () {
          /*
           * Take control of currently open pages.
           */
          return self.clients.claim();
        })
    );
  }
);


/* =========================================================
   FETCH
========================================================= */

self.addEventListener(
  "fetch",
  function (event) {

    const request = event.request;

    /*
     * Only handle GET requests.
     *
     * POST/PUT/PATCH/DELETE requests must always reach
     * the network and are never cached by this worker.
     */
    if (request.method !== "GET") {
      return;
    }


    const requestURL = new URL(
      request.url
    );


    /*
     * Only handle HTTP(S).
     *
     * This prevents problems with browser-internal
     * protocols and unsupported schemes.
     */
    if (
      requestURL.protocol !== "http:" &&
      requestURL.protocol !== "https:"
    ) {
      return;
    }


    /*
     * Firebase/API requests should NOT be intercepted
     * by this basic app-shell worker.
     *
     * They will be handled by their own application logic.
     */
    if (isFirebaseOrApiRequest(requestURL)) {
      return;
    }


    /*
     * B2/storage requests are intentionally excluded.
     *
     * User/business files should not be blindly cached.
     */
    if (isStorageRequest(requestURL)) {
      return;
    }


    /*
     * Navigation requests:
     *
     * Network first → cache fallback → offline page.
     *
     * This ensures users receive the latest HTML whenever
     * they have a network connection.
     */
    if (request.mode === "navigate") {

      event.respondWith(
        networkFirstNavigation(request)
      );

      return;
    }


    /*
     * Static resources:
     *
     * Cache first → network fallback.
     */
    event.respondWith(
      cacheFirstStatic(request)
    );
  }
);


/* =========================================================
   NAVIGATION STRATEGY
========================================================= */

async function networkFirstNavigation(
  request
) {

  try {

    const networkResponse =
      await fetch(
        request,
        {
          cache: "no-store"
        }
      );


    /*
     * Cache only valid successful responses.
     */
    if (
      networkResponse &&
      networkResponse.ok
    ) {

      const cache =
        await caches.open(
          RUNTIME_CACHE
        );

      await cache.put(
        request,
        networkResponse.clone()
      );
    }


    return networkResponse;

  } catch (error) {

    /*
     * First try the exact requested page.
     */
    const cachedResponse =
      await caches.match(
        request
      );

    if (cachedResponse) {
      return cachedResponse;
    }


    /*
     * Then try the main application shell.
     */
    const appShell =
      await caches.match(
        "./index.html"
      );

    if (appShell) {
      return appShell;
    }


    /*
     * Final fallback.
     */
    const offlineResponse =
      await caches.match(
        OFFLINE_PAGE
      );

    if (offlineResponse) {
      return offlineResponse;
    }


    return new Response(
      createOfflineHTML(),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      }
    );
  }
}


/* =========================================================
   STATIC RESOURCE STRATEGY
========================================================= */

async function cacheFirstStatic(
  request
) {

  const cachedResponse =
    await caches.match(
      request
    );

  if (cachedResponse) {
    return cachedResponse;
  }


  try {

    const networkResponse =
      await fetch(
        request
      );


    /*
     * Only cache successful same-origin resources.
     */
    if (
      networkResponse &&
      networkResponse.ok &&
      isSameOrigin(request.url)
    ) {

      const cache =
        await caches.open(
          RUNTIME_CACHE
        );

      await cache.put(
        request,
        networkResponse.clone()
      );
    }


    return networkResponse;

  } catch (error) {

    /*
     * No cached version exists.
     *
     * Return a lightweight offline response instead
     * of throwing an unhandled fetch error.
     */
    return new Response(
      createOfflineResourceHTML(),
      {
        status: 503,
        statusText: "Resource Unavailable",
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      }
    );
  }
}


/* =========================================================
   REQUEST FILTERS
========================================================= */

function isSameOrigin(
  url
) {

  try {

    return (
      new URL(url).origin ===
      self.location.origin
    );

  } catch (error) {

    return false;
  }
}


function isFirebaseOrApiRequest(
  url
) {

  const hostname =
    url.hostname.toLowerCase();


  const firebaseHosts = [
    "firebaseio.com",
    "firebaseio.com",
    "googleapis.com",
    "identitytoolkit.googleapis.com",
    "securetoken.googleapis.com",
    "fcm.googleapis.com"
  ];


  if (
    firebaseHosts.some(
      function (host) {
        return (
          hostname === host ||
          hostname.endsWith(
            "." + host
          )
        );
      }
    )
  ) {
    return true;
  }


  /*
   * Application API endpoints can be excluded
   * using the /api/ path convention.
   */
  if (
    url.pathname.startsWith(
      "/api/"
    )
  ) {
    return true;
  }


  return false;
}


function isStorageRequest(
  url
) {

  const hostname =
    url.hostname.toLowerCase();


  /*
   * Backblaze B2 endpoints.
   *
   * Exact production B2 endpoint configuration will be
   * introduced when the secure storage layer is implemented.
   */
  const storageHosts = [
    "backblazeb2.com",
    "backblazeb2.com"
  ];


  if (
    storageHosts.some(
      function (host) {
        return (
          hostname === host ||
          hostname.endsWith(
            "." + host
          )
        );
      }
    )
  ) {
    return true;
  }


  return false;
}


/* =========================================================
   OFFLINE FALLBACK
========================================================= */

function createOfflineHTML() {

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >
  <meta
    name="theme-color"
    content="#080b09"
  >
  <title>SaveBite — Offline</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #080b09;
      color: #ffffff;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      text-align: center;
    }

    .offline {
      width: min(100%, 460px);
      padding: 32px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 24px;
      background: #101512;
    }

    .logo {
      width: 58px;
      height: 58px;
      margin: 0 auto 20px;
      display: grid;
      place-items: center;
      border-radius: 17px;
      background: #38d878;
      color: #031108;
      font-size: 25px;
      font-weight: 800;
    }

    h1 {
      margin: 0;
      font-size: 27px;
    }

    p {
      margin: 12px 0 0;
      color: #9ca7a0;
      line-height: 1.6;
      font-size: 14px;
    }

    button {
      min-height: 46px;
      margin-top: 22px;
      padding: 0 18px;
      border: 0;
      border-radius: 12px;
      background: #38d878;
      color: #031108;
      font-weight: 800;
      cursor: pointer;
    }
  </style>
</head>

<body>

  <main class="offline">

    <div class="logo">
      S
    </div>

    <h1>
      You're offline
    </h1>

    <p>
      SaveBite needs an internet connection
      for live deals, accounts and orders.
      Please reconnect and try again.
    </p>

    <button
      type="button"
      onclick="location.reload()"
    >
      Try Again
    </button>

  </main>

</body>
</html>
`;
}


function createOfflineResourceHTML() {

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >
  <meta
    name="theme-color"
    content="#080b09"
  >
  <title>SaveBite</title>
</head>

<body
  style="
    margin:0;
    min-height:100vh;
    display:grid;
    place-items:center;
    background:#080b09;
    color:#fff;
    font-family:system-ui,sans-serif;
    text-align:center;
    padding:24px;
  "
>

  <div>

    <strong>
      SaveBite
    </strong>

    <p>
      This content is unavailable offline.
    </p>

  </div>

</body>
</html>
`;
}


/* =========================================================
   MESSAGE HANDLER
========================================================= */

self.addEventListener(
  "message",
  function (event) {

    if (!event.data) {
      return;
    }


    /*
     * Allows the application to explicitly request
     * activation of a newly installed service worker.
     */
    if (
      event.data.type ===
      "SAVE_BITE_SKIP_WAITING"
    ) {

      self.skipWaiting();
    }


    /*
     * Allows future versions of the application to
     * request cache cleanup without exposing cache
     * manipulation directly to the browser UI.
     */
    if (
      event.data.type ===
      "SAVE_BITE_CLEAR_RUNTIME_CACHE"
    ) {

      event.waitUntil(
        caches.delete(
          RUNTIME_CACHE
        )
      );
    }
  }
);


/* =========================================================
   ERROR SAFETY
========================================================= */

self.addEventListener(
  "error",
  function (event) {

    console.error(
      "[SaveBite SW] Runtime error:",
      event.error || event.message
    );
  }
);


self.addEventListener(
  "unhandledrejection",
  function (event) {

    console.error(
      "[SaveBite SW] Unhandled promise rejection:",
      event.reason
    );
  }
);
