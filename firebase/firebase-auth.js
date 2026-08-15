/*
 * SaveBite
 * Firebase Authentication Engine
 *
 * Handles:
 * - Email/password registration
 * - Email/password login
 * - Logout
 * - Current user
 * - Auth state listener
 * - Customer / Business role handling
 *
 * Authentication source of truth:
 * Firebase Authentication
 *
 * localStorage/sessionStorage must NOT be used
 * as an authentication authority.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  auth,
  db
} from "./firebase-config.js";


/* =========================================================
   CONSTANTS
========================================================= */

const ROLES = Object.freeze({
  CUSTOMER: "customer",
  BUSINESS: "business",
  ADMIN: "admin"
});

const USERS_COLLECTION = "users";


/* =========================================================
   ROLE NORMALIZATION
========================================================= */

function normalizeRole(role) {
  if (!role) {
    return null;
  }

  const normalized = String(role)
    .trim()
    .toLowerCase();

  if (normalized === "customer") {
    return ROLES.CUSTOMER;
  }

  if (
    normalized === "business" ||
    normalized === "shop" ||
    normalized === "merchant" ||
    normalized === "store"
  ) {
    return ROLES.BUSINESS;
  }

  if (normalized === "admin") {
    return ROLES.ADMIN;
  }

  return null;
}


/* =========================================================
   AUTH ERROR NORMALIZATION
========================================================= */

function getAuthErrorMessage(error) {
  if (!error) {
    return "Something went wrong. Please try again.";
  }

  const code = error.code || "";

  const messages = {
    "auth/email-already-in-use":
      "This email address is already registered.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Password is too weak. Please use a stronger password.",

    "auth/user-not-found":
      "No account was found with these details.",

    "auth/wrong-password":
      "Incorrect email or password.",

    "auth/invalid-credential":
      "Incorrect email or password.",

    "auth/too-many-requests":
      "Too many attempts. Please wait and try again.",

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "auth/user-disabled":
      "This account has been disabled.",

    "auth/requires-recent-login":
      "Please log in again before performing this action."
  };

  return (
    messages[code] ||
    error.message ||
    "Authentication failed. Please try again."
  );
}


/* =========================================================
   INPUT VALIDATION
========================================================= */

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || "").trim()
  );
}


function validatePassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 6
  );
}


function validateRole(role) {
  return Boolean(normalizeRole(role));
}


/* =========================================================
   CREATE USER PROFILE
========================================================= */

async function createUserProfile({
  user,
  role,
  name = "",
  phone = "",
  businessName = "",
  category = ""
}) {
  if (!user || !user.uid) {
    throw new Error(
      "A valid authenticated Firebase user is required."
    );
  }

  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    throw new Error("A valid account role is required.");
  }

  const userRef = doc(
    db,
    USERS_COLLECTION,
    user.uid
  );

  const existingSnapshot = await getDoc(userRef);

  if (existingSnapshot.exists()) {
    return existingSnapshot.data();
  }

  const profile = {
    uid: user.uid,

    email: user.email || "",

    name: String(name || "").trim(),

    phone: String(phone || "").trim(),

    role: normalizedRole,

    businessName:
      normalizedRole === ROLES.BUSINESS
        ? String(businessName || "").trim()
        : "",

    category:
      normalizedRole === ROLES.BUSINESS
        ? String(category || "").trim()
        : "",

    photoURL: user.photoURL || "",

    isActive: true,

    isBlocked: false,

    emailVerified:
      Boolean(user.emailVerified),

    createdAt: serverTimestamp(),

    updatedAt: serverTimestamp()
  };

  await setDoc(
    userRef,
    profile
  );

  return profile;
}


/* =========================================================
   GET USER PROFILE
========================================================= */

async function getUserProfile(uid = null) {
  const targetUid =
    uid ||
    auth.currentUser?.uid;

  if (!targetUid) {
    return null;
  }

  const userRef = doc(
    db,
    USERS_COLLECTION,
    targetUid
  );

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}


/* =========================================================
   REGISTER
========================================================= */

async function register({
  email,
  password,
  role,
  name = "",
  phone = "",
  businessName = "",
  category = ""
}) {
  const cleanEmail =
    String(email || "").trim().toLowerCase();

  if (!validateEmail(cleanEmail)) {
    throw new Error(
      "Please enter a valid email address."
    );
  }

  if (!validatePassword(password)) {
    throw new Error(
      "Password must contain at least 6 characters."
    );
  }

  const normalizedRole =
    normalizeRole(role);

  if (!normalizedRole) {
    throw new Error(
      "Please select a valid account type."
    );
  }

  try {
    const credential =
      await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    const user = credential.user;

    const displayName =
      normalizedRole === ROLES.BUSINESS
        ? String(businessName || name || "").trim()
        : String(name || "").trim();

    if (displayName) {
      await updateProfile(user, {
        displayName
      });
    }

    const profile =
      await createUserProfile({
        user,
        role: normalizedRole,
        name,
        phone,
        businessName,
        category
      });

    return {
      success: true,
      user,
      profile
    };

  } catch (error) {
    throw new Error(
      getAuthErrorMessage(error)
    );
  }
}


/* =========================================================
   LOGIN
========================================================= */

async function login(email, password) {
  const cleanEmail =
    String(email || "").trim().toLowerCase();

  if (!validateEmail(cleanEmail)) {
    throw new Error(
      "Please enter a valid email address."
    );
  }

  if (!password) {
    throw new Error(
      "Please enter your password."
    );
  }

  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    const user = credential.user;

    const profile =
      await getUserProfile(user.uid);

    if (
      profile &&
      profile.isBlocked === true
    ) {
      await signOut(auth);

      throw new Error(
        "This account has been blocked."
      );
    }

    return {
      success: true,
      user,
      profile
    };

  } catch (error) {
    throw new Error(
      getAuthErrorMessage(error)
    );
  }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
  try {
    await signOut(auth);

    return {
      success: true
    };

  } catch (error) {
    throw new Error(
      getAuthErrorMessage(error)
    );
  }
}


/* =========================================================
   PASSWORD RESET
========================================================= */

async function resetPassword(email) {
  const cleanEmail =
    String(email || "").trim().toLowerCase();

  if (!validateEmail(cleanEmail)) {
    throw new Error(
      "Please enter a valid email address."
    );
  }

  try {
    await sendPasswordResetEmail(
      auth,
      cleanEmail
    );

    return {
      success: true
    };

  } catch (error) {
    throw new Error(
      getAuthErrorMessage(error)
    );
  }
}


/* =========================================================
   AUTH STATE
========================================================= */

function onAuthChange(callback) {
  if (typeof callback !== "function") {
    throw new TypeError(
      "onAuthChange requires a callback function."
    );
  }

  return onAuthStateChanged(
    auth,
    async user => {
      if (!user) {
        callback({
          user: null,
          profile: null
        });

        return;
      }

      try {
        const profile =
          await getUserProfile(user.uid);

        callback({
          user,
          profile
        });

      } catch (error) {
        console.error(
          "SaveBite profile loading error:",
          error
        );

        callback({
          user,
          profile: null,
          error
        });
      }
    }
  );
}


/* =========================================================
   CURRENT USER
========================================================= */

function getCurrentUser() {
  return auth.currentUser || null;
}


/* =========================================================
   REQUIRE AUTHENTICATION
========================================================= */

async function requireAuth() {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Authentication required."
    );
  }

  return user;
}


/* =========================================================
   REQUIRE ROLE
========================================================= */

async function requireRole(role) {
  const user =
    await requireAuth();

  const profile =
    await getUserProfile(user.uid);

  if (!profile) {
    throw new Error(
      "User profile not found."
    );
  }

  const expectedRole =
    normalizeRole(role);

  const actualRole =
    normalizeRole(profile.role);

  if (
    !expectedRole ||
    actualRole !== expectedRole
  ) {
    throw new Error(
      "You do not have permission to access this area."
    );
  }

  return {
    user,
    profile
  };
}


/* =========================================================
   UPDATE PROFILE
========================================================= */

async function updateUserProfile(updates = {}) {
  const user =
    await requireAuth();

  const allowedFields = [
    "name",
    "phone",
    "photoURL",
    "businessName",
    "category"
  ];

  const cleanUpdates = {};

  for (const field of allowedFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        field
      )
    ) {
      cleanUpdates[field] =
        String(updates[field] ?? "").trim();
    }
  }

  cleanUpdates.updatedAt =
    serverTimestamp();

  const userRef =
    doc(
      db,
      USERS_COLLECTION,
      user.uid
    );

  await updateDoc(
    userRef,
    cleanUpdates
  );

  const displayName =
    cleanUpdates.businessName ||
    cleanUpdates.name;

  if (displayName || cleanUpdates.photoURL) {
    await updateProfile(user, {
      ...(displayName
        ? { displayName }
        : {}),
      ...(cleanUpdates.photoURL
        ? { photoURL: cleanUpdates.photoURL }
        : {})
    });
  }

  return await getUserProfile(
    user.uid
  );
}


/* =========================================================
   DELETE ACCOUNT
========================================================= */

async function deleteAccount({
  email,
  password
} = {}) {
  const user =
    await requireAuth();

  if (!email || !password) {
    throw new Error(
      "Email and password are required to delete the account."
    );
  }

  const credential =
    EmailAuthProvider.credential(
      email,
      password
    );

  try {
    await reauthenticateWithCredential(
      user,
      credential
    );

    await deleteUser(user);

    return {
      success: true
    };

  } catch (error) {
    throw new Error(
      getAuthErrorMessage(error)
    );
  }
}


/* =========================================================
   EXPORT
========================================================= */

export {
  ROLES,

  auth,
  db,

  normalizeRole,
  validateEmail,
  validatePassword,
  validateRole,

  getAuthErrorMessage,

  register,
  login,
  logout,

  resetPassword,

  getCurrentUser,
  getUserProfile,

  onAuthChange,

  requireAuth,
  requireRole,

  createUserProfile,
  updateUserProfile,

  deleteAccount
};
