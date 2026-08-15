/*
 * SaveBite
 * Cart Engine
 *
 * Responsibilities:
 * - Add / remove products
 * - Quantity management
 * - Product variants/options
 * - Shop-wise cart restriction
 * - Cart totals
 * - Delivery/packaging/service fees
 * - Discount / tip support
 * - Checkout payload preparation
 * - Cart state events
 *
 * IMPORTANT:
 * - Cart is UI/client state only.
 * - Firestore/backend must revalidate product availability,
 *   price, shop, quantity and final total before creating order.
 * - localStorage is NOT authentication.
 */

import {
  calculateOrderTotals,
  normalizeOrderItem
} from "./orders.js";


/* =========================================================
   CONSTANTS
========================================================= */

const CART_STORAGE_KEY =
  "savebite_cart_v1";


const CART_EVENTS =
  Object.freeze({

    UPDATED:
      "savebite:cart-updated",

    ITEM_ADDED:
      "savebite:cart-item-added",

    ITEM_REMOVED:
      "savebite:cart-item-removed",

    ITEM_UPDATED:
      "savebite:cart-item-updated",

    CLEARED:
      "savebite:cart-cleared",

    ERROR:
      "savebite:cart-error"
  });


const DEFAULTS =
  Object.freeze({

    deliveryFee:
      0,

    packagingFee:
      0,

    serviceFee:
      0,

    tax:
      0,

    discount:
      0,

    tip:
      0
  });


/* =========================================================
   STATE
========================================================= */

const state = {

  initialized:
    false,

  items:
    [],

  shop:
    null,

  fees: {
    ...DEFAULTS
  },

  discountCode:
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
   ID HELPERS
========================================================= */

function normalizeId(
  value
) {
  if (
    value ===
      undefined ||
    value ===
      null
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
   QUANTITY
========================================================= */

function normalizeQuantity(
  quantity
) {
  const number =
    Math.floor(
      toNumber(
        quantity,
        1
      )
    );


  return Math.max(
    1,
    number
  );
}


/* =========================================================
   TEXT
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
   OPTIONS NORMALIZATION
========================================================= */

function normalizeOptions(
  options
) {
  if (
    !options ||
    typeof options !==
      "object"
  ) {
    return {};
  }


  /*
   * Clone to prevent accidental
   * mutation of caller data.
   */

  if (
    Array.isArray(
      options
    )
  ) {

    return options.map(
      option => {

        if (
          option &&
          typeof option ===
            "object"
        ) {
          return {
            ...option
          };
        }

        return option;
      }
    );
  }


  return {
    ...options
  };
}


/* =========================================================
   OPTION KEY
========================================================= */

function createOptionKey(
  options
) {
  if (
    !options
  ) {
    return "";
  }


  try {

    return JSON.stringify(
      options,
      Object.keys(
        options
      ).sort()
    );

  } catch {

    return String(
      options
    );
  }
}


/* =========================================================
   CART ITEM KEY
========================================================= */

function createCartItemKey(
  {
    productId,
    variantId =
      null,
    options =
      {}
  } = {}
) {
  const product =
    normalizeId(
      productId
    ) || "";


  const variant =
    normalizeId(
      variantId
    ) || "";


  const optionKey =
    createOptionKey(
      options
    );


  return [
    product,
    variant,
    optionKey
  ].join(
    "::"
  );
}


/* =========================================================
   SHOP NORMALIZATION
========================================================= */

function normalizeShop(
  shop
) {
  if (
    !shop ||
    typeof shop !==
      "object"
  ) {
    return null;
  }


  return {

    id:
      normalizeId(
        shop.id ||
        shop.shopId
      ),

    name:
      cleanText(
        shop.name ||
        shop.shopName
      ),

    logoUrl:
      cleanText(
        shop.logoUrl
      ) ||
      null,

    address:
      cleanText(
        shop.address
      ),

    city:
      cleanText(
        shop.city
      ),

    isOpen:
      shop.isOpen !==
        false
  };
}


/* =========================================================
   ITEM NORMALIZATION
========================================================= */

function normalizeCartItem(
  item = {}
) {
  const productId =
    normalizeId(
      item.productId ||
      item.itemId ||
      item.id
    );


  if (
    !productId
  ) {
    throw new Error(
      "Product ID is required."
    );
  }


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


  const quantity =
    normalizeQuantity(
      item.quantity
    );


  const variantId =
    normalizeId(
      item.variantId
    );


  const options =
    normalizeOptions(
      item.options
    );


  return {

    key:
      item.key ||
      createCartItemKey(
        {
          productId,

          variantId,

          options
        }
      ),

    productId,

    name:
      cleanText(
        item.name
      ) ||
      "Item",

    imageUrl:
      cleanText(
        item.imageUrl
      ) ||
      null,

    unitPrice,

    quantity,

    subtotal:
      roundMoney(
        unitPrice *
        quantity
      ),

    variantId,

    variantName:
      cleanText(
        item.variantName
      ) ||
      null,

    options,

    notes:
      cleanText(
        item.notes
      ),

    shopId:
      normalizeId(
        item.shopId
      ),

    shopName:
      cleanText(
        item.shopName
      ),

    maxQuantity:
      Number.isFinite(
        Number(
          item.maxQuantity
        )
      )
        ? Math.max(
            1,
            Math.floor(
              Number(
                item.maxQuantity
              )
            )
          )
        : null,

    available:
      item.available !==
      false
  };
}


/* =========================================================
   UPDATE ITEM SUBTOTAL
========================================================= */

function refreshItem(
  item
) {
  return {

    ...item,

    subtotal:
      roundMoney(
        item.unitPrice *
        item.quantity
      )
  };
}


/* =========================================================
   TOTAL ITEM COUNT
========================================================= */

function getItemCount() {
  return state.items.reduce(
    (
      total,
      item
    ) =>
      total +
      item.quantity,
    0
  );
}


/* =========================================================
   UNIQUE PRODUCT COUNT
========================================================= */

function getUniqueItemCount() {
  return state.items.length;
}


/* =========================================================
   SUBTOTAL
========================================================= */

function getSubtotal() {
  return roundMoney(
    state.items.reduce(
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
   TOTALS
========================================================= */

function getTotals() {
  const totals =
    calculateOrderTotals(
      {
        items:
          state.items,

        deliveryFee:
          state.fees.deliveryFee,

        packagingFee:
          state.fees.packagingFee,

        serviceFee:
          state.fees.serviceFee,

        tax:
          state.fees.tax,

        discount:
          state.fees.discount,

        tip:
          state.fees.tip
      }
    );


  return totals;
}


/* =========================================================
   CART SNAPSHOT
========================================================= */

function getSnapshot() {
  return {

    items:
      state.items.map(
        item => ({
          ...item,

          options:
            normalizeOptions(
              item.options
            )
        })
      ),

    shop:
      state.shop
        ? {
            ...state.shop
          }
        : null,

    fees: {
      ...state.fees
    },

    discountCode:
      state.discountCode,

    itemCount:
      getItemCount(),

    uniqueItemCount:
      getUniqueItemCount(),

    subtotal:
      getSubtotal(),

    totals:
      getTotals(),

    isEmpty:
      state.items.length ===
      0
  };
}


/* =========================================================
   FIND ITEM
========================================================= */

function findItem(
  itemKey
) {
  const key =
    String(
      itemKey
    );


  return (
    state.items.find(
      item =>
        item.key ===
        key
    ) ||
    null
  );
}


/* =========================================================
   FIND PRODUCT ITEMS
========================================================= */

function findProductItems(
  productId
) {
  const id =
    normalizeId(
      productId
    );


  if (
    !id
  ) {
    return [];
  }


  return state.items.filter(
    item =>
      item.productId ===
      id
  );
}


/* =========================================================
   SHOP RESTRICTION
========================================================= */

function canAddFromShop(
  shopId
) {
  const id =
    normalizeId(
      shopId
    );


  /*
   * Empty cart can accept
   * any shop.
   */

  if (
    state.items.length ===
    0
  ) {
    return true;
  }


  /*
   * A cart can contain products
   * from only one shop.
   */

  return (
    state.shop?.id ===
    id
  );
}


/* =========================================================
   SET SHOP
========================================================= */

function setShop(
  shop
) {
  const normalized =
    normalizeShop(
      shop
    );


  if (
    !normalized?.id
  ) {

    throw new Error(
      "Valid shop information is required."
    );
  }


  /*
   * Never silently replace another
   * shop's cart.
   */

  if (
    state.items.length >
      0 &&
    state.shop?.id !==
      normalized.id
  ) {

    throw new Error(
      "Your cart already contains items from another shop."
    );
  }


  state.shop =
    normalized;


  persist();


  emitUpdate();


  return state.shop;
}


/* =========================================================
   ADD ITEM
========================================================= */

function addItem(
  item,
  {
    shop =
      null,

    quantity =
      null,

    replaceExisting =
      false
  } = {}
) {
  let normalized;


  try {

    normalized =
      normalizeCartItem(
        {
          ...item,

          quantity:
            quantity ??
            item.quantity ??
            1
        }
      );

  } catch (
    error
  ) {

    emit(
      CART_EVENTS.ERROR,
      {
        error
      }
    );

    throw error;
  }


  /*
   * Shop comes from item or explicit shop.
   */

  const incomingShop =
    normalizeShop(
      shop || {
        id:
          normalized.shopId,

        name:
          normalized.shopName
      }
    );


  const incomingShopId =
    normalized.shopId ||
    incomingShop?.id ||
    null;


  /*
   * Existing cart shop check.
   */

  if (
    state.items.length >
      0 &&
    !canAddFromShop(
      incomingShopId
    )
  ) {

    const error =
      new Error(
        "You can order from only one shop at a time."
      );


    error.code =
      "MULTIPLE_SHOPS";


    emit(
      CART_EVENTS.ERROR,
      {
        error
      }
    );


    throw error;
  }


  /*
   * Set shop on first item.
   */

  if (
    state.items.length ===
      0 &&
    incomingShop?.id
  ) {

    state.shop =
      incomingShop;
  }


  const existingIndex =
    state.items.findIndex(
      existing =>
        existing.key ===
        normalized.key
    );


  if (
    existingIndex >=
    0 &&
    !replaceExisting
  ) {

    const existing =
      state.items[
        existingIndex
      ];


    const requestedQuantity =
      normalizeQuantity(
        existing.quantity +
        normalized.quantity
      );


    let finalQuantity =
      requestedQuantity;


    if (
      Number.isFinite(
        existing.maxQuantity
      )
    ) {

      finalQuantity =
        Math.min(
          requestedQuantity,
          existing.maxQuantity
        );
    }


    state.items[
      existingIndex
    ] =
      refreshItem(
        {
          ...existing,

          quantity:
            finalQuantity
        }
      );


    emit(
      CART_EVENTS.ITEM_UPDATED,
      {
        item:
          state.items[
            existingIndex
          ]
      }
    );

  } else {

    state.items.push(
      normalized
    );


    emit(
      CART_EVENTS.ITEM_ADDED,
      {
        item:
          normalized
      }
    );
  }


  persist();

  emitUpdate();


  return getSnapshot();
}


/* =========================================================
   UPDATE ITEM
========================================================= */

function updateItem(
  itemKey,
  updates = {}
) {
  const index =
    state.items.findIndex(
      item =>
        item.key ===
        String(
          itemKey
        )
    );


  if (
    index <
    0
  ) {

    throw new Error(
      "Cart item not found."
    );
  }


  const current =
    state.items[
      index
    ];


  const quantity =
    updates.quantity !==
      undefined
      ? normalizeQuantity(
          updates.quantity
        )
      : current.quantity;


  if (
    current.maxQuantity !==
      null &&
    quantity >
      current.maxQuantity
  ) {

    throw new Error(
      `Maximum quantity allowed is ${current.maxQuantity}.`
    );
  }


  const updated =
    normalizeCartItem(
      {
        ...current,

        ...updates,

        productId:
          current.productId,

        quantity,

        unitPrice:
          current.unitPrice,

        key:
          current.key
      }
    );


  state.items[
    index
  ] =
    updated;


  persist();


  emit(
    CART_EVENTS.ITEM_UPDATED,
    {
      item:
        updated
    }
  );


  emitUpdate();


  return updated;
}


/* =========================================================
   SET QUANTITY
========================================================= */

function setQuantity(
  itemKey,
  quantity
) {
  const item =
    findItem(
      itemKey
    );


  if (
    !item
  ) {

    throw new Error(
      "Cart item not found."
    );
  }


  const nextQuantity =
    Math.floor(
      toNumber(
        quantity,
        0
      )
    );


  /*
   * Quantity zero means remove.
   */

  if (
    nextQuantity <=
      0
  ) {

    return removeItem(
      itemKey
    );
  }


  return updateItem(
    itemKey,
    {
      quantity:
        nextQuantity
    }
  );
}


/* =========================================================
   INCREMENT
========================================================= */

function incrementItem(
  itemKey,
  amount =
    1
) {
  const item =
    findItem(
      itemKey
    );


  if (
    !item
  ) {

    throw new Error(
      "Cart item not found."
    );
  }


  return setQuantity(
    itemKey,
    item.quantity +
      Math.max(
        1,
        Math.floor(
          toNumber(
            amount,
            1
          )
        )
      )
  );
}


/* =========================================================
   DECREMENT
========================================================= */

function decrementItem(
  itemKey,
  amount =
    1
) {
  const item =
    findItem(
      itemKey
    );


  if (
    !item
  ) {

    throw new Error(
      "Cart item not found."
    );
  }


  return setQuantity(
    itemKey,
    item.quantity -
      Math.max(
        1,
        Math.floor(
          toNumber(
            amount,
            1
          )
        )
      )
  );
}


/* =========================================================
   REMOVE ITEM
========================================================= */

function removeItem(
  itemKey
) {
  const index =
    state.items.findIndex(
      item =>
        item.key ===
        String(
          itemKey
        )
    );


  if (
    index <
    0
  ) {
    return false;
  }


  const [
    removed
  ] =
    state.items.splice(
      index,
      1
    );


  /*
   * If cart is empty,
   * clear shop metadata.
   */

  if (
    state.items.length ===
    0
  ) {

    state.shop =
      null;

    state.discountCode =
      null;

    state.fees = {
      ...DEFAULTS
    };
  }


  persist();


  emit(
    CART_EVENTS.ITEM_REMOVED,
    {
      item:
        removed
    }
  );


  emitUpdate();


  return true;
}


/* =========================================================
   REMOVE PRODUCT
========================================================= */

function removeProduct(
  productId
) {
  const id =
    normalizeId(
      productId
    );


  if (
    !id
  ) {
    return 0;
  }


  const before =
    state.items.length;


  state.items =
    state.items.filter(
      item =>
        item.productId !==
        id
    );


  const removed =
    before -
    state.items.length;


  if (
    state.items.length ===
    0
  ) {

    state.shop =
      null;

    state.discountCode =
      null;

    state.fees = {
      ...DEFAULTS
    };
  }


  if (
    removed >
    0
  ) {

    persist();

    emitUpdate();
  }


  return removed;
}


/* =========================================================
   CLEAR CART
========================================================= */

function clearCart() {
  state.items =
    [];

  state.shop =
    null;

  state.discountCode =
    null;

  state.fees = {
    ...DEFAULTS
  };


  removePersistedCart();


  emit(
    CART_EVENTS.CLEARED,
    {}
  );


  emitUpdate();


  return true;
}


/* =========================================================
   SET FEES
========================================================= */

function setFees(
  fees = {}
) {
  state.fees = {

    deliveryFee:
      Math.max(
        0,
        roundMoney(
          fees.deliveryFee ??
          state.fees.deliveryFee
        )
      ),

    packagingFee:
      Math.max(
        0,
        roundMoney(
          fees.packagingFee ??
          state.fees.packagingFee
        )
      ),

    serviceFee:
      Math.max(
        0,
        roundMoney(
          fees.serviceFee ??
          state.fees.serviceFee
        )
      ),

    tax:
      Math.max(
        0,
        roundMoney(
          fees.tax ??
          state.fees.tax
        )
      ),

    discount:
      Math.max(
        0,
        roundMoney(
          fees.discount ??
          state.fees.discount
        )
      ),

    tip:
      Math.max(
        0,
        roundMoney(
          fees.tip ??
          state.fees.tip
        )
      )
  };


  persist();

  emitUpdate();


  return {
    ...state.fees
  };
}


/* =========================================================
   SET DELIVERY FEE
========================================================= */

function setDeliveryFee(
  amount
) {
  return setFees(
    {
      deliveryFee:
        amount
    }
  );
}


/* =========================================================
   SET DISCOUNT
========================================================= */

function setDiscount(
  amount,
  code =
    null
) {
  state.fees.discount =
    Math.max(
      0,
      roundMoney(
        amount
      )
    );


  state.discountCode =
    cleanText(
      code
    ) ||
    null;


  persist();

  emitUpdate();


  return getTotals();
}


/* =========================================================
   SET TIP
========================================================= */

function setTip(
  amount
) {
  return setFees(
    {
      tip:
        amount
    }
  );
}


/* =========================================================
   CLEAR DISCOUNT
========================================================= */

function clearDiscount() {
  state.fees.discount =
    0;

  state.discountCode =
    null;


  persist();

  emitUpdate();


  return getTotals();
}


/* =========================================================
   VALIDATE CART
========================================================= */

function validateCart(
  {
    requireShop =
      true,

    requireAvailable =
      true,

    requirePositivePrice =
      true
  } = {}
) {
  const errors = [];


  if (
    state.items.length ===
    0
  ) {

    errors.push(
      "Cart is empty."
    );
  }


  if (
    requireShop &&
    !state.shop?.id
  ) {

    errors.push(
      "Shop information is missing."
    );
  }


  state.items.forEach(
    (
      item,
      index
    ) => {

      if (
        !item.productId
      ) {

        errors.push(
          `Item ${index + 1} has no product ID.`
        );
      }


      if (
        item.quantity <=
          0
      ) {

        errors.push(
          `Item ${index + 1} has invalid quantity.`
        );
      }


      if (
        requirePositivePrice &&
        item.unitPrice <=
          0
      ) {

        errors.push(
          `Item ${index + 1} has invalid price.`
        );
      }


      if (
        requireAvailable &&
        item.available ===
          false
      ) {

        errors.push(
          `${item.name} is currently unavailable.`
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
   CHECKOUT PAYLOAD
========================================================= */

function createCheckoutPayload(
  {
    customerId,

    fulfillmentType =
      "delivery",

    deliveryAddress =
      null,

    paymentMethod =
      null,

    customerNote =
      ""
  } = {}
) {
  const validation =
    validateCart();


  if (
    !validation.valid
  ) {

    const error =
      new Error(
        validation.errors.join(
          " "
        )
      );


    error.code =
      "INVALID_CART";


    throw error;
  }


  if (
    !customerId
  ) {

    throw new Error(
      "Customer ID is required."
    );
  }


  if (
    fulfillmentType ===
      "delivery" &&
    !deliveryAddress
  ) {

    throw new Error(
      "Delivery address is required."
    );
  }


  /*
   * Important:
   *
   * This payload is NOT authoritative.
   * Backend must recalculate everything.
   */

  return {

    customerId,

    shopId:
      state.shop.id,

    items:
      state.items.map(
        item => ({
          productId:
            item.productId,

          quantity:
            item.quantity,

          variantId:
            item.variantId,

          options:
            normalizeOptions(
              item.options
            )
        })
      ),

    fulfillmentType,

    deliveryAddress:
      deliveryAddress ||
      null,

    paymentMethod:
      paymentMethod ||
      null,

    customerNote:
      cleanText(
        customerNote
      ),

    clientTotals:
      getTotals(),

    discountCode:
      state.discountCode
  };
}


/* =========================================================
   SERIALIZE
========================================================= */

function serialize() {
  return {

    version:
      1,

    items:
      state.items,

    shop:
      state.shop,

    fees:
      state.fees,

    discountCode:
      state.discountCode
  };
}


/* =========================================================
   PERSIST
========================================================= */

function persist() {
  /*
   * Cart persistence is only convenience/UI state.
   * It is never authentication or authorization.
   */

  if (
    typeof localStorage ===
    "undefined"
  ) {
    return false;
  }


  try {

    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(
        serialize()
      )
    );


    return true;

  } catch {

    return false;
  }
}


/* =========================================================
   REMOVE PERSISTED CART
========================================================= */

function removePersistedCart() {
  if (
    typeof localStorage ===
    "undefined"
  ) {
    return;
  }


  try {

    localStorage.removeItem(
      CART_STORAGE_KEY
    );

  } catch {
    /* Ignore storage errors. */
  }
}


/* =========================================================
   RESTORE
========================================================= */

function restore() {
  if (
    typeof localStorage ===
    "undefined"
  ) {
    return false;
  }


  try {

    const raw =
      localStorage.getItem(
        CART_STORAGE_KEY
      );


    if (
      !raw
    ) {
      return false;
    }


    const saved =
      JSON.parse(
        raw
      );


    if (
      !saved ||
      typeof saved !==
        "object"
    ) {
      return false;
    }


    const items =
      Array.isArray(
        saved.items
      )
        ? saved.items
        : [];


    state.items =
      items
        .map(
          item => {

            try {

              return normalizeCartItem(
                item
              );

            } catch {

              return null;
            }
          }
        )
        .filter(
          Boolean
        );


    state.shop =
      normalizeShop(
        saved.shop
      );


    state.fees = {

      deliveryFee:
        Math.max(
          0,
          roundMoney(
            saved.fees
              ?.deliveryFee ??
              0
          )
        ),

      packagingFee:
        Math.max(
          0,
          roundMoney(
            saved.fees
              ?.packagingFee ??
              0
          )
        ),

      serviceFee:
        Math.max(
          0,
          roundMoney(
            saved.fees
              ?.serviceFee ??
              0
          )
        ),

      tax:
        Math.max(
          0,
          roundMoney(
            saved.fees
              ?.tax ??
              0
          )
        ),

      discount:
        Math.max(
          0,
          roundMoney(
            saved.fees
              ?.discount ??
              0
          )
        ),

      tip:
        Math.max(
          0,
          roundMoney(
            saved.fees
              ?.tip ??
              0
          )
        )
    };


    state.discountCode =
      cleanText(
        saved.discountCode
      ) ||
      null;


    /*
     * If restored items don't belong to
     * the restored shop, rebuild shop info
     * from first valid item.
     */

    if (
      state.items.length >
        0
    ) {

      const first =
        state.items[0];


      if (
        !state.shop?.id &&
        first.shopId
      ) {

        state.shop =
          normalizeShop(
            {
              id:
                first.shopId,

              name:
                first.shopName
            }
          );
      }
    }


    emitUpdate();


    return true;

  } catch {

    removePersistedCart();

    return false;
  }
}


/* =========================================================
   EMIT UPDATE
========================================================= */

function emitUpdate() {
  emit(
    CART_EVENTS.UPDATED,
    {
      cart:
        getSnapshot()
    }
  );
}


/* =========================================================
   INITIALIZE
========================================================= */

function initializeCart(
  {
    restoreSaved =
      true
  } = {}
) {
  state.initialized =
    true;


  if (
    restoreSaved
  ) {
    restore();
  }


  return getSnapshot();
}


/* =========================================================
   GET STATE
========================================================= */

function getState() {
  return {

    initialized:
      state.initialized,

    itemCount:
      getItemCount(),

    uniqueItemCount:
      getUniqueItemCount(),

    shop:
      state.shop,

    items:
      state.items,

    fees:
      {
        ...state.fees
      },

    discountCode:
      state.discountCode,

    totals:
      getTotals()
  };
}


/* =========================================================
   DESTROY
========================================================= */

function destroyCart(
  {
    clearPersisted =
      false
  } = {}
) {
  state.initialized =
    false;

  state.items =
    [];

  state.shop =
    null;

  state.fees = {
    ...DEFAULTS
  };

  state.discountCode =
    null;


  if (
    clearPersisted
  ) {
    removePersistedCart();
  }
}


/* =========================================================
   EXPORT
========================================================= */

export {

  CART_STORAGE_KEY,

  CART_EVENTS,

  normalizeCartItem,

  normalizeOptions,

  createCartItemKey,

  normalizeShop,

  getItemCount,

  getUniqueItemCount,

  getSubtotal,

  getTotals,

  getSnapshot,

  findItem,

  findProductItems,

  canAddFromShop,

  setShop,

  addItem,

  updateItem,

  setQuantity,

  incrementItem,

  decrementItem,

  removeItem,

  removeProduct,

  clearCart,

  setFees,

  setDeliveryFee,

  setDiscount,

  setTip,

  clearDiscount,

  validateCart,

  createCheckoutPayload,

  serialize,

  persist,

  restore,

  initializeCart,

  getState,

  destroyCart

};
