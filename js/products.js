/*
 * SaveBite
 * Products Engine
 *
 * Responsibilities:
 * - Product normalization
 * - Product listing
 * - Product details
 * - Search
 * - Category filtering
 * - Availability filtering
 * - Price filtering
 * - Sorting
 * - Pagination helpers
 * - Product cache
 * - Shop-wise product management
 *
 * IMPORTANT:
 * - Client-side product data is never authoritative.
 * - Final price, stock, availability and shop ownership
 *   MUST be verified by the backend before checkout/order.
 * - Firebase Auth remains the authentication source of truth.
 * - This file does not use localStorage for authentication.
 */


/* =========================================================
   CONSTANTS
========================================================= */

const PRODUCT_STATUS =
  Object.freeze({

    ACTIVE:
      "active",

    INACTIVE:
      "inactive",

    SOLD_OUT:
      "sold_out",

    EXPIRED:
      "expired",

    DRAFT:
      "draft"
  });


const PRODUCT_EVENTS =
  Object.freeze({

    LOADED:
      "savebite:products-loaded",

    UPDATED:
      "savebite:products-updated",

    SELECTED:
      "savebite:product-selected",

    ERROR:
      "savebite:products-error",

    CACHE_UPDATED:
      "savebite:products-cache-updated"
  });


const DEFAULT_PAGE_SIZE =
  20;


/* =========================================================
   STATE
========================================================= */

const state = {

  initialized:
    false,

  products:
    [],

  cache:
    new Map(),

  shopCache:
    new Map(),

  selectedProductId:
    null,

  lastQuery:
    "",

  lastFilters:
    {},

  lastUpdatedAt:
    null,

  loading:
    false,

  error:
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
   NUMBER
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


/* =========================================================
   MONEY
========================================================= */

function money(
  value
) {
  return Math.round(
    Math.max(
      0,
      toNumber(
        value,
        0
      )
    ) *
      100
  ) / 100;
}


/* =========================================================
   BOOLEAN
========================================================= */

function toBoolean(
  value,
  fallback = false
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }


  if (
    value ===
      "true" ||
    value ===
      1 ||
    value ===
      "1"
  ) {
    return true;
  }


  if (
    value ===
      "false" ||
    value ===
      0 ||
    value ===
      "0"
  ) {
    return false;
  }


  return fallback;
}


/* =========================================================
   ARRAY
========================================================= */

function safeArray(
  value
) {
  return Array.isArray(
    value
  )
    ? value
    : [];
}


/* =========================================================
   DATE NORMALIZATION
========================================================= */

function normalizeDate(
  value
) {
  if (
    !value
  ) {
    return null;
  }


  if (
    value instanceof
    Date
  ) {

    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }


  /*
   * Firebase Timestamp support.
   */

  if (
    typeof value.toDate ===
    "function"
  ) {

    try {

      const date =
        value.toDate();


      return Number.isNaN(
        date.getTime()
      )
        ? null
        : date;

    } catch {

      return null;
    }
  }


  const date =
    new Date(
      value
    );


  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


/* =========================================================
   IMAGE NORMALIZATION
========================================================= */

function normalizeImages(
  product
) {
  const images = [];


  if (
    typeof product.imageUrl ===
    "string" &&
    product.imageUrl.trim()
  ) {

    images.push(
      product.imageUrl.trim()
    );
  }


  safeArray(
    product.images
  ).forEach(
    image => {

      if (
        typeof image ===
        "string"
      ) {

        const url =
          image.trim();


        if (
          url &&
          !images.includes(
            url
          )
        ) {

          images.push(
            url
          );
        }

      } else if (
        image &&
        typeof image ===
          "object"
      ) {

        const url =
          cleanText(
            image.url ||
            image.imageUrl
          );


        if (
          url &&
          !images.includes(
            url
          )
        ) {

          images.push(
            url
          );
        }
      }
    }
  );


  return images;
}


/* =========================================================
   CATEGORY NORMALIZATION
========================================================= */

function normalizeCategories(
  product
) {
  const categories = [];


  const values = [
    product.category,
    product.categoryName,
    ...safeArray(
      product.categories
    )
  ];


  values.forEach(
    value => {

      if (
        typeof value ===
        "string"
      ) {

        const clean =
          value.trim();


        if (
          clean &&
          !categories.includes(
            clean
          )
        ) {

          categories.push(
            clean
          );
        }

      } else if (
        value &&
        typeof value ===
          "object"
      ) {

        const name =
          cleanText(
            value.name ||
            value.title
          );


        if (
          name &&
          !categories.includes(
            name
          )
        ) {

          categories.push(
            name
          );
        }
      }
    }
  );


  return categories;
}


/* =========================================================
   VARIANTS
========================================================= */

function normalizeVariants(
  variants
) {
  return safeArray(
    variants
  )
    .map(
      variant => {

        if (
          typeof variant ===
          "string"
        ) {

          return {

            id:
              variant,

            name:
              variant,

            price:
              0,

            available:
              true
          };
        }


        if (
          !variant ||
          typeof variant !==
            "object"
        ) {

          return null;
        }


        return {

          id:
            normalizeId(
              variant.id ||
              variant.variantId
            ),

          name:
            cleanText(
              variant.name ||
              variant.title
            ),

          price:
            money(
              variant.price
            ),

          compareAtPrice:
            money(
              variant.compareAtPrice
            ),

          available:
            variant.available !==
            false,

          quantity:
            variant.quantity !==
              undefined
              ? Math.max(
                  0,
                  Math.floor(
                    toNumber(
                      variant.quantity,
                      0
                    )
                  )
                )
              : null
        };
      }
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   ADD-ONS
========================================================= */

function normalizeAddons(
  addons
) {
  return safeArray(
    addons
  )
    .map(
      addon => {

        if (
          !addon ||
          typeof addon !==
            "object"
        ) {

          return null;
        }


        return {

          id:
            normalizeId(
              addon.id ||
              addon.addonId
            ),

          name:
            cleanText(
              addon.name ||
              addon.title
            ),

          price:
            money(
              addon.price
            ),

          required:
            toBoolean(
              addon.required,
              false
            ),

          available:
            addon.available !==
            false
        };
      }
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   PRODUCT NORMALIZATION
========================================================= */

function normalizeProduct(
  product = {}
) {
  const id =
    normalizeId(
      product.id ||
      product.productId ||
      product.itemId
    );


  if (
    !id
  ) {

    throw new Error(
      "Product ID is required."
    );
  }


  const regularPrice =
    money(
      product.price ??
      product.unitPrice
    );


  const surplusPrice =
    money(
      product.surplusPrice ??
      product.salePrice ??
      product.discountedPrice ??
      regularPrice
    );


  const compareAtPrice =
    money(
      product.compareAtPrice ??
      product.originalPrice ??
      regularPrice
    );


  const quantity =
    product.quantity !==
      undefined &&
    product.quantity !==
      null
      ? Math.max(
          0,
          Math.floor(
            toNumber(
              product.quantity,
              0
            )
          )
        )
      : null;


  const status =
    cleanText(
      product.status
    ).toLowerCase() ||
    PRODUCT_STATUS.ACTIVE;


  const categories =
    normalizeCategories(
      product
    );


  const images =
    normalizeImages(
      product
    );


  const variants =
    normalizeVariants(
      product.variants
    );


  const addons =
    normalizeAddons(
      product.addons ||
      product.addOns
    );


  const expiresAt =
    normalizeDate(
      product.expiresAt ||
      product.expiryAt ||
      product.expiryDate
    );


  const createdAt =
    normalizeDate(
      product.createdAt
    );


  const updatedAt =
    normalizeDate(
      product.updatedAt
    );


  const shopId =
    normalizeId(
      product.shopId ||
      product.storeId ||
      product.vendorId
    );


  const available =
    product.available !==
      false &&
    status ===
      PRODUCT_STATUS.ACTIVE &&
    (
      quantity ===
        null ||
      quantity >
        0
    );


  return {

    id,

    productId:
      id,

    shopId,

    shopName:
      cleanText(
        product.shopName ||
        product.storeName ||
        product.vendorName
      ),

    name:
      cleanText(
        product.name ||
        product.title
      ) ||
      "Product",

    description:
      cleanText(
        product.description
      ),

    shortDescription:
      cleanText(
        product.shortDescription
      ),

    category:
      categories[0] ||
      "",

    categories,

    imageUrl:
      images[0] ||
      null,

    images,

    price:
      regularPrice,

    surplusPrice,

    salePrice:
      surplusPrice,

    compareAtPrice,

    discountAmount:
      money(
        Math.max(
          0,
          compareAtPrice -
            surplusPrice
        )
      ),

    discountPercent:
      compareAtPrice >
      0
        ? Math.round(
            (
              (
                compareAtPrice -
                surplusPrice
              ) /
              compareAtPrice
            ) *
              100
          )
        : 0,

    quantity,

    stock:
      quantity,

    unit:
      cleanText(
        product.unit
      ),

    status,

    available,

    isFeatured:
      toBoolean(
        product.isFeatured ||
        product.featured,
        false
      ),

    isSurplus:
      product.isSurplus !==
        false,

    variants,

    addons,

    tags:
      safeArray(
        product.tags
      )
        .map(
          tag =>
            cleanText(
              String(tag)
            )
        )
        .filter(
          Boolean
        ),

    allergens:
      safeArray(
        product.allergens
      )
        .map(
          item =>
            cleanText(
              String(item)
            )
        )
        .filter(
          Boolean
        ),

    vegetarian:
      product.vegetarian !==
        false,

    expiresAt,

    createdAt,

    updatedAt,

    metadata:
      product.metadata &&
      typeof product.metadata ===
        "object"
        ? {
            ...product.metadata
          }
        : {}
  };
}


/* =========================================================
   NORMALIZE MANY
========================================================= */

function normalizeProducts(
  products
) {
  return safeArray(
    products
  )
    .map(
      product => {

        try {

          return normalizeProduct(
            product
          );

        } catch {

          return null;
        }
      }
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   REPLACE PRODUCTS
========================================================= */

function setProducts(
  products,
  {
    append =
      false
  } = {}
) {
  const normalized =
    normalizeProducts(
      products
    );


  if (
    append
  ) {

    const existing =
      new Map(
        state.products.map(
          product => [
            product.id,
            product
          ]
        )
      );


    normalized.forEach(
      product => {

        existing.set(
          product.id,
          product
        );
      }
    );


    state.products =
      Array.from(
        existing.values()
      );

  } else {

    state.products =
      normalized;
  }


  /*
   * Refresh product cache.
   */

  state.products.forEach(
    product => {

      state.cache.set(
        product.id,
        product
      );
    }
  );


  state.lastUpdatedAt =
    new Date();


  state.error =
    null;


  emit(
    PRODUCT_EVENTS.UPDATED,
    {
      products:
        state.products
    }
  );


  emit(
    PRODUCT_EVENTS.CACHE_UPDATED,
    {
      size:
        state.cache.size
    }
  );


  return getProducts();
}


/* =========================================================
   ADD PRODUCTS
========================================================= */

function addProducts(
  products
) {
  return setProducts(
    products,
    {
      append:
        true
    }
  );
}


/* =========================================================
   GET PRODUCTS
========================================================= */

function getProducts() {
  return state.products.map(
    product => ({
      ...product,

      categories:
        [
          ...product.categories
        ],

      images:
        [
          ...product.images
        ],

      variants:
        product.variants.map(
          variant => ({
            ...variant
          })
        ),

      addons:
        product.addons.map(
          addon => ({
            ...addon
          })
        )
    })
  );
}


/* =========================================================
   GET PRODUCT
========================================================= */

function getProduct(
  productId
) {
  const id =
    normalizeId(
      productId
    );


  if (
    !id
  ) {
    return null;
  }


  return (
    state.cache.get(
      id
    ) ||
    state.products.find(
      product =>
        product.id ===
        id
    ) ||
    null
  );
}


/* =========================================================
   SELECT PRODUCT
========================================================= */

function selectProduct(
  productId
) {
  const product =
    getProduct(
      productId
    );


  if (
    !product
  ) {

    state.selectedProductId =
      null;

    return null;
  }


  state.selectedProductId =
    product.id;


  emit(
    PRODUCT_EVENTS.SELECTED,
    {
      product
    }
  );


  return product;
}


/* =========================================================
   GET SELECTED
========================================================= */

function getSelectedProduct() {
  if (
    !state.selectedProductId
  ) {
    return null;
  }


  return getProduct(
    state.selectedProductId
  );
}


/* =========================================================
   SHOP PRODUCTS
========================================================= */

function getShopProducts(
  shopId,
  {
    includeUnavailable =
      false
  } = {}
) {
  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {
    return [];
  }


  const products =
    state.products.filter(
      product =>
        product.shopId ===
        id
    );


  if (
    includeUnavailable
  ) {

    return products;
  }


  return products.filter(
    product =>
      product.available
  );
}


/* =========================================================
   CATEGORY PRODUCTS
========================================================= */

function getCategoryProducts(
  category,
  {
    includeUnavailable =
      false
  } = {}
) {
  const normalized =
    cleanText(
      category
    ).toLowerCase();


  if (
    !normalized
  ) {
    return [];
  }


  return state.products.filter(
    product => {

      if (
        !includeUnavailable &&
        !product.available
      ) {
        return false;
      }


      return product.categories.some(
        item =>
          item
            .toLowerCase() ===
          normalized
      );
    }
  );
}


/* =========================================================
   CATEGORIES
========================================================= */

function getCategories(
  {
    onlyAvailable =
      true
  } = {}
) {
  const categories =
    new Map();


  state.products.forEach(
    product => {

      if (
        onlyAvailable &&
        !product.available
      ) {
        return;
      }


      product.categories.forEach(
        category => {

          const key =
            category
              .trim()
              .toLowerCase();


          if (
            !key
          ) {
            return;
          }


          if (
            !categories.has(
              key
            )
          ) {

            categories.set(
              key,
              category
            );
          }
        }
      );
    }
  );


  return Array.from(
    categories.values()
  ).sort(
    (
      a,
      b
    ) =>
      a.localeCompare(
        b
      )
  );
}


/* =========================================================
   SEARCH
========================================================= */

function searchProducts(
  query,
  {
    shopId =
      null,

    category =
      null,

    availableOnly =
      true,

    limit =
      null
  } = {}
) {
  const search =
    cleanText(
      query
    ).toLowerCase();


  const normalizedShopId =
    normalizeId(
      shopId
    );


  const normalizedCategory =
    cleanText(
      category
    ).toLowerCase();


  let results =
    state.products.filter(
      product => {

        if (
          availableOnly &&
          !product.available
        ) {
          return false;
        }


        if (
          normalizedShopId &&
          product.shopId !==
            normalizedShopId
        ) {

          return false;
        }


        if (
          normalizedCategory &&
          !product.categories.some(
            item =>
              item
                .toLowerCase() ===
              normalizedCategory
          )
        ) {

          return false;
        }


        if (
          !search
        ) {
          return true;
        }


        const haystack =
          [
            product.name,

            product.description,

            product.shortDescription,

            product.shopName,

            ...product.categories,

            ...product.tags
          ]
            .join(
              " "
            )
            .toLowerCase();


        return haystack.includes(
          search
        );
      }
    );


  /*
   * Search relevance:
   * exact name > starts with > contains.
   */

  if (
    search
  ) {

    results.sort(
      (
        a,
        b
      ) => {

        const aName =
          a.name.toLowerCase();

        const bName =
          b.name.toLowerCase();


        const aExact =
          aName ===
          search
            ? 0
            : 1;


        const bExact =
          bName ===
          search
            ? 0
            : 1;


        if (
          aExact !==
          bExact
        ) {

          return (
            aExact -
            bExact
          );
        }


        const aStart =
          aName.startsWith(
            search
          )
            ? 0
            : 1;


        const bStart =
          bName.startsWith(
            search
          )
            ? 0
            : 1;


        return (
          aStart -
          bStart
        );
      }
    );
  }


  if (
    Number.isFinite(
      Number(
        limit
      )
    ) &&
    Number(
      limit
    ) >
      0
  ) {

    results =
      results.slice(
        0,
        Math.floor(
          Number(
            limit
          )
        )
      );
  }


  state.lastQuery =
    search;


  return results;
}


/* =========================================================
   FILTER
========================================================= */

function filterProducts(
  {
    shopId =
      null,

    category =
      null,

    minPrice =
      null,

    maxPrice =
      null,

    availableOnly =
      true,

    featuredOnly =
      false,

    surplusOnly =
      false,

    vegetarianOnly =
      false,

    query =
      ""
  } = {}
) {
  const normalizedShopId =
    normalizeId(
      shopId
    );


  const normalizedCategory =
    cleanText(
      category
    ).toLowerCase();


  const minimum =
    minPrice !==
      null &&
    minPrice !==
      undefined
      ? Math.max(
          0,
          toNumber(
            minPrice,
            0
          )
        )
      : null;


  const maximum =
    maxPrice !==
      null &&
    maxPrice !==
      undefined
      ? Math.max(
          0,
          toNumber(
            maxPrice,
            0
          )
        )
      : null;


  const search =
    cleanText(
      query
    ).toLowerCase();


  const results =
    state.products.filter(
      product => {

        if (
          availableOnly &&
          !product.available
        ) {
          return false;
        }


        if (
          normalizedShopId &&
          product.shopId !==
            normalizedShopId
        ) {
          return false;
        }


        if (
          normalizedCategory &&
          !product.categories.some(
            item =>
              item
                .toLowerCase() ===
              normalizedCategory
          )
        ) {
          return false;
        }


        if (
          minimum !==
            null &&
          product.surplusPrice <
            minimum
        ) {
          return false;
        }


        if (
          maximum !==
            null &&
          product.surplusPrice >
            maximum
        ) {
          return false;
        }


        if (
          featuredOnly &&
          !product.isFeatured
        ) {
          return false;
        }


        if (
          surplusOnly &&
          !product.isSurplus
        ) {
          return false;
        }


        if (
          vegetarianOnly &&
          !product.vegetarian
        ) {
          return false;
        }


        if (
          search
        ) {

          const haystack =
            [
              product.name,

              product.description,

              product.shopName,

              ...product.categories,

              ...product.tags
            ]
              .join(
                " "
              )
              .toLowerCase();


          if (
            !haystack.includes(
              search
            )
          ) {

            return false;
          }
        }


        return true;
      }
    );


  state.lastFilters = {

    shopId:
      normalizedShopId,

    category:
      normalizedCategory,

    minPrice:
      minimum,

    maxPrice:
      maximum,

    availableOnly,

    featuredOnly,

    surplusOnly,

    vegetarianOnly,

    query:
      search
  };


  return results;
}


/* =========================================================
   SORT
========================================================= */

function sortProducts(
  products,
  sort =
    "recommended"
) {
  const list =
    safeArray(
      products
    ).slice();


  switch (
    cleanText(
      sort
    ).toLowerCase()
  ) {

    case "price_low":
    case "price-low":

      return list.sort(
        (
          a,
          b
        ) =>
          a.surplusPrice -
          b.surplusPrice
      );


    case "price_high":
    case "price-high":

      return list.sort(
        (
          a,
          b
        ) =>
          b.surplusPrice -
          a.surplusPrice
      );


    case "discount":

      return list.sort(
        (
          a,
          b
        ) =>
          b.discountPercent -
          a.discountPercent
      );


    case "newest":

      return list.sort(
        (
          a,
          b
        ) => {

          const aTime =
            a.createdAt
              ? a.createdAt.getTime()
              : 0;


          const bTime =
            b.createdAt
              ? b.createdAt.getTime()
              : 0;


          return (
            bTime -
            aTime
          );
        }
      );


    case "expiry":

      return list.sort(
        (
          a,
          b
        ) => {

          const aTime =
            a.expiresAt
              ? a.expiresAt.getTime()
              : Number.MAX_SAFE_INTEGER;


          const bTime =
            b.expiresAt
              ? b.expiresAt.getTime()
              : Number.MAX_SAFE_INTEGER;


          return (
            aTime -
            bTime
          );
        }
      );


    case "recommended":
    default:

      return list.sort(
        (
          a,
          b
        ) => {

          if (
            a.isFeatured !==
            b.isFeatured
          ) {

            return a.isFeatured
              ? -1
              : 1;
          }


          if (
            a.discountPercent !==
            b.discountPercent
          ) {

            return (
              b.discountPercent -
              a.discountPercent
            );
          }


          return a.name.localeCompare(
            b.name
          );
        }
      );
  }
}


/* =========================================================
   PAGINATION
========================================================= */

function paginateProducts(
  products,
  {
    page =
      1,

    pageSize =
      DEFAULT_PAGE_SIZE
  } = {}
) {
  const safePage =
    Math.max(
      1,
      Math.floor(
        toNumber(
          page,
          1
        )
      )
    );


  const safePageSize =
    Math.max(
      1,
      Math.floor(
        toNumber(
          pageSize,
          DEFAULT_PAGE_SIZE
        )
      )
    );


  const total =
    safeArray(
      products
    ).length;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
        safePageSize
      )
    );


  const currentPage =
    Math.min(
      safePage,
      totalPages
    );


  const start =
    (
      currentPage -
      1
    ) *
    safePageSize;


  return {

    products:
      safeArray(
        products
      ).slice(
        start,
        start +
          safePageSize
      ),

    page:
      currentPage,

    pageSize:
      safePageSize,

    total,

    totalPages,

    hasNext:
      currentPage <
      totalPages,

    hasPrevious:
      currentPage >
      1
  };
}


/* =========================================================
   PRICE RANGE
========================================================= */

function getPriceRange(
  products =
    state.products
) {
  const available =
    safeArray(
      products
    ).filter(
      product =>
        Number.isFinite(
          Number(
            product.surplusPrice
          )
        )
    );


  if (
    available.length ===
    0
  ) {

    return {

      min:
        0,

      max:
        0
    };
  }


  const prices =
    available.map(
      product =>
        product.surplusPrice
    );


  return {

    min:
      Math.min(
        ...prices
      ),

    max:
      Math.max(
        ...prices
      )
  };
}


/* =========================================================
   EXPIRING PRODUCTS
========================================================= */

function getExpiringProducts(
  {
    withinHours =
      24,

    shopId =
      null
  } = {}
) {
  const now =
    Date.now();


  const limit =
    now +
    Math.max(
      1,
      toNumber(
        withinHours,
        24
      )
    ) *
      60 *
      60 *
      1000;


  const normalizedShopId =
    normalizeId(
      shopId
    );


  return state.products.filter(
    product => {

      if (
        !product.available ||
        !product.expiresAt
      ) {
        return false;
      }


      if (
        normalizedShopId &&
        product.shopId !==
          normalizedShopId
      ) {
        return false;
      }


      const expiry =
        product.expiresAt.getTime();


      return (
        expiry >
          now &&
        expiry <=
          limit
      );
    }
  );
}


/* =========================================================
   AVAILABILITY
========================================================= */

function isProductAvailable(
  productId
) {
  const product =
    getProduct(
      productId
    );


  if (
    !product
  ) {
    return false;
  }


  if (
    !product.available
  ) {
    return false;
  }


  if (
    product.expiresAt &&
    product.expiresAt.getTime() <=
      Date.now()
  ) {

    return false;
  }


  if (
    product.quantity !==
      null &&
    product.quantity <=
      0
  ) {

    return false;
  }


  return true;
}


/* =========================================================
   STOCK CHECK
========================================================= */

function canPurchase(
  productId,
  quantity =
    1
) {
  const product =
    getProduct(
      productId
    );


  if (
    !product ||
    !isProductAvailable(
      productId
    )
  ) {

    return {

      allowed:
        false,

      reason:
        "Product is unavailable."
    };
  }


  const requested =
    Math.max(
      1,
      Math.floor(
        toNumber(
          quantity,
          1
        )
      )
    );


  if (
    product.quantity !==
      null &&
    requested >
      product.quantity
  ) {

    return {

      allowed:
        false,

      reason:
        `Only ${product.quantity} item(s) available.`,

      availableQuantity:
        product.quantity
    };
  }


  return {

    allowed:
      true,

    availableQuantity:
      product.quantity
  };
}


/* =========================================================
   PRODUCT PRICE
========================================================= */

function getCurrentDisplayPrice(
  productId
) {
  const product =
    getProduct(
      productId
    );


  if (
    !product
  ) {
    return 0;
  }


  return money(
    product.surplusPrice
  );
}


/* =========================================================
   PRODUCT SUMMARY
========================================================= */

function getProductSummary(
  productId
) {
  const product =
    getProduct(
      productId
    );


  if (
    !product
  ) {
    return null;
  }


  return {

    id:
      product.id,

    name:
      product.name,

    imageUrl:
      product.imageUrl,

    price:
      product.surplusPrice,

    compareAtPrice:
      product.compareAtPrice,

    discountPercent:
      product.discountPercent,

    shopId:
      product.shopId,

    shopName:
      product.shopName,

    available:
      product.available,

    quantity:
      product.quantity
  };
}


/* =========================================================
   SHOP CACHE
========================================================= */

function cacheShopProducts(
  shopId,
  products
) {
  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {
    return false;
  }


  const normalized =
    normalizeProducts(
      products
    );


  state.shopCache.set(
    id,
    normalized
  );


  normalized.forEach(
    product => {

      state.cache.set(
        product.id,
        product
      );
    }
  );


  return true;
}


/* =========================================================
   GET CACHED SHOP PRODUCTS
========================================================= */

function getCachedShopProducts(
  shopId
) {
  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {
    return [];
  }


  return (
    state.shopCache.get(
      id
    ) ||
    []
  );
}


/* =========================================================
   CLEAR CACHE
========================================================= */

function clearCache() {
  state.cache.clear();

  state.shopCache.clear();


  emit(
    PRODUCT_EVENTS.CACHE_UPDATED,
    {
      size:
        0
    }
  );


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
    return false;
  }


  const before =
    state.products.length;


  state.products =
    state.products.filter(
      product =>
        product.id !==
        id
    );


  state.cache.delete(
    id
  );


  if (
    state.selectedProductId ===
      id
  ) {

    state.selectedProductId =
      null;
  }


  return (
    state.products.length <
    before
  );
}


/* =========================================================
   UPDATE PRODUCT
========================================================= */

function updateProduct(
  productId,
  updates = {}
) {
  const id =
    normalizeId(
      productId
    );


  if (
    !id
  ) {
    return null;
  }


  const current =
    getProduct(
      id
    );


  if (
    !current
  ) {
    return null;
  }


  const updated =
    normalizeProduct(
      {
        ...current,

        ...updates,

        id
      }
    );


  const index =
    state.products.findIndex(
      product =>
        product.id ===
        id
    );


  if (
    index >=
    0
  ) {

    state.products[
      index
    ] =
      updated;
  }


  state.cache.set(
    id,
    updated
  );


  state.lastUpdatedAt =
    new Date();


  emit(
    PRODUCT_EVENTS.UPDATED,
    {
      products:
        getProducts(),

      product:
        updated
    }
  );


  return updated;
}


/* =========================================================
   LOADING STATE
========================================================= */

function setLoading(
  loading
) {
  state.loading =
    Boolean(
      loading
    );


  emitUpdate();


  return state.loading;
}


/* =========================================================
   ERROR
========================================================= */

function setError(
  error
) {
  state.error =
    error instanceof
      Error
      ? error.message
      : cleanText(
          String(
            error ||
            ""
          )
        );


  emit(
    PRODUCT_EVENTS.ERROR,
    {
      error:
        state.error
    }
  );


  return state.error;
}


/* =========================================================
   LOAD WITH FETCHER
========================================================= */

async function loadProducts(
  fetcher,
  {
    append =
      false
  } = {}
) {
  if (
    typeof fetcher !==
    "function"
  ) {

    throw new Error(
      "Product fetcher function is required."
    );
  }


  state.loading =
    true;

  state.error =
    null;


  emitUpdate();


  try {

    const result =
      await fetcher();


    /*
     * Accept common API shapes.
     */

    const products =
      Array.isArray(
        result
      )
        ? result
        : Array.isArray(
            result?.products
          )
          ? result.products
          : Array.isArray(
              result?.data
            )
            ? result.data
            : [];


    setProducts(
      products,
      {
        append
      }
    );


    state.loading =
      false;

    state.lastUpdatedAt =
      new Date();


    emit(
      PRODUCT_EVENTS.LOADED,
      {
        products:
          getProducts(),

        result
      }
    );


    emitUpdate();


    return getProducts();

  } catch (
    error
  ) {

    state.loading =
      false;

    setError(
      error
    );


    emitUpdate();


    throw error;

  }
}


/* =========================================================
   LOAD SHOP PRODUCTS
========================================================= */

async function loadShopProducts(
  shopId,
  fetcher,
  {
    append =
      false
  } = {}
) {
  const id =
    normalizeId(
      shopId
    );


  if (
    !id
  ) {

    throw new Error(
      "Shop ID is required."
    );
  }


  if (
    typeof fetcher !==
    "function"
  ) {

    throw new Error(
      "Shop product fetcher function is required."
    );
  }


  state.loading =
    true;

  state.error =
    null;


  emitUpdate();


  try {

    const result =
      await fetcher(
        id
      );


    const products =
      Array.isArray(
        result
      )
        ? result
        : Array.isArray(
            result?.products
          )
          ? result.products
          : Array.isArray(
              result?.data
            )
            ? result.data
            : [];


    cacheShopProducts(
      id,
      products
    );


    setProducts(
      products,
      {
        append
      }
    );


    state.loading =
      false;

    state.lastUpdatedAt =
      new Date();


    emit(
      PRODUCT_EVENTS.LOADED,
      {
        shopId:
          id,

        products:
          normalizeProducts(
            products
          )
      }
    );


    emitUpdate();


    return normalizeProducts(
      products
    );

  } catch (
    error
  ) {

    state.loading =
      false;

    setError(
      error
    );


    emitUpdate();


    throw error;
  }
}


/* =========================================================
   INITIALIZE
========================================================= */

function initializeProducts(
  {
    products =
      []
  } = {}
) {
  state.initialized =
    true;

  state.error =
    null;


  if (
    Array.isArray(
      products
    ) &&
    products.length
  ) {

    setProducts(
      products
    );
  }


  state.lastUpdatedAt =
    new Date();


  emitUpdate();


  return getProducts();
}


/* =========================================================
   STATE
========================================================= */

function getState() {
  return {

    initialized:
      state.initialized,

    loading:
      state.loading,

    error:
      state.error,

    productCount:
      state.products.length,

    selectedProductId:
      state.selectedProductId,

    lastQuery:
      state.lastQuery,

    lastFilters:
      {
        ...state.lastFilters
      },

    lastUpdatedAt:
      state.lastUpdatedAt
  };
}


/* =========================================================
   RESET
========================================================= */

function resetProducts() {
  state.products =
    [];

  state.cache.clear();

  state.shopCache.clear();

  state.selectedProductId =
    null;

  state.lastQuery =
    "";

  state.lastFilters =
    {};

  state.lastUpdatedAt =
    new Date();

  state.error =
    null;

  state.loading =
    false;


  emitUpdate();


  return true;
}


/* =========================================================
   DESTROY
========================================================= */

function destroyProducts() {
  resetProducts();

  state.initialized =
    false;
}


/* =========================================================
   EMIT UPDATE
========================================================= */

function emitUpdate() {
  emit(
    PRODUCT_EVENTS.UPDATED,
    {
      products:
        getProducts(),

      state:
        getState()
    }
  );
}


/* =========================================================
   EXPORT
========================================================= */

export {

  PRODUCT_STATUS,

  PRODUCT_EVENTS,

  DEFAULT_PAGE_SIZE,

  normalizeProduct,

  normalizeProducts,

  setProducts,

  addProducts,

  getProducts,

  getProduct,

  selectProduct,

  getSelectedProduct,

  getShopProducts,

  getCategoryProducts,

  getCategories,

  searchProducts,

  filterProducts,

  sortProducts,

  paginateProducts,

  getPriceRange,

  getExpiringProducts,

  isProductAvailable,

  canPurchase,

  getCurrentDisplayPrice,

  getProductSummary,

  cacheShopProducts,

  getCachedShopProducts,

  clearCache,

  removeProduct,

  updateProduct,

  setLoading,

  setError,

  loadProducts,

  loadShopProducts,

  initializeProducts,

  getState,

  resetProducts,

  destroyProducts

};
