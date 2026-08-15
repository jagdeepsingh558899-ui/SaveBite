/*
 * SaveBite
 * Central API Client
 *
 * Responsibilities:
 * - Cloudflare/API requests
 * - Request timeout
 * - JSON parsing
 * - Authentication token support
 * - Request headers
 * - Error normalization
 * - Retry handling
 * - GET / POST / PUT / PATCH / DELETE helpers
 *
 * IMPORTANT:
 * - Firebase Auth remains the authentication source of truth.
 * - This module does NOT treat localStorage as authentication.
 * - Firebase ID token can be supplied by the caller.
 * - Secrets must NEVER be placed in frontend code.
 */


/* =========================================================
   IMPORTS
========================================================= */

import {
  API_BASE_URL,
  API_TIMEOUT,
  API_RETRY_COUNT
} from "./config.js";


/* =========================================================
   CONSTANTS
========================================================= */

const API_EVENTS =
  Object.freeze({

    REQUEST_START:
      "savebite:api-request-start",

    REQUEST_SUCCESS:
      "savebite:api-request-success",

    REQUEST_ERROR:
      "savebite:api-request-error",

    REQUEST_RETRY:
      "savebite:api-request-retry"
  });


const HTTP_METHODS =
  Object.freeze({

    GET:
      "GET",

    POST:
      "POST",

    PUT:
      "PUT",

    PATCH:
      "PATCH",

    DELETE:
      "DELETE"
  });


/* =========================================================
   DEFAULTS
========================================================= */

const DEFAULTS =
  Object.freeze({

    baseUrl:
      API_BASE_URL || "",

    timeout:
      Number.isFinite(
        Number(API_TIMEOUT)
      )
        ? Number(API_TIMEOUT)
        : 15000,

    retries:
      Number.isFinite(
        Number(API_RETRY_COUNT)
      )
        ? Number(API_RETRY_COUNT)
        : 1
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  requestCount:
    0,

  activeRequests:
    0,

  lastRequestAt:
    null,

  lastError:
    null
};


/* =========================================================
   EVENT EMITTER
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
   URL BUILDER
========================================================= */

function buildUrl(
  endpoint,
  query = {},
  baseUrl =
    DEFAULTS.baseUrl
) {
  if (
    typeof endpoint !==
    "string" ||
    !endpoint.trim()
  ) {
    throw new Error(
      "API endpoint is required."
    );
  }


  const cleanEndpoint =
    endpoint.trim();


  /*
   * Absolute URL:
   *
   * https://api.example.com/...
   */

  let url;


  try {

    url =
      new URL(
        cleanEndpoint,
        baseUrl ||
          (
            typeof window !==
            "undefined"
              ? window.location.origin
              : "http://localhost"
          )
      );

  } catch {

    throw new Error(
      "Invalid API URL."
    );
  }


  if (
    query &&
    typeof query ===
      "object"
  ) {

    Object.entries(
      query
    ).forEach(
      (
        [
          key,
          value
        ]
      ) => {

        if (
          value ===
            undefined ||
          value ===
            null ||
          value ===
            ""
        ) {
          return;
        }


        /*
         * Arrays become repeated query parameters.
         *
         * ?tag=a&tag=b
         */

        if (
          Array.isArray(
            value
          )
        ) {

          value.forEach(
            item => {

              if (
                item !==
                  undefined &&
                item !==
                  null
              ) {
                url.searchParams.append(
                  key,
                  String(item)
                );
              }
            }
          );

          return;
        }


        /*
         * Dates.
         */

        if (
          value instanceof
          Date
        ) {
          url.searchParams.set(
            key,
            value.toISOString()
          );

          return;
        }


        /*
         * Objects are JSON encoded.
         */

        if (
          typeof value ===
            "object"
        ) {

          url.searchParams.set(
            key,
            JSON.stringify(
              value
            )
          );

          return;
        }


        url.searchParams.set(
          key,
          String(value)
        );
      }
    );
  }


  return url.toString();
}


/* =========================================================
   ABORT / TIMEOUT
========================================================= */

function createAbortController(
  timeout
) {
  const controller =
    new AbortController();


  const timeoutMs =
    Number(timeout);


  let timer =
    null;


  if (
    Number.isFinite(
      timeoutMs
    ) &&
    timeoutMs >
      0
  ) {

    timer =
      setTimeout(
        () => {
          controller.abort(
            new DOMException(
              "Request timed out.",
              "TimeoutError"
            )
          );
        },
        timeoutMs
      );
  }


  return {
    controller,

    cleanup() {
      if (
        timer !==
        null
      ) {
        clearTimeout(
          timer
        );
      }
    }
  };
}


/* =========================================================
   ERROR CLASS
========================================================= */

class ApiError extends Error {

  constructor(
    message,
    {
      status =
        0,

      code =
        "API_ERROR",

      data =
        null,

      url =
        null,

      method =
        null,

      originalError =
        null,

      retryable =
        false
    } = {}
  ) {

    super(
      message
    );


    this.name =
      "ApiError";

    this.status =
      status;

    this.code =
      code;

    this.data =
      data;

    this.url =
      url;

    this.method =
      method;

    this.originalError =
      originalError;

    this.retryable =
      retryable;
  }
}


/* =========================================================
   ERROR NORMALIZATION
========================================================= */

function normalizeError(
  error,
  {
    url =
      null,

    method =
      null
  } = {}
) {
  if (
    error instanceof
    ApiError
  ) {
    return error;
  }


  /*
   * Timeout / Abort.
   */

  if (
    error?.name ===
      "AbortError" ||
    error?.name ===
      "TimeoutError"
  ) {

    return new ApiError(
      "The request timed out. Please try again.",
      {
        status:
          408,

        code:
          "TIMEOUT",

        url,

        method,

        originalError:
          error,

        retryable:
          true
      }
    );
  }


  /*
   * Network failure.
   */

  if (
    error instanceof
      TypeError ||
    error?.message
      ?.toLowerCase()
      ?.includes(
        "network"
      )
  ) {

    return new ApiError(
      "Network error. Please check your internet connection.",
      {
        status:
          0,

        code:
          "NETWORK_ERROR",

        url,

        method,

        originalError:
          error,

        retryable:
          true
      }
    );
  }


  return new ApiError(
    error?.message ||
      "An unexpected API error occurred.",
    {
      status:
        Number(
          error?.status
        ) || 0,

      code:
        error?.code ||
        "API_ERROR",

      data:
        error?.data ||
        null,

      url,

      method,

      originalError:
        error,

      retryable:
        Boolean(
          error?.retryable
        )
    }
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


  /*
   * No content.
   */

  if (
    response.status ===
      204 ||
    response.status ===
      205
  ) {
    return null;
  }


  /*
   * JSON response.
   */

  if (
    contentType
      .toLowerCase()
      .includes(
        "application/json"
      )
  ) {

    try {

      return await response.json();

    } catch {

      return null;
    }
  }


  /*
   * Text fallback.
   */

  const text =
    await response.text();


  if (
    !text
  ) {
    return null;
  }


  /*
   * Some servers incorrectly return
   * JSON without content-type.
   */

  try {

    return JSON.parse(
      text
    );

  } catch {

    return text;
  }
}


/* =========================================================
   RESPONSE ERROR
========================================================= */

async function createResponseError(
  response,
  {
    url,
    method
  }
) {
  const data =
    await parseResponse(
      response
    );


  let message =
    `Request failed with status ${response.status}.`;


  if (
    data &&
    typeof data ===
      "object"
  ) {

    message =
      data.message ||
      data.error ||
      data.detail ||
      message;

  } else if (
    typeof data ===
    "string"
  ) {

    message =
      data ||
      message;
  }


  const retryable =
    response.status ===
      408 ||
    response.status ===
      425 ||
    response.status ===
      429 ||
    response.status >=
      500;


  let code =
    "HTTP_ERROR";


  if (
    response.status ===
      401
  ) {
    code =
      "UNAUTHORIZED";
  }


  if (
    response.status ===
      403
  ) {
    code =
      "FORBIDDEN";
  }


  if (
    response.status ===
      404
  ) {
    code =
      "NOT_FOUND";
  }


  if (
    response.status ===
      409
  ) {
    code =
      "CONFLICT";
  }


  if (
    response.status ===
      422
  ) {
    code =
      "VALIDATION_ERROR";
  }


  if (
    response.status ===
      429
  ) {
    code =
      "RATE_LIMITED";
  }


  if (
    response.status >=
    500
  ) {
    code =
      "SERVER_ERROR";
  }


  return new ApiError(
    message,
    {
      status:
        response.status,

      code,

      data,

      url,

      method,

      retryable
    }
  );
}


/* =========================================================
   RETRY POLICY
========================================================= */

function shouldRetry(
  error,
  attempt,
  maxRetries
) {
  if (
    attempt >=
    maxRetries
  ) {
    return false;
  }


  if (
    !error
  ) {
    return false;
  }


  if (
    error.retryable
  ) {
    return true;
  }


  /*
   * Never retry client-side authorization
   * or validation errors.
   */

  const status =
    Number(
      error.status
    );


  if (
    status >=
      400 &&
    status <
      500
  ) {
    return false;
  }


  return (
    status ===
      0 ||
    status >=
      500
  );
}


/* =========================================================
   RETRY DELAY
========================================================= */

function getRetryDelay(
  attempt
) {
  /*
   * Exponential backoff:
   *
   * 500ms
   * 1000ms
   * 2000ms
   * ...
   */

  const base =
    500;


  const max =
    8000;


  const exponential =
    Math.min(
      max,
      base *
        Math.pow(
          2,
          attempt
        )
    );


  /*
   * Small jitter prevents many clients
   * retrying at exactly the same time.
   */

  const jitter =
    Math.floor(
      Math.random() *
      250
    );


  return (
    exponential +
    jitter
  );
}


/* =========================================================
   REQUEST
========================================================= */

async function request(
  endpoint,
  {
    method =
      HTTP_METHODS.GET,

    query =
      null,

    body =
      undefined,

    headers =
      {},

    token =
      null,

    timeout =
      DEFAULTS.timeout,

    retries =
      DEFAULTS.retries,

    baseUrl =
      DEFAULTS.baseUrl,

    signal =
      null,

    credentials =
      "same-origin",

    cache =
      "no-store",

    retryNonIdempotent =
      false
  } = {}
) {
  const normalizedMethod =
    String(
      method
    ).toUpperCase();


  if (
    !Object.values(
      HTTP_METHODS
    ).includes(
      normalizedMethod
    )
  ) {

    throw new ApiError(
      "Unsupported HTTP method.",
      {
        code:
          "INVALID_METHOD",

        method:
          normalizedMethod
      }
    );
  }


  const url =
    buildUrl(
      endpoint,
      query,
      baseUrl
    );


  const requestId =
    `api_${Date.now()}_${state.requestCount + 1}`;


  state.requestCount +=
    1;

  state.activeRequests +=
    1;

  state.lastRequestAt =
    Date.now();


  emit(
    API_EVENTS.REQUEST_START,
    {
      requestId,

      method:
        normalizedMethod,

      url
    }
  );


  /*
   * Build headers.
   */

  const finalHeaders =
    new Headers(
      headers
    );


  if (
    !finalHeaders.has(
      "Accept"
    )
  ) {
    finalHeaders.set(
      "Accept",
      "application/json"
    );
  }


  /*
   * Firebase ID token, if supplied.
   *
   * This token should come directly from
   * Firebase Auth.
   */

  if (
    token &&
    typeof token ===
      "string"
  ) {

    finalHeaders.set(
      "Authorization",
      `Bearer ${token}`
    );
  }


  let requestBody =
    undefined;


  if (
    body !==
      undefined &&
    body !==
      null
  ) {

    /*
     * FormData must be sent untouched.
     */

    if (
      body instanceof
      FormData
    ) {

      requestBody =
        body;

    /*
     * Blob / ArrayBuffer.
     */

    } else if (
      body instanceof
        Blob ||
      body instanceof
        ArrayBuffer
    ) {

      requestBody =
        body;

    /*
     * String.
     */

    } else if (
      typeof body ===
      "string"
    ) {

      requestBody =
        body;

    /*
     * JSON object.
     */

    } else {

      requestBody =
        JSON.stringify(
          body
        );


      if (
        !finalHeaders.has(
          "Content-Type"
        )
      ) {
        finalHeaders.set(
          "Content-Type",
          "application/json"
        );
      }
    }
  }


  /*
   * Retry safety.
   *
   * GET / PUT / DELETE can generally be retried.
   * POST/PATCH are NOT retried automatically unless
   * explicitly enabled because they may create duplicates.
   */

  const isIdempotent =
    normalizedMethod ===
      HTTP_METHODS.GET ||
    normalizedMethod ===
      HTTP_METHODS.PUT ||
    normalizedMethod ===
      HTTP_METHODS.DELETE;


  const maxRetries =
    (
      isIdempotent ||
      retryNonIdempotent
    )
      ? Math.max(
          0,
          Number(retries) || 0
        )
      : 0;


  let lastError =
    null;


  try {

    for (
      let attempt = 0;
      attempt <=
        maxRetries;
      attempt +=
        1
    ) {

      if (
        attempt >
        0
      ) {

        const delay =
          getRetryDelay(
            attempt - 1
          );


        emit(
          API_EVENTS.REQUEST_RETRY,
          {
            requestId,

            attempt,

            delay,

            method:
              normalizedMethod,

            url
          }
        );


        await sleep(
          delay
        );
      }


      const abort =
        createAbortController(
          timeout
        );


      /*
       * If caller supplied AbortSignal,
       * connect it to our timeout controller.
       */

      let externalAbortHandler =
        null;


      if (
        signal
      ) {

        if (
          signal.aborted
        ) {

          abort.controller.abort(
            signal.reason
          );

        } else {

          externalAbortHandler =
            () => {

              abort.controller.abort(
                signal.reason
              );
            };


          signal.addEventListener(
            "abort",
            externalAbortHandler,
            {
              once:
                true
            }
          );
        }
      }


      try {

        const response =
          await fetch(
            url,
            {
              method:
                normalizedMethod,

              headers:
                finalHeaders,

              body:
                requestBody,

              signal:
                abort.controller.signal,

              credentials,

              cache
            }
          );


        /*
         * HTTP error.
         */

        if (
          !response.ok
        ) {

          throw await createResponseError(
            response,
            {
              url,

              method:
                normalizedMethod
            }
          );
        }


        const data =
          await parseResponse(
            response
          );


        emit(
          API_EVENTS.REQUEST_SUCCESS,
          {
            requestId,

            method:
              normalizedMethod,

            url,

            status:
              response.status,

            data
          }
        );


        return data;

      } catch (
        error
      ) {

        const normalized =
          normalizeError(
            error,
            {
              url,

              method:
                normalizedMethod
            }
          );


        lastError =
          normalized;


        if (
          shouldRetry(
            normalized,
            attempt,
            maxRetries
          )
        ) {
          continue;
        }


        state.lastError =
          normalized;


        emit(
          API_EVENTS.REQUEST_ERROR,
          {
            requestId,

            method:
              normalizedMethod,

            url,

            error:
              normalized
          }
        );


        throw normalized;

      } finally {

        abort.cleanup();


        if (
          signal &&
          externalAbortHandler
        ) {

          signal.removeEventListener(
            "abort",
            externalAbortHandler
          );
        }
      }
    }


    throw (
      lastError ||
      new ApiError(
        "API request failed."
      )
    );

  } finally {

    state.activeRequests =
      Math.max(
        0,
        state.activeRequests - 1
      );
  }
}


/* =========================================================
   GET
========================================================= */

function get(
  endpoint,
  options = {}
) {
  return request(
    endpoint,
    {
      ...options,

      method:
        HTTP_METHODS.GET
    }
  );
}


/* =========================================================
   POST
========================================================= */

function post(
  endpoint,
  body,
  options = {}
) {
  return request(
    endpoint,
    {
      ...options,

      method:
        HTTP_METHODS.POST,

      body
    }
  );
}


/* =========================================================
   PUT
========================================================= */

function put(
  endpoint,
  body,
  options = {}
) {
  return request(
    endpoint,
    {
      ...options,

      method:
        HTTP_METHODS.PUT,

      body
    }
  );
}


/* =========================================================
   PATCH
========================================================= */

function patch(
  endpoint,
  body,
  options = {}
) {
  return request(
    endpoint,
    {
      ...options,

      method:
        HTTP_METHODS.PATCH,

      body
    }
  );
}


/* =========================================================
   DELETE
========================================================= */

function del(
  endpoint,
  options = {}
) {
  return request(
    endpoint,
    {
      ...options,

      method:
        HTTP_METHODS.DELETE
    }
  );
}


/* =========================================================
   JSON HELPERS
========================================================= */

function getJson(
  endpoint,
  options = {}
) {
  return get(
    endpoint,
    {
      ...options,

      headers: {
        Accept:
          "application/json",

        ...(options.headers ||
          {})
      }
    }
  );
}


function postJson(
  endpoint,
  body,
  options = {}
) {
  return post(
    endpoint,
    body,
    {
      ...options,

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",

        ...(options.headers ||
          {})
      }
    }
  );
}


/* =========================================================
   AUTHENTICATED REQUEST
========================================================= */

/*
 * Caller should provide a fresh Firebase ID token.
 *
 * Example:
 *
 * const token = await user.getIdToken();
 *
 * api.authenticated("/orders", {
 *   token
 * });
 */

function authenticated(
  endpoint,
  {
    token,
    ...options
  } = {}
) {
  if (
    typeof token !==
      "string" ||
    !token.trim()
  ) {

    throw new ApiError(
      "A valid Firebase ID token is required.",
      {
        code:
          "AUTH_TOKEN_REQUIRED",

        status:
          401
      }
    );
  }


  return request(
    endpoint,
    {
      ...options,

      token:
        token.trim()
    }
  );
}


/* =========================================================
   AUTHENTICATED JSON
========================================================= */

function authenticatedJson(
  endpoint,
  {
    token,

    method =
      HTTP_METHODS.GET,

    body =
      undefined,

    query =
      undefined,

    ...options
  } = {}
) {
  if (
    typeof token !==
      "string" ||
    !token.trim()
  ) {

    throw new ApiError(
      "A valid Firebase ID token is required.",
      {
        code:
          "AUTH_TOKEN_REQUIRED",

        status:
          401
      }
    );
  }


  return request(
    endpoint,
    {
      ...options,

      method,

      body,

      query,

      token:
        token.trim(),

      headers: {
        Accept:
          "application/json",

        ...(body !==
            undefined &&
          body !==
            null &&
          typeof body !==
            "string" &&
          !(body instanceof
            FormData)
          ? {
              "Content-Type":
                "application/json"
            }
          : {}),

        ...(options.headers ||
          {})
      }
    }
  );
}


/* =========================================================
   SLEEP
========================================================= */

function sleep(
  milliseconds
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}


/* =========================================================
   API CONFIG
========================================================= */

function getConfig() {
  return {
    baseUrl:
      DEFAULTS.baseUrl,

    timeout:
      DEFAULTS.timeout,

    retries:
      DEFAULTS.retries
  };
}


/* =========================================================
   API STATE
========================================================= */

function getState() {
  return {

    requestCount:
      state.requestCount,

    activeRequests:
      state.activeRequests,

    lastRequestAt:
      state.lastRequestAt,

    lastError:
      state.lastError
  };
}


/* =========================================================
   RESET STATE
========================================================= */

function resetState() {
  state.requestCount =
    0;

  state.activeRequests =
    0;

  state.lastRequestAt =
    null;

  state.lastError =
    null;
}


/* =========================================================
   EXPORT
========================================================= */

export {

  API_EVENTS,

  HTTP_METHODS,

  ApiError,

  buildUrl,

  normalizeError,

  request,

  get,

  post,

  put,

  patch,

  del,

  getJson,

  postJson,

  authenticated,

  authenticatedJson,

  getConfig,

  getState,

  resetState

};
