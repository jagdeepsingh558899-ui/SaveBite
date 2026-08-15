/*
 * SaveBite
 * Common Utility Functions
 *
 * This file contains reusable, dependency-free helpers.
 *
 * IMPORTANT:
 * - No authentication logic here.
 * - No Firebase credentials here.
 * - No B2 credentials here.
 * - No business authorization here.
 */


/* =========================================================
   STRING HELPERS
========================================================= */

function toStringValue(value) {
  return String(value ?? "");
}


function cleanString(value) {
  return toStringValue(value).trim();
}


function normalizeEmail(email) {
  return cleanString(email).toLowerCase();
}


function normalizePhone(phone) {
  return cleanString(phone)
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");
}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function toNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function clamp(
  value,
  minimum,
  maximum
) {
  const number =
    toNumber(value);

  return Math.min(
    maximum,
    Math.max(
      minimum,
      number
    )
  );
}


function roundNumber(
  value,
  decimals = 2
) {
  const number =
    toNumber(value);

  const factor =
    10 ** decimals;

  return (
    Math.round(
      number * factor
    ) / factor
  );
}


/* =========================================================
   CURRENCY
========================================================= */

function formatCurrency(
  amount,
  currency = "INR"
) {
  const value =
    toNumber(amount);

  try {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          2
      }
    ).format(value);

  } catch {
    return `₹${value.toFixed(2)}`;
  }
}


function formatPrice(
  amount
) {
  return formatCurrency(
    amount,
    "INR"
  );
}


/* =========================================================
   PERCENTAGE
========================================================= */

function calculateDiscountPercent(
  originalPrice,
  salePrice
) {
  const original =
    toNumber(
      originalPrice
    );

  const sale =
    toNumber(
      salePrice
    );

  if (
    original <= 0 ||
    sale >= original
  ) {
    return 0;
  }

  return roundNumber(
    (
      (original - sale) /
      original
    ) * 100,
    2
  );
}


function calculateDiscountAmount(
  originalPrice,
  salePrice
) {
  return Math.max(
    0,
    roundNumber(
      toNumber(originalPrice) -
      toNumber(salePrice),
      2
    )
  );
}


/* =========================================================
   DATE / TIME
========================================================= */

function toDate(
  value
) {
  if (
    value instanceof Date
  ) {
    return value;
  }

  if (
    value &&
    typeof value.toDate ===
      "function"
  ) {
    return value.toDate();
  }

  if (
    typeof value === "number"
  ) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  if (
    typeof value === "string"
  ) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  return null;
}


function formatDate(
  value,
  options = {}
) {
  const date =
    toDate(value);

  if (!date) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...options
      }
    ).format(date);

  } catch {
    return "—";
  }
}


function formatDateTime(
  value
) {
  return formatDate(
    value,
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


function formatTime(
  value
) {
  const date =
    toDate(value);

  if (!date) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);

  } catch {
    return "—";
  }
}


/* =========================================================
   RELATIVE TIME
========================================================= */

function formatRelativeTime(
  value
) {
  const date =
    toDate(value);

  if (!date) {
    return "—";
  }

  const difference =
    Date.now() -
    date.getTime();

  const seconds =
    Math.floor(
      Math.abs(difference) /
      1000
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const hours =
    Math.floor(
      minutes / 60
    );

  const days =
    Math.floor(
      hours / 24
    );

  const future =
    difference < 0;

  if (seconds < 60) {
    return future
      ? "in a few seconds"
      : "just now";
  }

  if (minutes < 60) {
    return future
      ? `in ${minutes} min`
      : `${minutes} min ago`;
  }

  if (hours < 24) {
    return future
      ? `in ${hours} hr`
      : `${hours} hr ago`;
  }

  if (days < 7) {
    return future
      ? `in ${days} days`
      : `${days} days ago`;
  }

  return formatDate(
    date
  );
}


/* =========================================================
   DEAL EXPIRY
========================================================= */

function isExpired(
  value
) {
  const date =
    toDate(value);

  if (!date) {
    return false;
  }

  return (
    date.getTime() <=
    Date.now()
  );
}


function getRemainingTime(
  value
) {
  const date =
    toDate(value);

  if (!date) {
    return null;
  }

  const remaining =
    date.getTime() -
    Date.now();

  if (remaining <= 0) {
    return {
      expired: true,
      milliseconds: 0,
      seconds: 0,
      minutes: 0,
      hours: 0,
      days: 0
    };
  }

  const seconds =
    Math.floor(
      remaining / 1000
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const hours =
    Math.floor(
      minutes / 60
    );

  const days =
    Math.floor(
      hours / 24
    );

  return {
    expired: false,

    milliseconds:
      remaining,

    seconds:
      seconds % 60,

    minutes:
      minutes % 60,

    hours:
      hours % 24,

    days
  };
}


/* =========================================================
   ID GENERATION
========================================================= */

function generateId(
  prefix = ""
) {
  let id = "";

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    id =
      crypto.randomUUID();
  } else {
    id =
      `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;
  }

  return prefix
    ? `${prefix}_${id}`
    : id;
}


/* =========================================================
   DEBOUNCE
========================================================= */

function debounce(
  callback,
  delay = 300
) {
  let timeoutId = null;

  return function (...args) {
    clearTimeout(
      timeoutId
    );

    timeoutId =
      setTimeout(
        () => {
          callback.apply(
            this,
            args
          );
        },
        delay
      );
  };
}


/* =========================================================
   THROTTLE
========================================================= */

function throttle(
  callback,
  delay = 300
) {
  let lastRun = 0;

  return function (...args) {
    const now =
      Date.now();

    if (
      now - lastRun >=
      delay
    ) {
      lastRun = now;

      callback.apply(
        this,
        args
      );
    }
  };
}


/* =========================================================
   ASYNC DELAY
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
   SAFE JSON
========================================================= */

function safeJsonParse(
  value,
  fallback = null
) {
  try {
    return JSON.parse(
      value
    );
  } catch {
    return fallback;
  }
}


function safeJsonStringify(
  value,
  fallback = ""
) {
  try {
    return JSON.stringify(
      value
    );
  } catch {
    return fallback;
  }
}


/* =========================================================
   URL HELPERS
========================================================= */

function getQueryParams() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return Object.fromEntries(
    params.entries()
  );
}


function getQueryParam(
  name
) {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get(
    name
  );
}


function buildUrl(
  path,
  params = {}
) {
  const url =
    new URL(
      path,
      window.location.origin
    );

  Object.entries(
    params
  ).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(
          key,
          String(value)
        );
      }
    }
  );

  return url.toString();
}


/* =========================================================
   HTML SECURITY
========================================================= */

/*
 * Use this whenever user/database content is inserted
 * through innerHTML.
 *
 * Prefer textContent whenever possible.
 */

function escapeHtml(
  value
) {
  return toStringValue(
    value
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector, parent = document) {
  return parent.querySelector(
    selector
  );
}


function $$(selector, parent = document) {
  return [
    ...parent.querySelectorAll(
      selector
    )
  ];
}


function showElement(
  element
) {
  if (!element) {
    return;
  }

  element.hidden = false;
}


function hideElement(
  element
) {
  if (!element) {
    return;
  }

  element.hidden = true;
}


function toggleElement(
  element,
  visible
) {
  if (!element) {
    return;
  }

  element.hidden =
    !Boolean(visible);
}


/* =========================================================
   FORM HELPERS
========================================================= */

function getFormData(
  form
) {
  if (!(form instanceof HTMLFormElement)) {
    throw new TypeError(
      "A valid HTML form is required."
    );
  }

  const formData =
    new FormData(form);

  const data = {};

  for (
    const [
      key,
      value
    ] of formData.entries()
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        data,
        key
      )
    ) {
      if (
        Array.isArray(
          data[key]
        )
      ) {
        data[key].push(
          value
        );
      } else {
        data[key] = [
          data[key],
          value
        ];
      }
    } else {
      data[key] =
        value;
    }
  }

  return data;
}


/* =========================================================
   FILE HELPERS
========================================================= */

function isImageFile(
  file
) {
  if (!(file instanceof File)) {
    return false;
  }

  return [
    "image/jpeg",
    "image/png",
    "image/webp"
  ].includes(
    file.type
  );
}


function formatFileSize(
  bytes
) {
  const size =
    toNumber(bytes);

  if (size < 1024) {
    return `${size} B`;
  }

  if (
    size <
    1024 * 1024
  ) {
    return `${(
      size / 1024
    ).toFixed(1)} KB`;
  }

  if (
    size <
    1024 * 1024 * 1024
  ) {
    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    size /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}


/* =========================================================
   GEO HELPERS
========================================================= */

function isValidCoordinate(
  latitude,
  longitude
) {
  const lat =
    Number(latitude);

  const lng =
    Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}


function calculateDistanceKm(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  if (
    !isValidCoordinate(
      latitude1,
      longitude1
    ) ||
    !isValidCoordinate(
      latitude2,
      longitude2
    )
  ) {
    return null;
  }

  const earthRadiusKm =
    6371;

  const lat1 =
    Number(latitude1) *
    Math.PI /
    180;

  const lat2 =
    Number(latitude2) *
    Math.PI /
    180;

  const deltaLat =
    (
      Number(latitude2) -
      Number(latitude1)
    ) *
    Math.PI /
    180;

  const deltaLng =
    (
      Number(longitude2) -
      Number(longitude1)
    ) *
    Math.PI /
    180;

  const a =
    Math.sin(
      deltaLat / 2
    ) ** 2 +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(
      deltaLng / 2
    ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return roundNumber(
    earthRadiusKm * c,
    2
  );
}


/* =========================================================
   ARRAY HELPERS
========================================================= */

function uniqueArray(
  array
) {
  if (!Array.isArray(array)) {
    return [];
  }

  return [
    ...new Set(array)
  ];
}


function chunkArray(
  array,
  size = 10
) {
  if (!Array.isArray(array)) {
    return [];
  }

  const result = [];

  const chunkSize =
    Math.max(
      1,
      Number(size)
    );

  for (
    let i = 0;
    i < array.length;
    i += chunkSize
  ) {
    result.push(
      array.slice(
        i,
        i + chunkSize
      )
    );
  }

  return result;
}


/* =========================================================
   ERROR HELPERS
========================================================= */

function getErrorMessage(
  error,
  fallback =
    "Something went wrong. Please try again."
) {
  if (!error) {
    return fallback;
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  return (
    error.message ||
    fallback
  );
}


/* =========================================================
   CLIPBOARD
========================================================= */

async function copyToClipboard(
  value
) {
  const text =
    toStringValue(value);

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text
    );

    return true;
  }

  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value =
    text;

  textarea.style.position =
    "fixed";

  textarea.style.opacity =
    "0";

  document.body.appendChild(
    textarea
  );

  textarea.focus();
  textarea.select();

  let success = false;

  try {
    success =
      document.execCommand(
        "copy"
      );
  } finally {
    textarea.remove();
  }

  return success;
}


/* =========================================================
   EXPORT
========================================================= */

export {

  toStringValue,
  cleanString,
  normalizeEmail,
  normalizePhone,

  toNumber,
  clamp,
  roundNumber,

  formatCurrency,
  formatPrice,

  calculateDiscountPercent,
  calculateDiscountAmount,

  toDate,
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,

  isExpired,
  getRemainingTime,

  generateId,

  debounce,
  throttle,
  sleep,

  safeJsonParse,
  safeJsonStringify,

  getQueryParams,
  getQueryParam,
  buildUrl,

  escapeHtml,

  $,
  $$,

  showElement,
  hideElement,
  toggleElement,

  getFormData,

  isImageFile,
  formatFileSize,

  isValidCoordinate,
  calculateDistanceKm,

  uniqueArray,
  chunkArray,

  getErrorMessage,

  copyToClipboard

};
