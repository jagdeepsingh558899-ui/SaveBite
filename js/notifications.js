/*
 * SaveBite
 * Central Notification Engine
 *
 * Responsibilities:
 * - In-app notification state
 * - Unread notification count
 * - Browser notification permission
 * - FCM token registration hook
 * - Foreground notification handling hook
 * - Notification click handling
 * - Notification read/unread state
 * - Notification normalization
 *
 * IMPORTANT:
 * - Firebase Authentication remains the auth source of truth.
 * - This module does NOT trust localStorage for authentication.
 * - Persistent notifications should come from Firestore/backend.
 * - Browser notifications require explicit user permission.
 * - FCM token storage must be handled by trusted backend rules.
 */


/* =========================================================
   CONSTANTS
========================================================= */

const NOTIFICATION_EVENTS =
  Object.freeze({

    READY:
      "savebite:notifications-ready",

    RECEIVED:
      "savebite:notification-received",

    READ:
      "savebite:notification-read",

    UNREAD_CHANGED:
      "savebite:notification-unread-changed",

    CLEARED:
      "savebite:notifications-cleared",

    PERMISSION_CHANGED:
      "savebite:notification-permission-changed",

    TOKEN_RECEIVED:
      "savebite:fcm-token-received",

    TOKEN_ERROR:
      "savebite:fcm-token-error",

    CLICKED:
      "savebite:notification-clicked",

    ERROR:
      "savebite:notification-error"
  });


const NOTIFICATION_TYPES =
  Object.freeze({

    SYSTEM:
      "system",

    ORDER:
      "order",

    OFFER:
      "offer",

    SHOP:
      "shop",

    PAYMENT:
      "payment",

    ACCOUNT:
      "account",

    PROMOTION:
      "promotion",

    SECURITY:
      "security"
  });


const NOTIFICATION_PERMISSION =
  Object.freeze({

    DEFAULT:
      "default",

    GRANTED:
      "granted",

    DENIED:
      "denied"
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  initialized:
    false,

  notifications:
    [],

  unreadCount:
    0,

  browserPermission:
    typeof Notification !==
      "undefined"
      ? Notification.permission
      : "unsupported",

  fcmToken:
    null,

  unsubscribe:
    null,

  currentUserId:
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
   ID GENERATOR
========================================================= */

function generateNotificationId() {
  return (
    `notification_${Date.now()}_` +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}


/* =========================================================
   DATE NORMALIZATION
========================================================= */

function normalizeTimestamp(
  value
) {
  if (
    value instanceof Date
  ) {
    return value;
  }


  if (
    typeof value ===
    "number"
  ) {

    const date =
      new Date(
        value
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  if (
    typeof value ===
    "string"
  ) {

    const date =
      new Date(
        value
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  /*
   * Firebase Timestamp support.
   */

  if (
    value &&
    typeof value.toDate ===
      "function"
  ) {

    const date =
      value.toDate();

    if (
      date instanceof Date &&
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  /*
   * Firestore Timestamp-like object.
   */

  if (
    value &&
    Number.isFinite(
      value.seconds
    )
  ) {

    const date =
      new Date(
        value.seconds *
          1000
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  return new Date();
}


/* =========================================================
   TYPE NORMALIZATION
========================================================= */

function normalizeType(
  type
) {
  if (
    typeof type !==
    "string"
  ) {
    return NOTIFICATION_TYPES.SYSTEM;
  }


  const normalized =
    type
      .trim()
      .toLowerCase();


  return Object.values(
    NOTIFICATION_TYPES
  ).includes(
    normalized
  )
    ? normalized
    : NOTIFICATION_TYPES.SYSTEM;
}


/* =========================================================
   NOTIFICATION NORMALIZATION
========================================================= */

function normalizeNotification(
  notification = {}
) {
  const id =
    notification.id ||
    notification.notificationId ||
    generateNotificationId();


  const title =
    typeof notification.title ===
    "string" &&
    notification.title.trim()
      ? notification.title.trim()
      : "SaveBite";


  const body =
    typeof notification.body ===
    "string"
      ? notification.body.trim()
      : "";


  const timestamp =
    normalizeTimestamp(
      notification.timestamp ||
      notification.createdAt ||
      notification.time
    );


  return {

    id:
      String(id),

    title,

    body,

    type:
      normalizeType(
        notification.type
      ),

    read:
      Boolean(
        notification.read
      ),

    timestamp,

    createdAt:
      timestamp,

    data:
      notification.data &&
      typeof notification.data ===
        "object"
        ? {
            ...notification.data
          }
        : {},

    imageUrl:
      typeof notification.imageUrl ===
      "string"
        ? notification.imageUrl
        : null,

    link:
      typeof notification.link ===
      "string"
        ? notification.link
        : null,

    userId:
      notification.userId ||
      null
  };
}


/* =========================================================
   RECALCULATE UNREAD
========================================================= */

function recalculateUnreadCount() {
  state.unreadCount =
    state.notifications
      .filter(
        notification =>
          !notification.read
      )
      .length;


  emit(
    NOTIFICATION_EVENTS.UNREAD_CHANGED,
    {
      count:
        state.unreadCount
    }
  );


  return state.unreadCount;
}


/* =========================================================
   INITIALIZE
========================================================= */

function initializeNotifications(
  {
    userId =
      null,

    notifications =
      []
  } = {}
) {
  state.currentUserId =
    userId;


  state.notifications =
    Array.isArray(
      notifications
    )
      ? notifications
          .map(
            normalizeNotification
          )
          .sort(
            (
              first,
              second
            ) =>
              second.timestamp.getTime() -
              first.timestamp.getTime()
          )
      : [];


  recalculateUnreadCount();


  state.browserPermission =
    getBrowserPermission();


  state.initialized =
    true;


  emit(
    NOTIFICATION_EVENTS.READY,
    getState()
  );


  return getState();
}


/* =========================================================
   GET BROWSER PERMISSION
========================================================= */

function getBrowserPermission() {
  if (
    typeof Notification ===
    "undefined"
  ) {
    return "unsupported";
  }


  return Notification.permission;
}


/* =========================================================
   REQUEST BROWSER PERMISSION
========================================================= */

async function requestBrowserPermission() {
  if (
    typeof Notification ===
    "undefined"
  ) {

    state.browserPermission =
      "unsupported";


    emit(
      NOTIFICATION_EVENTS.PERMISSION_CHANGED,
      {
        permission:
          "unsupported"
      }
    );


    return "unsupported";
  }


  /*
   * Never repeatedly request permission
   * after explicit denial.
   */

  if (
    Notification.permission ===
    NOTIFICATION_PERMISSION.DENIED
  ) {

    state.browserPermission =
      Notification.permission;


    emit(
      NOTIFICATION_EVENTS.PERMISSION_CHANGED,
      {
        permission:
          Notification.permission
      }
    );


    return Notification.permission;
  }


  try {

    const permission =
      await Notification.requestPermission();


    state.browserPermission =
      permission;


    emit(
      NOTIFICATION_EVENTS.PERMISSION_CHANGED,
      {
        permission
      }
    );


    return permission;

  } catch (
    error
  ) {

    emit(
      NOTIFICATION_EVENTS.ERROR,
      {
        error,

        context:
          "request-browser-permission"
      }
    );


    return state.browserPermission;
  }
}


/* =========================================================
   SHOW BROWSER NOTIFICATION
========================================================= */

async function showBrowserNotification(
  notification,
  {
    requirePermission =
      true,

    silent =
      false,

    tag =
      undefined
  } = {}
) {
  if (
    typeof Notification ===
    "undefined"
  ) {
    return {
      shown:
        false,

      reason:
        "unsupported"
    };
  }


  let permission =
    Notification.permission;


  if (
    requirePermission &&
    permission !==
      NOTIFICATION_PERMISSION.GRANTED
  ) {

    permission =
      await requestBrowserPermission();
  }


  if (
    permission !==
      NOTIFICATION_PERMISSION.GRANTED
  ) {
    return {
      shown:
        false,

      reason:
        "permission_not_granted"
    };
  }


  const normalized =
    normalizeNotification(
      notification
    );


  try {

    const browserNotification =
      new Notification(
        normalized.title,
        {
          body:
            normalized.body,

          icon:
            normalized.imageUrl ||
            "/assets/icons/icon-192.png",

          badge:
            "/assets/icons/icon-192.png",

          tag:
            tag ||
            normalized.id,

          silent,

          data:
            {
              ...normalized.data,

              notificationId:
                normalized.id,

              link:
                normalized.link
            }
        }
      );


    browserNotification.onclick =
      event => {

        event.preventDefault();


        handleNotificationClick(
          normalized
        );


        try {
          browserNotification.close();
        } catch {
          // Ignore browser close failures.
        }
      };


    return {
      shown:
        true,

      notification:
        normalized,

      instance:
        browserNotification
    };

  } catch (
    error
  ) {

    emit(
      NOTIFICATION_EVENTS.ERROR,
      {
        error,

        context:
          "show-browser-notification"
      }
    );


    return {
      shown:
        false,

      reason:
        "notification_failed",

      error
    };
  }
}


/* =========================================================
   ADD NOTIFICATION
========================================================= */

function addNotification(
  notification,
  {
    showBrowser =
      false
  } = {}
) {
  const normalized =
    normalizeNotification(
      notification
    );


  const existingIndex =
    state.notifications.findIndex(
      item =>
        item.id ===
        normalized.id
    );


  if (
    existingIndex >=
    0
  ) {

    state.notifications[
      existingIndex
    ] =
      {
        ...state.notifications[
          existingIndex
        ],

        ...normalized
      };

  } else {

    state.notifications.unshift(
      normalized
    );
  }


  state.notifications.sort(
    (
      first,
      second
    ) =>
      second.timestamp.getTime() -
      first.timestamp.getTime()
  );


  recalculateUnreadCount();


  emit(
    NOTIFICATION_EVENTS.RECEIVED,
    {
      notification:
        normalized,

      unreadCount:
        state.unreadCount
    }
  );


  if (
    showBrowser
  ) {
    showBrowserNotification(
      normalized
    ).catch(
      error => {

        emit(
          NOTIFICATION_EVENTS.ERROR,
          {
            error,

            context:
              "add-notification-browser-display"
          }
        );
      }
    );
  }


  return normalized;
}


/* =========================================================
   ADD MULTIPLE NOTIFICATIONS
========================================================= */

function addNotifications(
  notifications
) {
  if (
    !Array.isArray(
      notifications
    )
  ) {
    return [];
  }


  return notifications.map(
    notification =>
      addNotification(
        notification
      )
  );
}


/* =========================================================
   GET NOTIFICATIONS
========================================================= */

function getNotifications(
  {
    unreadOnly =
      false,

    type =
      null,

    limit =
      null
  } = {}
) {
  let result =
    [
      ...state.notifications
    ];


  if (
    unreadOnly
  ) {
    result =
      result.filter(
        notification =>
          !notification.read
      );
  }


  if (
    type
  ) {

    const normalizedType =
      normalizeType(
        type
      );


    result =
      result.filter(
        notification =>
          notification.type ===
          normalizedType
      );
  }


  if (
    Number.isFinite(
      Number(limit)
    ) &&
    Number(limit) >
      0
  ) {

    result =
      result.slice(
        0,
        Number(limit)
      );
  }


  return result;
}


/* =========================================================
   GET ONE NOTIFICATION
========================================================= */

function getNotification(
  id
) {
  return (
    state.notifications.find(
      notification =>
        notification.id ===
        String(id)
    ) ||
    null
  );
}


/* =========================================================
   MARK AS READ
========================================================= */

function markAsRead(
  id
) {
  const notification =
    getNotification(
      id
    );


  if (
    !notification
  ) {
    return false;
  }


  if (
    notification.read
  ) {
    return true;
  }


  notification.read =
    true;


  recalculateUnreadCount();


  emit(
    NOTIFICATION_EVENTS.READ,
    {
      notification,

      unreadCount:
        state.unreadCount
    }
  );


  return true;
}


/* =========================================================
   MARK AS UNREAD
========================================================= */

function markAsUnread(
  id
) {
  const notification =
    getNotification(
      id
    );


  if (
    !notification
  ) {
    return false;
  }


  if (
    !notification.read
  ) {
    return true;
  }


  notification.read =
    false;


  recalculateUnreadCount();


  return true;
}


/* =========================================================
   MARK ALL AS READ
========================================================= */

function markAllAsRead() {
  let changed =
    false;


  for (
    const notification of
      state.notifications
  ) {

    if (
      !notification.read
    ) {

      notification.read =
        true;

      changed =
        true;
    }
  }


  if (
    changed
  ) {

    recalculateUnreadCount();


    emit(
      NOTIFICATION_EVENTS.READ,
      {
        all:
          true,

        unreadCount:
          state.unreadCount
      }
    );
  }


  return changed;
}


/* =========================================================
   REMOVE NOTIFICATION
========================================================= */

function removeNotification(
  id
) {
  const index =
    state.notifications.findIndex(
      notification =>
        notification.id ===
        String(id)
    );


  if (
    index <
    0
  ) {
    return false;
  }


  state.notifications.splice(
    index,
    1
  );


  recalculateUnreadCount();


  return true;
}


/* =========================================================
   CLEAR NOTIFICATIONS
========================================================= */

function clearNotifications() {
  state.notifications =
    [];

  state.unreadCount =
    0;


  emit(
    NOTIFICATION_EVENTS.CLEARED,
    {
      unreadCount:
        0
    }
  );


  emit(
    NOTIFICATION_EVENTS.UNREAD_CHANGED,
    {
      count:
        0
    }
  );


  return true;
}


/* =========================================================
   HANDLE NOTIFICATION CLICK
========================================================= */

function handleNotificationClick(
  notification
) {
  const normalized =
    normalizeNotification(
      notification
    );


  emit(
    NOTIFICATION_EVENTS.CLICKED,
    {
      notification:
        normalized
    }
  );


  markAsRead(
    normalized.id
  );


  /*
   * Only allow same-origin internal links.
   *
   * This prevents notification data from
   * automatically navigating the user to
   * arbitrary external URLs.
   */

  if (
    normalized.link &&
    typeof window !==
      "undefined"
  ) {

    try {

      const url =
        new URL(
          normalized.link,
          window.location.origin
        );


      if (
        url.origin ===
        window.location.origin
      ) {

        window.location.assign(
          url.href
        );

      } else {

        /*
         * External destinations are deliberately
         * not opened automatically.
         */

        emit(
          NOTIFICATION_EVENTS.ERROR,
          {
            error:
              new Error(
                "External notification link blocked."
              ),

            context:
              "notification-click"
          }
        );
      }

    } catch (
      error
    ) {

      emit(
        NOTIFICATION_EVENTS.ERROR,
        {
          error,

          context:
            "notification-link"
        }
      );
    }
  }


  return normalized;
}


/* =========================================================
   FCM TOKEN
========================================================= */

/*
 * Firebase Messaging implementation is injected
 * instead of importing a specific Firebase version
 * here. This keeps this module independent from
 * Firebase SDK initialization.
 */

async function registerFcmToken(
  {
    messaging,
    getToken,
    vapidKey =
      null
  } = {}
) {
  if (
    typeof getToken !==
    "function"
  ) {

    const error =
      new Error(
        "FCM getToken implementation was not supplied."
      );


    emit(
      NOTIFICATION_EVENTS.TOKEN_ERROR,
      {
        error
      }
    );


    throw error;
  }


  try {

    const permission =
      await requestBrowserPermission();


    if (
      permission !==
      NOTIFICATION_PERMISSION.GRANTED
    ) {

      const error =
        new Error(
          "Browser notification permission was not granted."
        );


      emit(
        NOTIFICATION_EVENTS.TOKEN_ERROR,
        {
          error
        }
      );


      return null;
    }


    const options = {
      vapidKey:
        vapidKey ||
        undefined
    };


    /*
     * Firebase's getToken() can accept messaging
     * plus token options depending on the SDK.
     *
     * The caller supplies the actual implementation.
     */

    const token =
      await getToken(
        messaging,
        options
      );


    if (
      typeof token !==
        "string" ||
      !token.trim()
    ) {

      const error =
        new Error(
          "Firebase did not return a valid FCM token."
        );


      emit(
        NOTIFICATION_EVENTS.TOKEN_ERROR,
        {
          error
        }
      );


      return null;
    }


    state.fcmToken =
      token;


    emit(
      NOTIFICATION_EVENTS.TOKEN_RECEIVED,
      {
        token
      }
    );


    return token;

  } catch (
    error
  ) {

    emit(
      NOTIFICATION_EVENTS.TOKEN_ERROR,
      {
        error
      }
    );


    throw error;
  }
}


/* =========================================================
   SET FCM TOKEN
========================================================= */

function setFcmToken(
  token
) {
  if (
    typeof token !==
      "string" ||
    !token.trim()
  ) {

    state.fcmToken =
      null;

    return false;
  }


  state.fcmToken =
    token.trim();


  emit(
    NOTIFICATION_EVENTS.TOKEN_RECEIVED,
    {
      token:
        state.fcmToken
    }
  );


  return true;
}


/* =========================================================
   GET FCM TOKEN
========================================================= */

function getFcmToken() {
  return (
    state.fcmToken ||
    null
  );
}


/* =========================================================
   CONNECT FOREGROUND FCM
========================================================= */

/*
 * Caller supplies Firebase onMessage().
 *
 * Example integration:
 *
 * connectForegroundMessaging({
 *   onMessage: callback
 * });
 */

function connectForegroundMessaging(
  {
    onMessage =
      null
  } = {}
) {
  if (
    typeof onMessage !==
    "function"
  ) {

    throw new Error(
      "FCM onMessage implementation was not supplied."
    );
  }


  if (
    typeof state.unsubscribe ===
    "function"
  ) {
    state.unsubscribe();
  }


  const result =
    onMessage(
      payload => {

        const notificationPayload =
          payload?.notification ||
          {};


        const normalized =
          normalizeNotification({

            id:
              payload?.messageId ||
              payload?.data?.notificationId ||
              undefined,

            title:
              notificationPayload.title ||
              payload?.data?.title ||
              "SaveBite",

            body:
              notificationPayload.body ||
              payload?.data?.body ||
              "",

            type:
              payload?.data?.type ||
              NOTIFICATION_TYPES.SYSTEM,

            data:
              payload?.data ||
              {},

            imageUrl:
              notificationPayload.image ||
              payload?.data?.imageUrl ||
              null,

            link:
              payload?.data?.link ||
              null
          });


        addNotification(
          normalized,
          {
            showBrowser:
              false
          }
        );
      }
    );


  if (
    typeof result ===
    "function"
  ) {
    state.unsubscribe =
      result;
  }


  return state.unsubscribe;
}


/* =========================================================
   DISCONNECT FOREGROUND FCM
========================================================= */

function disconnectForegroundMessaging() {
  if (
    typeof state.unsubscribe ===
    "function"
  ) {
    state.unsubscribe();
  }


  state.unsubscribe =
    null;
}


/* =========================================================
   SET CURRENT USER
========================================================= */

function setCurrentUser(
  userId
) {
  state.currentUserId =
    userId ||
    null;
}


/* =========================================================
   GET CURRENT USER
========================================================= */

function getCurrentUserId() {
  return (
    state.currentUserId ||
    null
  );
}


/* =========================================================
   GET UNREAD COUNT
========================================================= */

function getUnreadCount() {
  return state.unreadCount;
}


/* =========================================================
   GET STATE
========================================================= */

function getState() {
  return {

    initialized:
      state.initialized,

    notifications:
      [
        ...state.notifications
      ],

    unreadCount:
      state.unreadCount,

    browserPermission:
      state.browserPermission,

    fcmToken:
      state.fcmToken,

    currentUserId:
      state.currentUserId
  };
}


/* =========================================================
   DESTROY
========================================================= */

function destroyNotifications() {
  disconnectForegroundMessaging();


  state.initialized =
    false;

  state.notifications =
    [];

  state.unreadCount =
    0;

  state.fcmToken =
    null;

  state.currentUserId =
    null;
}


/* =========================================================
   EXPORT
========================================================= */

export {

  NOTIFICATION_EVENTS,

  NOTIFICATION_TYPES,

  NOTIFICATION_PERMISSION,

  initializeNotifications,

  normalizeNotification,

  getBrowserPermission,

  requestBrowserPermission,

  showBrowserNotification,

  addNotification,

  addNotifications,

  getNotifications,

  getNotification,

  markAsRead,

  markAsUnread,

  markAllAsRead,

  removeNotification,

  clearNotifications,

  handleNotificationClick,

  registerFcmToken,

  setFcmToken,

  getFcmToken,

  connectForegroundMessaging,

  disconnectForegroundMessaging,

  setCurrentUser,

  getCurrentUserId,

  getUnreadCount,

  getState,

  destroyNotifications

};
