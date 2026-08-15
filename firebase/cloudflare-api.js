/*
 * SaveBite
 * Cloudflare API Client
 *
 * Frontend
 *    ↓
 * Cloudflare Worker/API
 *    ↓
 * Backblaze B2 / Secure Server Operations
 *
 * IMPORTANT:
 * - Never put B2 secret keys here.
 * - Never put Firebase Admin credentials here.
 * - Never trust client-provided user IDs for authorization.
 * - The Cloudflare Worker must verify Firebase ID tokens
 *   before protected operations.
 */


/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE_URL =
  String(
    globalThis.SAVEBITE_API_URL || ""
  ).trim();


/* =========================================================
   CONFIGURATION CHECK
========================================================= */

function ensureApiConfigured() {
  if (!API_BASE_URL) {
    throw new Error(
      "SaveBite API is not configured yet."
    );
  }
}


/* =========================================================
   URL BUILDER
========================================================= */

function buildUrl(path) {
  ensureApiConfigured();

  const base =
    API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;

  const cleanPath =
    String(path || "").startsWith("/")
      ? path
      : `/${path}`;

  return `${base}${cleanPath}`;
}


/* =========================================================
   FIREBASE AUTH TOKEN
========================================================= */

async function getFirebaseIdToken(
  forceRefresh = false
) {
  /*
   * Firebase Auth is dynamically imported here so this
   * API module can remain independent from the auth module.
   */

  const {
    auth
  } = await import(
    "./firebase-config.js"
  );

  const user =
    auth.currentUser;

  if (!user) {
    return null;
  }

  return user.getIdToken(
    forceRefresh
  );
}


/* =========================================================
   REQUEST ID
========================================================= */

function createRequestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random()
      .toString(36)
      .slice(2)
  );
}


/* =========================================================
   RESPONSE PARSER
========================================================= */

async function parseResponse(
  response
) {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function getServerErrorMessage(
  data,
  status
) {
  if (
    data &&
    typeof data === "object"
  ) {
    if (data.message) {
      return String(
        data.message
      );
    }

    if (data.error) {
      return String(
        data.error
      );
    }
  }

  if (status === 401) {
    return "Authentication required.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 404) {
    return "Requested resource was not found.";
  }

  if (status === 429) {
    return "Too many requests. Please try again later.";
  }

  if (status >= 500) {
    return "Server error. Please try again later.";
  }

  return `API request failed (${status}).`;
}


/* =========================================================
   GENERIC REQUEST
========================================================= */

async function apiRequest(
  path,
  {
    method = "GET",
    body = null,
    headers = {},
    authenticated = true,
    timeout = 30000,
    retryOnUnauthorized = true
  } = {}
) {
  ensureApiConfigured();

  const requestId =
    createRequestId();

  let token = null;

  if (authenticated) {
    token =
      await getFirebaseIdToken(false);
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  const requestHeaders = {
    Accept:
      "application/json",

    "X-SaveBite-Request-Id":
      requestId,

    ...headers
  };

  if (token) {
    requestHeaders.Authorization =
      `Bearer ${token}`;
  }

  let requestBody =
    body;

  /*
   * Automatically encode plain JavaScript objects
   * as JSON.
   */

  if (
    body !== null &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  ) {
    requestBody =
      JSON.stringify(body);

    if (
      !requestHeaders["Content-Type"]
    ) {
      requestHeaders["Content-Type"] =
        "application/json";
    }
  }

  try {
    const response =
      await fetch(
        buildUrl(path),
        {
          method,

          headers:
            requestHeaders,

          body:
            method === "GET" ||
            method === "HEAD"
              ? undefined
              : requestBody,

          credentials:
            "omit",

          cache:
            "no-store",

          signal:
            controller.signal
        }
      );

    const data =
      await parseResponse(
        response
      );

    /*
     * Firebase token may expire between requests.
     * Refresh once and retry only on 401.
     */

    if (
      response.status === 401 &&
      authenticated &&
      retryOnUnauthorized
    ) {
      const freshToken =
        await getFirebaseIdToken(
          true
        );

      if (freshToken) {
        return apiRequest(
          path,
          {
            method,
            body,
            headers: {
              ...headers,
              Authorization:
                `Bearer ${freshToken}`
            },
            authenticated: true,
            timeout,
            retryOnUnauthorized: false
          }
        );
      }
    }

    if (!response.ok) {
      const error =
        new Error(
          getServerErrorMessage(
            data,
            response.status
          )
        );

      error.status =
        response.status;

      error.requestId =
        requestId;

      error.data =
        data;

      throw error;
    }

    return {
      success: true,

      status:
        response.status,

      data,

      requestId
    };

  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      const timeoutError =
        new Error(
          "The request timed out. Please try again."
        );

      timeoutError.code =
        "API_TIMEOUT";

      timeoutError.requestId =
        requestId;

      throw timeoutError;
    }

    if (
      error instanceof TypeError
    ) {
      const networkError =
        new Error(
          "Unable to connect to SaveBite server."
        );

      networkError.code =
        "API_NETWORK_ERROR";

      networkError.requestId =
        requestId;

      throw networkError;
    }

    throw error;

  } finally {
    clearTimeout(
      timeoutId
    );
  }
}


/* =========================================================
   GET
========================================================= */

async function apiGet(
  path,
  options = {}
) {
  return apiRequest(
    path,
    {
      ...options,
      method: "GET"
    }
  );
}


/* =========================================================
   POST
========================================================= */

async function apiPost(
  path,
  body = null,
  options = {}
) {
  return apiRequest(
    path,
    {
      ...options,
      method: "POST",
      body
    }
  );
}


/* =========================================================
   PUT
========================================================= */

async function apiPut(
  path,
  body = null,
  options = {}
) {
  return apiRequest(
    path,
    {
      ...options,
      method: "PUT",
      body
    }
  );
}


/* =========================================================
   PATCH
========================================================= */

async function apiPatch(
  path,
  body = null,
  options = {}
) {
  return apiRequest(
    path,
    {
      ...options,
      method: "PATCH",
      body
    }
  );
}


/* =========================================================
   DELETE
========================================================= */

async function apiDelete(
  path,
  body = null,
  options = {}
) {
  return apiRequest(
    path,
    {
      ...options,
      method: "DELETE",
      body
    }
  );
}


/* =========================================================
   PUBLIC API
========================================================= */

const cloudflareApi =
  Object.freeze({

    get: apiGet,

    post: apiPost,

    put: apiPut,

    patch: apiPatch,

    delete: apiDelete,

    request: apiRequest

  });


/* =========================================================
   STORAGE API
========================================================= */

async function uploadToB2(
  file,
  {
    folder = "uploads",
    entityId = "",
    entityType = ""
  } = {}
) {
  if (!(file instanceof File)) {
    throw new TypeError(
      "A valid file is required."
    );
  }

  const formData =
    new FormData();

  formData.append(
    "file",
    file,
    file.name
  );

  formData.append(
    "folder",
    String(folder)
  );

  if (entityId) {
    formData.append(
      "entityId",
      String(entityId)
    );
  }

  if (entityType) {
    formData.append(
      "entityType",
      String(entityType)
    );
  }

  return apiPost(
    "/storage/upload",
    formData
  );
}


async function deleteFromB2(
  fileKey
) {
  const key =
    String(
      fileKey || ""
    ).trim();

  if (!key) {
    throw new Error(
      "File key is required."
    );
  }

  return apiPost(
    "/storage/delete",
    {
      key
    }
  );
}


async function getB2DownloadUrl(
  fileKey
) {
  const key =
    String(
      fileKey || ""
    ).trim();

  if (!key) {
    throw new Error(
      "File key is required."
    );
  }

  return apiGet(
    `/storage/download-url?key=${encodeURIComponent(key)}`
  );
}


/* =========================================================
   HEALTH CHECK
========================================================= */

async function checkApiHealth() {
  return apiGet(
    "/health",
    {
      authenticated: false,
      timeout: 10000
    }
  );
}


/* =========================================================
   EXPORT
========================================================= */

export {
  API_BASE_URL,

  apiRequest,

  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,

  uploadToB2,
  deleteFromB2,
  getB2DownloadUrl,

  checkApiHealth,

  cloudflareApi
};
