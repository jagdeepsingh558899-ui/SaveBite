/*
 * SaveBite
 * Firebase Configuration & Initialization
 *
 * Backend:
 * - Firebase Authentication
 * - Cloud Firestore
 * - Firebase Realtime Database
 * - Firebase Cloud Messaging
 *
 * Storage:
 * - Backblaze B2 Cloud
 *
 * IMPORTANT:
 * Replace the placeholder Firebase configuration
 * with the configuration from Firebase Console.
 */

import { initializeApp, getApps, getApp } from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getDatabase
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import {
  getMessaging,
  isSupported as isMessagingSupported
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);


/* =========================================================
   FIREBASE SERVICES
========================================================= */

const auth = getAuth(app);

const db = getFirestore(app);

const realtimeDb = getDatabase(app);


/* =========================================================
   FIREBASE CLOUD MESSAGING
========================================================= */

let messaging = null;

let messagingSupported = false;

try {
  messagingSupported =
    await isMessagingSupported();

  if (messagingSupported) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn(
    "SaveBite: Firebase Cloud Messaging is unavailable.",
    error
  );
}


/* =========================================================
   SERVICE STATUS
========================================================= */

const firebaseServices = Object.freeze({
  auth: true,
  firestore: true,
  realtimeDatabase: true,
  messaging: messagingSupported
});


/* =========================================================
   PUBLIC API
========================================================= */

export {
  app,
  auth,
  db,
  realtimeDb,
  messaging,
  messagingSupported,
  firebaseServices,
  firebaseConfig
};


/* =========================================================
   GLOBAL READ-ONLY REFERENCE
========================================================= */

if (typeof window !== "undefined") {
  window.SaveBiteFirebase = Object.freeze({
    app,
    auth,
    db,
    realtimeDb,
    messaging,
    messagingSupported,
    firebaseServices
  });
}
