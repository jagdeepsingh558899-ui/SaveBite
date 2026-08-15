/*
 * SaveBite
 * Order Engine
 *
 * Responsibilities:
 * - Order data normalization
 * - Cart/order payload preparation
 * - Order status management
 * - Customer order operations
 * - Shop order operations
 * - Order cancellation validation
 * - Status transition validation
 * - Order totals calculation
 * - Delivery/pickup state helpers
 *
 * IMPORTANT:
 * - Firebase Auth is the authentication source of truth.
 * - This module does NOT authenticate users.
 * - This module does NOT trust localStorage for ownership.
 * - Final authorization must happen server-side / Firestore Rules.
 * - Prices received from clients must be validated again server-side.
 */


/* =========================================================
   ORDER STATUS
========================================================= */

const ORDER_STATUS =
  Object.freeze({

    CREATED:
      "created",

    PENDING:
      "pending",

    ACCEPTED:
      "accepted",

    REJECTED:
      "rejected",

    PREPARING:
      "preparing",

    READY:
      "ready",

    PICKED_UP:
      "picked_up",

    OUT_FOR_DELIVERY:
      "out_for_delivery",

    DELIVERED:
      "delivered",

    COMPLETED:
      "completed",

    CANCELLED:
      "cancelled",

    FAILED:
      "failed"
  });


/* =========================================================
   FULFILLMENT TYPES
========================================================= */

const FULFILLMENT_TYPES =
  Object.freeze({

    DELIVERY:
      "delivery",

    PICKUP:
      "pickup"
  });


/* =========================================================
   PAYMENT STATUS
========================================================= */

const PAYMENT_STATUS =
  Object.freeze({

    PENDING:
      "pending",

    AUTHORIZED:
      "authorized",

    PAID:
      "paid",

    FAILED:
      "failed",

    REFUNDED:
      "refunded",

    PARTIALLY_REFUNDED:
      "partially_refunded",

    COD_PENDING:
      "cod_pending",

    COD_COLLECTED:
      "cod_collected"
  });


/* =========================================================
   ORDER EVENTS
========================================================= */

const ORDER_EVENTS =
  Object.freeze({

    CREATED:
      "savebite:order-created",

    UPDATED:
      "savebite:order-updated",

    STATUS_CHANGED:
      "savebite:order-status-changed",

    CANCELLED:
      "savebite:order-cancelled",

    ERROR:
      "savebite:order-error"
  });


/* =========================================================
   TERMINAL STATUSES
========================================================= */

const TERMINAL_STATUSES =
  Object.freeze([
    ORDER_STATUS.REJECTED,

    ORDER_STATUS.DELIVERED,

    ORDER_STATUS.COMPLETED,

    ORDER_STATUS.CANCELLED,

    ORDER_STATUS.FAILED
  ]);


/* =========================================================
   STATUS TRANSITIONS
========================================================= */

const STATUS_TRANSITIONS =
  Object.freeze({

    [ORDER_STATUS.CREATED]:
      [
        ORDER_STATUS.PENDING,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.FAILED
      ],

    [ORDER_STATUS.PENDING]:
      [
        ORDER_STATUS.ACCEPTED,
        ORDER_STATUS.REJECTED,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.FAILED
      ],

    [ORDER_STATUS.ACCEPTED]:
      [
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.FAILED
      ],

    [ORDER_STATUS.PREPARING]:
      [
        ORDER_STATUS.READY,
        ORDER_STATUS.CANCELLED,
        ORDER_STATUS.FAILED
      ],

    [ORDER_STATUS.READY]:
      [
        ORDER_STATUS.PICKED_UP,
        ORDER_STATUS.OUT_FOR_DELIVERY,
        ORDER_STATUS.COMPLETED,
        ORDER_STATUS.CANCELLED
      ],

    [ORDER_STATUS.PICKED_UP]:
      [
        ORDER_STATUS.OUT_FOR_DELIVERY,
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.FAILED
      ],

    [ORDER_STATUS.OUT_FOR_DELIVERY]:
      [
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.FAILED
      ],

    [ORDER_STATUS.DELIVERED]:
      [
        ORDER_STATUS.COMPLETED
      ],

    [ORDER_STATUS.COMPLETED]:
      [],

    [ORDER_STATUS.REJECTED]:
      [],

    [ORDER_STATUS.CANCELLED]:
      [],

    [ORDER_STATUS.FAILED]:
      []
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  initialized:
    false,

  currentOrders:
    new Map(),

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

function generateClientOrderId() {
  return (
    `order_${Date.now()}_` +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function toNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);


  if (
    Number.isFinite(
      number
    )
  ) {
    return number;
  }


  return fallback;
}


function roundMoney(
  value
) {
  return Math.round(
    (
      toNumber(value) *
      100
    )
  ) / 100;
}


/* =========================================================
   STATUS NORMALIZATION
========================================================= */

function normalizeOrderStatus(
  status
) {
  if (
    typeof status !==
    "string"
  ) {
    return ORDER_STATUS.PENDING;
  }


  const normalized =
    status
      .trim()
      .toLowerCase();


  if (
    Object.values(
      ORDER_STATUS
    ).includes(
      normalized
    )
  ) {
    return normalized;
  }


  return ORDER_STATUS.PENDING;
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
   PAYMENT NORMALIZATION
========================================================= */

function normalizePaymentStatus(
  status
) {
  if (
    typeof status !==
    "string"
  ) {
    return PAYMENT_STATUS.PENDING;
  }


  const normalized =
    status
      .trim()
      .toLowerCase();


  if (
    Object.values(
      PAYMENT_STATUS
    ).includes(
      normalized
    )
  ) {
    return normalized;
  }


  return PAYMENT_STATUS.PENDING;
}


/* =========================================================
   TIMESTAMP NORMALIZATION
========================================================= */

function normalizeTimestamp(
  value
) {
  if (
    value instanceof
    Date
  ) {
    return value;
  }


  if (
    value &&
    typeof value.toDate ===
      "function"
  ) {

    const date =
      value.toDate();


    if (
      date instanceof
        Date &&
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  if (
    value &&
    Number.isFinite(
      value.seconds
    )
  ) {

    return new Date(
      value.seconds *
        1000
    );
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


  return new Date();
}


/* =========================================================
   ITEM NORMALIZATION
========================================================= */

function normalizeOrderItem(
  item = {}
) {
  const quantity =
    Math.max(
      1,
      Math.floor(
        toNumber(
          item.quantity,
          1
        )
      )
    );


  const unitPrice =
    roundMoney(
      Math.max(
        0,
        toNumber(
          item.unitPrice ??
          item.price,
          0
        )
      )
    );


  const subtotal =
    roundMoney(
      unitPrice *
      quantity
    );


  return {

    productId:
      item.productId ||
      item.itemId ||
      null,

    name:
      typeof item.name ===
      "string"
        ? item.name.trim()
        : "Item",

    quantity,

    unitPrice,

    subtotal,

    imageUrl:
      typeof item.imageUrl ===
      "string"
        ? item.imageUrl
        : null,

    variantId:
      item.variantId ||
      null,

    variantName:
      item.variantName ||
      null,

    notes:
      typeof item.notes ===
      "string"
        ? item.notes.trim()
        : "",

    options:
      item.options &&
      typeof item.options ===
        "object"
        ? {
            ...item.options
          }
        : {}
  };
}


/* =========================================================
   NORMALIZE ITEMS
========================================================= */

function normalizeOrderItems(
  items
) {
  if (
    !Array.isArray(
      items
    )
  ) {
    return [];
  }


  return items
    .map(
      normalizeOrderItem
    )
    .filter(
      item =>
        item.quantity >
        0
    );
}


/* =========================================================
   CALCULATE ITEMS TOTAL
========================================================= */

function calculateItemsTotal(
  items
) {
  const normalizedItems =
    normalizeOrderItems(
      items
    );


  return roundMoney(
    normalizedItems.reduce(
      (
        total,
        item
      ) =>
        total +
        item.subtotal,
      0
    )
  );
}


/* =========================================================
   CALCULATE ORDER TOTAL
========================================================= */

function calculateOrderTotals(
  {
    items = [],

    deliveryFee =
      0,

    packagingFee =
      0,

    serviceFee =
      0,

    tax =
      0,

    discount =
      0,

    tip =
      0
  } = {}
) {
  const itemTotal =
    calculateItemsTotal(
      items
    );


  const safeDeliveryFee =
    roundMoney(
      Math.max(
        0,
        toNumber(
          deliveryFee
        )
      )
    );


  const safePackagingFee =
    roundMoney(
      Math.max(
        0,
        toNumber(
          packagingFee
        )
      )
    );


  const safeServiceFee =
    roundMoney(
      Math.max(
        0,
        toNumber(
          serviceFee
        )
      )
    );


  const safeTax =
    roundMoney(
      Math.max(
        0,
        toNumber(
          tax
        )
      )
    );


  const safeDiscount =
    roundMoney(
      Math.max(
        0,
        toNumber(
          discount
        )
      )
    );


  const safeTip =
    roundMoney(
      Math.max(
        0,
        toNumber(
          tip
        )
      )
    );


  const subtotal =
    roundMoney(
      itemTotal +
      safePackagingFee
    );


  const beforeDiscount =
    roundMoney(
      subtotal +
      safeDeliveryFee +
      safeServiceFee +
      safeTax +
      safeTip
    );


  const total =
    roundMoney(
      Math.max(
        0,
        beforeDiscount -
        safeDiscount
      )
    );


  return {

    itemTotal,

    subtotal,

    deliveryFee:
      safeDeliveryFee,

    packagingFee:
      safePackagingFee,

    serviceFee:
      safeServiceFee,

    tax:
      safeTax,

    discount:
      safeDiscount,

    tip:
      safeTip,

    beforeDiscount,

    total
  };
}


/* =========================================================
   VALIDATE ITEMS
========================================================= */

function validateOrderItems(
  items
) {
  const errors = [];


  if (
    !Array.isArray(
      items
    ) ||
    items.length ===
      0
  ) {

    errors.push(
      "Order must contain at least one item."
    );


    return {
      valid:
        false,

      errors
    };
  }


  items.forEach(
    (
      item,
      index
    ) => {

      if (
        !item.productId
      ) {

        errors.push(
          `Item ${index + 1} is missing productId.`
        );
      }


      const quantity =
        Number(
          item.quantity
        );


      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity <=
          0
      ) {

        errors.push(
          `Item ${index + 1} has an invalid quantity.`
        );
      }


      const price =
        Number(
          item.unitPrice ??
          item.price
        );


      if (
        !Number.isFinite(
          price
        ) ||
        price <
          0
      ) {

        errors.push(
          `Item ${index + 1} has an invalid price.`
        );
      }
    }
  );


  return {

    valid:
      errors.length ===
      0,

    errors
  };
}


/* =========================================================
   NORMALIZE ADDRESS
========================================================= */

function normalizeAddress(
  address = {}
) {
  if (
    typeof address ===
      "string"
  ) {

    return {

      label:
        "Delivery Address",

      address:
        address.trim(),

      latitude:
        null,

      longitude:
        null
    };
  }


  return {

    label:
      address.label ||
      "Delivery Address",

    address:
      typeof address.address ===
      "string"
        ? address.address.trim()
        : "",

    landmark:
      typeof address.landmark ===
      "string"
        ? address.landmark.trim()
        : "",

    city:
      typeof address.city ===
      "string"
        ? address.city.trim()
        : "",

    state:
      typeof address.state ===
      "string"
        ? address.state.trim()
        : "",

    postalCode:
      typeof address.postalCode ===
      "string"
        ? address.postalCode.trim()
        : "",

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
   NORMALIZE ORDER
========================================================= */

function normalizeOrder(
  order = {}
) {
  const items =
    normalizeOrderItems(
      order.items
    );


  const totals =
    calculateOrderTotals(
      {
        items,

        deliveryFee:
          order.deliveryFee,

        packagingFee:
          order.packagingFee,

        serviceFee:
          order.serviceFee,

        tax:
          order.tax,

        discount:
          order.discount,

        tip:
          order.tip
      }
    );


  const status =
    normalizeOrderStatus(
      order.status
    );


  const fulfillmentType =
    normalizeFulfillmentType(
      order.fulfillmentType
    );


  const paymentStatus =
    normalizePaymentStatus(
      order.paymentStatus
    );


  return {

    id:
      order.id ||
      order.orderId ||
      null,

    clientOrderId:
      order.clientOrderId ||
      null,

    customerId:
      order.customerId ||
      order.userId ||
      null,

    shopId:
      order.shopId ||
      null,

    shopName:
      order.shopName ||
      "",

    riderId:
      order.riderId ||
      null,

    status,

    fulfillmentType,

    paymentMethod:
      order.paymentMethod ||
      null,

    paymentStatus,

    items,

    itemCount:
      items.reduce(
        (
          total,
          item
        ) =>
          total +
          item.quantity,
        0
      ),

    ...totals,

    deliveryAddress:
      normalizeAddress(
        order.deliveryAddress ||
        order.address
      ),

    pickupAddress:
      normalizeAddress(
        order.pickupAddress ||
        {}
      ),

    customerNote:
      typeof order.customerNote ===
      "string"
        ? order.customerNote.trim()
        : "",

    shopNote:
      typeof order.shopNote ===
      "string"
        ? order.shopNote.trim()
        : "",

    cancellationReason:
      order.cancellationReason ||
      null,

    estimatedPreparationMinutes:
      Math.max(
        0,
        Math.floor(
          toNumber(
            order.estimatedPreparationMinutes
          )
        )
      ),

    estimatedDeliveryMinutes:
      Math.max(
        0,
        Math.floor(
          toNumber(
            order.estimatedDeliveryMinutes
          )
        )
      ),

    createdAt:
      normalizeTimestamp(
        order.createdAt
      ),

    updatedAt:
      normalizeTimestamp(
        order.updatedAt
      ),

    acceptedAt:
      order.acceptedAt
        ? normalizeTimestamp(
            order.acceptedAt
          )
        : null,

    preparingAt:
      order.preparingAt
        ? normalizeTimestamp(
            order.preparingAt
          )
        : null,

    readyAt:
      order.readyAt
        ? normalizeTimestamp(
            order.readyAt
          )
        : null,

    pickedUpAt:
      order.pickedUpAt
        ? normalizeTimestamp(
            order.pickedUpAt
          )
        : null,

    deliveredAt:
      order.deliveredAt
        ? normalizeTimestamp(
            order.deliveredAt
          )
        : null,

    completedAt:
      order.completedAt
        ? normalizeTimestamp(
            order.completedAt
          )
        : null,

    cancelledAt:
      order.cancelledAt
        ? normalizeTimestamp(
            order.cancelledAt
          )
        : null,

    metadata:
      order.metadata &&
      typeof order.metadata ===
        "object"
        ? {
            ...order.metadata
          }
        : {}
  };
}


/* =========================================================
   CREATE ORDER PAYLOAD
========================================================= */

function createOrderPayload(
  {
    customerId,

    shopId,

    items,

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

    deliveryFee =
      0,

    packagingFee =
      0,

    serviceFee =
      0,

    tax =
      0,

    discount =
      0,

    tip =
      0
  } = {}
) {
  const normalizedItems =
    normalizeOrderItems(
      items
    );


  const validation =
    validateOrderItems(
      normalizedItems
    );


  if (
    !validation.valid
  ) {

    throw new Error(
      validation.errors.join(
        " "
      )
    );
  }


  if (
    !customerId
  ) {
    throw new Error(
      "Customer ID is required."
    );
  }


  if (
    !shopId
  ) {
    throw new Error(
      "Shop ID is required."
    );
  }


  const totals =
    calculateOrderTotals(
      {
        items:
          normalizedItems,

        deliveryFee,

        packagingFee,

        serviceFee,

        tax,

        discount,

        tip
      }
    );


  const fulfillment =
    normalizeFulfillmentType(
      fulfillmentType
    );


  if (
    fulfillment ===
      FULFILLMENT_TYPES.DELIVERY &&
    !deliveryAddress
  ) {

    throw new Error(
      "Delivery address is required."
    );
  }


  return {

    clientOrderId:
      generateClientOrderId(),

    customerId,

    shopId,

    items:
      normalizedItems,

    fulfillmentType:
      fulfillment,

    deliveryAddress:
      fulfillment ===
        FULFILLMENT_TYPES.DELIVERY
        ? normalizeAddress(
            deliveryAddress
          )
        : null,

    pickupAddress:
      pickupAddress
        ? normalizeAddress(
            pickupAddress
          )
        : null,

    paymentMethod:
      paymentMethod ||
      null,

    paymentStatus:
      PAYMENT_STATUS.PENDING,

    status:
      ORDER_STATUS.PENDING,

    customerNote:
      String(
        customerNote ||
          ""
      ).trim(),

    ...totals,

    createdAt:
      new Date(),

    updatedAt:
      new Date()
  };
}


/* =========================================================
   STATUS TRANSITION CHECK
========================================================= */

function canTransitionStatus(
  fromStatus,
  toStatus
) {
  const from =
    normalizeOrderStatus(
      fromStatus
    );


  const to =
    normalizeOrderStatus(
      toStatus
    );


  if (
    from ===
    to
  ) {
    return true;
  }


  return (
    STATUS_TRANSITIONS[
      from
    ] || []
  ).includes(
    to
  );
}


/* =========================================================
   GET ALLOWED NEXT STATUSES
========================================================= */

function getAllowedNextStatuses(
  currentStatus
) {
  const normalized =
    normalizeOrderStatus(
      currentStatus
    );


  return [
    ...(STATUS_TRANSITIONS[
      normalized
    ] || [])
  ];
}


/* =========================================================
   IS TERMINAL
========================================================= */

function isTerminalStatus(
  status
) {
  return TERMINAL_STATUSES.includes(
    normalizeOrderStatus(
      status
    )
  );
}


/* =========================================================
   CUSTOMER CANCELLATION
========================================================= */

function canCustomerCancelOrder(
  order
) {
  const normalized =
    normalizeOrder(
      order
    );


  return (
    normalized.status ===
      ORDER_STATUS.CREATED ||
    normalized.status ===
      ORDER_STATUS.PENDING ||
    normalized.status ===
      ORDER_STATUS.ACCEPTED
  );
}


/* =========================================================
   SHOP CANCELLATION / REJECTION
========================================================= */

function canShopRejectOrder(
  order
) {
  const normalized =
    normalizeOrder(
      order
    );


  return (
    normalized.status ===
      ORDER_STATUS.CREATED ||
    normalized.status ===
      ORDER_STATUS.PENDING
  );
}


/* =========================================================
   UPDATE LOCAL ORDER
========================================================= */

function updateLocalOrder(
  order
) {
  const normalized =
    normalizeOrder(
      order
    );


  if (
    !normalized.id
  ) {

    return normalized;
  }


  const previous =
    state.currentOrders.get(
      normalized.id
    );


  state.currentOrders.set(
    normalized.id,
    normalized
  );


  emit(
    ORDER_EVENTS.UPDATED,
    {
      order:
        normalized,

      previous:
        previous ||
        null
    }
  );


  if (
    previous &&
    previous.status !==
      normalized.status
  ) {

    emit(
      ORDER_EVENTS.STATUS_CHANGED,
      {
        order:
          normalized,

        previousStatus:
          previous.status,

        status:
          normalized.status
      }
    );


    if (
      normalized.status ===
      ORDER_STATUS.CANCELLED
    ) {

      emit(
        ORDER_EVENTS.CANCELLED,
        {
          order:
            normalized
        }
      );
    }
  }


  return normalized;
}


/* =========================================================
   SET ORDERS
========================================================= */

function setOrders(
  orders
) {
  state.currentOrders.clear();


  if (
    Array.isArray(
      orders
    )
  ) {

    orders.forEach(
      order => {

        const normalized =
          normalizeOrder(
            order
          );


        if (
          normalized.id
        ) {

          state.currentOrders.set(
            normalized.id,
            normalized
          );
        }
      }
    );
  }


  return getOrders();
}


/* =========================================================
   GET ORDERS
========================================================= */

function getOrders(
  {
    status =
      null,

    shopId =
      null,

    customerId =
      null,

    limit =
      null
  } = {}
) {
  let orders =
    Array.from(
      state.currentOrders.values()
    );


  if (
    status
  ) {

    const normalizedStatus =
      normalizeOrderStatus(
        status
      );


    orders =
      orders.filter(
        order =>
          order.status ===
          normalizedStatus
      );
  }


  if (
    shopId
  ) {

    orders =
      orders.filter(
        order =>
          order.shopId ===
          shopId
      );
  }


  if (
    customerId
  ) {

    orders =
      orders.filter(
        order =>
          order.customerId ===
          customerId
      );
  }


  orders.sort(
    (
      first,
      second
    ) =>
      second.createdAt.getTime() -
      first.createdAt.getTime()
  );


  if (
    Number.isFinite(
      Number(limit)
    ) &&
    Number(limit) >
      0
  ) {

    orders =
      orders.slice(
        0,
        Number(limit)
      );
  }


  return orders;
}


/* =========================================================
   GET ORDER
========================================================= */

function getOrder(
  orderId
) {
  if (
    !orderId
  ) {
    return null;
  }


  return (
    state.currentOrders.get(
      String(orderId)
    ) ||
    null
  );
}


/* =========================================================
   BUILD STATUS UPDATE
========================================================= */

function buildStatusUpdate(
  order,
  newStatus,
  extra = {}
) {
  const normalized =
    normalizeOrder(
      order
    );


  const nextStatus =
    normalizeOrderStatus(
      newStatus
    );


  if (
    !canTransitionStatus(
      normalized.status,
      nextStatus
    )
  ) {

    throw new Error(
      `Invalid order status transition: ${normalized.status} → ${nextStatus}`
    );
  }


  const now =
    new Date();


  const update = {

    status:
      nextStatus,

    updatedAt:
      now,

    ...extra
  };


  switch (
    nextStatus
  ) {

    case ORDER_STATUS.ACCEPTED:
      update.acceptedAt =
        now;
      break;


    case ORDER_STATUS.PREPARING:
      update.preparingAt =
        now;
      break;


    case ORDER_STATUS.READY:
      update.readyAt =
        now;
      break;


    case ORDER_STATUS.PICKED_UP:
      update.pickedUpAt =
        now;
      break;


    case ORDER_STATUS.DELIVERED:
      update.deliveredAt =
        now;
      break;


    case ORDER_STATUS.COMPLETED:
      update.completedAt =
        now;
      break;


    case ORDER_STATUS.CANCELLED:
      update.cancelledAt =
        now;
      break;
  }


  return update;
}


/* =========================================================
   CUSTOMER ACTION
========================================================= */

function buildCustomerCancelUpdate(
  order,
  reason =
    ""
) {
  const normalized =
    normalizeOrder(
      order
    );


  if (
    !canCustomerCancelOrder(
      normalized
    )
  ) {

    throw new Error(
      "This order can no longer be cancelled by the customer."
    );
  }


  return buildStatusUpdate(
    normalized,
    ORDER_STATUS.CANCELLED,
    {
      cancellationReason:
        String(
          reason ||
            ""
        ).trim(),

      cancelledBy:
        "customer"
    }
  );
}


/* =========================================================
   SHOP ACCEPT
========================================================= */

function buildShopAcceptUpdate(
  order,
  {
    preparationMinutes =
      0
  } = {}
) {
  const normalized =
    normalizeOrder(
      order
    );


  if (
    !canTransitionStatus(
      normalized.status,
      ORDER_STATUS.ACCEPTED
    )
  ) {

    throw new Error(
      "This order cannot be accepted in its current state."
    );
  }


  return buildStatusUpdate(
    normalized,
    ORDER_STATUS.ACCEPTED,
    {
      estimatedPreparationMinutes:
        Math.max(
          0,
          Math.floor(
            toNumber(
              preparationMinutes
            )
          )
        )
    }
  );
}


/* =========================================================
   SHOP REJECT
========================================================= */

function buildShopRejectUpdate(
  order,
  reason =
    ""
) {
  const normalized =
    normalizeOrder(
      order
    );


  if (
    !canShopRejectOrder(
      normalized
    )
  ) {

    throw new Error(
      "This order cannot be rejected in its current state."
    );
  }


  return buildStatusUpdate(
    normalized,
    ORDER_STATUS.REJECTED,
    {
      cancellationReason:
        String(
          reason ||
            ""
        ).trim(),

      rejectedBy:
        "shop"
    }
  );
}


/* =========================================================
   PAYMENT STATUS UPDATE
========================================================= */

function buildPaymentStatusUpdate(
  order,
  paymentStatus
) {
  const normalized =
    normalizePaymentStatus(
      paymentStatus
    );


  return {

    paymentStatus:
      normalized,

    updatedAt:
      new Date()
  };
}


/* =========================================================
   ORDER SUMMARY
========================================================= */

function getOrderSummary(
  order
) {
  const normalized =
    normalizeOrder(
      order
    );


  return {

    id:
      normalized.id,

    status:
      normalized.status,

    itemCount:
      normalized.itemCount,

    itemTotal:
      normalized.itemTotal,

    deliveryFee:
      normalized.deliveryFee,

    packagingFee:
      normalized.packagingFee,

    serviceFee:
      normalized.serviceFee,

    tax:
      normalized.tax,

    discount:
      normalized.discount,

    tip:
      normalized.tip,

    total:
      normalized.total,

    paymentMethod:
      normalized.paymentMethod,

    paymentStatus:
      normalized.paymentStatus,

    fulfillmentType:
      normalized.fulfillmentType
  };
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
   INITIALIZE
========================================================= */

function initializeOrders(
  {
    userId =
      null,

    orders =
      []
  } = {}
) {
  state.initialized =
    true;


  state.currentUserId =
    userId ||
    null;


  setOrders(
    orders
  );


  return getState();
}


/* =========================================================
   GET STATE
========================================================= */

function getState() {
  return {

    initialized:
      state.initialized,

    currentUserId:
      state.currentUserId,

    orders:
      getOrders()
  };
}


/* =========================================================
   CLEAR
========================================================= */

function clearOrders() {
  state.currentOrders.clear();


  return true;
}


/* =========================================================
   DESTROY
========================================================= */

function destroyOrders() {
  clearOrders();


  state.initialized =
    false;

  state.currentUserId =
    null;
}


/* =========================================================
   EXPORT
========================================================= */

export {

  ORDER_STATUS,

  FULFILLMENT_TYPES,

  PAYMENT_STATUS,

  ORDER_EVENTS,

  TERMINAL_STATUSES,

  STATUS_TRANSITIONS,

  normalizeOrderStatus,

  normalizeFulfillmentType,

  normalizePaymentStatus,

  normalizeOrderItem,

  normalizeOrderItems,

  calculateItemsTotal,

  calculateOrderTotals,

  validateOrderItems,

  normalizeAddress,

  normalizeOrder,

  createOrderPayload,

  canTransitionStatus,

  getAllowedNextStatuses,

  isTerminalStatus,

  canCustomerCancelOrder,

  canShopRejectOrder,

  updateLocalOrder,

  setOrders,

  getOrders,

  getOrder,

  buildStatusUpdate,

  buildCustomerCancelUpdate,

  buildShopAcceptUpdate,

  buildShopRejectUpdate,

  buildPaymentStatusUpdate,

  getOrderSummary,

  setCurrentUser,

  getCurrentUserId,

  initializeOrders,

  getState,

  clearOrders,

  destroyOrders

};
