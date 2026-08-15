/*
 * SaveBite
 * Browser Storage Layer
 *
 * IMPORTANT SECURITY RULE:
 *
 * Firebase Authentication = authentication source of truth.
 *
 * localStorage / sessionStorage:
 * - UI preferences
 * - onboarding state
 * - temporary non-sensitive cache
 * - harmless app settings
 *
 * NEVER store:
 * - Firebase passwords
 * - OTPs
 * - B2 credentials
 * - Firebase Admin credentials
 * - payment secrets
 * - authentication tokens
 * - sensitive personal data
 */


/* =========================================================
   STORAGE NAMESPACES
========================================================= */

const STORAGE_PREFIX =
  "savebite:";


/* =========================================================
   STORAGE KEYS
========================================================= */

const STORAGE_KEYS =
  Object.freeze({

    THEME:
      `${STORAGE_PREFIX}theme`,

    LANGUAGE:
      `${STORAGE_PREFIX}language`,

    ONBOARDING_COMPLETED:
      `${STORAGE_PREFIX}onboarding_completed`,

    INSTALL_DISMISSED:
      `${STORAGE_PREFIX}install_dismissed`,

    LAST_ROLE:
      `${STORAGE_PREFIX}last_role`,

    LAST_LOCATION:
      `${STORAGE_PREFIX}last_location`,

    RECENT_SEARCHES:
      `${STORAGE_PREFIX}recent_searches`,

    FAVORITE_CATEGORIES:
      `${STORAGE_PREFIX}favorite_categories`,

    UI_PREFERENCES:
      `${STORAGE_PREFIX}ui_preferences`,

    APP_VERSION:
      `${STORAGE_PREFIX}app_version`
  });


/* =========================================================
   FORBIDDEN KEY PATTERNS
========================================================= */

const FORBIDDEN_PATTERNS =
  Object.freeze([

    "password",
    "passwd",

    "otp",
    "verification",

    "token",
    "access_token",
    "refresh_token",

    "secret",
    "private_key",
    "api_key",

    "b2_key",
    "b2_secret",

    "admin_key",

    "credit_card",
    "card_number",
    "cvv",

    "firebase_token",

    "id_token"
  ]);


/* =========================================================
   KEY VALIDATION
========================================================= */

function normalizeKey(
  key
) {
  return String(
    key ?? ""
  ).trim();
}


function isForbiddenKey(
  key
) {
  const normalized =
    normalizeKey(
      key
    ).toLowerCase();

  if (!normalized) {
    return true;
  }

  return FORBIDDEN_PATTERNS.some(
    pattern =>
      normalized.includes(
        pattern
      )
  );
}


function validateKey(
  key
) {
  const normalized =
    normalizeKey(
      key
    );

  if (!normalized) {
    throw new Error(
      "Storage key is required."
    );
  }

  if (
    isForbiddenKey(
      normalized
    )
  ) {
    throw new Error(
      "Sensitive authentication or secret data cannot be stored in browser storage."
    );
  }

  return normalized;
}


/* =========================================================
   STORAGE AVAILABILITY
========================================================= */

function isStorageAvailable(
  storage
) {
  if (!storage) {
    return false;
  }

  const testKey =
    `${STORAGE_PREFIX}__test__`;

  try {
    storage.setItem(
      testKey,
      "1"
    );

    storage.removeItem(
      testKey
    );

    return true;

  } catch {
    return false;
  }
}


function getLocalStorage() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return isStorageAvailable(
    window.localStorage
  )
    ? window.localStorage
    : null;
}


function getSessionStorage() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return isStorageAvailable(
    window.sessionStorage
  )
    ? window.sessionStorage
    : null;
}


/* =========================================================
   JSON HELPERS
========================================================= */

function parseStoredValue(
  value,
  fallback = null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  try {
    return JSON.parse(
      value
    );

  } catch {
    return fallback;
  }
}


function serializeValue(
  value
) {
  try {
    return JSON.stringify(
      value
    );

  } catch {
    throw new Error(
      "Unable to serialize storage value."
    );
  }
}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function setLocal(
  key,
  value
) {
  const safeKey =
    validateKey(
      key
    );

  const storage =
    getLocalStorage();

  if (!storage) {
    return false;
  }

  storage.setItem(
    safeKey,
    serializeValue(
      value
    )
  );

  return true;
}


function getLocal(
  key,
  fallback = null
) {
  const safeKey =
    validateKey(
      key
    );

  const storage =
    getLocalStorage();

  if (!storage) {
    return fallback;
  }

  return parseStoredValue(
    storage.getItem(
      safeKey
    ),
    fallback
  );
}


function removeLocal(
  key
) {
  const safeKey =
    validateKey(
      key
    );

  const storage =
    getLocalStorage();

  if (!storage) {
    return false;
  }

  storage.removeItem(
    safeKey
  );

  return true;
}


/* =========================================================
   SESSION STORAGE
========================================================= */

function setSession(
  key,
  value
) {
  const safeKey =
    validateKey(
      key
    );

  const storage =
    getSessionStorage();

  if (!storage) {
    return false;
  }

  storage.setItem(
    safeKey,
    serializeValue(
      value
    )
  );

  return true;
}


function getSession(
  key,
  fallback = null
) {
  const safeKey =
    validateKey(
      key
    );

  const storage =
    getSessionStorage();

  if (!storage) {
    return fallback;
  }

  return parseStoredValue(
    storage.getItem(
      safeKey
    ),
    fallback
  );
}


function removeSession(
  key
) {
  const safeKey =
    validateKey(
      key
    );

  const storage =
    getSessionStorage();

  if (!storage) {
    return false;
  }

  storage.removeItem(
    safeKey
  );

  return true;
}


/* =========================================================
   THEME
========================================================= */

const THEME_VALUES =
  Object.freeze([
    "system",
    "light",
    "dark"
  ]);


function setTheme(
  theme
) {
  const value =
    String(
      theme ?? ""
    ).trim().toLowerCase();

  if (
    !THEME_VALUES.includes(
      value
    )
  ) {
    throw new Error(
      "Invalid theme."
    );
  }

  return setLocal(
    STORAGE_KEYS.THEME,
    value
  );
}


function getTheme() {
  return getLocal(
    STORAGE_KEYS.THEME,
    "system"
  );
}


/* =========================================================
   LANGUAGE
========================================================= */

function setLanguage(
  language
) {
  const value =
    String(
      language ?? ""
    ).trim();

  if (!value) {
    throw new Error(
      "Language is required."
    );
  }

  return setLocal(
    STORAGE_KEYS.LANGUAGE,
    value
  );
}


function getLanguage() {
  return getLocal(
    STORAGE_KEYS.LANGUAGE,
    "en-IN"
  );
}


/* =========================================================
   ONBOARDING
========================================================= */

function setOnboardingCompleted(
  completed = true
) {
  return setLocal(
    STORAGE_KEYS.ONBOARDING_COMPLETED,
    Boolean(completed)
  );
}


function hasCompletedOnboarding() {
  return Boolean(
    getLocal(
      STORAGE_KEYS.ONBOARDING_COMPLETED,
      false
    )
  );
}


/* =========================================================
   INSTALL PROMPT
========================================================= */

function setInstallPromptDismissed(
  dismissed = true
) {
  return setLocal(
    STORAGE_KEYS.INSTALL_DISMISSED,
    Boolean(dismissed)
  );
}


function isInstallPromptDismissed() {
  return Boolean(
    getLocal(
      STORAGE_KEYS.INSTALL_DISMISSED,
      false
    )
  );
}


/* =========================================================
   LAST ROLE
========================================================= */

function setLastRole(
  role
) {
  const value =
    String(
      role ?? ""
    ).trim().toLowerCase();

  const allowedRoles = [
    "customer",
    "business"
  ];

  if (
    !allowedRoles.includes(
      value
    )
  ) {
    throw new Error(
      "Invalid SaveBite role."
    );
  }

  return setLocal(
    STORAGE_KEYS.LAST_ROLE,
    value
  );
}


function getLastRole() {
  return getLocal(
    STORAGE_KEYS.LAST_ROLE,
    null
  );
}


/* =========================================================
   LOCATION CACHE
========================================================= */

/*
 * This is only a non-sensitive UI convenience cache.
 *
 * It must never be used as proof of identity,
 * authorization or exact user location.
 */

function setLastLocation(
  location
) {
  if (
    !location ||
    typeof location !==
      "object"
  ) {
    throw new TypeError(
      "Location must be an object."
    );
  }

  const latitude =
    Number(
      location.latitude
    );

  const longitude =
    Number(
      location.longitude
    );

  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    throw new Error(
      "Invalid location coordinates."
    );
  }

  return setLocal(
    STORAGE_KEYS.LAST_LOCATION,
    {
      latitude,
      longitude
    }
  );
}


function getLastLocation() {
  return getLocal(
    STORAGE_KEYS.LAST_LOCATION,
    null
  );
}


function clearLastLocation() {
  return removeLocal(
    STORAGE_KEYS.LAST_LOCATION
  );
}


/* =========================================================
   RECENT SEARCHES
========================================================= */

function getRecentSearches() {
  const searches =
    getLocal(
      STORAGE_KEYS.RECENT_SEARCHES,
      []
    );

  return Array.isArray(
    searches
  )
    ? searches
    : [];
}


function addRecentSearch(
  search,
  maximum = 10
) {
  const value =
    String(
      search ?? ""
    ).trim();

  if (!value) {
    return false;
  }

  const searches =
    getRecentSearches();

  const filtered =
    searches.filter(
      item =>
        String(item)
          .toLowerCase() !==
        value.toLowerCase()
    );

  filtered.unshift(
    value
  );

  return setLocal(
    STORAGE_KEYS.RECENT_SEARCHES,
    filtered.slice(
      0,
      Math.max(
        1,
        Number(maximum)
      )
    )
  );
}


function clearRecentSearches() {
  return removeLocal(
    STORAGE_KEYS.RECENT_SEARCHES
  );
}


/* =========================================================
   FAVORITE CATEGORIES
========================================================= */

function getFavoriteCategories() {
  const categories =
    getLocal(
      STORAGE_KEYS.FAVORITE_CATEGORIES,
      []
    );

  return Array.isArray(
    categories
  )
    ? categories
    : [];
}


function setFavoriteCategories(
  categories
) {
  if (
    !Array.isArray(
      categories
    )
  ) {
    throw new TypeError(
      "Categories must be an array."
    );
  }

  const cleaned =
    [
      ...new Set(
        categories
          .map(
            item =>
              String(
                item ?? ""
              ).trim()
          )
          .filter(Boolean)
      )
    ];

  return setLocal(
    STORAGE_KEYS.FAVORITE_CATEGORIES,
    cleaned
  );
}


/* =========================================================
   UI PREFERENCES
========================================================= */

function getUiPreferences() {
  const preferences =
    getLocal(
      STORAGE_KEYS.UI_PREFERENCES,
      {}
    );

  if (
    !preferences ||
    typeof preferences !==
      "object" ||
    Array.isArray(
      preferences
    )
  ) {
    return {};
  }

  return preferences;
}


function setUiPreference(
  key,
  value
) {
  const safeKey =
    String(
      key ?? ""
    ).trim();

  if (!safeKey) {
    throw new Error(
      "UI preference key is required."
    );
  }

  const preferences =
    getUiPreferences();

  preferences[
    safeKey
  ] = value;

  return setLocal(
    STORAGE_KEYS.UI_PREFERENCES,
    preferences
  );
}


function getUiPreference(
  key,
  fallback = null
) {
  const safeKey =
    String(
      key ?? ""
    ).trim();

  if (!safeKey) {
    return fallback;
  }

  const preferences =
    getUiPreferences();

  return Object.prototype.hasOwnProperty.call(
    preferences,
    safeKey
  )
    ? preferences[
        safeKey
      ]
    : fallback;
}


function removeUiPreference(
  key
) {
  const preferences =
    getUiPreferences();

  const safeKey =
    String(
      key ?? ""
    ).trim();

  if (!safeKey) {
    return false;
  }

  delete preferences[
    safeKey
  ];

  return setLocal(
    STORAGE_KEYS.UI_PREFERENCES,
    preferences
  );
}


/* =========================================================
   APP VERSION
========================================================= */

function setAppVersion(
  version
) {
  return setLocal(
    STORAGE_KEYS.APP_VERSION,
    String(
      version ?? ""
    )
  );
}


function getAppVersion() {
  return getLocal(
    STORAGE_KEYS.APP_VERSION,
    null
  );
}


/* =========================================================
   CLEAR SAFE APP DATA
========================================================= */

function clearSafeAppData() {
  const storage =
    getLocalStorage();

  if (!storage) {
    return false;
  }

  Object.values(
    STORAGE_KEYS
  ).forEach(
    key => {
      try {
        storage.removeItem(
          key
        );
      } catch {
        // Ignore individual removal failures.
      }
    }
  );

  return true;
}


/* =========================================================
   STORAGE EVENT
========================================================= */

function onStorageChange(
  callback
) {
  if (
    typeof window ===
      "undefined" ||
    typeof callback !==
      "function"
  ) {
    return () => {};
  }

  const handler =
    event => {
      callback(
        event
      );
    };

  window.addEventListener(
    "storage",
    handler
  );

  return () => {
    window.removeEventListener(
      "storage",
      handler
    );
  };
}


/* =========================================================
   EXPORT
========================================================= */

export {

  STORAGE_PREFIX,
  STORAGE_KEYS,

  isStorageAvailable,

  setLocal,
  getLocal,
  removeLocal,

  setSession,
  getSession,
  removeSession,

  setTheme,
  getTheme,

  setLanguage,
  getLanguage,

  setOnboardingCompleted,
  hasCompletedOnboarding,

  setInstallPromptDismissed,
  isInstallPromptDismissed,

  setLastRole,
  getLastRole,

  setLastLocation,
  getLastLocation,
  clearLastLocation,

  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,

  getFavoriteCategories,
  setFavoriteCategories,

  getUiPreferences,
  setUiPreference,
  getUiPreference,
  removeUiPreference,

  setAppVersion,
  getAppVersion,

  clearSafeAppData,

  onStorageChange

};
