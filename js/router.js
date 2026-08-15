/*
 * SaveBite
 * Central Router
 *
 * Responsibilities:
 * - Application navigation
 * - Route matching
 * - Protected route metadata
 * - Role-based route metadata
 * - Query/hash handling
 * - Browser history handling
 * - Redirect helpers
 *
 * IMPORTANT:
 * This router is NOT a security boundary.
 * Firebase Auth + Firestore/Realtime Database rules
 * remain the real source of authorization.
 *
 * Never trust a role supplied by the URL.
 */


/* =========================================================
   CONSTANTS
========================================================= */

const ROUTER_EVENTS =
  Object.freeze({
    BEFORE_NAVIGATE:
      "savebite:before-navigate",

    NAVIGATE:
      "savebite:navigate",

    AFTER_NAVIGATE:
      "savebite:after-navigate",

    ROUTE_NOT_FOUND:
      "savebite:route-not-found",

    ROUTE_BLOCKED:
      "savebite:route-blocked"
  });


const ROUTE_ROLES =
  Object.freeze({
    CUSTOMER:
      "customer",

    BUSINESS:
      "business",

    ADMIN:
      "admin",

    SUPER_ADMIN:
      "super_admin"
  });


/* =========================================================
   ROUTE DEFINITIONS
========================================================= */

/*
 * Paths are intentionally relative to the project root.
 *
 * These are route metadata definitions.
 * Actual HTML files can be mapped here without allowing
 * arbitrary URL paths to become executable file paths.
 */

const ROUTES = Object.freeze({

  home: {
    name:
      "home",

    path:
      "/index.html",

    file:
      "/index.html",

    public:
      true
  },


  login: {
    name:
      "login",

    path:
      "/auth/login.html",

    file:
      "/auth/login.html",

    public:
      true
  },


  register: {
    name:
      "register",

    path:
      "/auth/register.html",

    file:
      "/auth/register.html",

    public:
      true
  },


  customerHome: {
    name:
      "customer-home",

    path:
      "/customer/home.html",

    file:
      "/customer/home.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.CUSTOMER
    ]
  },


  customerDeals: {
    name:
      "customer-deals",

    path:
      "/customer/deals.html",

    file:
      "/customer/deals.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.CUSTOMER
    ]
  },


  customerOrders: {
    name:
      "customer-orders",

    path:
      "/customer/orders.html",

    file:
      "/customer/orders.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.CUSTOMER
    ]
  },


  customerProfile: {
    name:
      "customer-profile",

    path:
      "/customer/profile.html",

    file:
      "/customer/profile.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.CUSTOMER
    ]
  },


  businessHome: {
    name:
      "business-home",

    path:
      "/business/home.html",

    file:
      "/business/home.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.BUSINESS
    ]
  },


  businessRegister: {
    name:
      "business-register",

    path:
      "/business/register.html",

    file:
      "/business/register.html",

    public:
      true
  },


  businessDeals: {
    name:
      "business-deals",

    path:
      "/business/deals.html",

    file:
      "/business/deals.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.BUSINESS
    ]
  },


  businessOrders: {
    name:
      "business-orders",

    path:
      "/business/orders.html",

    file:
      "/business/orders.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.BUSINESS
    ]
  },


  businessProfile: {
    name:
      "business-profile",

    path:
      "/business/profile.html",

    file:
      "/business/profile.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.BUSINESS
    ]
  },


  adminHome: {
    name:
      "admin-home",

    path:
      "/admin/index.html",

    file:
      "/admin/index.html",

    public:
      false,

    roles: [
      ROUTE_ROLES.ADMIN,
      ROUTE_ROLES.SUPER_ADMIN
    ]
  },


  notFound: {
    name:
      "not-found",

    path:
      "/404.html",

    file:
      "/404.html",

    public:
      true
  }

});


/* =========================================================
   STATE
========================================================= */

const state = {
  currentRoute:
    null,

  currentUrl:
    null,

  navigating:
    false,

  started:
    false
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
   NORMALIZE PATH
========================================================= */

function normalizePath(
  path
) {
  if (
    typeof path !==
    "string"
  ) {
    return "/";
  }

  let normalized =
    path.trim();


  if (
    normalized === ""
  ) {
    return "/";
  }


  /*
   * Remove origin if a full URL was supplied.
   */

  try {
    const url =
      new URL(
        normalized,
        window.location.origin
      );

    normalized =
      url.pathname;

  } catch {
    /*
     * Continue with the original
     * string if it is not a valid URL.
     */
  }


  /*
   * Ensure leading slash.
   */

  if (
    !normalized.startsWith(
      "/"
    )
  ) {
    normalized =
      `/${normalized}`;
  }


  /*
   * Normalize duplicate slashes.
   */

  normalized =
    normalized.replace(
      /\/{2,}/g,
      "/"
    );


  /*
   * Remove trailing slash,
   * except root.
   */

  if (
    normalized.length > 1 &&
    normalized.endsWith("/")
  ) {
    normalized =
      normalized.slice(
        0,
        -1
      );
  }


  return normalized;
}


/* =========================================================
   CURRENT URL
========================================================= */

function getCurrentUrl() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return new URL(
    window.location.href
  );
}


function getCurrentPath() {
  const url =
    getCurrentUrl();

  return url
    ? normalizePath(
        url.pathname
      )
    : "/";
}


/* =========================================================
   QUERY PARAMETERS
========================================================= */

function getQueryParams(
  url = getCurrentUrl()
) {
  if (!url) {
    return {};
  }

  const params =
    {};

  url.searchParams.forEach(
    (
      value,
      key
    ) => {
      params[
        key
      ] = value;
    }
  );

  return params;
}


/* =========================================================
   HASH
========================================================= */

function getHash(
  url = getCurrentUrl()
) {
  if (!url) {
    return "";
  }

  return url.hash
    ? url.hash.slice(1)
    : "";
}


/* =========================================================
   MATCH ROUTE
========================================================= */

function findRouteByPath(
  path
) {
  const normalized =
    normalizePath(
      path
    );


  const routes =
    Object.values(
      ROUTES
    );


  return (
    routes.find(
      route =>
        normalizePath(
          route.path
        ) ===
        normalized
    ) ||
    null
  );
}


/* =========================================================
   FIND ROUTE
========================================================= */

function getRoute(
  name
) {
  if (
    typeof name !==
    "string"
  ) {
    return null;
  }

  return (
    ROUTES[name] ||
    Object.values(
      ROUTES
    ).find(
      route =>
        route.name ===
        name
    ) ||
    null
  );
}


/* =========================================================
   ROUTE URL
========================================================= */

function routeUrl(
  routeOrName,
  {
    query = {},
    hash = ""
  } = {}
) {
  const route =
    typeof routeOrName ===
    "string"
      ? getRoute(
          routeOrName
        )
      : routeOrName;


  if (!route) {
    throw new Error(
      "Unknown SaveBite route."
    );
  }


  const url =
    new URL(
      route.path,
      window.location.origin
    );


  Object.entries(
    query || {}
  ).forEach(
    (
      [key, value]
    ) => {

      if (
        value ===
          undefined ||
        value === null
      ) {
        return;
      }

      url.searchParams.set(
        key,
        String(value)
      );
    }
  );


  if (hash) {
    url.hash =
      String(hash)
        .replace(
          /^#/,
          ""
        );
  }


  /*
   * Return a project-relative URL.
   */

  return (
    url.pathname +
    url.search +
    url.hash
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


  const aliases =
    {
      user:
        ROUTE_ROLES.CUSTOMER,

      customer:
        ROUTE_ROLES.CUSTOMER,

      buyer:
        ROUTE_ROLES.CUSTOMER,

      business:
        ROUTE_ROLES.BUSINESS,

      merchant:
        ROUTE_ROLES.BUSINESS,

      shop:
        ROUTE_ROLES.BUSINESS,

      store:
        ROUTE_ROLES.BUSINESS,

      admin:
        ROUTE_ROLES.ADMIN,

      administrator:
        ROUTE_ROLES.ADMIN,

      superadmin:
        ROUTE_ROLES.SUPER_ADMIN,

      super_admin:
        ROUTE_ROLES.SUPER_ADMIN
    };


  return (
    aliases[
      normalized
    ] ||
    null
  );
}


/* =========================================================
   ROUTE ACCESS
========================================================= */

function canAccessRoute(
  route,
  {
    authenticated =
      false,

    role =
      null
  } = {}
) {
  if (!route) {
    return false;
  }


  if (
    route.public
  ) {
    return true;
  }


  if (
    !authenticated
  ) {
    return false;
  }


  if (
    !Array.isArray(
      route.roles
    ) ||
    route.roles.length ===
      0
  ) {
    return true;
  }


  const normalizedRole =
    normalizeRole(
      role
    );


  return route.roles.includes(
    normalizedRole
  );
}


/* =========================================================
   DEFAULT ROUTE BY ROLE
========================================================= */

function getHomeRouteForRole(
  role
) {
  const normalizedRole =
    normalizeRole(
      role
    );


  switch (
    normalizedRole
  ) {

    case ROUTE_ROLES.CUSTOMER:
      return ROUTES.customerHome;

    case ROUTE_ROLES.BUSINESS:
      return ROUTES.businessHome;

    case ROUTE_ROLES.ADMIN:
    case ROUTE_ROLES.SUPER_ADMIN:
      return ROUTES.adminHome;

    default:
      return ROUTES.home;
  }
}


/* =========================================================
   NAVIGATION
========================================================= */

async function navigate(
  target,
  {
    replace = false,

    query = {},

    hash = "",

    authenticated =
      false,

    role = null,

    external =
      false
  } = {}
) {
  if (
    state.navigating
  ) {
    return false;
  }


  state.navigating =
    true;


  try {

    /*
     * External URL support is deliberately
     * explicit. Arbitrary redirects should
     * never be created from untrusted data.
     */

    if (
      external
    ) {
      if (
        typeof target !==
        "string"
      ) {
        return false;
      }

      const externalUrl =
        new URL(
          target
        );

      if (
        ![
          "http:",
          "https:"
        ].includes(
          externalUrl.protocol
        )
      ) {
        return false;
      }

      window.location.assign(
        externalUrl.toString()
      );

      return true;
    }


    const route =
      typeof target ===
      "string"
        ? (
            getRoute(
              target
            ) ||
            findRouteByPath(
              target
            )
          )
        : target;


    if (!route) {

      emit(
        ROUTER_EVENTS.ROUTE_NOT_FOUND,
        {
          target
        }
      );

      const notFound =
        ROUTES.notFound;

      window.location.assign(
        notFound.path
      );

      return false;
    }


    const allowed =
      canAccessRoute(
        route,
        {
          authenticated,
          role
        }
      );


    if (!allowed) {

      emit(
        ROUTER_EVENTS.ROUTE_BLOCKED,
        {
          route,
          authenticated,
          role
        }
      );


      /*
       * Do not expose protected path
       * details in the UI.
       */

      const destination =
        authenticated
          ? getHomeRouteForRole(
              role
            )
          : ROUTES.login;


      window.location.assign(
        destination.path
      );

      return false;
    }


    const destination =
      routeUrl(
        route,
        {
          query,
          hash
        }
      );


    const current =
      window.location.pathname +
      window.location.search +
      window.location.hash;


    if (
      destination ===
      current
    ) {
      return true;
    }


    const detail = {
      route,

      url:
        destination,

      replace
    };


    emit(
      ROUTER_EVENTS.BEFORE_NAVIGATE,
      detail
    );


    if (replace) {
      window.history.replaceState(
        {
          savebiteRoute:
            route.name
        },
        "",
        destination
      );

    } else {
      window.history.pushState(
        {
          savebiteRoute:
            route.name
        },
        "",
        destination
      );
    }


    state.currentRoute =
      route;

    state.currentUrl =
      destination;


    emit(
      ROUTER_EVENTS.NAVIGATE,
      detail
    );


    emit(
      ROUTER_EVENTS.AFTER_NAVIGATE,
      detail
    );


    return true;

  } finally {
    state.navigating =
      false;
  }
}


/* =========================================================
   SIMPLE REDIRECT
========================================================= */

function redirect(
  target,
  options = {}
) {
  return navigate(
    target,
    {
      ...options,
      replace:
        options.replace ??
        true
    }
  );
}


/* =========================================================
   GO HOME
========================================================= */

function goHome(
  role,
  options = {}
) {
  const route =
    getHomeRouteForRole(
      role
    );

  return navigate(
    route,
    options
  );
}


/* =========================================================
   BACK
========================================================= */

function back() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  window.history.back();

  return true;
}


/* =========================================================
   FORWARD
========================================================= */

function forward() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  window.history.forward();

  return true;
}


/* =========================================================
   ROUTER START
========================================================= */

function startRouter() {
  if (
    state.started
  ) {
    return;
  }

  state.started =
    true;


  const route =
    findRouteByPath(
      getCurrentPath()
    );


  state.currentRoute =
    route;

  state.currentUrl =
    window.location.href;


  window.addEventListener(
    "popstate",
    () => {

      const currentRoute =
        findRouteByPath(
          getCurrentPath()
        );


      state.currentRoute =
        currentRoute;

      state.currentUrl =
        window.location.href;


      emit(
        ROUTER_EVENTS.NAVIGATE,
        {
          route:
            currentRoute,

          url:
            window.location.href,

          history:
            true
        }
      );


      emit(
        ROUTER_EVENTS.AFTER_NAVIGATE,
        {
          route:
            currentRoute,

          url:
            window.location.href,

          history:
            true
        }
      );
    }
  );
}


/* =========================================================
   ROUTE PROTECTION HELPER
========================================================= */

function requireRouteAccess(
  {
    authenticated =
      false,

    role = null,

    route =
      state.currentRoute
  } = {}
) {
  if (!route) {
    return {
      allowed:
        false,

      reason:
        "route_not_found"
    };
  }


  if (
    route.public
  ) {
    return {
      allowed:
        true,

      reason:
        null
    };
  }


  if (
    !authenticated
  ) {
    return {
      allowed:
        false,

      reason:
        "authentication_required",

      redirect:
        ROUTES.login
    };
  }


  if (
    !canAccessRoute(
      route,
      {
        authenticated,
        role
      }
    )
  ) {
    return {
      allowed:
        false,

      reason:
        "role_not_allowed",

      redirect:
        getHomeRouteForRole(
          role
        )
    };
  }


  return {
    allowed:
      true,

    reason:
      null
  };
}


/* =========================================================
   ROUTER STATE
========================================================= */

function getState() {
  return {
    currentRoute:
      state.currentRoute,

    currentUrl:
      state.currentUrl,

    navigating:
      state.navigating,

    started:
      state.started
  };
}


/* =========================================================
   EXPORT
========================================================= */

export {

  ROUTES,

  ROUTE_ROLES,

  ROUTER_EVENTS,

  getRoute,

  findRouteByPath,

  routeUrl,

  normalizePath,

  normalizeRole,

  canAccessRoute,

  getHomeRouteForRole,

  getCurrentUrl,

  getCurrentPath,

  getQueryParams,

  getHash,

  navigate,

  redirect,

  goHome,

  back,

  forward,

  startRouter,

  requireRouteAccess,

  getState

};
