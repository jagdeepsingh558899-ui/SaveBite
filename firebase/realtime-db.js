/*
 * SaveBite
 * Firebase Realtime Database Layer
 *
 * Used for:
 * - Business online/offline status
 * - Live deal availability
 * - Live order status
 * - Temporary live operational state
 *
 * Permanent application data belongs in Firestore.
 * Images/files belong to Backblaze B2.
 */

import {
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
  realtimeDb
} from "./firebase-config.js";


/* =========================================================
   PATHS
========================================================= */

const PATHS = Object.freeze({
  PRESENCE: "presence",
  BUSINESS_STATUS: "businessStatus",
  DEAL_STATUS: "dealStatus",
  ORDER_STATUS: "orderStatus",
  LIVE_SESSIONS: "liveSessions"
});


/* =========================================================
   HELPERS
========================================================= */

function cleanId(value) {
  const result =
    String(value ?? "").trim();

  if (!result) {
    throw new Error(
      "A valid ID is required."
    );
  }

  return result;
}


function databaseRef(path) {
  if (!path) {
    throw new Error(
      "Realtime Database path is required."
    );
  }

  return ref(
    realtimeDb,
    path
  );
}


/* =========================================================
   GENERIC READ
========================================================= */

async function getValue(path) {
  const snapshot =
    await get(
      databaseRef(path)
    );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val();
}


/* =========================================================
   GENERIC WRITE
========================================================= */

async function setValue(
  path,
  value
) {
  await set(
    databaseRef(path),
    value
  );

  return true;
}


async function updateValue(
  path,
  values
) {
  if (
    !values ||
    typeof values !== "object"
  ) {
    throw new Error(
      "Update data must be an object."
    );
  }

  await update(
    databaseRef(path),
    values
  );

  return true;
}


async function removeValue(path) {
  await remove(
    databaseRef(path)
  );

  return true;
}


/* =========================================================
   BUSINESS ONLINE / OFFLINE
========================================================= */

function businessStatusPath(
  businessId
) {
  return `${PATHS.BUSINESS_STATUS}/${cleanId(businessId)}`;
}


async function setBusinessOnline(
  businessId
) {
  const id =
    cleanId(businessId);

  const path =
    businessStatusPath(id);

  const statusRef =
    databaseRef(path);

  const connectedRef =
    databaseRef(".info/connected");

  const connectedSnapshot =
    await get(connectedRef);

  if (!connectedSnapshot.val()) {
    throw new Error(
      "Realtime connection is unavailable."
    );
  }

  const offlineValue = {
    online: false,
    updatedAt:
      serverTimestamp()
  };

  await onDisconnect(
    statusRef
  ).set(
    offlineValue
  );

  await set(
    statusRef,
    {
      online: true,
      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function setBusinessOffline(
  businessId
) {
  const path =
    businessStatusPath(
      businessId
    );

  await set(
    databaseRef(path),
    {
      online: false,
      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function getBusinessStatus(
  businessId
) {
  return getValue(
    businessStatusPath(
      businessId
    )
  );
}


function watchBusinessStatus(
  businessId,
  callback
) {
  if (
    typeof callback !== "function"
  ) {
    throw new TypeError(
      "Callback must be a function."
    );
  }

  const reference =
    databaseRef(
      businessStatusPath(
        businessId
      )
    );

  return onValue(
    reference,
    snapshot => {
      callback(
        snapshot.exists()
          ? snapshot.val()
          : null
      );
    }
  );
}


/* =========================================================
   DEAL LIVE STATUS
========================================================= */

function dealStatusPath(
  dealId
) {
  return `${PATHS.DEAL_STATUS}/${cleanId(dealId)}`;
}


async function setDealLiveStatus(
  dealId,
  data
) {
  const id =
    cleanId(dealId);

  await set(
    databaseRef(
      dealStatusPath(id)
    ),
    {
      ...data,

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function updateDealLiveStatus(
  dealId,
  data
) {
  await update(
    databaseRef(
      dealStatusPath(dealId)
    ),
    {
      ...data,

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function getDealLiveStatus(
  dealId
) {
  return getValue(
    dealStatusPath(
      dealId
    )
  );
}


function watchDealLiveStatus(
  dealId,
  callback
) {
  if (
    typeof callback !== "function"
  ) {
    throw new TypeError(
      "Callback must be a function."
    );
  }

  return onValue(
    databaseRef(
      dealStatusPath(
        dealId
      )
    ),
    snapshot => {
      callback(
        snapshot.exists()
          ? snapshot.val()
          : null
      );
    }
  );
}


/* =========================================================
   ORDER LIVE STATUS
========================================================= */

function orderStatusPath(
  orderId
) {
  return `${PATHS.ORDER_STATUS}/${cleanId(orderId)}`;
}


async function setOrderLiveStatus(
  orderId,
  data
) {
  const id =
    cleanId(orderId);

  await set(
    databaseRef(
      orderStatusPath(id)
    ),
    {
      ...data,

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function updateOrderLiveStatus(
  orderId,
  data
) {
  await update(
    databaseRef(
      orderStatusPath(orderId)
    ),
    {
      ...data,

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function getOrderLiveStatus(
  orderId
) {
  return getValue(
    orderStatusPath(
      orderId
    )
  );
}


function watchOrderLiveStatus(
  orderId,
  callback
) {
  if (
    typeof callback !== "function"
  ) {
    throw new TypeError(
      "Callback must be a function."
    );
  }

  return onValue(
    databaseRef(
      orderStatusPath(
        orderId
      )
    ),
    snapshot => {
      callback(
        snapshot.exists()
          ? snapshot.val()
          : null
      );
    }
  );
}


/* =========================================================
   LIVE SESSION
========================================================= */

function liveSessionPath(
  sessionId
) {
  return `${PATHS.LIVE_SESSIONS}/${cleanId(sessionId)}`;
}


async function createLiveSession(
  sessionId,
  data = {}
) {
  await set(
    databaseRef(
      liveSessionPath(
        sessionId
      )
    ),
    {
      ...data,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function updateLiveSession(
  sessionId,
  data
) {
  await update(
    databaseRef(
      liveSessionPath(
        sessionId
      )
    ),
    {
      ...data,

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


async function getLiveSession(
  sessionId
) {
  return getValue(
    liveSessionPath(
      sessionId
    )
  );
}


async function removeLiveSession(
  sessionId
) {
  return removeValue(
    liveSessionPath(
      sessionId
    )
  );
}


function watchLiveSession(
  sessionId,
  callback
) {
  if (
    typeof callback !== "function"
  ) {
    throw new TypeError(
      "Callback must be a function."
    );
  }

  return onValue(
    databaseRef(
      liveSessionPath(
        sessionId
      )
    ),
    snapshot => {
      callback(
        snapshot.exists()
          ? snapshot.val()
          : null
      );
    }
  );
}


/* =========================================================
   CHILD LISTENERS
========================================================= */

function watchChildren(
  path,
  {
    onAdded,
    onChanged,
    onRemoved
  } = {}
) {
  const reference =
    databaseRef(path);

  const unsubscribers = [];

  if (
    typeof onAdded === "function"
  ) {
    unsubscribers.push(
      onChildAdded(
        reference,
        snapshot => {
          onAdded(
            snapshot.key,
            snapshot.val()
          );
        }
      )
    );
  }

  if (
    typeof onChanged === "function"
  ) {
    unsubscribers.push(
      onChildChanged(
        reference,
        snapshot => {
          onChanged(
            snapshot.key,
            snapshot.val()
          );
        }
      )
    );
  }

  if (
    typeof onRemoved === "function"
  ) {
    unsubscribers.push(
      onChildRemoved(
        reference,
        snapshot => {
          onRemoved(
            snapshot.key,
            snapshot.val()
          );
        }
      )
    );
  }

  return () => {
    unsubscribers.forEach(
      unsubscribe => {
        if (
          typeof unsubscribe ===
          "function"
        ) {
          unsubscribe();
        }
      }
    );
  };
}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function watchConnection(
  callback
) {
  if (
    typeof callback !== "function"
  ) {
    throw new TypeError(
      "Callback must be a function."
    );
  }

  return onValue(
    databaseRef(
      ".info/connected"
    ),
    snapshot => {
      callback(
        snapshot.val() === true
      );
    }
  );
}


/* =========================================================
   CLEANUP HELPERS
========================================================= */

async function clearBusinessStatus(
  businessId
) {
  return removeValue(
    businessStatusPath(
      businessId
    )
  );
}


async function clearDealStatus(
  dealId
) {
  return removeValue(
    dealStatusPath(
      dealId
    )
  );
}


async function clearOrderStatus(
  orderId
) {
  return removeValue(
    orderStatusPath(
      orderId
    )
  );
}


/* =========================================================
   EXPORT
========================================================= */

export {
  PATHS,

  getValue,
  setValue,
  updateValue,
  removeValue,

  setBusinessOnline,
  setBusinessOffline,
  getBusinessStatus,
  watchBusinessStatus,
  clearBusinessStatus,

  setDealLiveStatus,
  updateDealLiveStatus,
  getDealLiveStatus,
  watchDealLiveStatus,
  clearDealStatus,

  setOrderLiveStatus,
  updateOrderLiveStatus,
  getOrderLiveStatus,
  watchOrderLiveStatus,
  clearOrderStatus,

  createLiveSession,
  updateLiveSession,
  getLiveSession,
  removeLiveSession,
  watchLiveSession,

  watchChildren,
  watchConnection
};
