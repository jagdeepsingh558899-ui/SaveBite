/*
 * SaveBite
 * js/shops.js
 *
 * SHOP DISCOVERY / SHOP DIRECTORY ENGINE
 *
 * Responsibilities:
 * - Normalize shop data
 * - Store and retrieve shops
 * - Search shops
 * - Filter shops
 * - Category filtering
 * - Open / closed status
 * - Distance calculation
 * - Nearby shops
 * - Surplus availability
 * - Featured shops
 * - Rating-based sorting
 * - Distance-based sorting
 * - Shop caching
 * - Pagination
 * - Shop selection
 * - Generic async loaders
 *
 * IMPORTANT:
 * This is a client-side discovery layer.
 *
 * It MUST NOT be treated as the final authority for:
 * - order acceptance
 * - stock
 * - price
 * - payment
 * - shop ownership
 * - delivery availability
 *
 * Those values must be verified by the backend/Firebase
 * before creating or confirming an order.
 */


/* =========================================================
   CONSTANTS
========================================================= */

const SHOP_STATUS = Object.freeze({

  ACTIVE:
    "active",

  INACTIVE:
    "inactive",

  SUSPENDED:
    "suspended",

  PENDING:
    "pending",

  CLOSED:
    "closed"
});


const SHOP_EVENTS = Object.freeze({

  LOADED:
    "savebite:shops-loaded",

  UPDATED:
    "savebite:shops-updated",

  SELECTED:
    "savebite:shop-selected",

  ERROR:
    "savebite:shops-error",

  CACHE_UPDATED:
    "savebite:shops-cache-updated",

  LOCATION_UPDATED:
    "savebite:shops-location-updated"
});


const DEFAULT_PAGE_SIZE = 20;

const EARTH_RADIUS_KM = 6371;


/* =========================================================
   STATE
========================================================= */

const state = {

  initialized:
    false,

  loading:
    false,

  error:
    null,

  shops:
    [],

  cache:
    new Map(),

  selectedShopId:
    null,

  userLocation:
    null,

  lastQuery:
    "",

  lastFilters:
    {},

  lastSort:
    "recommended",

  lastUpdatedAt:
    null
};


/* =========================================================
   EVENT HELPER
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
   TEXT HELPERS
========================================================= */

function cleanText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(
    value
  ).trim();
}


/* =========================================================
   ID HELPERS
========================================================= */

function normalizeId(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const id =
    String(
      value
    ).trim();

  return id || null;
}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function toNumber(
  value,
  fallback = 0
) {

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}


/* =========================================================
   BOOLEAN HELPERS
========================================================= */

function toBoolean(
  value,
  fallback = false
) {

  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false"
  ) {
    return false;
  }

  return fallback;
}


/* =========================================================
   ARRAY HELPERS
========================================================= */

function safeArray(
  value
) {

  return Array.isArray(
    value
  )
    ? value
    : [];
}


/* =========================================================
   DATE HELPERS
========================================================= */

function normalizeDate(
  value
) {

  if (
    !value
  ) {
    return null;
  }

  if (
    value instanceof Date
  ) {

    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  /*
   * Firebase Timestamp.
   */

  if (
    typeof value.toDate ===
    "function"
  ) {

    try {

      const date =
        value.toDate();

      return Number.isNaN(
        date.getTime()
      )
        ? null
        : date;

    } catch {

      return null;
    }
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


/* =========================================================
   COORDINATE HELPERS
========================================================= */

function normalizeCoordinate(
  value
) {

  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return number;
}


/* =========================================================
   LOCATION NORMALIZATION
========================================================= */

function normalizeLocation(
  shop
) {

  const location =
    shop.location &&
    typeof shop.location ===
      "object"
      ? shop.location
      : {};


  const latitude =
    normalizeCoordinate(
      shop.latitude ??
      shop.lat ??
      location.latitude ??
      location.lat
    );


  const longitude =
    normalizeCoordinate(
      shop.longitude ??
      shop.lng ??
      shop.lon ??
      location.longitude ??
      location.lng ??
      location.lon
    );


  return {

    latitude,

    longitude,

    address:
      cleanText(
        shop.address ||
        location.address
      ),

    area:
      cleanText(
        shop.area ||
        location.area ||
        shop.locality
      ),

    city:
      cleanText(
        shop.city ||
        location.city
      ),

    state:
      cleanText(
        shop.state ||
        location.state
      ),

    pincode:
      cleanText(
        shop.pincode ||
        shop.postalCode ||
        location.pincode ||
        location.postalCode
      )
  };
}


/* =========================================================
   CATEGORY NORMALIZATION
========================================================= */

function normalizeCategories(
  shop
) {

  const categories = [];

  const values = [

    shop.category,

    shop.categoryName,

    shop.businessCategory,

    ...safeArray(
      shop.categories
    )

  ];


  values.forEach(
    value => {

      if (
        typeof value ===
        "string"
      ) {

        const category =
          value.trim();

        if (
          category &&
          !categories.includes(
            category
          )
        ) {

          categories.push(
            category
          );
        }

        return;
      }


      if (
        value &&
        typeof value ===
          "object"
      ) {

        const category =
          cleanText(
            value.name ||
            value.title ||
            value.label
          );

        if (
          category &&
          !categories.includes(
            category
          )
        ) {

          categories.push(
            category
          );
        }
      }
    }
  );


  return categories;
}


/* =========================================================
   TAG NORMALIZATION
========================================================= */

function normalizeTags(
  shop
) {

  return safeArray(
    shop.tags
  )
    .map(
      tag =>
        cleanText(
          tag
        )
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   IMAGE NORMALIZATION
========================================================= */

function normalizeImages(
  shop
) {

  const images = [];

  const candidates = [

    shop.imageUrl,

    shop.logoUrl,

    shop.coverImage,

    shop.bannerUrl

  ];


  candidates.forEach(
    value => {

      const url =
        cleanText(
          value
        );

      if (
        url &&
        !images.includes(
          url
        )
      ) {

        images.push(
          url
        );
      }
    }
  );


  safeArray(
    shop.images
  ).forEach(
    image => {

      if (
        typeof image ===
        "string"
      ) {

        const url =
          image.trim();

        if (
          url &&
          !images.includes(
            url
          )
        ) {

          images.push(
            url
          );
        }

        return;
      }


      if (
        image &&
        typeof image ===
          "object"
      ) {

        const url =
          cleanText(
            image.url ||
            image.imageUrl
          );

        if (
          url &&
          !images.includes(
            url
          )
        ) {

          images.push(
            url
          );
        }
      }
    }
  );


  return images;
}


/* =========================================================
   BUSINESS HOURS NORMALIZATION
========================================================= */

function normalizeTime(
  value
) {

  const text =
    cleanText(
      value
    );

  if (
    !text
  ) {
    return null;
  }


  /*
   * Accept:
   * 09:00
   * 09:30
   * 9:00 AM
   * 9 AM
   */

  const ampm =
    text.match(
      /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
    );


  if (
    ampm
  ) {

    let hour =
      Number(
        ampm[1]
      );

    const minute =
      Number(
        ampm[2] ||
        0
      );

    const period =
      ampm[3].toUpperCase();


    if (
      hour ===
      12
    ) {

      hour = 0;
    }


    if (
      period ===
      "PM"
    ) {

      hour += 12;
    }


    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {

      return (
        String(
          hour
        ).padStart(
          2,
          "0"
        ) +
        ":" +
        String(
          minute
        ).padStart(
          2,
          "0"
        )
      );
    }
  }


  const standard =
    text.match(
      /^(\d{1,2}):(\d{2})$/
    );


  if (
    standard
  ) {

    const hour =
      Number(
        standard[1]
      );

    const minute =
      Number(
        standard[2]
      );


    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {

      return (
        String(
          hour
        ).padStart(
          2,
          "0"
        ) +
        ":" +
        String(
          minute
        ).padStart(
          2,
          "0"
        )
      );
    }
  }


  return null;
}


/* =========================================================
   HOURS NORMALIZATION
========================================================= */

function normalizeHours(
  shop
) {

  const source =
    shop.hours ||
    shop.businessHours ||
    shop.openingHours ||
    {};


  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
  ];


  const result = {};


  days.forEach(
    day => {

      const raw =
        source[day] ??
        source[
          day.slice(
            0,
            3
          )
        ];


      if (
        typeof raw ===
        "string"
      ) {

        const parts =
          raw.split(
            "-"
          );


        result[day] = {

          open:
            normalizeTime(
              parts[0]
            ),

          close:
            normalizeTime(
              parts[1]
            ),

          closed:
            raw
              .toLowerCase()
              .includes(
                "closed"
              )
        };

        return;
      }


      if (
        raw &&
        typeof raw ===
          "object"
      ) {

        result[day] = {

          open:
            normalizeTime(
              raw.open ||
              raw.opening
            ),

          close:
            normalizeTime(
              raw.close ||
              raw.closing
            ),

          closed:
            toBoolean(
              raw.closed,
              false
            )
        };

        return;
      }


      result[day] = {

        open:
          null,

        close:
          null,

        closed:
          false
      };
    }
  );


  return result;
}


/* =========================================================
   SHOP STATUS
========================================================= */

function normalizeStatus(
  shop
) {

  const status =
    cleanText(
      shop.status
    ).toLowerCase();


  if (
    status
  ) {
    return status;
  }


  if (
    shop.suspended ===
    true
  ) {
    return SHOP_STATUS.SUSPENDED;
  }


  if (
    shop.active ===
      false ||
    shop.isActive ===
      false
  ) {

    return SHOP_STATUS.INACTIVE;
  }


  return SHOP_STATUS.ACTIVE;
}


/* =========================================================
   RATING
========================================================= */

function normalizeRating(
  shop
) {

  const rating =
    toNumber(
      shop.rating ??
      shop.averageRating ??
      shop.avgRating,
      0
    );


  return Math.max(
    0,
    Math.min(
      5,
      rating
    )
  );
}


/* =========================================================
   RATING COUNT
========================================================= */

function normalizeRatingCount(
  shop
) {

  return Math.max(
    0,
    Math.floor(
      toNumber(
        shop.ratingCount ??
        shop.reviewCount ??
        shop.reviewsCount,
        0
      )
    )
  );
}


/* =========================================================
   SURPLUS COUNT
========================================================= */

function normalizeSurplusCount(
  shop
) {

  return Math.max(
    0,
    Math.floor(
      toNumber(
        shop.surplusCount ??
        shop.availableSurplusCount ??
        shop.availableProducts ??
        0,
        0
      )
    )
  );
}


/* =========================================================
   DELIVERY SETTINGS
========================================================= */

function normalizeDelivery(
  shop
) {

  const delivery =
    shop.delivery &&
    typeof shop.delivery ===
      "object"
      ? shop.delivery
      : {};


  return {

    available:
      shop.deliveryAvailable !==
        undefined
        ? toBoolean(
            shop.deliveryAvailable,
            false
          )
        : delivery.available !==
            undefined
          ? toBoolean(
              delivery.available,
              false
            )
          : true,

    radiusKm:
      Math.max(
        0,
        toNumber(
          shop.deliveryRadiusKm ??
          delivery.radiusKm,
          0
        )
      ),

    fee:
      Math.max(
        0,
        toNumber(
          shop.deliveryFee ??
          delivery.fee,
          0
        )
      )
  };
}


/* =========================================================
   SHOP NORMALIZATION
========================================================= */

function normalizeShop(
  shop = {}
) {

  const id =
    normalizeId(
      shop.id ||
      shop.shopId ||
      shop.storeId ||
      shop.vendorId
    );


  if (
    !id
  ) {

    throw new Error(
      "Shop ID is required."
    );
  }


  const location =
    normalizeLocation(
      shop
    );


  const categories =
    normalizeCategories(
      shop
    );


  const images =
    normalizeImages(
      shop
    );


  const hours =
    normalizeHours(
      shop
    );


  const status =
    normalizeStatus(
      shop
    );


  const createdAt =
    normalizeDate(
      shop.createdAt
    );


  const updatedAt =
    normalizeDate(
      shop.updatedAt
    );


  const verified =
    toBoolean(
      shop.verified ??
      shop.isVerified,
      false
    );


  const featured =
    toBoolean(
      shop.featured ??
      shop.isFeatured,
      false
    );


  const rating =
    normalizeRating(
      shop
    );


  const ratingCount =
    normalizeRatingCount(
      shop
    );


  const surplusCount =
    normalizeSurplusCount(
      shop
    );


  const delivery =
    normalizeDelivery(
      shop
    );


  const isOpenExplicit =
    shop.isOpen !==
      undefined
      ? toBoolean(
          shop.isOpen,
          false
        )
      : null;


  return {

    id,

    shopId:
      id,

    ownerId:
      normalizeId(
        shop.ownerId ||
        shop.vendorId ||
        shop.userId
      ),

    name:
      cleanText(
        shop.name ||
        shop.shopName ||
        shop.storeName
      ) ||
      "SaveBite Shop",

    description:
      cleanText(
        shop.description
      ),

    shortDescription:
      cleanText(
        shop.shortDescription
      ),

    phone:
      cleanText(
        shop.phone ||
        shop.phoneNumber
      ),

    email:
      cleanText(
        shop.email
      ),

    website:
      cleanText(
        shop.website
      ),

    categories,

    category:
      categories[0] ||
      "",

    tags:
      normalizeTags(
        shop
      ),

    images,

    imageUrl:
      images[0] ||
      null,

    logoUrl:
      cleanText(
        shop.logoUrl
      ) ||
      null,

    location,

    latitude:
      location.latitude,

    longitude:
      location.longitude,

    address:
      location.address,

    area:
      location.area,

    city:
      location.city,

    state:
      location.state,

    pincode:
      location.pincode,

    status,

    verified,

    featured,

    rating,

    ratingCount,

    reviewCount:
      ratingCount,

    surplusCount,

    hasSurplus:
      surplusCount >
        0 ||
      toBoolean(
        shop.hasSurplus ??
        shop.surplusAvailable,
        false
      ),

    delivery,

    hours,

    isOpen:
      isOpenExplicit,

    createdAt,

    updatedAt,

    distanceKm:
      null,

    distanceMeters:
      null,

    metadata:
      shop.metadata &&
      typeof shop.metadata ===
        "object"
        ? {
            ...shop.metadata
          }
        : {}
  };
}


/* =========================================================
   NORMALIZE MANY
========================================================= */

function normalizeShops(
  shops
) {

  return safeArray(
    shops
  )
    .map(
      shop => {

        try {

          return normalizeShop(
            shop
          );

        } catch {

          return null;
        }
      }
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   DISTANCE CALCULATION
========================================================= */

function calculateDistanceKm(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {

  const lat1 =
    Number(
      latitude1
    );

  const lon1 =
    Number(
      longitude1
    );

  const lat2 =
    Number(
      latitude2
    );

  const lon2 =
    Number(
      longitude2
    );


  if (
    !Number.isFinite(
      lat1
    ) ||
    !Number.isFinite(
      lon1
    ) ||
    !Number.isFinite(
      lat2
    ) ||
    !Number.isFinite(
      lon2
    )
  ) {

    return null;
  }


  const toRadians =
    degrees =>
      degrees *
      Math.PI /
      180;


  const dLat =
    toRadians(
      lat2 -
      lat1
    );


  const dLon =
    toRadians(
      lon2 -
      lon1
    );


  const a =
    Math.sin(
      dLat / 2
    ) *
      Math.sin(
        dLat / 2
      ) +
    Math.cos(
      toRadians(
        lat1
      )
    ) *
      Math.cos(
        toRadians(
          lat2
        )
      ) *
      Math.sin(
        dLon / 2
      ) *
      Math.sin(
        dLon / 2
      );


  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        a
      ),
      Math.sqrt(
        1 -
        a
      )
    );


  return (
    EARTH_RADIUS_KM *
    c
  );
}


/* =========================================================
   DISTANCE FORMAT
========================================================= */

function formatDistance(
  distanceKm
) {

  if (
    !Number.isFinite(
      Number(
        distanceKm
      )
    )
  ) {

    return "";
  }


  const distance =
    Number(
      distanceKm
    );


  if (
    distance <
    1
  ) {

    return `${Math.round(
      distance * 1000
    )} m`;
  }


  if (
    distance <
    10
  ) {

    return `${distance.toFixed(
      1
    )} km`;
  }


  return `${Math.round(
    distance
  )} km`;
}


/* =========================================================
   SET USER LOCATION
========================================================= */

function setUserLocation(
  latitude,
  longitude
) {

  const lat =
    normalizeCoordinate(
      latitude
    );

  const lon =
    normalizeCoordinate(
      longitude
    );


  if (
    lat === null ||
    lon === null
  ) {

    state.userLocation =
      null;

    return false;
  }


  state.userLocation = {

    latitude:
      lat,

    longitude:
      lon
  };


  /*
   * Recalculate distances.
   */

  state.shops =
    state.shops.map(
      shop =>
        addDistanceToShop(
          shop
        )
    );


  state.shops.forEach(
    shop => {

      state.cache.set(
        shop.id,
        shop
      );
    }
  );


  emit(
    SHOP_EVENTS.LOCATION_UPDATED,
    {
      location:
        {
          ...state.userLocation
        },

      shops:
        getShops()
    }
  );


  return true;
}


/* =========================================================
   GET USER LOCATION
========================================================= */

function getUserLocation() {

  if (
    !state.userLocation
  ) {
    return null;
  }


  return {
    ...state.userLocation
  };
}


/* =========================================================
   ADD DISTANCE
========================================================= */

function addDistanceToShop(
  shop
) {

  if (
    !state.userLocation
  ) {

    return {
      ...shop,

      distanceKm:
        null,

      distanceMeters:
        null
    };
  }


  const distanceKm =
    calculateDistanceKm(
      state.userLocation.latitude,
      state.userLocation.longitude,
      shop.latitude,
      shop.longitude
    );


  return {

    ...shop,

    distanceKm,

    distanceMeters:
      distanceKm ===
        null
        ? null
        : Math.round(
            distanceKm *
            1000
          )
  };
}


/* =========================================================
   SET SHOPS
========================================================= */

function setShops(
  shops,
  {
    append =
      false
  } = {}
) {

  let normalized =
    normalizeShops(
      shops
    );


  normalized =
    normalized.map(
      shop =>
        addDistanceToShop(
          shop
        )
    );


  if (
    append
  ) {

    const existing =
      new Map(
        state.shops.map(
          shop => [
            shop.id,
            shop
          ]
        )
      );


    normalized.forEach(
      shop => {

        existing.set(
          shop.id,
          shop
        );
      }
    );


    state.shops =
      Array.from(
        existing.values()
      );

  } else {

    state.shops =
      normalized;
  }


  state.shops.forEach(
    shop => {

      state.cache.set(
        shop.id,
        shop
      );
    }
  );


  state.lastUpdatedAt =
    new Date();

  state.error =
    null;


  emit(
    SHOP_EVENTS.UPDATED,
    {
      shops:
        getShops(),

      state:
        getState()
    }
  );


  emit(
    SHOP_EVENTS.CACHE_UPDATED,
    {
      size:
        state.cache.size
    }
  );


  return getShops();
}


/* =========================================================
   ADD SHOPS
========================================================= */

function addShops(
  shops
) {

  return setShops(
    shops,
    {
      append:
        true
    }
  );
}


/* =========================================================
   GET SHOPS
========================================================= */

function getShops() {

  return state.shops.map(
    shop => ({

      ...shop,

      categories:
        [
          ...shop.categories
        ],

      tags:
        [
          ...shop.tags
        ],

      images:
        [
          ...shop.images
        ],

      location:
        {
          ...shop.location
        },

      delivery:
        {
          ...shop.delivery
        },

      hours:
        {
          ...shop.hours
        }
    })
  );
}


/* =========================================================
   GET SHOP
========================================================= */

function getShop(
  shopId
) {

  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {
    return null;
  }


  return (
    state.cache.get(
      id
    ) ||
    state.shops.find(
      shop =>
        shop.id ===
        id
    ) ||
    null
  );
}


/* =========================================================
   SELECT SHOP
========================================================= */

function selectShop(
  shopId
) {

  const shop =
    getShop(
      shopId
    );


  if (
    !shop
  ) {

    state.selectedShopId =
      null;

    return null;
  }


  state.selectedShopId =
    shop.id;


  emit(
    SHOP_EVENTS.SELECTED,
    {
      shop
    }
  );


  return shop;
}


/* =========================================================
   GET SELECTED SHOP
========================================================= */

function getSelectedShop() {

  if (
    !state.selectedShopId
  ) {
    return null;
  }


  return getShop(
    state.selectedShopId
  );
}


/* =========================================================
   SHOP OPEN STATUS
========================================================= */

function isShopOpen(
  shopId,
  date =
    new Date()
) {

  const shop =
    getShop(
      shopId
    );


  if (
    !shop
  ) {
    return false;
  }


  /*
   * Explicit backend value has priority.
   */

  if (
    typeof shop.isOpen ===
    "boolean"
  ) {

    return (
      shop.isOpen &&
      shop.status ===
        SHOP_STATUS.ACTIVE
    );
  }


  if (
    shop.status !==
    SHOP_STATUS.ACTIVE
  ) {

    return false;
  }


  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];


  const day =
    days[
      date.getDay()
    ];


  const hours =
    shop.hours?.[
      day
    ];


  /*
   * No configured hours means the
   * backend status remains the authority.
   */

  if (
    !hours ||
    !hours.open ||
    !hours.close
  ) {

    return true;
  }


  if (
    hours.closed
  ) {
    return false;
  }


  const currentMinutes =
    date.getHours() *
      60 +
    date.getMinutes();


  const [openHour, openMinute] =
    hours.open
      .split(
        ":"
      )
      .map(
        Number
      );


  const [closeHour, closeMinute] =
    hours.close
      .split(
        ":"
      )
      .map(
        Number
      );


  if (
    !Number.isFinite(
      openHour
    ) ||
    !Number.isFinite(
      openMinute
    ) ||
    !Number.isFinite(
      closeHour
    ) ||
    !Number.isFinite(
      closeMinute
    )
  ) {

    return true;
  }


  const openMinutes =
    openHour *
      60 +
    openMinute;


  const closeMinutes =
    closeHour *
      60 +
    closeMinute;


  /*
   * Overnight shop:
   * 20:00 -> 02:00
   */

  if (
    closeMinutes <
    openMinutes
  ) {

    return (
      currentMinutes >=
        openMinutes ||
      currentMinutes <
        closeMinutes
    );
  }


  return (
    currentMinutes >=
      openMinutes &&
    currentMinutes <
      closeMinutes
  );
}


/* =========================================================
   UPDATE OPEN STATUS
========================================================= */

function updateOpenStatuses(
  date =
    new Date()
) {

  state.shops =
    state.shops.map(
      shop => ({

        ...shop,

        isOpen:
          isShopOpen(
            shop.id,
            date
          )
      })
    );


  state.shops.forEach(
    shop => {

      state.cache.set(
        shop.id,
        shop
      );
    }
  );


  emitUpdate();


  return getShops();
}


/* =========================================================
   GET SHOP STATUS LABEL
========================================================= */

function getShopStatus(
  shopId
) {

  const shop =
    getShop(
      shopId
    );


  if (
    !shop
  ) {

    return {

      open:
        false,

      label:
        "Unavailable"
    };
  }


  if (
    shop.status ===
    SHOP_STATUS.SUSPENDED
  ) {

    return {

      open:
        false,

      label:
        "Temporarily unavailable"
    };
  }


  if (
    shop.status !==
    SHOP_STATUS.ACTIVE
  ) {

    return {

      open:
        false,

      label:
        "Unavailable"
    };
  }


  const open =
    isShopOpen(
      shopId
    );


  return {

    open,

    label:
      open
        ? "Open"
        : "Closed"
  };
}


/* =========================================================
   GET SHOP CATEGORIES
========================================================= */

function getCategories(
  {
    activeOnly =
      true
  } = {}
) {

  const categories =
    new Map();


  state.shops.forEach(
    shop => {

      if (
        activeOnly &&
        shop.status !==
          SHOP_STATUS.ACTIVE
      ) {
        return;
      }


      shop.categories.forEach(
        category => {

          const key =
            category
              .toLowerCase()
              .trim();


          if (
            !key
          ) {
            return;
          }


          if (
            !categories.has(
              key
            )
          ) {

            categories.set(
              key,
              category
            );
          }
        }
      );
    }
  );


  return Array.from(
    categories.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.localeCompare(
        b
      )
  );
}


/* =========================================================
   SEARCH SHOPS
========================================================= */

function searchShops(
  query,
  {
    activeOnly =
      true,

    openOnly =
      false,

    surplusOnly =
      false,

    category =
      null,

    limit =
      null
  } = {}
) {

  const search =
    cleanText(
      query
    ).toLowerCase();


  const normalizedCategory =
    cleanText(
      category
    ).toLowerCase();


  let results =
    state.shops.filter(
      shop => {

        if (
          activeOnly &&
          shop.status !==
            SHOP_STATUS.ACTIVE
        ) {
          return false;
        }


        if (
          openOnly &&
          !isShopOpen(
            shop.id
          )
        ) {
          return false;
        }


        if (
          surplusOnly &&
          !shop.hasSurplus
        ) {
          return false;
        }


        if (
          normalizedCategory &&
          !shop.categories.some(
            item =>
              item
                .toLowerCase() ===
              normalizedCategory
          )
        ) {
          return false;
        }


        if (
          !search
        ) {
          return true;
        }


        const searchable =
          [

            shop.name,

            shop.description,

            shop.shortDescription,

            shop.address,

            shop.area,

            shop.city,

            ...shop.categories,

            ...shop.tags

          ]
            .join(
              " "
            )
            .toLowerCase();


        return searchable.includes(
          search
        );
      }
    );


  /*
   * Better search relevance.
   */

  if (
    search
  ) {

    results.sort(
      (
        a,
        b
      ) => {

        const aName =
          a.name.toLowerCase();

        const bName =
          b.name.toLowerCase();


        const aExact =
          aName ===
          search
            ? 0
            : 1;


        const bExact =
          bName ===
          search
            ? 0
            : 1;


        if (
          aExact !==
          bExact
        ) {

          return (
            aExact -
            bExact
          );
        }


        const aStarts =
          aName.startsWith(
            search
          )
            ? 0
            : 1;


        const bStarts =
          bName.startsWith(
            search
          )
            ? 0
            : 1;


        return (
          aStarts -
          bStarts
        );
      }
    );
  }


  if (
    Number.isFinite(
      Number(
        limit
      )
    ) &&
    Number(
      limit
    ) >
      0
  ) {

    results =
      results.slice(
        0,
        Math.floor(
          Number(
            limit
          )
        )
      );
  }


  state.lastQuery =
    search;


  return results;
}


/* =========================================================
   FILTER SHOPS
========================================================= */

function filterShops(
  {
    category =
      null,

    city =
      null,

    area =
      null,

    openOnly =
      false,

    activeOnly =
      true,

    verifiedOnly =
      false,

    featuredOnly =
      false,

    surplusOnly =
      false,

    deliveryOnly =
      false,

    minRating =
      null,

    maxDistanceKm =
      null,

    query =
      ""
  } = {}
) {

  const normalizedCategory =
    cleanText(
      category
    ).toLowerCase();


  const normalizedCity =
    cleanText(
      city
    ).toLowerCase();


  const normalizedArea =
    cleanText(
      area
    ).toLowerCase();


  const search =
    cleanText(
      query
    ).toLowerCase();


  const minimumRating =
    minRating !==
      null &&
    minRating !==
      undefined
      ? Math.max(
          0,
          toNumber(
            minRating,
            0
          )
        )
      : null;


  const maximumDistance =
    maxDistanceKm !==
      null &&
    maxDistanceKm !==
      undefined
      ? Math.max(
          0,
          toNumber(
            maxDistanceKm,
            0
          )
        )
      : null;


  const results =
    state.shops.filter(
      shop => {

        if (
          activeOnly &&
          shop.status !==
            SHOP_STATUS.ACTIVE
        ) {
          return false;
        }


        if (
          normalizedCategory &&
          !shop.categories.some(
            item =>
              item
                .toLowerCase() ===
              normalizedCategory
          )
        ) {
          return false;
        }


        if (
          normalizedCity &&
          shop.city
            .toLowerCase() !==
          normalizedCity
        ) {
          return false;
        }


        if (
          normalizedArea &&
          !shop.area
            .toLowerCase()
            .includes(
              normalizedArea
            )
        ) {
          return false;
        }


        if (
          openOnly &&
          !isShopOpen(
            shop.id
          )
        ) {
          return false;
        }


        if (
          verifiedOnly &&
          !shop.verified
        ) {
          return false;
        }


        if (
          featuredOnly &&
          !shop.featured
        ) {
          return false;
        }


        if (
          surplusOnly &&
          !shop.hasSurplus
        ) {
          return false;
        }


        if (
          deliveryOnly &&
          !shop.delivery.available
        ) {
          return false;
        }


        if (
          minimumRating !==
            null &&
          shop.rating <
            minimumRating
        ) {
          return false;
        }


        if (
          maximumDistance !==
            null
        ) {

          if (
            shop.distanceKm ===
              null ||
            shop.distanceKm >
              maximumDistance
          ) {
            return false;
          }
        }


        if (
          search
        ) {

          const searchable =
            [

              shop.name,

              shop.description,

              shop.address,

              shop.area,

              shop.city,

              ...shop.categories,

              ...shop.tags

            ]
              .join(
                " "
              )
              .toLowerCase();


          if (
            !searchable.includes(
              search
            )
          ) {

            return false;
          }
        }


        return true;
      }
    );


  state.lastFilters = {

    category:
      normalizedCategory,

    city:
      normalizedCity,

    area:
      normalizedArea,

    openOnly,

    activeOnly,

    verifiedOnly,

    featuredOnly,

    surplusOnly,

    deliveryOnly,

    minRating:
      minimumRating,

    maxDistanceKm:
      maximumDistance,

    query:
      search
  };


  return results;
}


/* =========================================================
   NEARBY SHOPS
========================================================= */

function getNearbyShops(
  {
    radiusKm =
      10,

    limit =
      DEFAULT_PAGE_SIZE,

    surplusOnly =
      false,

    openOnly =
      false,

    activeOnly =
      true
  } = {}
) {

  if (
    !state.userLocation
  ) {
    return [];
  }


  let results =
    state.shops.filter(
      shop => {

        if (
          activeOnly &&
          shop.status !==
            SHOP_STATUS.ACTIVE
        ) {
          return false;
        }


        if (
          surplusOnly &&
          !shop.hasSurplus
        ) {
          return false;
        }


        if (
          openOnly &&
          !isShopOpen(
            shop.id
          )
        ) {
          return false;
        }


        return (
          shop.distanceKm !==
            null &&
          shop.distanceKm <=
            radiusKm
        );
      }
    );


  results.sort(
    (
      a,
      b
    ) =>
      (
        a.distanceKm ?? Infinity
      ) -
      (
        b.distanceKm ?? Infinity
      )
  );


  if (
    Number.isFinite(
      Number(
        limit
      )
    ) &&
    Number(
      limit
    ) >
      0
  ) {

    results =
      results.slice(
        0,
        Math.floor(
          Number(
            limit
          )
        )
      );
  }


  return results;
}


/* =========================================================
   SORT SHOPS
========================================================= */

function sortShops(
  shops,
  sort =
    "recommended"
) {

  const list =
    safeArray(
      shops
    ).slice();


  const mode =
    cleanText(
      sort
    ).toLowerCase();


  state.lastSort =
    mode ||
    "recommended";


  switch (
    mode
  ) {

    case "nearest":

    case "distance":

      return list.sort(
        (
          a,
          b
        ) =>
          (
            a.distanceKm ??
            Infinity
          ) -
          (
            b.distanceKm ??
            Infinity
          )
      );


    case "rating":

      return list.sort(
        (
          a,
          b
        ) => {

          if (
            b.rating !==
            a.rating
          ) {

            return (
              b.rating -
              a.rating
            );
          }


          return (
            b.ratingCount -
            a.ratingCount
          );
        }
      );


    case "surplus":

      return list.sort(
        (
          a,
          b
        ) => {

          if (
            b.hasSurplus !==
            a.hasSurplus
          ) {

            return b.hasSurplus
              ? -1
              : 1;
          }


          return (
            b.surplusCount -
            a.surplusCount
          );
        }
      );


    case "featured":

      return list.sort(
        (
          a,
          b
        ) => {

          if (
            a.featured !==
            b.featured
          ) {

            return a.featured
              ? -1
              : 1;
          }


          return (
            b.rating -
            a.rating
          );
        }
      );


    case "name":

    case "alphabetical":

      return list.sort(
        (
          a,
          b
        ) =>
          a.name.localeCompare(
            b.name
          )
      );


    case "newest":

      return list.sort(
        (
          a,
          b
        ) => {

          const aTime =
            a.createdAt
              ? a.createdAt.getTime()
              : 0;


          const bTime =
            b.createdAt
              ? b.createdAt.getTime()
              : 0;


          return (
            bTime -
            aTime
          );
        }
      );


    case "recommended":

    default:

      return list.sort(
        (
          a,
          b
        ) => {

          /*
           * Featured shops first.
           */

          if (
            a.featured !==
            b.featured
          ) {

            return a.featured
              ? -1
              : 1;
          }


          /*
           * Shops with surplus next.
           */

          if (
            a.hasSurplus !==
            b.hasSurplus
          ) {

            return a.hasSurplus
              ? -1
              : 1;
          }


          /*
           * Verified shops.
           */

          if (
            a.verified !==
            b.verified
          ) {

            return a.verified
              ? -1
              : 1;
          }


          /*
           * Higher rating.
           */

          if (
            b.rating !==
            a.rating
          ) {

            return (
              b.rating -
              a.rating
            );
          }


          /*
           * Nearer shop.
           */

          return (
            a.distanceKm ??
            Infinity
          ) -
          (
            b.distanceKm ??
            Infinity
          );
        }
      );
  }
}


/* =========================================================
   PAGINATION
========================================================= */

function paginateShops(
  shops,
  {
    page =
      1,

    pageSize =
      DEFAULT_PAGE_SIZE
  } = {}
) {

  const safePage =
    Math.max(
      1,
      Math.floor(
        toNumber(
          page,
          1
        )
      )
    );


  const safePageSize =
    Math.max(
      1,
      Math.floor(
        toNumber(
          pageSize,
          DEFAULT_PAGE_SIZE
        )
      )
    );


  const total =
    safeArray(
      shops
    ).length;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
        safePageSize
      )
    );


  const currentPage =
    Math.min(
      safePage,
      totalPages
    );


  const start =
    (
      currentPage -
      1
    ) *
    safePageSize;


  return {

    shops:
      safeArray(
        shops
      ).slice(
        start,
        start +
          safePageSize
      ),

    page:
      currentPage,

    pageSize:
      safePageSize,

    total,

    totalPages,

    hasNext:
      currentPage <
      totalPages,

    hasPrevious:
      currentPage >
      1
  };
}


/* =========================================================
   CITY LIST
========================================================= */

function getCities() {

  const cities =
    new Map();


  state.shops.forEach(
    shop => {

      const city =
        cleanText(
          shop.city
        );


      if (
        !city
      ) {
        return;
      }


      const key =
        city.toLowerCase();


      if (
        !cities.has(
          key
        )
      ) {

        cities.set(
          key,
          city
        );
      }
    }
  );


  return Array.from(
    cities.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.localeCompare(
        b
      )
  );
}


/* =========================================================
   AREA LIST
========================================================= */

function getAreas(
  city =
    null
) {

  const normalizedCity =
    cleanText(
      city
    ).toLowerCase();


  const areas =
    new Map();


  state.shops.forEach(
    shop => {

      if (
        normalizedCity &&
        shop.city
          .toLowerCase() !==
        normalizedCity
      ) {
        return;
      }


      const area =
        cleanText(
          shop.area
        );


      if (
        !area
      ) {
        return;
      }


      const key =
        area.toLowerCase();


      if (
        !areas.has(
          key
        )
      ) {

        areas.set(
          key,
          area
        );
      }
    }
  );


  return Array.from(
    areas.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.localeCompare(
        b
      )
  );
}


/* =========================================================
   FEATURED SHOPS
========================================================= */

function getFeaturedShops(
  limit =
    DEFAULT_PAGE_SIZE
) {

  let shops =
    state.shops.filter(
      shop =>
        shop.status ===
          SHOP_STATUS.ACTIVE &&
        shop.featured
    );


  shops =
    sortShops(
      shops,
      "featured"
    );


  return shops.slice(
    0,
    Math.max(
      1,
      Math.floor(
        toNumber(
          limit,
          DEFAULT_PAGE_SIZE
        )
      )
    )
  );
}


/* =========================================================
   SURPLUS SHOPS
========================================================= */

function getSurplusShops(
  {
    openOnly =
      false,

    limit =
      DEFAULT_PAGE_SIZE
  } = {}
) {

  let shops =
    state.shops.filter(
      shop => {

        if (
          shop.status !==
          SHOP_STATUS.ACTIVE
        ) {
          return false;
        }


        if (
          !shop.hasSurplus
        ) {
          return false;
        }


        if (
          openOnly &&
          !isShopOpen(
            shop.id
          )
        ) {
          return false;
        }


        return true;
      }
    );


  shops =
    sortShops(
      shops,
      state.userLocation
        ? "nearest"
        : "recommended"
    );


  return shops.slice(
    0,
    Math.max(
      1,
      Math.floor(
        toNumber(
          limit,
          DEFAULT_PAGE_SIZE
        )
      )
    )
  );
}


/* =========================================================
   DELIVERY ELIGIBILITY
========================================================= */

function isDeliveryAvailable(
  shopId,
  distanceKm =
    null
) {

  const shop =
    getShop(
      shopId
    );


  if (
    !shop
  ) {
    return false;
  }


  if (
    !shop.delivery.available
  ) {
    return false;
  }


  if (
    distanceKm ===
      null ||
    distanceKm ===
      undefined
  ) {

    distanceKm =
      shop.distanceKm;
  }


  /*
   * If no radius is configured,
   * don't invent a client-side restriction.
   */

  if (
    !shop.delivery.radiusKm
  ) {

    return true;
  }


  if (
    !Number.isFinite(
      Number(
        distanceKm
      )
    )
  ) {

    return true;
  }


  return (
    Number(
      distanceKm
    ) <=
    shop.delivery.radiusKm
  );
}


/* =========================================================
   SHOP SUMMARY
========================================================= */

function getShopSummary(
  shopId
) {

  const shop =
    getShop(
      shopId
    );


  if (
    !shop
  ) {
    return null;
  }


  return {

    id:
      shop.id,

    name:
      shop.name,

    imageUrl:
      shop.imageUrl,

    logoUrl:
      shop.logoUrl,

    category:
      shop.category,

    categories:
      [
        ...shop.categories
      ],

    rating:
      shop.rating,

    ratingCount:
      shop.ratingCount,

    verified:
      shop.verified,

    featured:
      shop.featured,

    hasSurplus:
      shop.hasSurplus,

    surplusCount:
      shop.surplusCount,

    isOpen:
      isShopOpen(
        shop.id
      ),

    distanceKm:
      shop.distanceKm,

    distanceText:
      formatDistance(
        shop.distanceKm
      ),

    address:
      shop.address,

    area:
      shop.area,

    city:
      shop.city,

    deliveryAvailable:
      shop.delivery.available
  };
}


/* =========================================================
   CACHE SHOP
========================================================= */

function cacheShop(
  shop
) {

  try {

    const normalized =
      normalizeShop(
        shop
      );


    const withDistance =
      addDistanceToShop(
        normalized
      );


    state.cache.set(
      withDistance.id,
      withDistance
    );


    return withDistance;

  } catch {

    return null;
  }
}


/* =========================================================
   CACHE MANY SHOPS
========================================================= */

function cacheShops(
  shops
) {

  const normalized =
    normalizeShops(
      shops
    );


  normalized.forEach(
    shop => {

      const withDistance =
        addDistanceToShop(
          shop
        );


      state.cache.set(
        withDistance.id,
        withDistance
      );
    }
  );


  emit(
    SHOP_EVENTS.CACHE_UPDATED,
    {
      size:
        state.cache.size
    }
  );


  return normalized;
}


/* =========================================================
   GET CACHED SHOP
========================================================= */

function getCachedShop(
  shopId
) {

  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {
    return null;
  }


  return (
    state.cache.get(
      id
    ) ||
    null
  );
}


/* =========================================================
   CLEAR CACHE
========================================================= */

function clearCache() {

  state.cache.clear();


  emit(
    SHOP_EVENTS.CACHE_UPDATED,
    {
      size:
        0
    }
  );


  return true;
}


/* =========================================================
   REMOVE SHOP
========================================================= */

function removeShop(
  shopId
) {

  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {
    return false;
  }


  const previousLength =
    state.shops.length;


  state.shops =
    state.shops.filter(
      shop =>
        shop.id !==
        id
    );


  state.cache.delete(
    id
  );


  if (
    state.selectedShopId ===
      id
  ) {

    state.selectedShopId =
      null;
  }


  const removed =
    state.shops.length <
    previousLength;


  if (
    removed
  ) {

    emitUpdate();
  }


  return removed;
}


/* =========================================================
   UPDATE SHOP
========================================================= */

function updateShop(
  shopId,
  updates = {}
) {

  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {
    return null;
  }


  const current =
    getShop(
      id
    );


  if (
    !current
  ) {
    return null;
  }


  try {

    const updated =
      normalizeShop(
        {
          ...current,

          ...updates,

          id
        }
      );


    const withDistance =
      addDistanceToShop(
        updated
      );


    const index =
      state.shops.findIndex(
        shop =>
          shop.id ===
          id
      );


    if (
      index >=
      0
    ) {

      state.shops[
        index
      ] =
        withDistance;
    }


    state.cache.set(
      id,
      withDistance
    );


    state.lastUpdatedAt =
      new Date();


    emit(
      SHOP_EVENTS.UPDATED,
      {
        shops:
          getShops(),

        shop:
          withDistance
      }
    );


    return withDistance;

  } catch {

    return null;
  }
}


/* =========================================================
   ASYNC LOAD SHOPS
========================================================= */

async function loadShops(
  fetcher,
  {
    append =
      false
  } = {}
) {

  if (
    typeof fetcher !==
    "function"
  ) {

    throw new Error(
      "Shop fetcher function is required."
    );
  }


  state.loading =
    true;

  state.error =
    null;


  emitUpdate();


  try {

    const result =
      await fetcher();


    /*
     * Accept:
     *
     * [
     *   {...}
     * ]
     *
     * OR
     *
     * {
     *   shops: [...]
     * }
     *
     * OR
     *
     * {
     *   data: [...]
     * }
     */

    const shops =
      Array.isArray(
        result
      )
        ? result
        : Array.isArray(
            result?.shops
          )
          ? result.shops
          : Array.isArray(
              result?.data
            )
            ? result.data
            : [];


    setShops(
      shops,
      {
        append
      }
    );


    state.loading =
      false;

    state.lastUpdatedAt =
      new Date();


    emit(
      SHOP_EVENTS.LOADED,
      {
        shops:
          getShops(),

        result
      }
    );


    emitUpdate();


    return getShops();

  } catch (
    error
  ) {

    state.loading =
      false;

    setError(
      error
    );


    emitUpdate();


    throw error;
  }
}


/* =========================================================
   LOAD SHOP BY ID
========================================================= */

async function loadShop(
  shopId,
  fetcher
) {

  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {

    throw new Error(
      "Shop ID is required."
    );
  }


  if (
    typeof fetcher !==
    "function"
  ) {

    throw new Error(
      "Shop fetcher function is required."
    );
  }


  try {

    const result =
      await fetcher(
        id
      );


    const rawShop =
      result?.shop ||
      result?.data ||
      result;


    const shop =
      normalizeShop(
        rawShop
      );


    const withDistance =
      addDistanceToShop(
        shop
      );


    state.cache.set(
      id,
      withDistance
    );


    const index =
      state.shops.findIndex(
        item =>
          item.id ===
          id
      );


    if (
      index >=
      0
    ) {

      state.shops[
        index
      ] =
        withDistance;

    } else {

      state.shops.push(
        withDistance
      );
    }


    state.lastUpdatedAt =
      new Date();


    emit(
      SHOP_EVENTS.UPDATED,
      {
        shop:
          withDistance,

        shops:
          getShops()
      }
    );


    return withDistance;

  } catch (
    error
  ) {

    setError(
      error
    );

    throw error;
  }
}


/* =========================================================
   LOCATION DISTANCE REFRESH
========================================================= */

function refreshDistances() {

  if (
    !state.userLocation
  ) {
    return getShops();
  }


  state.shops =
    state.shops.map(
      shop =>
        addDistanceToShop(
          shop
        )
    );


  state.shops.forEach(
    shop => {

      state.cache.set(
        shop.id,
        shop
      );
    }
  );


  emitUpdate();


  return getShops();
}


/* =========================================================
   GET RECOMMENDED SHOPS
========================================================= */

function getRecommendedShops(
  {
    limit =
      DEFAULT_PAGE_SIZE,

    surplusOnly =
      true
  } = {}
) {

  let shops =
    state.shops.filter(
      shop => {

        if (
          shop.status !==
          SHOP_STATUS.ACTIVE
        ) {
          return false;
        }


        if (
          surplusOnly &&
          !shop.hasSurplus
        ) {
          return false;
        }


        return true;
      }
    );


  shops =
    sortShops(
      shops,
      "recommended"
    );


  return shops.slice(
    0,
    Math.max(
      1,
      Math.floor(
        toNumber(
          limit,
          DEFAULT_PAGE_SIZE
        )
      )
    )
  );
}


/* =========================================================
   GET TOP RATED SHOPS
========================================================= */

function getTopRatedShops(
  limit =
    DEFAULT_PAGE_SIZE
) {

  const shops =
    state.shops.filter(
      shop =>
        shop.status ===
        SHOP_STATUS.ACTIVE
    );


  return sortShops(
    shops,
    "rating"
  ).slice(
    0,
    Math.max(
      1,
      Math.floor(
        toNumber(
          limit,
          DEFAULT_PAGE_SIZE
        )
      )
    )
  );
}


/* =========================================================
   GET SHOP COUNT
========================================================= */

function getShopCount(
  {
    activeOnly =
      true,

    openOnly =
      false,

    surplusOnly =
      false
  } = {}
) {

  return state.shops.filter(
    shop => {

      if (
        activeOnly &&
        shop.status !==
          SHOP_STATUS.ACTIVE
      ) {
        return false;
      }


      if (
        openOnly &&
        !isShopOpen(
          shop.id
        )
      ) {
        return false;
      }


      if (
        surplusOnly &&
        !shop.hasSurplus
      ) {
        return false;
      }


      return true;
    }
  ).length;
}


/* =========================================================
   LOADING STATE
========================================================= */

function setLoading(
  loading
) {

  state.loading =
    Boolean(
      loading
    );


  emitUpdate();


  return state.loading;
}


/* =========================================================
   ERROR STATE
========================================================= */

function setError(
  error
) {

  state.error =
    error instanceof
      Error
      ? error.message
      : cleanText(
          String(
            error ||
            ""
          )
        );


  emit(
    SHOP_EVENTS.ERROR,
    {
      error:
        state.error
    }
  );


  return state.error;
}


/* =========================================================
   STATE
========================================================= */

function getState() {

  return {

    initialized:
      state.initialized,

    loading:
      state.loading,

    error:
      state.error,

    shopCount:
      state.shops.length,

    selectedShopId:
      state.selectedShopId,

    userLocation:
      state.userLocation
        ? {
            ...state.userLocation
          }
        : null,

    lastQuery:
      state.lastQuery,

    lastFilters:
      {
        ...state.lastFilters
      },

    lastSort:
      state.lastSort,

    lastUpdatedAt:
      state.lastUpdatedAt
  };
}


/* =========================================================
   INITIALIZE
========================================================= */

function initializeShops(
  {
    shops =
      []
  } = {}
) {

  state.initialized =
    true;

  state.error =
    null;


  if (
    Array.isArray(
      shops
    ) &&
    shops.length
  ) {

    setShops(
      shops
    );
  }


  state.lastUpdatedAt =
    new Date();


  emitUpdate();


  return getShops();
}


/* =========================================================
   RESET
========================================================= */

function resetShops() {

  state.shops =
    [];

  state.cache.clear();

  state.selectedShopId =
    null;

  state.lastQuery =
    "";

  state.lastFilters =
    {};

  state.lastSort =
    "recommended";

  state.lastUpdatedAt =
    new Date();

  state.error =
    null;

  state.loading =
    false;


  emitUpdate();


  return true;
}


/* =========================================================
   DESTROY
========================================================= */

function destroyShops() {

  resetShops();

  state.userLocation =
    null;

  state.initialized =
    false;
}


/* =========================================================
   EMIT UPDATE
========================================================= */

function emitUpdate() {

  emit(
    SHOP_EVENTS.UPDATED,
    {
      shops:
        getShops(),

      state:
        getState()
    }
  );
}


/* =========================================================
   PUBLIC API
========================================================= */

export {

  SHOP_STATUS,

  SHOP_EVENTS,

  DEFAULT_PAGE_SIZE,

  normalizeShop,

  normalizeShops,

  calculateDistanceKm,

  formatDistance,

  setUserLocation,

  getUserLocation,

  setShops,

  addShops,

  getShops,

  getShop,

  selectShop,

  getSelectedShop,

  isShopOpen,

  updateOpenStatuses,

  getShopStatus,

  getCategories,

  searchShops,

  filterShops,

  getNearbyShops,

  sortShops,

  paginateShops,

  getCities,

  getAreas,

  getFeaturedShops,

  getSurplusShops,

  isDeliveryAvailable,

  getShopSummary,

  cacheShop,

  cacheShops,

  getCachedShop,

  clearCache,

  removeShop,

  updateShop,

  loadShops,

 
