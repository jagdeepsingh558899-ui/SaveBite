/*
 * SaveBite
 * Backblaze B2 Storage Client
 *
 * IMPORTANT:
 * B2 secret credentials MUST NEVER be placed
 * in this frontend JavaScript file.
 *
 * Upload architecture:
 *
 * SaveBite Web/PWA
 *       ↓
 * Cloudflare Worker / Secure API
 *       ↓
 * Backblaze B2
 *
 * This module communicates only with the
 * secure upload API.
 */


/* =========================================================
   CONFIGURATION
========================================================= */

/*
 * This URL will point to the Cloudflare Worker
 * responsible for secure B2 operations.
 *
 * Example:
 *
 * https://storage-api.your-domain.com
 *
 * Do NOT put B2 application keys here.
 */

const B2_API_BASE_URL =
  String(
    globalThis.SAVEBITE_B2_API_URL || ""
  ).trim();


/* =========================================================
   CONFIG VALIDATION
========================================================= */

function ensureConfigured() {
  if (!B2_API_BASE_URL) {
    throw new Error(
      "SaveBite storage service is not configured yet."
    );
  }
}


/* =========================================================
   API URL
========================================================= */

function buildUrl(path) {
  ensureConfigured();

  const base =
    B2_API_BASE_URL.endsWith("/")
      ? B2_API_BASE_URL.slice(0, -1)
      : B2_API_BASE_URL;

  const cleanPath =
    String(path || "").startsWith("/")
      ? path
      : `/${path}`;

  return `${base}${cleanPath}`;
}


/* =========================================================
   API REQUEST
========================================================= */

async function request(
  path,
  {
    method = "GET",
    body = null,
    headers = {}
  } = {}
) {
  const response =
    await fetch(
      buildUrl(path),
      {
        method,

        headers: {
          Accept:
            "application/json",

          ...headers
        },

        ...(body !== null
          ? { body }
          : {})
      }
    );

  let data = null;

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      data =
        await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text =
        await response.text();

      data = text || null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Storage request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return data;
}


/* =========================================================
   FILE VALIDATION
========================================================= */

function validateFile(file) {
  if (!(file instanceof File)) {
    throw new TypeError(
      "A valid File object is required."
    );
  }

  if (file.size <= 0) {
    throw new Error(
      "The selected file is empty."
    );
  }

  return true;
}


/* =========================================================
   DEFAULT IMAGE LIMITS
========================================================= */

const IMAGE_LIMITS = Object.freeze({
  maxSize:
    10 * 1024 * 1024,

  allowedTypes: [
    "image/jpeg",
    "image/png",
    "image/webp"
  ]
});


/* =========================================================
   IMAGE VALIDATION
========================================================= */

function validateImage(
  file,
  {
    maxSize =
      IMAGE_LIMITS.maxSize,

    allowedTypes =
      IMAGE_LIMITS.allowedTypes
  } = {}
) {
  validateFile(file);

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    throw new Error(
      "Unsupported image format. Please use JPG, PNG or WebP."
    );
  }

  if (
    file.size > maxSize
  ) {
    throw new Error(
      "Image is too large."
    );
  }

  return true;
}


/* =========================================================
   UPLOAD IMAGE
========================================================= */

async function uploadImage(
  file,
  {
    folder = "uploads",
    userId = "",
    entityId = "",
    entityType = ""
  } = {}
) {
  validateImage(file);

  const formData =
    new FormData();

  formData.append(
    "file",
    file,
    file.name
  );

  formData.append(
    "folder",
    String(folder || "uploads")
  );

  if (userId) {
    formData.append(
      "userId",
      String(userId)
    );
  }

  if (entityId) {
    formData.append(
      "entityId",
      String(entityId)
    );
  }

  if (entityType) {
    formData.append(
      "entityType",
      String(entityType)
    );
  }

  return request(
    "/upload",
    {
      method: "POST",
      body: formData
    }
  );
}


/* =========================================================
   UPLOAD BUSINESS LOGO
========================================================= */

async function uploadBusinessLogo(
  file,
  {
    userId,
    businessId
  } = {}
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!businessId) {
    throw new Error(
      "Business ID is required."
    );
  }

  return uploadImage(
    file,
    {
      folder:
        "businesses/logos",

      userId,

      entityId:
        businessId,

      entityType:
        "business-logo"
    }
  );
}


/* =========================================================
   UPLOAD DEAL IMAGE
========================================================= */

async function uploadDealImage(
  file,
  {
    userId,
    businessId,
    dealId = ""
  } = {}
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!businessId) {
    throw new Error(
      "Business ID is required."
    );
  }

  return uploadImage(
    file,
    {
      folder:
        "businesses/deals",

      userId,

      entityId:
        dealId ||
        businessId,

      entityType:
        "deal-image"
    }
  );
}


/* =========================================================
   UPLOAD CUSTOMER PROFILE IMAGE
========================================================= */

async function uploadCustomerProfileImage(
  file,
  {
    userId
  } = {}
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  return uploadImage(
    file,
    {
      folder:
        "users/profile",

      userId,

      entityId:
        userId,

      entityType:
        "profile-image"
    }
  );
}


/* =========================================================
   DELETE FILE
========================================================= */

async function deleteFile(
  fileKey
) {
  const key =
    String(
      fileKey || ""
    ).trim();

  if (!key) {
    throw new Error(
      "B2 file key is required."
    );
  }

  return request(
    "/delete",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          key
        })
    }
  );
}


/* =========================================================
   GET SIGNED DOWNLOAD URL
========================================================= */

async function getDownloadUrl(
  fileKey
) {
  const key =
    String(
      fileKey || ""
    ).trim();

  if (!key) {
    throw new Error(
      "B2 file key is required."
    );
  }

  const encodedKey =
    encodeURIComponent(key);

  const result =
    await request(
      `/download-url?key=${encodedKey}`
    );

  if (
    !result ||
    !result.url
  ) {
    throw new Error(
      "Storage service did not return a download URL."
    );
  }

  return result.url;
}


/* =========================================================
   CHECK STORAGE SERVICE
========================================================= */

async function checkStorageHealth() {
  return request(
    "/health"
  );
}


/* =========================================================
   EXPORT
========================================================= */

export {
  B2_API_BASE_URL,

  uploadImage,

  uploadBusinessLogo,
  uploadDealImage,
  uploadCustomerProfileImage,

  deleteFile,
  getDownloadUrl,

  checkStorageHealth,

  validateFile,
  validateImage
};
