/*
 * SaveBite
 * Global Application Configuration
 *
 * IMPORTANT:
 * This file contains PUBLIC frontend configuration only.
 *
 * NEVER put these here:
 * - B2 Application Key
 * - B2 Secret Key
 * - Firebase Admin credentials
 * - Private API secrets
 * - Payment gateway secret keys
 */


/* =========================================================
   ENVIRONMENT
========================================================= */

const ENVIRONMENTS =
  Object.freeze({
    DEVELOPMENT: "development",
    STAGING: "staging",
    PRODUCTION: "production"
  });


/*
 * Change this only when deploying.
 *
 * For local testing:
 * development
 *
 * For live SaveBite:
 * production
 */

const ENVIRONMENT =
  String(
    globalThis.SAVEBITE_ENVIRONMENT ||
    ENVIRONMENTS.PRODUCTION
  ).trim().toLowerCase();


/* =========================================================
   APPLICATION
========================================================= */

const APP = Object.freeze({

  name: "SaveBite",

  shortName: "SaveBite",

  version: "1.0.0",

  environment:
    ENVIRONMENT,

  currency:
    "INR",

  currencySymbol:
    "₹",

  country:
    "IN",

  language:
    "en-IN",

  timezone:
    "Asia/Kolkata"
});


/* =========================================================
   DOMAIN
========================================================= */

const DOMAINS = Object.freeze({

  production:
    "https://savebite.in",

  development:
    "http://localhost:5500",

  staging:
    "https://staging.savebite.in"
});


const APP_ORIGIN =
  DOMAINS[
    ENVIRONMENT
  ] ||
  DOMAINS.production;


/* =========================================================
   API
========================================================= */

const API = Object.freeze({

  baseUrl:
    String(
      globalThis.SAVEBITE_API_URL ||
      ""
    ).trim(),

  timeout:
    30000,

  uploadTimeout:
    120000,

  retryAttempts:
    2
});


/* =========================================================
   B2 STORAGE API
========================================================= */

const STORAGE = Object.freeze({

  apiUrl:
    String(
      globalThis.SAVEBITE_B2_API_URL ||
      API.baseUrl ||
      ""
    ).trim(),

  maxImageSize:
    10 * 1024 * 1024,

  maxDocumentSize:
    20 * 1024 * 1024,

  allowedImageTypes:
    Object.freeze([
      "image/jpeg",
      "image/png",
      "image/webp"
    ]),

  allowedDocumentTypes:
    Object.freeze([
      "application/pdf"
    ])
});


/* =========================================================
   FIREBASE
========================================================= */

const FIREBASE = Object.freeze({

  sdkVersion:
    "12.2.1",

  authEnabled:
    true,

  firestoreEnabled:
    true,

  realtimeDatabaseEnabled:
    true,

  storageEnabled:
    false,

  messagingEnabled:
    true
});


/* =========================================================
   MAP
========================================================= */

const MAP = Object.freeze({

  provider:
    "leaflet",

  tileProvider:
    "OpenStreetMap",

  /*
   * Google Maps is intentionally not used.
   */

  googleMapsEnabled:
    false,

  defaultCountry:
    "India",

  defaultCity:
    "Mohali",

  defaultLatitude:
    30.7046,

  defaultLongitude:
    76.7179,

  defaultZoom:
    13,

  minZoom:
    5,

  maxZoom:
    19,

  geolocationTimeout:
    10000,

  geolocationMaximumAge:
    30000,

  enableHighAccuracy:
    true
});


/* =========================================================
   BUSINESS
========================================================= */

const BUSINESS = Object.freeze({

  defaultStatus:
    "pending",

  approvedStatus:
    "approved",

  rejectedStatus:
    "rejected",

  suspendedStatus:
    "suspended",

  defaultOpeningHour:
    "09:00",

  defaultClosingHour:
    "22:00"
});


/* =========================================================
   DEALS
========================================================= */

const DEALS = Object.freeze({

  defaultExpiryHours:
    24,

  minimumQuantity:
    1,

  maximumImageCount:
    5,

  minimumDiscountPercent:
    1,

  maximumDiscountPercent:
    99
});


/* =========================================================
   ORDERS
========================================================= */

const ORDER_STATUS =
  Object.freeze({

    PENDING:
      "pending",

    CONFIRMED:
      "confirmed",

    READY:
      "ready",

    PICKED_UP:
      "picked_up",

    COMPLETED:
      "completed",

    CANCELLED:
      "cancelled",

    EXPIRED:
      "expired"
  });


const PAYMENT_STATUS =
  Object.freeze({

    PENDING:
      "pending",

    PAID:
      "paid",

    FAILED:
      "failed",

    REFUNDED:
      "refunded"
  });


/* =========================================================
   USER ROLES
========================================================= */

const ROLES =
  Object.freeze({

    CUSTOMER:
      "customer",

    BUSINESS:
      "business",

    ADMIN:
      "admin"
  });


/* =========================================================
   ROUTES
========================================================= */

const ROUTES =
  Object.freeze({

    HOME:
      "/",

    LOGIN:
      "/auth/login.html",

    REGISTER:
      "/auth/register.html",

    CUSTOMER:
      "/customer/home.html",

    CUSTOMER_DASHBOARD:
      "/customer/dashboard.html",

    BUSINESS:
      "/business/home.html",

    BUSINESS_DASHBOARD:
      "/business/dashboard.html",

    ADMIN:
      "/admin/index.html",

    PROFILE:
      "/customer/profile.html",

    BUSINESS_PROFILE:
      "/business/profile.html",

    ORDERS:
      "/customer/orders.html",

    BUSINESS_ORDERS:
      "/business/orders.html",

    DEALS:
      "/customer/deals.html",

    BUSINESS_DEALS:
      "/business/deals.html"
  });


/* =========================================================
   PWA
========================================================= */

const PWA =
  Object.freeze({

    enabled:
      true,

    manifest:
      "/manifest.json",

    serviceWorker:
      "/service-worker.js",

    cacheVersion:
      `savebite-${APP.version}`,

    installPromptEnabled:
      true
  });


/* =========================================================
   PAGINATION
========================================================= */

const PAGINATION =
  Object.freeze({

    defaultLimit:
      20,

    maximumLimit:
      100
  });


/* =========================================================
   SECURITY
========================================================= */

const SECURITY =
  Object.freeze({

    authenticationSource:
      "firebase-auth",

    authorizationSource:
      "firebase-auth-and-server-rules",

    clientStorageAuthentication:
      false,

    allowGuestBrowsing:
      true,

    requireAuthenticationForOrders:
      true,

    requireAuthenticationForBusiness:
      true,

    requireAuthenticationForAdmin:
      true
  });


/* =========================================================
   FEATURE FLAGS
========================================================= */

const FEATURES =
  Object.freeze({

    customerAccounts:
      true,

    businessAccounts:
      true,

    adminDashboard:
      true,

    deals:
      true,

    favorites:
      true,

    orders:
      true,

    notifications:
      true,

    realtimeStatus:
      true,

    b2Storage:
      true,

    pwa:
      true,

    pushNotifications:
      true,

    locationServices:
      true,

    onlinePayments:
      false,

    coupons:
      false,

    referrals:
      false
  });


/* =========================================================
   VALIDATION
========================================================= */

function validateConfig() {

  if (
    !APP.name
  ) {
    throw new Error(
      "SaveBite application name is missing."
    );
  }

  if (
    !FIREBASE.authEnabled
  ) {
    throw new Error(
      "Firebase Authentication must remain enabled."
    );
  }

  if (
    MAP.googleMapsEnabled
  ) {
    throw new Error(
      "Google Maps is disabled in SaveBite."
    );
  }

  return true;
}


/* =========================================================
   CONFIG OBJECT
========================================================= */

const CONFIG =
  Object.freeze({

    APP,

    ENVIRONMENT,

    DOMAINS,

    APP_ORIGIN,

    API,

    STORAGE,

    FIREBASE,

    MAP,

    BUSINESS,

    DEALS,

    ORDER_STATUS,

    PAYMENT_STATUS,

    ROLES,

    ROUTES,

    PWA,

    PAGINATION,

    SECURITY,

    FEATURES

  });


/* =========================================================
   GLOBAL CONFIG
========================================================= */

if (
  typeof window !== "undefined"
) {
  window.SaveBiteConfig =
    CONFIG;
}


/* =========================================================
   VALIDATE
========================================================= */

validateConfig();


/* =========================================================
   EXPORT
========================================================= */

export {

  CONFIG,

  APP,
  ENVIRONMENT,
  ENVIRONMENTS,

  DOMAINS,
  APP_ORIGIN,

  API,
  STORAGE,

  FIREBASE,

  MAP,

  BUSINESS,
  DEALS,

  ORDER_STATUS,
  PAYMENT_STATUS,

  ROLES,

  ROUTES,

  PWA,

  PAGINATION,

  SECURITY,

  FEATURES,

  validateConfig

};
