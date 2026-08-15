/*
 * SaveBite
 * Firebase Authentication Guard
 *
 * Responsibilities:
 * - Observe Firebase Auth state
 * - Protect authenticated pages
 * - Protect role-specific pages
 * - Redirect unauthenticated users
 * - Redirect unauthorized roles
 * - Wait for Firebase Auth initialization
 *
 * SECURITY:
 * Firebase Auth is the authentication source of truth.
 *
 * localStorage/sessionStorage must NEVER be used
 * as proof that a user is authenticated or authorized.
 *
 * IMPORTANT:
 * Client-side guards are UX/navigation protection only.
 * Firestore / Realtime Database Security Rules remain
 * the real authorization boundary.
 */


/* =========================================================
   IMPORTS
========================================================= */

import {
  auth,
  waitForAuthReady,
  getCurrentUser,
  getUserProfile,
  onAuthStateChangedSafe
} from "../firebase/firebase-auth.js";

import {
  ROUTES,
  ROUTE_ROLES,
  getHomeRouteForRole,
  canAccessRoute,
  navigate,
  redirect,
  getCurrentPath,
  findRouteByPath,
  ROUTER_EVENTS
} from "./router.js";


/* =========================================================
   EVENTS
========================================================= */

const AUTH_GUARD_EVENTS =
  Object.freeze({

    READY:
      "savebite:auth-guard-ready",

    CHECKING:
      "savebite:auth-guard-checking",

    ALLOWED:
      "savebite:auth-guard-allowed",

    BLOCKED:
      "savebite:auth-guard-blocked",

    AUTHENTICATED:
      "savebite:auth-guard-authenticated",

    SIGNED_OUT:
      "savebite:auth-guard-signed-out",

    PROFILE_LOADED:
      "savebite:auth-guard-profile-loaded",

    ERROR:
      "savebite:auth-guard-error"
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  initialized:
    false,

  ready:
    false,

  checking:
    false,

  authenticated:
    false,

  user:
    null,

  profile:
    null,

  role:
    null,

  authUnsubscribe:
    null,

  initializationPromise:
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
   ROLE NORMALIZATION
========================================================= */

function normalizeRole(
  role
) {
  if (
    typeof role !==
    "string"
  ) {
    return null;
  }

  const normalized =
    role
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );


  switch (
    normalized
  ) {

    case "customer":
    case "user":
    case "buyer":
      return ROUTE_ROLES.CUSTOMER;

    case "business":
    case "merchant":
    case "shop":
    case "store":
      return ROUTE_ROLES.BUSINESS;

    case "admin":
    case "administrator":
      return ROUTE_ROLES.ADMIN;

    case "superadmin":
    case "super_admin":
      return ROUTE_ROLES.SUPER_ADMIN;

    default:
      return null;
  }
}


/* =========================================================
   PROFILE ROLE EXTRACTION
========================================================= */

function getRoleFromProfile(
  profile
) {
  if (
    !profile ||
    typeof profile !==
      "object"
  ) {
    return null;
  }


  /*
   * Prefer the canonical role field.
   */

  const candidates = [

    profile.role,

    profile.userRole,

    profile.accountRole,

    profile.type
  ];


  for (
    const candidate of
      candidates
  ) {
    const role =
      normalizeRole(
        candidate
      );

    if (role) {
      return role;
    }
  }


  return null;
}


/* =========================================================
   AUTH USER NORMALIZATION
========================================================= */

function normalizeAuthUser(
  user
) {
  if (!user) {
    return null;
  }

  return {
    uid:
      user.uid,

    email:
      user.email ||
      null,

    emailVerified:
      Boolean(
        user.emailVerified
      ),

    phoneNumber:
      user.phoneNumber ||
      null,

    displayName:
      user.displayName ||
      null,

    photoURL:
      user.photoURL ||
      null,

    isAnonymous:
      Boolean(
        user.isAnonymous
      )
  };
}


/* =========================================================
   CURRENT USER
========================================================= */

function getAuthenticatedUser() {
  try {
    return (
      getCurrentUser() ||
      auth?.currentUser ||
      null
    );
  } catch {
    return null;
  }
}


/* =========================================================
   AUTH STATE HANDLER
========================================================= */

async function handleAuthStateChanged(
  user
) {
  state.checking =
    true;

  emit(
    AUTH_GUARD_EVENTS.CHECKING,
    {
      authenticated:
        Boolean(user)
    }
  );


  try {

    if (!user) {

      state.authenticated =
        false;

      state.user =
        null;

      state.profile =
        null;

      state.role =
        null;


      emit(
        AUTH_GUARD_EVENTS.SIGNED_OUT
      );

      return;
    }


    state.authenticated =
      true;

    state.user =
      normalizeAuthUser(
        user
      );


    emit(
      AUTH_GUARD_EVENTS.AUTHENTICATED,
      {
        user:
          state.user
      }
    );


    /*
     * The profile is loaded from the actual
     * backend profile source.
     *
     * If profile loading fails, do not invent
     * a role from localStorage or URL parameters.
     */

    try {

      const profile =
        await getUserProfile(
          user.uid
        );

      state.profile =
        profile ||
        null;


      state.role =
        getRoleFromProfile(
          state.profile
        );


      emit(
        AUTH_GUARD_EVENTS.PROFILE_LOADED,
        {
          profile:
            state.profile,

          role:
            state.role
        }
      );

    } catch (error) {

      state.profile =
        null;

      state.role =
        null;


      emit(
        AUTH_GUARD_EVENTS.ERROR,
        {
          error,
          context:
            "profile-load"
        }
      );
    }

  } finally {

    state.checking =
      false;

    state.ready =
      true;
  }
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeAuthGuard() {
  if (
    state.initialized &&
    state.ready
  ) {
    return getState();
  }


  if (
    state.initializationPromise
  ) {
    return state
      .initializationPromise;
  }


  state.initializationPromise =
    (async () => {

      try {

        /*
         * Wait until Firebase Auth has restored
         * its real persisted authentication state.
         */

        await waitForAuthReady();


        /*
         * Get current Firebase user after
         * Auth initialization.
         */

        const currentUser =
          getAuthenticatedUser();


        await handleAuthStateChanged(
          currentUser
        );


        /*
         * Subscribe to future Firebase Auth
         * state changes.
         */

        if (
          typeof onAuthStateChangedSafe ===
          "function"
        ) {

          state.authUnsubscribe =
            onAuthStateChangedSafe(
              async user => {

                await handleAuthStateChanged(
                  user
                );
              }
            );
        }


        state.initialized =
          true;

        state.ready =
          true;


        emit(
          AUTH_GUARD_EVENTS.READY,
          getState()
        );


        return getState();

      } catch (error) {

        state.ready =
          false;

        state.initialized =
          false;


        emit(
          AUTH_GUARD_EVENTS.ERROR,
          {
            error,
            context:
              "initialize"
          }
        );


        throw error;

      } finally {

        state.initializationPromise =
          null;
      }

    })();


  return state
    .initializationPromise;
}


/* =========================================================
   GET AUTH STATE
========================================================= */

function getAuthState() {
  return {
    authenticated:
      state.authenticated,

    user:
      state.user,

    profile:
      state.profile,

    role:
      state.role,

    ready:
      state.ready,

    checking:
      state.checking
  };
}


/* =========================================================
   WAIT UNTIL READY
========================================================= */

async function waitUntilReady() {
  if (
    state.ready
  ) {
    return getAuthState();
  }

  await initializeAuthGuard();

  return getAuthState();
}


/* =========================================================
   CHECK AUTHENTICATION
========================================================= */

async function isAuthenticated() {
  await waitUntilReady();

  /*
   * Read Firebase-derived state only.
   */

  return Boolean(
    getAuthenticatedUser()
  );
}


/* =========================================================
   REQUIRE AUTHENTICATION
========================================================= */

async function requireAuthentication(
  {
    redirectTo =
      ROUTES.login,

    preserveDestination =
      true
  } = {}
) {
  await waitUntilReady();


  const user =
    getAuthenticatedUser();


  if (user) {
    return {
      allowed:
        true,

      user:
        normalizeAuthUser(
          user
        ),

      profile:
        state.profile,

      role:
        state.role
    };
  }


  emit(
    AUTH_GUARD_EVENTS.BLOCKED,
    {
      reason:
        "authentication_required"
    }
  );


  const query =
    {};


  if (
    preserveDestination
  ) {
    const destination =
      window.location.pathname +
      window.location.search +
      window.location.hash;

    query.next =
      destination;
  }


  await navigate(
    redirectTo,
    {
      query,
      replace:
        true,

      authenticated:
        false
    }
  );


  return {
    allowed:
      false,

    reason:
      "authentication_required"
  };
}


/* =========================================================
   REQUIRE ROLE
========================================================= */

async function requireRole(
  requiredRoles,
  {
    redirectUnauthorized =
      true,

    redirectUnauthenticated =
      true
  } = {}
) {
  await waitUntilReady();


  const user =
    getAuthenticatedUser();


  if (!user) {

    emit(
      AUTH_GUARD_EVENTS.BLOCKED,
      {
        reason:
          "authentication_required"
      }
    );


    if (
      redirectUnauthenticated
    ) {
      await navigate(
        ROUTES.login,
        {
          replace:
            true,

          authenticated:
            false
        }
      );
    }


    return {
      allowed:
        false,

      reason:
        "authentication_required"
    };
  }


  const roles =
    Array.isArray(
      requiredRoles
    )
      ? requiredRoles
      : [
          requiredRoles
        ];


  const normalizedRoles =
    roles
      .map(
        normalizeRole
      )
      .filter(
        Boolean
      );


  const currentRole =
    normalizeRole(
      state.role
    );


  const allowed =
    normalizedRoles.includes(
      currentRole
    );


  if (
    allowed
  ) {

    emit(
      AUTH_GUARD_EVENTS.ALLOWED,
      {
        role:
          currentRole,

        requiredRoles:
          normalizedRoles
      }
    );


    return {
      allowed:
        true,

      role:
        currentRole,

      user:
        normalizeAuthUser(
          user
        ),

      profile:
        state.profile
    };
  }


  emit(
    AUTH_GUARD_EVENTS.BLOCKED,
    {
      reason:
        "role_not_allowed",

      role:
        currentRole,

      requiredRoles:
        normalizedRoles
    }
  );


  if (
    redirectUnauthorized
  ) {

    const home =
      getHomeRouteForRole(
        currentRole
      );


    await navigate(
      home,
      {
        replace:
          true,

        authenticated:
          true,

        role:
          currentRole
      }
    );
  }


  return {
    allowed:
      false,

    reason:
      "role_not_allowed",

    role:
      currentRole
  };
}


/* =========================================================
   PROTECT CURRENT ROUTE
========================================================= */

async function protectCurrentRoute(
  {
    redirectUnauthorized =
      true
  } = {}
) {
  await waitUntilReady();


  const path =
    getCurrentPath();


  const route =
    findRouteByPath(
      path
    );


  if (!route) {
    return {
      allowed:
        false,

      reason:
        "route_not_found"
    };
  }


  /*
   * Public routes do not require authentication.
   */

  if (
    route.public
  ) {
    return {
      allowed:
        true,

      route
    };
  }


  const user =
    getAuthenticatedUser();


  if (!user) {

    emit(
      AUTH_GUARD_EVENTS.BLOCKED,
      {
        reason:
          "authentication_required",

        route
      }
    );


    if (
      redirectUnauthorized
    ) {

      await navigate(
        ROUTES.login,
        {
          query: {
            next:
              path
          },

          replace:
            true,

          authenticated:
            false
        }
      );
    }


    return {
      allowed:
        false,

      reason:
        "authentication_required",

      route
    };
  }


  const role =
    normalizeRole(
      state.role
    );


  const allowed =
    canAccessRoute(
      route,
      {
        authenticated:
          true,

        role
      }
    );


  if (
    allowed
  ) {

    emit(
      AUTH_GUARD_EVENTS.ALLOWED,
      {
        route,

        role
      }
    );


    return {
      allowed:
        true,

      route,

      role,

      user:
        normalizeAuthUser(
          user
        ),

      profile:
        state.profile
    };
  }


  emit(
    AUTH_GUARD_EVENTS.BLOCKED,
    {
      reason:
        "role_not_allowed",

      route,

      role
    }
  );


  if (
    redirectUnauthorized
  ) {

    const home =
      getHomeRouteForRole(
        role
      );


    await navigate(
      home,
      {
        replace:
          true,

        authenticated:
          true,

        role
      }
    );
  }


  return {
    allowed:
      false,

    reason:
      "role_not_allowed",

    route,

    role
  };
}


/* =========================================================
   REQUIRE CURRENT ROUTE
========================================================= */

async function requireCurrentRoute() {
  return protectCurrentRoute({
    redirectUnauthorized:
      true
  });
}


/* =========================================================
   SIGNED-IN USER REDIRECT
========================================================= */

async function redirectIfAuthenticated() {
  await waitUntilReady();


  const user =
    getAuthenticatedUser();


  if (!user) {
    return false;
  }


  const role =
    normalizeRole(
      state.role
    );


  /*
   * Never use an unknown role to guess a
   * protected destination.
   */

  if (!role) {
    return false;
  }


  const home =
    getHomeRouteForRole(
      role
    );


  await navigate(
    home,
    {
      replace:
        true,

      authenticated:
        true,

      role
    }
  );


  return true;
}


/* =========================================================
   ROLE CHECK
========================================================= */

function hasRole(
  role
) {
  const current =
    normalizeRole(
      state.role
    );

  const required =
    normalizeRole(
      role
    );

  return Boolean(
    current &&
    required &&
    current ===
      required
  );
}


/* =========================================================
   PROFILE CHECK
========================================================= */

function hasProfile() {
  return Boolean(
    state.profile &&
    typeof state.profile ===
      "object"
  );
}


/* =========================================================
   GET UID
========================================================= */

function getUid() {
  const user =
    getAuthenticatedUser();

  return user
    ? user.uid
    : null;
}


/* =========================================================
   CLEANUP
========================================================= */

function destroyAuthGuard() {
  if (
    typeof state.authUnsubscribe ===
    "function"
  ) {
    state.authUnsubscribe();
  }

  state.authUnsubscribe =
    null;

  state.initialized =
    false;

  state.ready =
    false;

  state.authenticated =
    false;

  state.user =
    null;

  state.profile =
    null;

  state.role =
    null;
}


/* =========================================================
   STATE
========================================================= */

function getState() {
  return {
    initialized:
      state.initialized,

    ready:
      state.ready,

    checking:
      state.checking,

    authenticated:
      state.authenticated,

    user:
      state.user,

    profile:
      state.profile,

    role:
      state.role
  };
}


/* =========================================================
   AUTO START
========================================================= */

if (
  typeof window !==
  "undefined"
) {

  /*
   * Auth guard initializes when imported.
   * It still waits for Firebase Auth readiness
   * before making any access decision.
   */

  initializeAuthGuard()
    .catch(
      error => {

        emit(
          AUTH_GUARD_EVENTS.ERROR,
          {
            error,
            context:
              "auto-start"
          }
        );
      }
    );
}


/* =========================================================
   EXPORT
========================================================= */

export {

  AUTH_GUARD_EVENTS,

  normalizeRole,

  getRoleFromProfile,

  initializeAuthGuard,

  waitUntilReady,

  getAuthenticatedUser,

  getAuthState,

  getState,

  isAuthenticated,

  requireAuthentication,

  requireRole,

  protectCurrentRoute,

  requireCurrentRoute,

  redirectIfAuthenticated,

  hasRole,

  hasProfile,

  getUid,

  destroyAuthGuard

};
