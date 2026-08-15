/*
 * SaveBite
 * Firestore Data Layer
 *
 * Firebase Firestore is the source of truth for application data.
 *
 * Handles:
 * - Users
 * - Businesses
 * - Deals
 * - Orders
 * - Favorites
 * - Notifications
 *
 * File/image storage is NOT handled here.
 * SaveBite uses Backblaze B2 for file storage.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  db
} from "./firebase-config.js";


/* =========================================================
   COLLECTIONS
========================================================= */

const COLLECTIONS = Object.freeze({
  USERS: "users",
  BUSINESSES: "businesses",
  DEALS: "deals",
  ORDERS: "orders",
  FAVORITES: "favorites",
  NOTIFICATIONS: "notifications"
});


/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}


function cleanObject(object = {}) {
  const result = {};

  Object.entries(object).forEach(
    ([key, value]) => {
      if (value !== undefined) {
        result[key] = value;
      }
    }
  );

  return result;
}


function getCollection(name) {
  if (!COLLECTIONS[name]) {
    throw new Error(
      `Unknown Firestore collection: ${name}`
    );
  }

  return collection(
    db,
    COLLECTIONS[name]
  );
}


/* =========================================================
   GENERIC DOCUMENT HELPERS
========================================================= */

async function getDocument(
  collectionName,
  documentId
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  const reference = doc(
    db,
    COLLECTIONS[collectionName],
    documentId
  );

  const snapshot =
    await getDoc(reference);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}


async function createDocument(
  collectionName,
  data
) {
  const reference =
    await addDoc(
      getCollection(collectionName),
      cleanObject({
        ...data,
        createdAt:
          data.createdAt || serverTimestamp(),
        updatedAt:
          serverTimestamp()
      })
    );

  return reference.id;
}


async function setDocument(
  collectionName,
  documentId,
  data,
  merge = true
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  const reference = doc(
    db,
    COLLECTIONS[collectionName],
    documentId
  );

  await setDoc(
    reference,
    cleanObject({
      ...data,
      updatedAt:
        serverTimestamp()
    }),
    { merge }
  );

  return documentId;
}


async function updateDocument(
  collectionName,
  documentId,
  data
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  const reference = doc(
    db,
    COLLECTIONS[collectionName],
    documentId
  );

  await updateDoc(
    reference,
    cleanObject({
      ...data,
      updatedAt:
        serverTimestamp()
    })
  );

  return documentId;
}


async function removeDocument(
  collectionName,
  documentId
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  const reference = doc(
    db,
    COLLECTIONS[collectionName],
    documentId
  );

  await deleteDoc(reference);

  return true;
}


/* =========================================================
   USER
========================================================= */

async function getUser(uid) {
  return getDocument(
    "USERS",
    uid
  );
}


async function saveUser(
  uid,
  data
) {
  return setDocument(
    "USERS",
    uid,
    data,
    true
  );
}


/* =========================================================
   BUSINESS
========================================================= */

async function getBusiness(
  businessId
) {
  return getDocument(
    "BUSINESSES",
    businessId
  );
}


async function createBusiness(
  businessId,
  data
) {
  const payload = {
    ...data,

    ownerId:
      cleanString(
        data.ownerId
      ),

    name:
      cleanString(
        data.name
      ),

    category:
      cleanString(
        data.category
      ),

    description:
      cleanString(
        data.description
      ),

    phone:
      cleanString(
        data.phone
      ),

    address:
      cleanString(
        data.address
      ),

    city:
      cleanString(
        data.city
      ),

    status:
      data.status || "pending",

    isActive:
      data.isActive !== false
  };

  return setDocument(
    "BUSINESSES",
    businessId,
    payload,
    false
  );
}


async function updateBusiness(
  businessId,
  updates
) {
  return updateDocument(
    "BUSINESSES",
    businessId,
    updates
  );
}


async function getBusinessesByOwner(
  ownerId
) {
  if (!ownerId) {
    throw new Error(
      "Owner ID is required."
    );
  }

  const q = query(
    getCollection("BUSINESSES"),
    where(
      "ownerId",
      "==",
      ownerId
    ),
    orderBy(
      "createdAt",
      "desc"
    )
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


async function getActiveBusinesses(
  city = "",
  category = "",
  maxResults = 50
) {
  const conditions = [
    where(
      "isActive",
      "==",
      true
    ),
    where(
      "status",
      "==",
      "approved"
    )
  ];

  if (city) {
    conditions.push(
      where(
        "city",
        "==",
        cleanString(city)
      )
    );
  }

  if (category) {
    conditions.push(
      where(
        "category",
        "==",
        cleanString(category)
      )
    );
  }

  const q = query(
    getCollection("BUSINESSES"),
    ...conditions,
    limit(maxResults)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


/* =========================================================
   DEALS
========================================================= */

async function getDeal(
  dealId
) {
  return getDocument(
    "DEALS",
    dealId
  );
}


async function createDeal(
  data
) {
  const businessId =
    cleanString(
      data.businessId
    );

  if (!businessId) {
    throw new Error(
      "Business ID is required."
    );
  }

  const payload = {
    ...data,

    businessId,

    title:
      cleanString(
        data.title
      ),

    description:
      cleanString(
        data.description
      ),

    category:
      cleanString(
        data.category
      ),

    originalPrice:
      Number(
        data.originalPrice || 0
      ),

    salePrice:
      Number(
        data.salePrice || 0
      ),

    quantity:
      Math.max(
        0,
        Number(
          data.quantity || 0
        )
      ),

    soldQuantity:
      0,

    status:
      data.status || "draft",

    isActive:
      data.isActive === true,

    expiresAt:
      data.expiresAt || null
  };

  return createDocument(
    "DEALS",
    payload
  );
}


async function updateDeal(
  dealId,
  updates
) {
  return updateDocument(
    "DEALS",
    dealId,
    updates
  );
}


async function deleteDeal(
  dealId
) {
  return removeDocument(
    "DEALS",
    dealId
  );
}


async function getBusinessDeals(
  businessId,
  maxResults = 50
) {
  if (!businessId) {
    throw new Error(
      "Business ID is required."
    );
  }

  const q = query(
    getCollection("DEALS"),
    where(
      "businessId",
      "==",
      businessId
    ),
    orderBy(
      "createdAt",
      "desc"
    ),
    limit(maxResults)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


async function getActiveDeals(
  {
    city = "",
    category = "",
    businessId = "",
    maxResults = 50
  } = {}
) {
  const conditions = [
    where(
      "isActive",
      "==",
      true
    ),
    where(
      "status",
      "==",
      "published"
    )
  ];

  if (city) {
    conditions.push(
      where(
        "city",
        "==",
        cleanString(city)
      )
    );
  }

  if (category) {
    conditions.push(
      where(
        "category",
        "==",
        cleanString(category)
      )
    );
  }

  if (businessId) {
    conditions.push(
      where(
        "businessId",
        "==",
        businessId
      )
    );
  }

  const q = query(
    getCollection("DEALS"),
    ...conditions,
    limit(maxResults)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


async function markDealSold(
  dealId,
  quantity = 1
) {
  if (!dealId) {
    throw new Error(
      "Deal ID is required."
    );
  }

  const reference = doc(
    db,
    COLLECTIONS.DEALS,
    dealId
  );

  await updateDoc(
    reference,
    {
      soldQuantity:
        increment(
          Math.max(
            1,
            Number(quantity)
          )
        ),

      updatedAt:
        serverTimestamp()
    }
  );

  return true;
}


/* =========================================================
   FAVORITES
========================================================= */

function favoriteDocumentId(
  userId,
  dealId
) {
  return `${userId}_${dealId}`;
}


async function addFavorite(
  userId,
  dealId
) {
  if (!userId || !dealId) {
    throw new Error(
      "User ID and deal ID are required."
    );
  }

  const favoriteId =
    favoriteDocumentId(
      userId,
      dealId
    );

  return setDocument(
    "FAVORITES",
    favoriteId,
    {
      userId,
      dealId
    },
    true
  );
}


async function removeFavorite(
  userId,
  dealId
) {
  if (!userId || !dealId) {
    throw new Error(
      "User ID and deal ID are required."
    );
  }

  return removeDocument(
    "FAVORITES",
    favoriteDocumentId(
      userId,
      dealId
    )
  );
}


async function isFavorite(
  userId,
  dealId
) {
  if (!userId || !dealId) {
    return false;
  }

  const reference = doc(
    db,
    COLLECTIONS.FAVORITES,
    favoriteDocumentId(
      userId,
      dealId
    )
  );

  const snapshot =
    await getDoc(reference);

  return snapshot.exists();
}


async function getUserFavorites(
  userId,
  maxResults = 100
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const q = query(
    getCollection("FAVORITES"),
    where(
      "userId",
      "==",
      userId
    ),
    limit(maxResults)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


/* =========================================================
   ORDERS
========================================================= */

async function getOrder(
  orderId
) {
  return getDocument(
    "ORDERS",
    orderId
  );
}


async function createOrder(
  data
) {
  if (!data.customerId) {
    throw new Error(
      "Customer ID is required."
    );
  }

  if (!data.businessId) {
    throw new Error(
      "Business ID is required."
    );
  }

  if (!data.dealId) {
    throw new Error(
      "Deal ID is required."
    );
  }

  const quantity =
    Math.max(
      1,
      Number(
        data.quantity || 1
      )
    );

  const payload = {
    ...data,

    customerId:
      cleanString(
        data.customerId
      ),

    businessId:
      cleanString(
        data.businessId
      ),

    dealId:
      cleanString(
        data.dealId
      ),

    quantity,

    totalAmount:
      Number(
        data.totalAmount || 0
      ),

    status:
      data.status || "pending",

    paymentStatus:
      data.paymentStatus || "pending",

    pickupStatus:
      data.pickupStatus || "pending",

    cancelledAt:
      null,

    completedAt:
      null
  };

  return createDocument(
    "ORDERS",
    payload
  );
}


async function updateOrder(
  orderId,
  updates
) {
  return updateDocument(
    "ORDERS",
    orderId,
    updates
  );
}


async function getCustomerOrders(
  customerId,
  maxResults = 50
) {
  if (!customerId) {
    throw new Error(
      "Customer ID is required."
    );
  }

  const q = query(
    getCollection("ORDERS"),
    where(
      "customerId",
      "==",
      customerId
    ),
    orderBy(
      "createdAt",
      "desc"
    ),
    limit(maxResults)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


async function getBusinessOrders(
  businessId,
  maxResults = 100
) {
  if (!businessId) {
    throw new Error(
      "Business ID is required."
    );
  }

  const q = query(
    getCollection("ORDERS"),
    where(
      "businessId",
      "==",
      businessId
    ),
    orderBy(
      "createdAt",
      "desc"
    ),
    limit(maxResults)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function createNotification(
  userId,
  data
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  return createDocument(
    "NOTIFICATIONS",
    {
      ...data,

      userId,

      title:
        cleanString(
          data.title
        ),

      body:
        cleanString(
          data.body
        ),

      type:
        cleanString(
          data.type
        ) || "general",

      read: false
    }
  );
}


async function markNotificationRead(
  notificationId
) {
  return updateDocument(
    "NOTIFICATIONS",
    notificationId,
    {
      read: true,
      readAt: serverTimestamp()
    }
  );
}


async function getUserNotifications(
  userId,
  maxResults = 50
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const q = query(
    getCollection("NOTIFICATIONS"),
    where(
      "userId",
      "==",
      userId
    ),
    orderBy(
      "createdAt",
      "desc"
    ),
    limit(maxResults)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...item.data()
    })
  );
}


/* =========================================================
   BATCH OPERATIONS
========================================================= */

async function batchWrite(
  operations = []
) {
  if (!Array.isArray(operations)) {
    throw new Error(
      "Operations must be an array."
    );
  }

  const batch = writeBatch(db);

  operations.forEach(
    operation => {
      if (
        !operation ||
        !operation.collection ||
        !operation.id ||
        !operation.data
      ) {
        throw new Error(
          "Invalid batch operation."
        );
      }

      const collectionName =
        COLLECTIONS[
          operation.collection
        ];

      if (!collectionName) {
        throw new Error(
          `Invalid collection: ${operation.collection}`
        );
      }

      const reference = doc(
        db,
        collectionName,
        operation.id
      );

      if (
        operation.type === "delete"
      ) {
        batch.delete(reference);
        return;
      }

      if (
        operation.type === "update"
      ) {
        batch.update(
          reference,
          cleanObject({
            ...operation.data,
            updatedAt:
              serverTimestamp()
          })
        );

        return;
      }

      batch.set(
        reference,
        cleanObject({
          ...operation.data,
          updatedAt:
            serverTimestamp()
        }),
        {
          merge:
            operation.merge !== false
        }
      );
    }
  );

  await batch.commit();

  return true;
}


/* =========================================================
   EXPORT
========================================================= */

export {
  COLLECTIONS,

  getDocument,
  createDocument,
  setDocument,
  updateDocument,
  removeDocument,

  getUser,
  saveUser,

  getBusiness,
  createBusiness,
  updateBusiness,
  getBusinessesByOwner,
  getActiveBusinesses,

  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  getBusinessDeals,
  getActiveDeals,
  markDealSold,

  addFavorite,
  removeFavorite,
  isFavorite,
  getUserFavorites,

  getOrder,
  createOrder,
  updateOrder,
  getCustomerOrders,
  getBusinessOrders,

  createNotification,
  markNotificationRead,
  getUserNotifications,

  batchWrite
};
