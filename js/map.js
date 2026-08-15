/*
 * SaveBite
 * Central Map Engine
 *
 * Map provider:
 * - Leaflet
 * - OpenStreetMap tiles
 *
 * Google Maps is intentionally NOT used.
 *
 * Responsibilities:
 * - Leaflet initialization
 * - OpenStreetMap tile layer
 * - User marker
 * - Business markers
 * - Pickup/drop marker
 * - Map click handling
 * - Map movement
 * - Fit bounds
 * - Marker management
 * - Location accuracy circle
 * - Basic map state
 *
 * IMPORTANT:
 * This module does not authenticate users.
 * This module does not authorize businesses.
 * Backend data must still be validated by Firebase rules.
 */


/* =========================================================
   IMPORTS
========================================================= */

import {
  validateCoordinates
} from "./validation.js";

import {
  distanceBetween,
  formatDistance
} from "./location.js";


/* =========================================================
   CONSTANTS
========================================================= */

const MAP_EVENTS =
  Object.freeze({

    READY:
      "savebite:map-ready",

    DESTROYED:
      "savebite:map-destroyed",

    CLICK:
      "savebite:map-click",

    MOVE:
      "savebite:map-move",

    MOVESTART:
      "savebite:map-movestart",

    MOVEEND:
      "savebite:map-moveend",

    ZOOM:
      "savebite:map-zoom",

    MARKER_ADDED:
      "savebite:map-marker-added",

    MARKER_REMOVED:
      "savebite:map-marker-removed",

    USER_LOCATION:
      "savebite:map-user-location",

    ERROR:
      "savebite:map-error"
  });


const DEFAULT_MAP_OPTIONS =
  Object.freeze({

    center: [
      30.7046,
      76.7179
    ],

    zoom:
      13,

    minZoom:
      3,

    maxZoom:
      19,

    zoomControl:
      true,

    attributionControl:
      true,

    preferCanvas:
      true
  });


const DEFAULT_TILE_OPTIONS =
  Object.freeze({

    maxZoom:
      19,

    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  map:
    null,

  container:
    null,

  userMarker:
    null,

  userAccuracyCircle:
    null,

  markers:
    new Map(),

  pickupMarker:
    null,

  dropMarker:
    null,

  routeLayer:
    null,

  initialized:
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
   LEAFLET CHECK
========================================================= */

function getLeaflet() {
  if (
    typeof window ===
      "undefined" ||
    !window.L
  ) {
    throw new Error(
      "Leaflet is not loaded. Include Leaflet before using SaveBite map.js."
    );
  }

  return window.L;
}


/* =========================================================
   VALIDATE MAP CONTAINER
========================================================= */

function resolveContainer(
  container
) {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }


  if (
    container instanceof
    HTMLElement
  ) {
    return container;
  }


  if (
    typeof container ===
    "string"
  ) {
    const element =
      document.querySelector(
        container
      );

    return element ||
      null;
  }


  return null;
}


/* =========================================================
   INITIALIZE MAP
========================================================= */

function initializeMap(
  container,
  options = {}
) {
  if (
    state.map
  ) {
    return state.map;
  }


  const element =
    resolveContainer(
      container
    );


  if (!element) {
    const error =
      new Error(
        "Map container was not found."
      );

    emit(
      MAP_EVENTS.ERROR,
      {
        error
      }
    );

    throw error;
  }


  const L =
    getLeaflet();


  const mapOptions =
    {
      ...DEFAULT_MAP_OPTIONS,
      ...options
    };


  /*
   * Support both:
   *
   * center: [lat, lng]
   *
   * and:
   *
   * latitude / longitude
   */

  let center =
    mapOptions.center;


  if (
    Number.isFinite(
      Number(
        options.latitude
      )
    ) &&
    Number.isFinite(
      Number(
        options.longitude
      )
    )
  ) {
    center = [
      Number(
        options.latitude
      ),
      Number(
        options.longitude
      )
    ];
  }


  const validation =
    validateCoordinates(
      center?.[0],
      center?.[1]
    );


  if (
    !validation.valid
  ) {
    center =
      DEFAULT_MAP_OPTIONS.center;
  }


  const map =
    L.map(
      element,
      {
        zoomControl:
          mapOptions.zoomControl,

        attributionControl:
          mapOptions.attributionControl,

        minZoom:
          mapOptions.minZoom,

        maxZoom:
          mapOptions.maxZoom,

        preferCanvas:
          mapOptions.preferCanvas
      }
    );


  map.setView(
    center,
    mapOptions.zoom
  );


  /*
   * OpenStreetMap tile layer.
   */

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      ...DEFAULT_TILE_OPTIONS,

      maxZoom:
        mapOptions.maxZoom
    }
  ).addTo(
    map
  );


  /*
   * Map click.
   */

  map.on(
    "click",
    event => {

      emit(
        MAP_EVENTS.CLICK,
        {
          map,

          latitude:
            event.latlng.lat,

          longitude:
            event.latlng.lng,

          latlng:
            event.latlng,

          originalEvent:
            event.originalEvent
        }
      );
    }
  );


  map.on(
    "movestart",
    event => {

      emit(
        MAP_EVENTS.MOVESTART,
        {
          map,
          event
        }
      );
    }
  );


  map.on(
    "move",
    event => {

      const center =
        map.getCenter();


      emit(
        MAP_EVENTS.MOVE,
        {
          map,

          latitude:
            center.lat,

          longitude:
            center.lng,

          zoom:
            map.getZoom(),

          event
        }
      );
    }
  );


  map.on(
    "moveend",
    event => {

      const center =
        map.getCenter();


      emit(
        MAP_EVENTS.MOVEEND,
        {
          map,

          latitude:
            center.lat,

          longitude:
            center.lng,

          zoom:
            map.getZoom(),

          event
        }
      );
    }
  );


  map.on(
    "zoomend",
    event => {

      emit(
        MAP_EVENTS.ZOOM,
        {
          map,

          zoom:
            map.getZoom(),

          event
        }
      );
    }
  );


  state.map =
    map;

  state.container =
    element;

  state.initialized =
    true;


  emit(
    MAP_EVENTS.READY,
    {
      map,
      container:
        element
    }
  );


  /*
   * Leaflet sometimes needs a size refresh
   * when initialized inside hidden/flexible UI.
   */

  setTimeout(
    () => {
      try {
        map.invalidateSize();
      } catch {
        // Ignore if map was destroyed.
      }
    },
    100
  );


  return map;
}


/* =========================================================
   GET MAP
========================================================= */

function getMap() {
  return state.map;
}


/* =========================================================
   INVALIDATE SIZE
========================================================= */

function invalidateSize(
  options = {}
) {
  if (
    !state.map
  ) {
    return false;
  }


  state.map.invalidateSize(
    options
  );


  return true;
}


/* =========================================================
   SET VIEW
========================================================= */

function setView(
  latitude,
  longitude,
  zoom =
    undefined
) {
  if (
    !state.map
  ) {
    return false;
  }


  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    return false;
  }


  const nextZoom =
    Number.isFinite(
      Number(zoom)
    )
      ? Number(zoom)
      : state.map.getZoom();


  state.map.setView(
    [
      validation.value.latitude,
      validation.value.longitude
    ],
    nextZoom
  );


  return true;
}


/* =========================================================
   PAN TO
========================================================= */

function panTo(
  latitude,
  longitude,
  options = {}
) {
  if (
    !state.map
  ) {
    return false;
  }


  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    return false;
  }


  state.map.panTo(
    [
      validation.value.latitude,
      validation.value.longitude
    ],
    options
  );


  return true;
}


/* =========================================================
   CREATE DEFAULT ICON
========================================================= */

function createIcon(
  {
    className =
      "savebite-map-marker",

    html =
      "",

    size = [
      40,
      40
    ],

    anchor = [
      20,
      40
    ],

    popupAnchor = [
      0,
      -40
    ]
  } = {}
) {
  const L =
    getLeaflet();


  return L.divIcon({
    className,

    html,

    iconSize:
      size,

    iconAnchor:
      anchor,

    popupAnchor
  });
}


/* =========================================================
   ADD MARKER
========================================================= */

function addMarker(
  {
    id = null,

    latitude,

    longitude,

    icon = null,

    title = "",

    popup = "",

    draggable =
      false,

    data = {}
  } = {}
) {
  if (
    !state.map
  ) {
    throw new Error(
      "Map is not initialized."
    );
  }


  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      "Invalid marker coordinates."
    );
  }


  const L =
    getLeaflet();


  const marker =
    L.marker(
      [
        validation.value.latitude,
        validation.value.longitude
      ],
      {
        icon:
          icon ||
          undefined,

        draggable
      }
    );


  marker.addTo(
    state.map
  );


  if (
    title
  ) {
    marker.bindTooltip(
      String(title),
      {
        direction:
          "top",

        offset:
          [
            0,
            -10
          ]
      }
    );
  }


  if (
    popup
  ) {
    marker.bindPopup(
      String(popup)
    );
  }


  if (
    id !== null &&
    id !== undefined
  ) {
    const key =
      String(id);


    /*
     * Remove an existing marker with the
     * same logical ID to avoid duplicates.
     */

    removeMarker(
      key
    );


    state.markers.set(
      key,
      {
        marker,

        data
      }
    );


    emit(
      MAP_EVENTS.MARKER_ADDED,
      {
        id:
          key,

        marker,

        data
      }
    );
  }


  return marker;
}


/* =========================================================
   UPDATE MARKER
========================================================= */

function updateMarker(
  id,
  {
    latitude,
    longitude,

    title =
      undefined,

    popup =
      undefined
  } = {}
) {
  const key =
    String(id);


  const record =
    state.markers.get(
      key
    );


  if (
    !record
  ) {
    return null;
  }


  const marker =
    record.marker;


  if (
    latitude !==
      undefined &&
    longitude !==
      undefined
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


    marker.setLatLng(
      [
        validation.value.latitude,
        validation.value.longitude
      ]
    );
  }


  if (
    title !==
      undefined
  ) {

    if (
      title
    ) {
      marker.bindTooltip(
        String(title),
        {
          direction:
            "top",

          offset:
            [
              0,
              -10
            ]
        }
      );

    } else {
      marker.unbindTooltip();
    }
  }


  if (
    popup !==
      undefined
  ) {

    if (
      popup
    ) {
      marker.bindPopup(
        String(popup)
      );

    } else {
      marker.unbindPopup();
    }
  }


  return marker;
}


/* =========================================================
   REMOVE MARKER
========================================================= */

function removeMarker(
  id
) {
  const key =
    String(id);


  const record =
    state.markers.get(
      key
    );


  if (
    !record
  ) {
    return false;
  }


  if (
    state.map
  ) {
    record.marker.removeFrom(
      state.map
    );
  }


  state.markers.delete(
    key
  );


  emit(
    MAP_EVENTS.MARKER_REMOVED,
    {
      id:
        key
    }
  );


  return true;
}


/* =========================================================
   CLEAR MARKERS
========================================================= */

function clearMarkers() {
  for (
    const id of
      state.markers.keys()
  ) {
    removeMarker(
      id
    );
  }


  return true;
}


/* =========================================================
   GET MARKER
========================================================= */

function getMarker(
  id
) {
  const record =
    state.markers.get(
      String(id)
    );


  return record ||
    null;
}


/* =========================================================
   ADD USER LOCATION
========================================================= */

function setUserLocation(
  {
    latitude,
    longitude,

    accuracy =
      null,

    center =
      false,

    zoom =
      16
  } = {}
) {
  if (
    !state.map
  ) {
    throw new Error(
      "Map is not initialized."
    );
  }


  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      "Invalid user coordinates."
    );
  }


  const L =
    getLeaflet();


  const position = [
    validation.value.latitude,
    validation.value.longitude
  ];


  if (
    !state.userMarker
  ) {

    state.userMarker =
      L.circleMarker(
        position,
        {
          radius:
            9,

          weight:
            3,

          color:
            "#ffffff",

          fillColor:
            "#FFD600",

          fillOpacity:
            1
        }
      ).addTo(
        state.map
      );

  } else {

    state.userMarker.setLatLng(
      position
    );
  }


  /*
   * Accuracy circle.
   */

  if (
    Number.isFinite(
      Number(accuracy)
    ) &&
    Number(accuracy) >
      0
  ) {

    if (
      !state.userAccuracyCircle
    ) {

      state.userAccuracyCircle =
        L.circle(
          position,
          {
            radius:
              Number(accuracy),

            weight:
              1,

            color:
              "#FFD600",

            fillColor:
              "#FFD600",

            fillOpacity:
              0.12
          }
        ).addTo(
          state.map
        );

    } else {

      state.userAccuracyCircle
        .setLatLng(
          position
        );

      state.userAccuracyCircle
        .setRadius(
          Number(accuracy)
        );
    }

  } else if (
    state.userAccuracyCircle
  ) {

    state.userAccuracyCircle
      .removeFrom(
        state.map
      );

    state.userAccuracyCircle =
      null;
  }


  if (
    center
  ) {
    state.map.setView(
      position,
      zoom
    );
  }


  emit(
    MAP_EVENTS.USER_LOCATION,
    {
      latitude:
        validation.value.latitude,

      longitude:
        validation.value.longitude,

      accuracy:
        Number.isFinite(
          Number(accuracy)
        )
          ? Number(accuracy)
          : null
    }
  );


  return state.userMarker;
}


/* =========================================================
   REMOVE USER LOCATION
========================================================= */

function clearUserLocation() {
  if (
    state.userMarker &&
    state.map
  ) {
    state.userMarker.removeFrom(
      state.map
    );
  }


  if (
    state.userAccuracyCircle &&
    state.map
  ) {
    state.userAccuracyCircle.removeFrom(
      state.map
    );
  }


  state.userMarker =
    null;

  state.userAccuracyCircle =
    null;
}


/* =========================================================
   PICKUP MARKER
========================================================= */

function setPickupMarker(
  {
    latitude,
    longitude,

    popup =
      "Pickup location"
  } = {}
) {
  if (
    !state.map
  ) {
    throw new Error(
      "Map is not initialized."
    );
  }


  const L =
    getLeaflet();


  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      "Invalid pickup coordinates."
    );
  }


  clearPickupMarker();


  const icon =
    createIcon({
      className:
        "savebite-pickup-marker",

      html:
        '<span aria-hidden="true">P</span>',

      size:
        [
          38,
          38
        ],

      anchor:
        [
          19,
          38
        ],

      popupAnchor:
        [
          0,
          -36
        ]
    });


  state.pickupMarker =
    L.marker(
      [
        validation.value.latitude,
        validation.value.longitude
      ],
      {
        icon
      }
    )
      .addTo(
        state.map
      )
      .bindPopup(
        popup
      );


  return state.pickupMarker;
}


/* =========================================================
   CLEAR PICKUP MARKER
========================================================= */

function clearPickupMarker() {
  if (
    state.pickupMarker &&
    state.map
  ) {
    state.pickupMarker.removeFrom(
      state.map
    );
  }


  state.pickupMarker =
    null;
}


/* =========================================================
   DROP MARKER
========================================================= */

function setDropMarker(
  {
    latitude,
    longitude,

    popup =
      "Drop location"
  } = {}
) {
  if (
    !state.map
  ) {
    throw new Error(
      "Map is not initialized."
    );
  }


  const L =
    getLeaflet();


  const validation =
    validateCoordinates(
      latitude,
      longitude
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      "Invalid drop coordinates."
    );
  }


  clearDropMarker();


  const icon =
    createIcon({
      className:
        "savebite-drop-marker",

      html:
        '<span aria-hidden="true">D</span>',

      size:
        [
          38,
          38
        ],

      anchor:
        [
          19,
          38
        ],

      popupAnchor:
        [
          0,
          -36
        ]
    });


  state.dropMarker =
    L.marker(
      [
        validation.value.latitude,
        validation.value.longitude
      ],
      {
        icon
      }
    )
      .addTo(
        state.map
      )
      .bindPopup(
        popup
      );


  return state.dropMarker;
}


/* =========================================================
   CLEAR DROP MARKER
========================================================= */

function clearDropMarker() {
  if (
    state.dropMarker &&
    state.map
  ) {
    state.dropMarker.removeFrom(
      state.map
    );
  }


  state.dropMarker =
    null;
}


/* =========================================================
   CLEAR PICKUP + DROP
========================================================= */

function clearLocationMarkers() {
  clearPickupMarker();
  clearDropMarker();
}


/* =========================================================
   FIT BOUNDS
========================================================= */

function fitCoordinates(
  points,
  {
    padding =
      [
        40,
        40
      ],

    maxZoom =
      16
  } = {}
) {
  if (
    !state.map ||
    !Array.isArray(
      points
    ) ||
    points.length ===
      0
  ) {
    return false;
  }


  const validPoints =
    points
      .map(
        point =>
          validateCoordinates(
            point.latitude,
            point.longitude
          )
      )
      .filter(
        result =>
          result.valid
      )
      .map(
        result => [
          result.value.latitude,
          result.value.longitude
        ]
      );


  if (
    validPoints.length ===
      0
  ) {
    return false;
  }


  const L =
    getLeaflet();


  const bounds =
    L.latLngBounds(
      validPoints
    );


  state.map.fitBounds(
    bounds,
    {
      padding,

      maxZoom
    }
  );


  return true;
}


/* =========================================================
   DISTANCE TO MARKER
========================================================= */

function distanceFromUser(
  latitude,
  longitude
) {
  if (
    !state.userMarker
  ) {
    return null;
  }


  const user =
    state.userMarker.getLatLng();


  return distanceBetween(
    {
      latitude:
        user.lat,

      longitude:
        user.lng
    },
    {
      latitude,
      longitude
    }
  );
}


/* =========================================================
   DISTANCE LABEL
========================================================= */

function distanceLabelFromUser(
  latitude,
  longitude
) {
  const distance =
    distanceFromUser(
      latitude,
      longitude
    );


  if (
    distance ===
      null
  ) {
    return "";
  }


  return formatDistance(
    distance
  );
}


/* =========================================================
   REMOVE ROUTE LAYER
========================================================= */

function clearRouteLayer() {
  if (
    state.routeLayer &&
    state.map
  ) {
    state.routeLayer.removeFrom(
      state.map
    );
  }


  state.routeLayer =
    null;
}


/* =========================================================
   SET ROUTE LAYER
========================================================= */

function setRouteLayer(
  layer
) {
  if (
    !state.map
  ) {
    return false;
  }


  clearRouteLayer();


  if (
    !layer
  ) {
    return false;
  }


  state.routeLayer =
    layer;


  layer.addTo(
    state.map
  );


  return true;
}


/* =========================================================
   GET MAP CENTER
========================================================= */

function getCenter() {
  if (
    !state.map
  ) {
    return null;
  }


  const center =
    state.map.getCenter();


  return {
    latitude:
      center.lat,

    longitude:
      center.lng
  };
}


/* =========================================================
   GET ZOOM
========================================================= */

function getZoom() {
  if (
    !state.map
  ) {
    return null;
  }

  return state.map.getZoom();
}


/* =========================================================
   GET STATE
========================================================= */

function getState() {
  return {

    initialized:
      state.initialized,

    map:
      state.map,

    container:
      state.container,

    userMarker:
      state.userMarker,

    pickupMarker:
      state.pickupMarker,

    dropMarker:
      state.dropMarker,

    routeLayer:
      state.routeLayer,

    markerCount:
      state.markers.size
  };
}


/* =========================================================
   DESTROY MAP
========================================================= */

function destroyMap() {
  if (
    !state.map
  ) {
    return false;
  }


  clearMarkers();

  clearUserLocation();

  clearLocationMarkers();

  clearRouteLayer();


  state.map.remove();


  state.map =
    null;

  state.container =
    null;

  state.userMarker =
    null;

  state.userAccuracyCircle =
    null;

  state.pickupMarker =
    null;

  state.dropMarker =
    null;

  state.routeLayer =
    null;

  state.markers.clear();

  state.initialized =
    false;


  emit(
    MAP_EVENTS.DESTROYED
  );


  return true;
}


/* =========================================================
   EXPORT
========================================================= */

export {

  MAP_EVENTS,

  DEFAULT_MAP_OPTIONS,

  DEFAULT_TILE_OPTIONS,

  initializeMap,

  getMap,

  invalidateSize,

  setView,

  panTo,

  createIcon,

  addMarker,

  updateMarker,

  removeMarker,

  clearMarkers,

  getMarker,

  setUserLocation,

  clearUserLocation,

  setPickupMarker,

  clearPickupMarker,

  setDropMarker,

  clearDropMarker,

  clearLocationMarkers,

  fitCoordinates,

  distanceFromUser,

  distanceLabelFromUser,

  clearRouteLayer,

  setRouteLayer,

  getCenter,

  getZoom,

  getState,

  destroyMap

};
