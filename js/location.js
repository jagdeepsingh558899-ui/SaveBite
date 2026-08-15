/*
 * SaveBite
 * Central Location Engine
 *
 * Responsibilities:
 * - Browser geolocation
 * - Permission handling
 * - Current position
 * - Location watching
 * - Distance calculation
 * - Coordinate validation
 * - Reverse-geocoding helper
 * - Location error normalization
 *
 * IMPORTANT:
 * - Uses browser Geolocation API.
 * - Does NOT use Google Maps.
 * - Map rendering belongs to the Leaflet/map module.
 * - Coordinates received from the browser are user/device data
 *   and must never be treated as trusted business data.
 */


/* =========================================================
   IMPORTS
========================================================= */

import {
  validateCoordinates
} from "./validation.js";


/* =========================================================
   CONSTANTS
========================================================= */

const LOCATION_EVENTS =
  Object.freeze({

    REQUESTING:
      "savebite:location-requesting",

    SUCCESS:
      "savebite:location-success",

    ERROR:
      "savebite:location-error",

    WATCH_STARTED:
      "savebite:location-watch-started",

    WATCH_STOPPED:
      "savebite:location-watch-stopped",

    PERMISSION_CHANGED:
      "savebite:location-permission-changed"
  });


const LOCATION_ERROR_CODES =
  Object.freeze({

    PERMISSION_DENIED:
      "PERMISSION_DENIED",

    POSITION_UNAVAILABLE:
      "POSITION_UNAVAILABLE",

    TIMEOUT:
      "TIMEOUT",

    NOT_SUPPORTED:
      "NOT_SUPPORTED",

    INVALID_COORDINATES:
      "INVALID_COORDINATES",

    UNKNOWN:
      "UNKNOWN"
  });


const DEFAULT_OPTIONS =
  Object.freeze({

    enableHighAccuracy:
      true,

    timeout:
      15000,

    maximumAge:
      30000
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  currentPosition:
    null,

  watchId:
    null,

  permission:
    "unknown",

  requesting:
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
   SUPPORT CHECK
========================================================= */

function isSupported() {
  return (
    typeof navigator !==
      "undefined" &&
    "geolocation" in
      navigator
  );
}


/* =========================================================
   NORMALIZE ERROR
========================================================= */

function normalizeLocationError(
  error
) {
  if (!error) {
    return {
      code:
        LOCATION_ERROR_CODES.UNKNOWN,

      message:
        "Unable to determine your location.",

      original:
        null
    };
  }


  switch (
    error.code
  ) {

    case 1:
      return {
        code:
          LOCATION_ERROR_CODES.PERMISSION_DENIED,

        message:
          "Location permission was denied. Please allow location access in your browser settings.",

        original:
          error
      };


    case 2:
      return {
        code:
          LOCATION_ERROR_CODES.POSITION_UNAVAILABLE,

        message:
          "Your current location is temporarily unavailable.",

        original:
          error
      };


    case 3:
      return {
        code:
          LOCATION_ERROR_CODES.TIMEOUT,

        message:
          "Getting your location took too long. Please try again.",

        original:
          error
      };


    default:
      return {
        code:
          LOCATION_ERROR_CODES.UNKNOWN,

        message:
          "Unable to determine your location. Please try again.",

        original:
          error
      };
  }
}


/* =========================================================
   NORMALIZE POSITION
========================================================= */

function normalizePosition(
  position
) {
  if (
    !position ||
    !position.coords
  ) {
    throw new Error(
      "Invalid geolocation response."
    );
  }


  const {
    latitude,
    longitude,
    accuracy,
    altitude,
    altitudeAccuracy,
    heading,
    speed
  } = position.coords;


  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    const error =
      new Error(
        "Invalid coordinates returned by the device."
      );

    error.code =
      LOCATION_ERROR_CODES.INVALID_COORDINATES;

    throw error;
  }


  return {

    latitude:
      validation.value.latitude,

    longitude:
      validation.value.longitude,

    accuracy:
      Number.isFinite(
        accuracy
      )
        ? accuracy
        : null,

    altitude:
      Number.isFinite(
        altitude
      )
        ? altitude
        : null,

    altitudeAccuracy:
      Number.isFinite(
        altitudeAccuracy
      )
        ? altitudeAccuracy
        : null,

    heading:
      Number.isFinite(
        heading
      )
        ? heading
        : null,

    speed:
      Number.isFinite(
        speed
      )
        ? speed
        : null,

    timestamp:
      Number.isFinite(
        position.timestamp
      )
        ? position.timestamp
        : Date.now()
  };
}


/* =========================================================
   GET CURRENT POSITION
========================================================= */

function getCurrentPosition(
  options = {}
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        !isSupported()
      ) {

        const error = {
          code:
            LOCATION_ERROR_CODES.NOT_SUPPORTED,

          message:
            "Location services are not supported by this browser."
        };

        emit(
          LOCATION_EVENTS.ERROR,
          error
        );

        reject(
          error
        );

        return;
      }


      state.requesting =
        true;


      emit(
        LOCATION_EVENTS.REQUESTING
      );


      const finalOptions =
        {
          ...DEFAULT_OPTIONS,
          ...options
        };


      navigator.geolocation.getCurrentPosition(

        position => {

          try {

            const normalized =
              normalizePosition(
                position
              );


            state.currentPosition =
              normalized;


            state.permission =
              "granted";


            state.requesting =
              false;


            emit(
              LOCATION_EVENTS.SUCCESS,
              {
                position:
                  normalized
              }
            );


            resolve(
              normalized
            );

          } catch (
            error
          ) {

            state.requesting =
              false;


            const normalizedError = {
              code:
                error.code ||
                LOCATION_ERROR_CODES.INVALID_COORDINATES,

              message:
                error.message ||
                "Invalid location data.",

              original:
                error
            };


            emit(
              LOCATION_EVENTS.ERROR,
              normalizedError
            );


            reject(
              normalizedError
            );
          }
        },


        error => {

          state.requesting =
            false;


          const normalized =
            normalizeLocationError(
              error
            );


          if (
            normalized.code ===
            LOCATION_ERROR_CODES.PERMISSION_DENIED
          ) {
            state.permission =
              "denied";
          }


          emit(
            LOCATION_EVENTS.ERROR,
            normalized
          );


          reject(
            normalized
          );
        },


        finalOptions
      );
    }
  );
}


/* =========================================================
   START LOCATION WATCH
========================================================= */

function startWatching(
  {
    options = {},

    onSuccess =
      null,

    onError =
      null
  } = {}
) {
  if (
    !isSupported()
  ) {

    const error = {
      code:
        LOCATION_ERROR_CODES.NOT_SUPPORTED,

      message:
        "Location services are not supported by this browser."
    };


    if (
      typeof onError ===
      "function"
    ) {
      onError(
        error
      );
    }


    emit(
      LOCATION_EVENTS.ERROR,
      error
    );


    return null;
  }


  stopWatching();


  const finalOptions =
    {
      ...DEFAULT_OPTIONS,
      ...options
    };


  const watchId =
    navigator.geolocation.watchPosition(

      position => {

        try {

          const normalized =
            normalizePosition(
              position
            );


          state.currentPosition =
            normalized;


          state.permission =
            "granted";


          emit(
            LOCATION_EVENTS.SUCCESS,
            {
              position:
                normalized,

              watching:
                true
            }
          );


          if (
            typeof onSuccess ===
            "function"
          ) {
            onSuccess(
              normalized
            );
          }

        } catch (
          error
        ) {

          const normalizedError = {
            code:
              error.code ||
              LOCATION_ERROR_CODES.INVALID_COORDINATES,

            message:
              error.message ||
              "Invalid location data.",

            original:
              error
          };


          emit(
            LOCATION_EVENTS.ERROR,
            normalizedError
          );


          if (
            typeof onError ===
            "function"
          ) {
            onError(
              normalizedError
            );
          }
        }
      },


      error => {

        const normalized =
          normalizeLocationError(
            error
          );


        if (
          normalized.code ===
          LOCATION_ERROR_CODES.PERMISSION_DENIED
        ) {
          state.permission =
            "denied";
        }


        emit(
          LOCATION_EVENTS.ERROR,
          normalized
        );


        if (
          typeof onError ===
          "function"
        ) {
          onError(
            normalized
          );
        }
      },


      finalOptions
    );


  state.watchId =
    watchId;


  emit(
    LOCATION_EVENTS.WATCH_STARTED,
    {
      watchId
    }
  );


  return watchId;
}


/* =========================================================
   STOP LOCATION WATCH
========================================================= */

function stopWatching() {
  if (
    state.watchId ===
    null
  ) {
    return false;
  }


  if (
    isSupported()
  ) {
    navigator.geolocation.clearWatch(
      state.watchId
    );
  }


  const previousWatchId =
    state.watchId;


  state.watchId =
    null;


  emit(
    LOCATION_EVENTS.WATCH_STOPPED,
    {
      watchId:
        previousWatchId
    }
  );


  return true;
}


/* =========================================================
   GET LAST KNOWN POSITION
========================================================= */

function getLastKnownPosition() {
  return (
    state.currentPosition ||
    null
  );
}


/* =========================================================
   CLEAR POSITION
========================================================= */

function clearPosition() {
  state.currentPosition =
    null;
}


/* =========================================================
   PERMISSION
========================================================= */

async function getPermissionState() {
  /*
   * Permissions API is not available everywhere.
   */

  if (
    typeof navigator ===
      "undefined" ||
    !navigator.permissions ||
    typeof navigator.permissions.query !==
      "function"
  ) {
    return state.permission;
  }


  try {

    const result =
      await navigator.permissions.query(
        {
          name:
            "geolocation"
        }
      );


    state.permission =
      result.state;


    emit(
      LOCATION_EVENTS.PERMISSION_CHANGED,
      {
        permission:
          result.state
      }
    );


    /*
     * Keep listening for browser-level
     * permission changes.
     */

    if (
      typeof result.addEventListener ===
      "function"
    ) {

      result.addEventListener(
        "change",
        () => {

          state.permission =
            result.state;


          emit(
            LOCATION_EVENTS.PERMISSION_CHANGED,
            {
              permission:
                result.state
            }
          );
        }
      );
    }


    return result.state;

  } catch {

    return state.permission;
  }
}


/* =========================================================
   DISTANCE
========================================================= */

/*
 * Haversine distance.
 *
 * Returns distance in meters.
 */

function distanceBetween(
  pointA,
  pointB
) {
  if (
    !pointA ||
    !pointB
  ) {
    return null;
  }


  const first =
    validateCoordinates(
      pointA.latitude,
      pointA.longitude
    );


  const second =
    validateCoordinates(
      pointB.latitude,
      pointB.longitude
    );


  if (
    !first.valid ||
    !second.valid
  ) {
    return null;
  }


  const lat1 =
    toRadians(
      first.value.latitude
    );

  const lat2 =
    toRadians(
      second.value.latitude
    );


  const deltaLat =
    toRadians(
      second.value.latitude -
      first.value.latitude
    );


  const deltaLng =
    toRadians(
      second.value.longitude -
      first.value.longitude
    );


  const sinLat =
    Math.sin(
      deltaLat / 2
    );


  const sinLng =
    Math.sin(
      deltaLng / 2
    );


  const a =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLng *
      sinLng;


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    );


  /*
   * Mean Earth radius in meters.
   */

  const EARTH_RADIUS =
    6371008.8;


  return (
    EARTH_RADIUS *
    c
  );
}


/* =========================================================
   BEARING
========================================================= */

function bearingBetween(
  pointA,
  pointB
) {
  if (
    !pointA ||
    !pointB
  ) {
    return null;
  }


  const first =
    validateCoordinates(
      pointA.latitude,
      pointA.longitude
    );


  const second =
    validateCoordinates(
      pointB.latitude,
      pointB.longitude
    );


  if (
    !first.valid ||
    !second.valid
  ) {
    return null;
  }


  const lat1 =
    toRadians(
      first.value.latitude
    );

  const lat2 =
    toRadians(
      second.value.latitude
    );


  const deltaLng =
    toRadians(
      second.value.longitude -
      first.value.longitude
    );


  const y =
    Math.sin(
      deltaLng
    ) *
    Math.cos(
      lat2
    );


  const x =
    Math.cos(
      lat1
    ) *
    Math.sin(
      lat2
    ) -
    Math.sin(
      lat1
    ) *
    Math.cos(
      lat2
    ) *
    Math.cos(
      deltaLng
    );


  const degrees =
    toDegrees(
      Math.atan2(
        y,
        x
      )
    );


  return (
    degrees + 360
  ) % 360;
}


/* =========================================================
   RADIANS / DEGREES
========================================================= */

function toRadians(
  degrees
) {
  return (
    Number(degrees) *
    Math.PI /
    180
  );
}


function toDegrees(
  radians
) {
  return (
    Number(radians) *
    180 /
    Math.PI
  );
}


/* =========================================================
   FORMAT DISTANCE
========================================================= */

function formatDistance(
  meters,
  {
    metric = true
  } = {}
) {
  if (
    !Number.isFinite(
      Number(meters)
    )
  ) {
    return "";
  }


  const value =
    Number(meters);


  if (
    metric
  ) {

    if (
      value < 1000
    ) {
      return `${Math.round(value)} m`;
    }


    return `${(
      value / 1000
    ).toFixed(
      value < 10000
        ? 1
        : 0
    )} km`;
  }


  const feet =
    value *
    3.280839895;


  if (
    feet < 5280
  ) {
    return `${Math.round(feet)} ft`;
  }


  return `${(
    feet / 5280
  ).toFixed(1)} mi`;
}


/* =========================================================
   BOUNDING BOX
========================================================= */

function getBoundingBox(
  points
) {
  if (
    !Array.isArray(
      points
    ) ||
    points.length ===
      0
  ) {
    return null;
  }


  let minLat =
    Infinity;

  let maxLat =
    -Infinity;

  let minLng =
    Infinity;

  let maxLng =
    -Infinity;


  for (
    const point of
      points
  ) {

    if (
      !point
    ) {
      continue;
    }


    const validation =
      validateCoordinates(
        point.latitude,
        point.longitude
      );


    if (
      !validation.valid
    ) {
      continue;
    }


    const {
      latitude,
      longitude
    } =
      validation.value;


    minLat =
      Math.min(
        minLat,
        latitude
      );

    maxLat =
      Math.max(
        maxLat,
        latitude
      );

    minLng =
      Math.min(
        minLng,
        longitude
      );

    maxLng =
      Math.max(
        maxLng,
        longitude
      );
  }


  if (
    !Number.isFinite(
      minLat
    ) ||
    !Number.isFinite(
      maxLat
    ) ||
    !Number.isFinite(
      minLng
    ) ||
    !Number.isFinite(
      maxLng
    )
  ) {
    return null;
  }


  return {
    south:
      minLat,

    west:
      minLng,

    north:
      maxLat,

    east:
      maxLng
  };
}


/* =========================================================
   REVERSE GEOCODING
========================================================= */

/*
 * This function intentionally accepts a geocoder callback
 * rather than hard-coding a third-party service.
 *
 * The map/geocoding layer can later supply an approved
 * OpenStreetMap-compatible/Nominatim implementation.
 */

async function reverseGeocode(
  latitude,
  longitude,
  {
    geocoder =
      null
  } = {}
) {
  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      "Invalid coordinates."
    );
  }


  if (
    typeof geocoder !==
    "function"
  ) {
    throw new Error(
      "No geocoder implementation was supplied."
    );
  }


  return geocoder(
    validation.value.latitude,
    validation.value.longitude
  );
}


/* =========================================================
   CREATE LOCATION OBJECT
========================================================= */

function createLocation(
  latitude,
  longitude,
  extra = {}
) {
  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    return null;
  }


  return {
    latitude:
      validation.value.latitude,

    longitude:
      validation.value.longitude,

    ...extra
  };
}


/* =========================================================
   GET STATE
========================================================= */

function getState() {
  return {
    currentPosition:
      state.currentPosition,

    watchId:
      state.watchId,

    permission:
      state.permission,

    requesting:
      state.requesting
  };
}


/* =========================================================
   EXPORT
========================================================= */

export {

  LOCATION_EVENTS,

  LOCATION_ERROR_CODES,

  DEFAULT_OPTIONS,

  isSupported,

  normalizeLocationError,

  normalizePosition,

  getCurrentPosition,

  startWatching,

  stopWatching,

  getLastKnownPosition,

  clearPosition,

  getPermissionState,

  distanceBetween,

  bearingBetween,

  toRadians,

  toDegrees,

  formatDistance,

  getBoundingBox,

  reverseGeocode,

  createLocation,

  getState

};
