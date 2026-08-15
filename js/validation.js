/*
 * SaveBite
 * Central Validation Engine
 *
 * IMPORTANT:
 * - Client-side validation improves UX only.
 * - It is NOT a security boundary.
 * - Firestore/Realtime Database security rules and
 *   trusted backend logic must validate permissions/data.
 *
 * Never trust:
 * - price
 * - discount
 * - business role
 * - ownership
 * - user ID
 * - payment status
 * - admin status
 * - uploaded file metadata
 */


/* =========================================================
   CONSTANTS
========================================================= */

const VALIDATION_MESSAGES =
  Object.freeze({

    required:
      "This field is required.",

    email:
      "Please enter a valid email address.",

    phone:
      "Please enter a valid mobile number.",

    password:
      "Password does not meet the required criteria.",

    passwordMatch:
      "Passwords do not match.",

    name:
      "Please enter a valid name.",

    price:
      "Please enter a valid price.",

    discount:
      "Please enter a valid discount.",

    image:
      "Please select a valid image.",

    fileSize:
      "The selected file is too large.",

    coordinates:
      "Please enter valid location coordinates.",

    url:
      "Please enter a valid URL.",

    otp:
      "Please enter a valid OTP.",

    pin:
      "Please enter a valid PIN.",

    generic:
      "Please check this field."
  });


/* =========================================================
   RESULT HELPERS
========================================================= */

function valid(
  value = null
) {
  return {
    valid: true,
    value,
    message: ""
  };
}


function invalid(
  message
) {
  return {
    valid: false,
    value: null,
    message:
      message ||
      VALIDATION_MESSAGES.generic
  };
}


/* =========================================================
   STRING
========================================================= */

function validateRequired(
  value,
  message =
    VALIDATION_MESSAGES.required
) {
  if (
    value === null ||
    value === undefined
  ) {
    return invalid(
      message
    );
  }

  if (
    String(value)
      .trim()
      .length === 0
  ) {
    return invalid(
      message
    );
  }

  return valid(
    String(value).trim()
  );
}


function validateLength(
  value,
  {
    min = 0,
    max = Infinity,
    message = ""
  } = {}
) {
  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  const text =
    String(value).trim();

  if (
    text.length < min ||
    text.length > max
  ) {
    return invalid(
      message ||
        `Must be between ${min} and ${max} characters.`
    );
  }

  return valid(
    text
  );
}


/* =========================================================
   NAME
========================================================= */

function validateName(
  value,
  {
    min = 2,
    max = 80
  } = {}
) {
  const result =
    validateLength(
      value,
      {
        min,
        max,
        message:
          VALIDATION_MESSAGES.name
      }
    );

  if (!result.valid) {
    return result;
  }

  const name =
    result.value;

  /*
   * Supports Indian and international names
   * without restricting Unicode unnecessarily.
   */

  if (
    /[\u0000-\u001F\u007F]/.test(
      name
    )
  ) {
    return invalid(
      VALIDATION_MESSAGES.name
    );
  }

  return valid(
    name
  );
}


/* =========================================================
   EMAIL
========================================================= */

function validateEmail(
  value
) {
  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  const email =
    required.value
      .toLowerCase();

  /*
   * Deliberately practical rather than
   * overly restrictive email regex.
   */

  const pattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (
    !pattern.test(
      email
    )
  ) {
    return invalid(
      VALIDATION_MESSAGES.email
    );
  }

  if (
    email.length > 254
  ) {
    return invalid(
      VALIDATION_MESSAGES.email
    );
  }

  return valid(
    email
  );
}


/* =========================================================
   PHONE
========================================================= */

function normalizePhone(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /[\s()-]/g,
      ""
    );
}


function validateIndianPhone(
  value
) {
  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  const phone =
    normalizePhone(
      required.value
    );


  let normalized =
    phone;


  if (
    /^\d{10}$/.test(
      phone
    )
  ) {
    normalized =
      `+91${phone}`;
  }


  if (
    !/^\+91[6-9]\d{9}$/.test(
      normalized
    )
  ) {
    return invalid(
      VALIDATION_MESSAGES.phone
    );
  }


  return valid(
    normalized
  );
}


function validatePhone(
  value,
  {
    country =
      "IN"
  } = {}
) {
  if (
    country === "IN"
  ) {
    return validateIndianPhone(
      value
    );
  }

  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  const phone =
    normalizePhone(
      required.value
    );

  if (
    !/^\+?[1-9]\d{7,14}$/.test(
      phone
    )
  ) {
    return invalid(
      VALIDATION_MESSAGES.phone
    );
  }

  return valid(
    phone
  );
}


/* =========================================================
   PASSWORD
========================================================= */

function validatePassword(
  value,
  {
    min = 8,
    max = 128
  } = {}
) {
  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  const password =
    String(value);

  if (
    password.length < min ||
    password.length > max
  ) {
    return invalid(
      `Password must be between ${min} and ${max} characters.`
    );
  }

  /*
   * Do not force arbitrary complexity rules that
   * make legitimate passwords difficult.
   */

  if (
    /[\u0000-\u001F\u007F]/.test(
      password
    )
  ) {
    return invalid(
      VALIDATION_MESSAGES.password
    );
  }

  return valid(
    password
  );
}


function validatePasswordMatch(
  password,
  confirmPassword
) {
  if (
    String(password ?? "") !==
    String(confirmPassword ?? "")
  ) {
    return invalid(
      VALIDATION_MESSAGES.passwordMatch
    );
  }

  return valid(
    true
  );
}


/* =========================================================
   OTP
========================================================= */

function validateOtp(
  value,
  {
    length = 6
  } = {}
) {
  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  const otp =
    String(
      required.value
    ).replace(
      /\s/g,
      ""
    );

  const pattern =
    new RegExp(
      `^\\d{${length}}$`
    );

  if (
    !pattern.test(
      otp
    )
  ) {
    return invalid(
      VALIDATION_MESSAGES.otp
    );
  }

  return valid(
    otp
  );
}


/* =========================================================
   PIN
========================================================= */

function validatePin(
  value,
  {
    length = 4
  } = {}
) {
  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  const pin =
    String(
      required.value
    ).trim();

  const pattern =
    new RegExp(
      `^\\d{${length}}$`
    );

  if (
    !pattern.test(
      pin
    )
  ) {
    return invalid(
      VALIDATION_MESSAGES.pin
    );
  }

  return valid(
    pin
  );
}


/* =========================================================
   NUMBER
========================================================= */

function validateNumber(
  value,
  {
    min = -Infinity,
    max = Infinity,
    integer = false,
    message = VALIDATION_MESSAGES.generic
  } = {}
) {
  const required =
    validateRequired(
      value,
      message
    );

  if (!required.valid) {
    return required;
  }

  const number =
    Number(
      required.value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return invalid(
      message
    );
  }

  if (
    number < min ||
    number > max
  ) {
    return invalid(
      message
    );
  }

  if (
    integer &&
    !Number.isInteger(
      number
    )
  ) {
    return invalid(
      message
    );
  }

  return valid(
    number
  );
}


/* =========================================================
   PRICE
========================================================= */

function validatePrice(
  value,
  {
    min = 0,
    max = 10000000
  } = {}
) {
  const result =
    validateNumber(
      value,
      {
        min,
        max,
        message:
          VALIDATION_MESSAGES.price
      }
    );

  if (!result.valid) {
    return result;
  }

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      String(value).trim()
    )
  ) {
    return invalid(
      "Price can have a maximum of 2 decimal places."
    );
  }

  return valid(
    Number(
      result.value
    )
  );
}


/* =========================================================
   DISCOUNT
========================================================= */

function validateDiscount(
  value
) {
  return validateNumber(
    value,
    {
      min: 0,
      max: 100,
      message:
        VALIDATION_MESSAGES.discount
    }
  );
}


function validateDiscountedPrice(
  originalPrice,
  salePrice
) {
  const original =
    validatePrice(
      originalPrice
    );

  if (!original.valid) {
    return original;
  }

  const sale =
    validatePrice(
      salePrice
    );

  if (!sale.valid) {
    return sale;
  }

  if (
    sale.value >
    original.value
  ) {
    return invalid(
      "Sale price cannot be greater than the original price."
    );
  }

  return valid({
    originalPrice:
      original.value,

    salePrice:
      sale.value
  });
}


/* =========================================================
   COORDINATES
========================================================= */

function validateLatitude(
  value
) {
  return validateNumber(
    value,
    {
      min: -90,
      max: 90,
      message:
        VALIDATION_MESSAGES.coordinates
    }
  );
}


function validateLongitude(
  value
) {
  return validateNumber(
    value,
    {
      min: -180,
      max: 180,
      message:
        VALIDATION_MESSAGES.coordinates
    }
  );
}


function validateCoordinates(
  latitude,
  longitude
) {
  const lat =
    validateLatitude(
      latitude
    );

  if (!lat.valid) {
    return lat;
  }

  const lng =
    validateLongitude(
      longitude
    );

  if (!lng.valid) {
    return lng;
  }

  return valid({
    latitude:
      lat.value,

    longitude:
      lng.value
  });
}


/* =========================================================
   URL
========================================================= */

function validateUrl(
  value
) {
  const required =
    validateRequired(
      value
    );

  if (!required.valid) {
    return required;
  }

  try {
    const url =
      new URL(
        required.value
      );

    if (
      ![
        "http:",
        "https:"
      ].includes(
        url.protocol
      )
    ) {
      return invalid(
        VALIDATION_MESSAGES.url
      );
    }

    return valid(
      url.toString()
    );

  } catch {
    return invalid(
      VALIDATION_MESSAGES.url
    );
  }
}


/* =========================================================
   BUSINESS NAME
========================================================= */

function validateBusinessName(
  value
) {
  return validateLength(
    value,
    {
      min: 2,
      max: 120,

      message:
        "Please enter a valid business name."
    }
  );
}


/* =========================================================
   ADDRESS
========================================================= */

function validateAddress(
  value
) {
  return validateLength(
    value,
    {
      min: 5,
      max: 300,

      message:
        "Please enter a valid address."
    }
  );
}


/* =========================================================
   CATEGORY
========================================================= */

function validateCategory(
  value
) {
  return validateLength(
    value,
    {
      min: 2,
      max: 60,

      message:
        "Please select a valid category."
    }
  );
}


/* =========================================================
   DESCRIPTION
========================================================= */

function validateDescription(
  value,
  {
    required = false,
    max = 2000
  } = {}
) {
  if (
    !required &&
    (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    )
  ) {
    return valid(
      ""
    );
  }

  return validateLength(
    value,
    {
      min:
        required
          ? 1
          : 0,

      max,

      message:
        `Description must be ${required ? "provided and " : ""}no more than ${max} characters.`
    }
  );
}


/* =========================================================
   FILE
========================================================= */

function validateFile(
  file,
  {
    required = true,

    allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ],

    maxSizeBytes =
      5 * 1024 * 1024
  } = {}
) {
  if (
    !file
  ) {
    return required
      ? invalid(
          VALIDATION_MESSAGES.image
        )
      : valid(
          null
        );
  }

  if (
    !(file instanceof File)
  ) {
    return invalid(
      VALIDATION_MESSAGES.image
    );
  }

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    return invalid(
      `Allowed file types: ${allowedTypes.join(", ")}.`
    );
  }

  if (
    file.size >
    maxSizeBytes
  ) {
    return invalid(
      `${VALIDATION_MESSAGES.fileSize} Maximum allowed size is ${formatBytes(maxSizeBytes)}.`
    );
  }

  return valid(
    file
  );
}


function formatBytes(
  bytes
) {
  if (
    bytes < 1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}


/* =========================================================
   IMAGE
========================================================= */

function validateImage(
  file,
  options = {}
) {
  return validateFile(
    file,
    {
      ...options,

      allowedTypes:
        options.allowedTypes ||
        [
          "image/jpeg",
          "image/png",
          "image/webp"
        ]
    }
  );
}


/* =========================================================
   BUSINESS DEAL
========================================================= */

function validateDeal({
  title,
  description,
  originalPrice,
  salePrice,
  category,
  expiresAt
} = {}) {

  const titleResult =
    validateLength(
      title,
      {
        min: 2,
        max: 150,

        message:
          "Deal title must be between 2 and 150 characters."
      }
    );

  if (!titleResult.valid) {
    return titleResult;
  }


  const descriptionResult =
    validateDescription(
      description,
      {
        required:
          true,

        max:
          2000
      }
    );

  if (
    !descriptionResult.valid
  ) {
    return descriptionResult;
  }


  const categoryResult =
    validateCategory(
      category
    );

  if (
    !categoryResult.valid
  ) {
    return categoryResult;
  }


  const priceResult =
    validateDiscountedPrice(
      originalPrice,
      salePrice
    );

  if (
    !priceResult.valid
  ) {
    return priceResult;
  }


  if (
    expiresAt !==
      undefined &&
    expiresAt !==
      null &&
    expiresAt !==
      ""
  ) {
    const expiry =
      new Date(
        expiresAt
      );

    if (
      Number.isNaN(
        expiry.getTime()
      )
    ) {
      return invalid(
        "Please enter a valid expiry date."
      );
    }

    if (
      expiry.getTime() <=
      Date.now()
    ) {
      return invalid(
        "Deal expiry must be in the future."
      );
    }
  }


  return valid({
    title:
      titleResult.value,

    description:
      descriptionResult.value,

    category:
      categoryResult.value,

    originalPrice:
      priceResult.value
        .originalPrice,

    salePrice:
      priceResult.value
        .salePrice,

    expiresAt:
      expiresAt || null
  });
}


/* =========================================================
   FIELD VALIDATION
========================================================= */

function validateField(
  value,
  rules = {}
) {
  if (
    typeof rules !==
    "object"
  ) {
    return valid(
      value
    );
  }


  if (
    rules.required
  ) {
    const result =
      validateRequired(
        value,
        rules.requiredMessage
      );

    if (!result.valid) {
      return result;
    }
  }


  switch (
    rules.type
  ) {

    case "email":
      return validateEmail(
        value
      );

    case "phone":
      return validatePhone(
        value
      );

    case "name":
      return validateName(
        value
      );

    case "password":
      return validatePassword(
        value,
        rules
      );

    case "otp":
      return validateOtp(
        value,
        rules
      );

    case "pin":
      return validatePin(
        value,
        rules
      );

    case "price":
      return validatePrice(
        value,
        rules
      );

    case "discount":
      return validateDiscount(
        value
      );

    case "url":
      return validateUrl(
        value
      );

    case "number":
      return validateNumber(
        value,
        rules
      );

    case "latitude":
      return validateLatitude(
        value
      );

    case "longitude":
      return validateLongitude(
        value
      );

    case "businessName":
      return validateBusinessName(
        value
      );

    case "address":
      return validateAddress(
        value
      );

    case "category":
      return validateCategory(
        value
      );

    case "description":
      return validateDescription(
        value,
        rules
      );

    default:
      break;
  }


  if (
    rules.min !==
      undefined ||
    rules.max !==
      undefined
  ) {
    return validateLength(
      value,
      {
        min:
          rules.min ??
          0,

        max:
          rules.max ??
          Infinity,

        message:
          rules.message
      }
    );
  }


  return valid(
    value
  );
}


/* =========================================================
   FORM VALIDATION
========================================================= */

function validateForm(
  form,
  schema
) {
  if (
    !(form instanceof
      HTMLFormElement)
  ) {
    throw new TypeError(
      "A valid HTML form is required."
    );
  }

  if (
    !schema ||
    typeof schema !==
      "object"
  ) {
    throw new TypeError(
      "Validation schema is required."
    );
  }


  const formData =
    new FormData(
      form
    );

  const values =
    {};

  const errors =
    {};


  for (
    const [
      field,
      rules
    ] of Object.entries(
      schema
    )
  ) {

    const value =
      formData.get(
        field
      );

    values[
      field
    ] = value;


    const result =
      validateField(
        value,
        rules
      );


    if (
      !result.valid
    ) {
      errors[
        field
      ] =
        result.message;
    }
  }


  return {
    valid:
      Object.keys(
        errors
      ).length === 0,

    values,

    errors
  };
}


/* =========================================================
   DISPLAY FORM ERRORS
========================================================= */

function clearFieldErrors(
  form
) {
  if (!form) {
    return;
  }

  form
    .querySelectorAll(
      "[data-validation-error]"
    )
    .forEach(
      element => {
        element.textContent =
          "";

        element.hidden =
          true;
      }
    );


  form
    .querySelectorAll(
      "[aria-invalid='true']"
    )
    .forEach(
      field => {
        field.removeAttribute(
          "aria-invalid"
        );
      }
    );
}


function displayFieldErrors(
  form,
  errors
) {
  if (
    !form ||
    !errors
  ) {
    return;
  }


  Object.entries(
    errors
  ).forEach(
    ([
      fieldName,
      message
    ]) => {

      const field =
        form.elements[
          fieldName
        ];

      if (!field) {
        return;
      }

      field.setAttribute(
        "aria-invalid",
        "true"
      );


      const errorElement =
        form.querySelector(
          `[data-validation-error="${CSS.escape(fieldName)}"]`
        );


      if (errorElement) {
        errorElement.textContent =
          message;

        errorElement.hidden =
          false;
      }
    }
  );
}


/* =========================================================
   EXPORT
========================================================= */

export {

  VALIDATION_MESSAGES,

  valid,
  invalid,

  validateRequired,
  validateLength,

  validateName,

  validateEmail,

  normalizePhone,
  validatePhone,
  validateIndianPhone,

  validatePassword,
  validatePasswordMatch,

  validateOtp,
  validatePin,

  validateNumber,
  validatePrice,
  validateDiscount,
  validateDiscountedPrice,

  validateLatitude,
  validateLongitude,
  validateCoordinates,

  validateUrl,

  validateBusinessName,
  validateAddress,
  validateCategory,
  validateDescription,

  validateFile,
  validateImage,

  validateDeal,

  validateField,
  validateForm,

  clearFieldErrors,
  displayFieldErrors

};
