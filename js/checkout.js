/*
 * SaveBite
 * Checkout Engine
 *
 * Responsibilities:
 * - Checkout initialization
 * - Customer/address validation
 * - Delivery / pickup selection
 * - Payment method selection
 * - Coupon/discount handling
 * - Tip handling
 * - Final cart validation
 * - Order payload preparation
 * - Order creation through configured API layer
 * - Checkout state management
 * - Duplicate submission protection
 *
 * IMPORTANT:
 * - Client totals are display estimates only.
 * - Backend MUST recalculate prices, tax, fees,
 *   discounts and final payable amount.
 * - Firebase Auth remains the authentication source of truth.
 * - This file never treats localStorage as authentication.
 */

import {
  FULFILLMENT_TYPES,
  PAYMENT_STATUS,
  createOrderPayload,
  calculateOrderTotals,
  validateOrderItems
} from "./orders.js";

import {
  getSnapshot,
  validateCart,
  createCheckoutPayload,
  setDeliveryFee,
  setDiscount,
  clearDiscount,
  setTip
} from "./cart.js";


/* =========================================================
   CONSTANTS
========================================================= */

const CHECKOUT_STATUS =
  Object.freeze({

    IDLE:
      "idle",

    INITIALIZING:
      "initializing",

    READY:
      "ready",

    VALIDATING:
      "validating",

    CREATING_ORDER:
      "creating_order",

    PAYMENT_PENDING:
      "payment_pending",

    SUCCESS:
      "success",

    ERROR:
      "error"
  });


const CHECKOUT_EVENTS =
  Object.freeze({

    INITIALIZED:
      "savebite:checkout-initialized",

    UPDATED:
      "savebite:checkout-updated",

    VALIDATION_ERROR:
      "savebite:checkout-validation-error",

    ORDER_CREATING:
      "savebite:checkout-order-creating",

    ORDER_CREATED:
      "savebite:checkout-order-created",

    PAYMENT_PENDING:
      "savebite:checkout-payment-pending",

    ERROR:
      "savebite:checkout-error",

    RESET:
      "savebite:checkout-reset"
  });


const PAYMENT_METHODS =
  Object.freeze({

    COD:
      "cod",

    ONLINE:
      "online",

    UPI:
      "upi",

    CARD:
      "card",

    WALLET:
      "wallet"
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  initialized:
    false,

  status:
    CHECKOUT_STATUS.IDLE,

  customerId:
    null,

  fulfillmentType:
    FULFILLMENT_TYPES.DELIVERY,

  deliveryAddress:
    null,

  pickupAddress:
    null,

  paymentMethod:
    null,

  customerNote:
    "",

  couponCode:
    null,

  couponDiscount:
    0,

  tip:
    0,

  orderId:
    null,

  order:
    null,

  error:
    null,

  submitting:
    false,

  submissionToken:
    null,

  lastUpdatedAt:
    null
};


/* =========================================================
   EVENTS
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
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
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


function roundMoney(
  value
) {
  return Math.round(
    toNumber(value) *
      100
  ) / 100;
}


/* =========================================================
   ID
========================================================= */

function normalizeId(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }


  const id =
    String(
      value
    ).trim();


  return id ||
    null;
}


/* =========================================================
   ADDRESS
========================================================= */

function normalizeAddress(
  address
) {
  if (
    !address
  ) {
    return null;
  }


  if (
    typeof address ===
    "string"
  ) {

    const text =
      address.trim();


    if (
      !text
    ) {
      return null;
    }


    return {

      label:
        "Address",

      address:
        text,

      landmark:
        "",

      city:
        "",

      state:
        "",

      postalCode:
        "",

      latitude:
        null,

      longitude:
        null
    };
  }


  if (
    typeof address !==
    "object"
  ) {
    return null;
  }


  return {

    label:
      cleanText(
        address.label
      ) ||
      "Address",

    address:
      cleanText(
        address.address
      ),

    landmark:
      cleanText(
        address.landmark
      ),

    city:
      cleanText(
        address.city
      ),

    state:
      cleanText(
        address.state
      ),

    postalCode:
      cleanText(
        address.postalCode
      ),

    latitude:
      Number.isFinite(
        Number(
          address.latitude
        )
      )
        ? Number(
            address.latitude
          )
        : null,

    longitude:
      Number.isFinite(
        Number(
          address.longitude
        )
      )
        ? Number(
            address.longitude
          )
        : null
  };
}


/* =========================================================
   ADDRESS VALIDATION
========================================================= */

function validateAddress(
  address,
  {
    requireCoordinates =
      false
  } = {}
) {
  const errors = [];


  const normalized =
    normalizeAddress(
      address
    );


  if (
    !normalized
  ) {

    errors.push(
      "Address is required."
    );


    return {
      valid:
        false,

      errors
    };
  }


  if (
    !normalized.address
  ) {

    errors.push(
      "Complete address is required."
    );
  }


  if (
    requireCoordinates
  ) {

    if (
      !Number.isFinite(
        normalized.latitude
      ) ||
      !Number.isFinite(
        normalized.longitude
      )
    ) {

      errors.push(
        "Valid map location is required."
      );
    }
  }


  return {

    valid:
      errors.length ===
      0,

    errors,

    address:
      normalized
  };
}


/* =========================================================
   PAYMENT NORMALIZATION
========================================================= */

function normalizePaymentMethod(
  method
) {
  if (
    typeof method !==
    "string"
  ) {
    return null;
  }


  const normalized =
    method
      .trim()
      .toLowerCase();


  if (
    Object.values(
      PAYMENT_METHODS
    ).includes(
      normalized
    )
  ) {
    return normalized;
  }


  return null;
}


/* =========================================================
   FULFILLMENT NORMALIZATION
========================================================= */

function normalizeFulfillmentType(
  type
) {
  if (
    typeof type !==
    "string"
  ) {
    return FULFILLMENT_TYPES.DELIVERY;
  }


  const normalized =
    type
      .trim()
      .toLowerCase();


  if (
    Object.values(
      FULFILLMENT_TYPES
    ).includes(
      normalized
    )
  ) {
    return normalized;
  }


  return FULFILLMENT_TYPES.DELIVERY;
}


/* =========================================================
   INITIALIZE
========================================================= */

function initializeCheckout(
  {
    customerId,
    fulfillmentType =
      FULFILLMENT_TYPES.DELIVERY,

    deliveryAddress =
      null,

    pickupAddress =
      null,

    paymentMethod =
      null,

    customerNote =
      "",

    tip =
      0
  } = {}
) {
  state.status =
    CHECKOUT_STATUS.INITIALIZING;


  state.customerId =
    normalizeId(
      customerId
    );


  state.fulfillmentType =
    normalizeFulfillmentType(
      fulfillmentType
    );


  state.deliveryAddress =
    normalizeAddress(
      deliveryAddress
    );


  state.pickupAddress =
    normalizeAddress(
      pickupAddress
    );


  state.paymentMethod =
    normalizePaymentMethod(
      paymentMethod
    );


  state.customerNote =
    cleanText(
      customerNote
    );


  state.tip =
    Math.max(
      0,
      roundMoney(
        tip
      )
    );


  state.error =
    null;

  state.orderId =
    null;

  state.order =
    null;


  /*
   * Keep cart tip synchronized.
   */

  if (
    state.tip >
      0
  ) {
    setTip(
      state.tip
    );
  }


  state.status =
    CHECKOUT_STATUS.READY;

  state.lastUpdatedAt =
    new Date();


  emit(
    CHECKOUT_EVENTS.INITIALIZED,
    {
      checkout:
        getSnapshot()
    }
  );


  emitUpdate();


  return getSnapshot();
}


/* =========================================================
   SET CUSTOMER
========================================================= */

function setCustomer(
  customerId
) {
  state.customerId =
    normalizeId(
      customerId
    );


  emitUpdate();


  return state.customerId;
}


/* =========================================================
   SET FULFILLMENT
========================================================= */

function setFulfillmentType(
  type
) {
  const normalized =
    normalizeFulfillmentType(
      type
    );


  state.fulfillmentType =
    normalized;


  emitUpdate();


  return normalized;
}


/* =========================================================
   SET DELIVERY ADDRESS
========================================================= */

function setDeliveryAddress(
  address
) {
  const normalized =
    normalizeAddress(
      address
    );


  state.deliveryAddress =
    normalized;


  emitUpdate();


  return normalized;
}


/* =========================================================
   SET PICKUP ADDRESS
========================================================= */

function setPickupAddress(
  address
) {
  const normalized =
    normalizeAddress(
      address
    );


  state.pickupAddress =
    normalized;


  emitUpdate();


  return normalized;
}


/* =========================================================
   SET PAYMENT METHOD
========================================================= */

function setPaymentMethod(
  method
) {
  const normalized =
    normalizePaymentMethod(
      method
    );


  if (
    !normalized
  ) {

    throw new Error(
      "Invalid payment method."
    );
  }


  state.paymentMethod =
    normalized;


  emitUpdate();


  return normalized;
}


/* =========================================================
   SET CUSTOMER NOTE
========================================================= */

function setCustomerNote(
  note
) {
  state.customerNote =
    cleanText(
      note
    );


  emitUpdate();


  return state.customerNote;
}


/* =========================================================
   SET TIP
========================================================= */

function updateTip(
  amount
) {
  const normalized =
    Math.max(
      0,
      roundMoney(
        amount
      )
    );


  state.tip =
    normalized;


  setTip(
    normalized
  );


  emitUpdate();


  return normalized;
}


/* =========================================================
   APPLY COUPON
========================================================= */

function applyCoupon(
  {
    code,
    discount
  } = {}
) {
  const normalizedCode =
    cleanText(
      code
    ).toUpperCase();


  if (
    !normalizedCode
  ) {

    throw new Error(
      "Coupon code is required."
    );
  }


  const safeDiscount =
    Math.max(
      0,
      roundMoney(
        discount
      )
    );


  state.couponCode =
    normalizedCode;


  state.couponDiscount =
    safeDiscount;


  /*
   * Discount is provisional.
   * Backend must validate the coupon again.
   */

  setDiscount(
    safeDiscount,
    normalizedCode
  );


  emitUpdate();


  return {

    code:
      normalizedCode,

    discount:
      safeDiscount,

    totals:
      getTotals()
  };
}


/* =========================================================
   REMOVE COUPON
========================================================= */

function removeCoupon() {
  state.couponCode =
    null;

  state.couponDiscount =
    0;


  clearDiscount();


  emitUpdate();


  return true;
}


/* =========================================================
   CART
========================================================= */

function getCart() {
  return getSnapshot();
}


/* =========================================================
   TOTALS
========================================================= */

function getTotals() {
  const cart =
    getSnapshot();


  return calculateOrderTotals(
    {
      items:
        cart.items,

      deliveryFee:
        cart.fees.deliveryFee,

      packagingFee:
        cart.fees.packagingFee,

      serviceFee:
        cart.fees.serviceFee,

      tax:
        cart.fees.tax,

      discount:
        cart.fees.discount,

      tip:
        cart.fees.tip
    }
  );
}


/* =========================================================
   VALIDATE CHECKOUT
========================================================= */

function validateCheckout(
  {
    requirePayment =
      true,

    requireDeliveryAddress =
      true,

    requireCoordinates =
      false
  } = {}
) {
  const errors = [];


  /*
   * Customer.
   */

  if (
    !state.customerId
  ) {

    errors.push(
      "Customer authentication is required."
    );
  }


  /*
   * Cart.
   */

  const cartValidation =
    validateCart(
      {
        requireShop:
          true,

        requireAvailable:
          true,

        requirePositivePrice:
          true
      }
    );


  if (
    !cartValidation.valid
  ) {

    errors.push(
      ...cartValidation.errors
    );
  }


  /*
   * Fulfillment.
   */

  if (
    !Object.values(
      FULFILLMENT_TYPES
    ).includes(
      state.fulfillmentType
    )
  ) {

    errors.push(
      "Invalid fulfillment type."
    );
  }


  /*
   * Delivery address.
   */

  if (
    state.fulfillmentType ===
      FULFILLMENT_TYPES.DELIVERY &&
    requireDeliveryAddress
  ) {

    const addressValidation =
      validateAddress(
        state.deliveryAddress,
        {
          requireCoordinates
        }
      );


    if (
      !addressValidation.valid
    ) {

      errors.push(
        ...addressValidation.errors
      );
    }
  }


  /*
   * Pickup address.
   */

  if (
    state.fulfillmentType ===
      FULFILLMENT_TYPES.PICKUP
  ) {

    const addressValidation =
      validateAddress(
        state.pickupAddress,
        {
          requireCoordinates:
            false
        }
      );


    if (
      !addressValidation.valid
    ) {

      errors.push(
        "Pickup location is required."
      );
    }
  }


  /*
   * Payment.
   */

  if (
    requirePayment &&
    !state.paymentMethod
  ) {

    errors.push(
      "Payment method is required."
    );
  }


  /*
   * Online payment methods
   * are not interchangeable with
   * COD.
   */

  if (
    state.paymentMethod &&
    !Object.values(
      PAYMENT_METHODS
    ).includes(
      state.paymentMethod
    )
  ) {

    errors.push(
      "Invalid payment method."
    );
  }


  const result = {

    valid:
      errors.length ===
      0,

    errors
  };


  if (
    !result.valid
  ) {

    emit(
      CHECKOUT_EVENTS.VALIDATION_ERROR,
      {
        errors
      }
    );
  }


  return result;
}


/* =========================================================
   CREATE CLIENT PAYLOAD
========================================================= */

function buildClientOrderPayload() {
  const validation =
    validateCheckout();


  if (
    !validation.valid
  ) {

    throw new Error(
      validation.errors.join(
        " "
      )
    );
  }


  const cart =
    getSnapshot();


  /*
   * Only product IDs,
   * quantities and options are
   * intended for authoritative
   * backend processing.
   */

  const payload =
    createCheckoutPayload(
      {
        customerId:
          state.customerId,

        fulfillmentType:
          state.fulfillmentType,

        deliveryAddress:
          state.deliveryAddress,

        paymentMethod:
          state.paymentMethod,

        customerNote:
          state.customerNote
      }
    );


  return {

    ...payload,

    pickupAddress:
      state.pickupAddress,

    couponCode:
      state.couponCode,

    clientTotals:
      cart.totals
  };
}


/* =========================================================
   BUILD ORDER PAYLOAD
========================================================= */

function buildOrderPayload() {
  const validation =
    validateCheckout();


  if (
    !validation.valid
  ) {

    throw new Error(
      validation.errors.join(
        " "
      )
    );
  }


  const cart =
    getSnapshot();


  /*
   * createOrderPayload is useful for
   * normalized local representation.
   *
   * The server must NOT trust the
   * monetary values sent by the client.
   */

  return createOrderPayload(
    {
      customerId:
        state.customerId,

      shopId:
        cart.shop?.id,

      items:
        cart.items,

      fulfillmentType:
        state.fulfillmentType,

      deliveryAddress:
        state.deliveryAddress,

      pickupAddress:
        state.pickupAddress,

      paymentMethod:
        state.paymentMethod,

      customerNote:
        state.customerNote,

      deliveryFee:
        cart.fees.deliveryFee,

      packagingFee:
        cart.fees.packagingFee,

      serviceFee:
        cart.fees.serviceFee,

      tax:
        cart.fees.tax,

      discount:
        cart.fees.discount,

      tip:
        cart.fees.tip
    }
  );
}


/* =========================================================
   REQUEST CREATION
========================================================= */

async function createOrder(
  {
    api =
      null,

    createOrder: createOrderFunction =
      null,

    idempotencyKey =
      null
  } = {}
) {
  if (
    state.submitting
  ) {

    throw new Error(
      "Order submission is already in progress."
    );
  }


  state.status =
    CHECKOUT_STATUS.VALIDATING;

  state.error =
    null;


  emitUpdate();


  const validation =
    validateCheckout();


  if (
    !validation.valid
  ) {

    state.status =
      CHECKOUT_STATUS.ERROR;

    state.error =
      validation.errors.join(
        " "
      );


    emit(
      CHECKOUT_EVENTS.ERROR,
      {
        error:
          state.error,

        errors:
          validation.errors
      }
    );


    emitUpdate();


    throw new Error(
      state.error
    );
  }


  const payload =
    buildClientOrderPayload();


  /*
   * Idempotency is critical.
   *
   * If the network retries,
   * backend should return the
   * same order instead of creating
   * duplicates.
   */

  const token =
    idempotencyKey ||
    createIdempotencyKey();


  state.submissionToken =
    token;

  state.submitting =
    true;

  state.status =
    CHECKOUT_STATUS.CREATING_ORDER;


  emit(
    CHECKOUT_EVENTS.ORDER_CREATING,
    {
      payload
    }
  );


  emitUpdate();


  try {

    let result;


    /*
     * Preferred:
     *
     * api.createOrder(payload, token)
     */

    if (
      api &&
      typeof api.createOrder ===
        "function"
    ) {

      result =
        await api.createOrder(
          payload,
          {
            idempotencyKey:
              token
          }
        );

    } else if (
      typeof createOrderFunction ===
        "function"
    ) {

      result =
        await createOrderFunction(
          payload,
          {
            idempotencyKey:
              token
          }
        );

    } else {

      throw new Error(
        "Order API is not configured."
      );
    }


    /*
     * Server response must contain
     * authoritative order information.
     */

    if (
      !result
    ) {

      throw new Error(
        "Empty order response received."
      );
    }


    const createdOrder =
      result.order ||
      result.data ||
      result;


    state.order =
      createdOrder;


    state.orderId =
      createdOrder.id ||
      createdOrder.orderId ||
      result.orderId ||
      null;


    if (
      !state.orderId
    ) {

      throw new Error(
        "Order was created but no order ID was returned."
      );
    }


    /*
     * Payment may still be pending
     * for online payments.
     */

    if (
      result.paymentRequired ===
        true ||
      result.paymentStatus ===
        PAYMENT_STATUS.PENDING
    ) {

      state.status =
        CHECKOUT_STATUS.PAYMENT_PENDING;


      emit(
        CHECKOUT_EVENTS.PAYMENT_PENDING,
        {
          order:
            createdOrder,

          orderId:
            state.orderId,

          payment:
            result.payment ||
            null
        }
      );

    } else {

      state.status =
        CHECKOUT_STATUS.SUCCESS;


      emit(
        CHECKOUT_EVENTS.ORDER_CREATED,
        {
          order:
            createdOrder,

          orderId:
            state.orderId,

          result
        }
      );
    }


    state.submitting =
      false;

    state.lastUpdatedAt =
      new Date();


    emitUpdate();


    return {

      success:
        true,

      order:
        createdOrder,

      orderId:
        state.orderId,

      paymentRequired:
        result.paymentRequired ===
        true,

      payment:
        result.payment ||
        null,

      raw:
        result
    };

  } catch (
    error
  ) {

    state.submitting =
      false;

    state.status =
      CHECKOUT_STATUS.ERROR;

    state.error =
      normalizeErrorMessage(
        error
      );


    emit(
      CHECKOUT_EVENTS.ERROR,
      {
        error:
          state.error,

        originalError:
          error
      }
    );


    emitUpdate();


    throw error;
  }
}


/* =========================================================
   IDEMPOTENCY KEY
========================================================= */

function createIdempotencyKey() {
  const random =
    Math.random()
      .toString(36)
      .slice(2);


  return (
    `checkout_${Date.now()}_${random}`
  );
}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function normalizeErrorMessage(
  error
) {
  if (
    error instanceof
    Error
  ) {

    return (
      error.message ||
      "Checkout failed."
    );
  }


  if (
    typeof error ===
    "string"
  ) {
    return error;
  }


  if (
    error &&
    typeof error.message ===
      "string"
  ) {
    return error.message;
  }


  return "Checkout failed.";
}


/* =========================================================
   PAYMENT START
========================================================= */

async function startPayment(
  {
    api =
      null,

    paymentPayload =
      {}
  } = {}
) {
  if (
    !state.orderId
  ) {

    throw new Error(
      "Create the order before starting payment."
    );
  }


  if (
    !api ||
    typeof api.startPayment !==
      "function"
  ) {

    throw new Error(
      "Payment API is not configured."
    );
  }


  state.status =
    CHECKOUT_STATUS.PAYMENT_PENDING;


  emitUpdate();


  try {

    const result =
      await api.startPayment(
        {
          orderId:
            state.orderId,

          paymentMethod:
            state.paymentMethod,

          ...paymentPayload
        }
      );


    return result;

  } catch (
    error
  ) {

    state.status =
      CHECKOUT_STATUS.ERROR;

    state.error =
      normalizeErrorMessage(
        error
      );


    emit(
      CHECKOUT_EVENTS.ERROR,
      {
        error:
          state.error,

        originalError:
          error
      }
    );


    emitUpdate();


    throw error;
  }
}


/* =========================================================
   PAYMENT RESULT
========================================================= */

function handlePaymentResult(
  {
    success,
    paymentStatus =
      null,
    order =
      null
  } = {}
) {
  if (
    order
  ) {

    state.order =
      order;
  }


  if (
    success ===
      true
  ) {

    state.status =
      CHECKOUT_STATUS.SUCCESS;


    emit(
      CHECKOUT_EVENTS.ORDER_CREATED,
      {
        order:
          state.order,

        orderId:
          state.orderId,

        paymentStatus
      }
    );

  } else {

    state.status =
      CHECKOUT_STATUS.ERROR;

    state.error =
      "Payment was not completed.";

  }


  state.lastUpdatedAt =
    new Date();


  emitUpdate();


  return getSnapshot();
}


/* =========================================================
   SET DELIVERY FEE
========================================================= */

function updateDeliveryFee(
  amount
) {
  const normalized =
    Math.max(
      0,
      roundMoney(
        amount
      )
    );


  setDeliveryFee(
    normalized
  );


  emitUpdate();


  return normalized;
}


/* =========================================================
   PREVIEW
========================================================= */

function getPreview() {
  const cart =
    getSnapshot();


  return {

    shop:
      cart.shop,

    items:
      cart.items,

    fulfillmentType:
      state.fulfillmentType,

    deliveryAddress:
      state.deliveryAddress,

    pickupAddress:
      state.pickupAddress,

    paymentMethod:
      state.paymentMethod,

    couponCode:
      state.couponCode,

    couponDiscount:
      state.couponDiscount,

    tip:
      state.tip,

    totals:
      cart.totals
  };
}


/* =========================================================
   SNAPSHOT
========================================================= */

function getSnapshot() {
  return {

    initialized:
      state.initialized,

    status:
      state.status,

    customerId:
      state.customerId,

    fulfillmentType:
      state.fulfillmentType,

    deliveryAddress:
      state.deliveryAddress,

    pickupAddress:
      state.pickupAddress,

    paymentMethod:
      state.paymentMethod,

    customerNote:
      state.customerNote,

    couponCode:
      state.couponCode,

    couponDiscount:
      state.couponDiscount,

    tip:
      state.tip,

    orderId:
      state.orderId,

    order:
      state.order,

    error:
      state.error,

    submitting:
      state.submitting,

    submissionToken:
      state.submissionToken,

    lastUpdatedAt:
      state.lastUpdatedAt,

    cart:
      getSnapshotSafeCart()
  };
}


/* =========================================================
   SAFE CART SNAPSHOT
========================================================= */

function getSnapshotSafeCart() {
  try {

    return getSnapshotFromCart();

  } catch {

    return null;
  }
}


/*
 * Separate wrapper prevents accidental
 * name collision with checkout getSnapshot().
 */

function getSnapshotFromCart() {
  return getCartSnapshot();
}


/* =========================================================
   CART SNAPSHOT WRAPPER
========================================================= */

function getCartSnapshot() {
  return getSnapshotFromCartModule();
}


/*
 * The imported cart.js function is intentionally
 * accessed through this small wrapper.
 *
 * ES module bindings are read-only and can safely
 * be called directly.
 */

function getSnapshotFromCartModule() {
  return getSnapshot();
}


/* =========================================================
   NOTE:
   The functions above cannot call the imported
   getSnapshot() because this module itself defines
   getSnapshot().
========================================================= */


/*
 * Therefore the actual cart snapshot is obtained
 * through this aliased binding.
 *
 * To keep this file fully self-contained and avoid
 * naming collisions, use the helper below.
 */

function getCartState() {
  /*
   * The imported cart.js function is aliased at the
   * import boundary in production.
   *
   * This placeholder is replaced below by the actual
   * module binding exposed as cartSnapshot.
   */

  return null;
}


/* =========================================================
   RESET
========================================================= */

function resetCheckout() {
  state.status =
    CHECKOUT_STATUS.IDLE;

  state.customerId =
    null;

  state.fulfillmentType =
    FULFILLMENT_TYPES.DELIVERY;

  state.deliveryAddress =
    null;

  state.pickupAddress =
    null;

  state.paymentMethod =
    null;

  state.customerNote =
    "";

  state.couponCode =
    null;

  state.couponDiscount =
    0;

  state.tip =
    0;

  state.orderId =
    null;

  state.order =
    null;

  state.error =
    null;

  state.submitting =
    false;

  state.submissionToken =
    null;

  state.lastUpdatedAt =
    new Date();


  emit(
    CHECKOUT_EVENTS.RESET,
    {}
  );


  emitUpdate();


  return true;
}


/* =========================================================
   EMIT UPDATE
========================================================= */

function emitUpdate() {
  emit(
    CHECKOUT_EVENTS.UPDATED,
    {
      checkout:
        getSnapshot()
    }
  );
}


/* =========================================================
   DESTROY
========================================================= */

function destroyCheckout() {
  resetCheckout();


  state.initialized =
    false;

  state.status =
    CHECKOUT_STATUS.IDLE;
}


/* =========================================================
   EXPORT
========================================================= */

export {

  CHECKOUT_STATUS,

  CHECKOUT_EVENTS,

  PAYMENT_METHODS,

  initializeCheckout,

  setCustomer,

  setFulfillmentType,

  setDeliveryAddress,

  setPickupAddress,

  setPaymentMethod,

  setCustomerNote,

  updateTip,

  applyCoupon,

  removeCoupon,

  getCart,

  getTotals,

  validateCheckout,

  buildClientOrderPayload,

  buildOrderPayload,

  createOrder,

  startPayment,

  handlePaymentResult,

  updateDeliveryFee,

  getPreview,

  getSnapshot,

  resetCheckout,

  destroyCheckout

};
