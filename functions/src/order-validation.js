"use strict";

const SOURCE = "static-storefront";
const INITIAL_STATUS = "needs_review";
const MAX_ITEM_QUANTITY = 50;
const MIN_SUBTOTAL_CENTS = 1795;
const MAX_SUBTOTAL_CENTS = 84000;
const SCHEMA_VERSION = "2026-06-28";

const PRODUCT_CATALOG = Object.freeze({
  "ear-corn-20lb": Object.freeze({
    name: "20 lb Ear Corn Bag",
    sku: "ear-corn-20lb",
    unitPriceCents: 1795,
  }),
  "ear-corn-40lb": Object.freeze({
    name: "40 lb Ear Corn Bag",
    sku: "ear-corn-40lb",
    unitPriceCents: 2995,
  }),
});

const CONTACT_METHODS = Object.freeze({
  email: "email",
  phone: "phone",
  "phone call": "phone",
  text: "text",
  "text message": "text",
});

const ORDER_DRAFT_FIELDS = Object.freeze([
  "customer",
  "items",
  "source",
  "status",
  "subtotalCents",
]);

const CUSTOMER_FIELDS = Object.freeze([
  "contact",
  "name",
  "note",
  "preferredContact",
  "shippingZip",
]);

const ITEM_FIELDS = Object.freeze([
  "name",
  "quantity",
  "sku",
  "unitPriceCents",
]);

const TRUSTED_ORDER_FIELDS = Object.freeze([
  "checkoutCompletedAt",
  "checkoutCreatedAt",
  "checkoutErrorCode",
  "checkoutStatus",
  "createdAt",
  "deliveredAt",
  "fulfillmentStatus",
  "lastStripeEventAt",
  "lastStripeEventId",
  "packedAt",
  "paidAt",
  "paymentStatus",
  "readyToPackAt",
  "refundedAt",
  "shippedAt",
  "shippingAddress",
  "shippingAmountCents",
  "shippingCarrier",
  "shippingCurrency",
  "shippingDurationTerms",
  "shippingEstimatedDays",
  "shippingPackageCount",
  "shippingPackageRateIds",
  "shippingRateId",
  "shippingService",
  "stripeCheckoutSessionId",
  "stripeCustomerId",
  "stripePaymentIntentId",
  "stripePaymentStatus",
  "trustedUpdatedAt",
]);

function cleanText(value) {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findUnexpectedKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return [];
  return Object.keys(value).filter((key) => !allowedKeys.includes(key));
}

function findTrustedFields(value) {
  if (!isPlainObject(value)) return [];
  return TRUSTED_ORDER_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function normalizePreferredContact(value) {
  return CONTACT_METHODS[cleanText(value).toLowerCase()] || "";
}

function normalizeCustomer(customer) {
  const normalized = {
    name: cleanText(customer && customer.name),
    contact: cleanText(customer && customer.contact),
    preferredContact: normalizePreferredContact(customer && customer.preferredContact),
    shippingZip: cleanText(customer && customer.shippingZip),
  };

  const note = cleanText(customer && customer.note);
  if (note) {
    normalized.note = note;
  }

  return normalized;
}

function validateCustomer(customer) {
  const errors = [];

  if (!isPlainObject(customer)) {
    return ["Customer details are required before requesting checkout."];
  }

  const unexpectedFields = findUnexpectedKeys(customer, CUSTOMER_FIELDS);
  if (unexpectedFields.length) {
    errors.push("Customer details include unsupported fields.");
  }

  const normalized = normalizeCustomer(customer);

  if (!normalized.name || !normalized.contact || !normalized.shippingZip || !normalized.preferredContact) {
    errors.push("Name, contact info, shipping ZIP, and preferred contact method are required.");
  }

  if (normalized.name.length > 120) {
    errors.push("Customer name must be 120 characters or fewer.");
  }

  if (normalized.contact.length < 3 || normalized.contact.length > 160) {
    errors.push("Customer contact must be between 3 and 160 characters.");
  }

  if (!/^\d{5}$/.test(normalized.shippingZip)) {
    errors.push("Shipping ZIP must be a 5-digit ZIP code.");
  }

  if (!["email", "phone", "text"].includes(normalized.preferredContact)) {
    errors.push("Preferred contact must be email, phone, or text.");
  }

  if (normalized.note && normalized.note.length > 1000) {
    errors.push("Order note must be 1000 characters or fewer.");
  }

  return errors;
}

function normalizeItem(item) {
  if (!isPlainObject(item)) {
    return {
      error: "Each item must be a product object.",
    };
  }

  const unexpectedFields = findUnexpectedKeys(item, ITEM_FIELDS);
  if (unexpectedFields.length) {
    return {
      error: "Cart items include unsupported fields.",
    };
  }

  const sku = cleanText(item.sku);
  const catalogItem = PRODUCT_CATALOG[sku];
  if (!catalogItem) {
    return {
      error: "Cart includes an unsupported product.",
    };
  }

  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
    return {
      error: "Quantity must be an integer from 1 through 50 per product.",
    };
  }

  if (item.name !== catalogItem.name || item.unitPriceCents !== catalogItem.unitPriceCents) {
    return {
      error: "Cart item names and prices must match the current Theo's Farm catalog.",
    };
  }

  return {
    item: {
      name: catalogItem.name,
      sku: catalogItem.sku,
      quantity,
      unitPriceCents: catalogItem.unitPriceCents,
    },
  };
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 2) {
    return {
      errors: ["Cart must include one or two supported Theo's Farm products."],
      items: [],
    };
  }

  const errors = [];
  const normalizedItems = [];

  for (const item of items) {
    const result = normalizeItem(item);
    if (result.error) {
      errors.push(result.error);
      continue;
    }

    normalizedItems.push(result.item);
  }

  return {
    errors,
    items: normalizedItems,
  };
}

function calculateSubtotalCents(items) {
  return items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
}

function validateOrderRequestDraft(orderRequest) {
  const errors = [];

  if (!isPlainObject(orderRequest)) {
    return {
      ok: false,
      errors: ["Order request payload is required."],
    };
  }

  const trustedFields = findTrustedFields(orderRequest);
  if (trustedFields.length) {
    errors.push("Order request includes fields reserved for trusted backend or webhook code.");
  }

  const unexpectedFields = findUnexpectedKeys(orderRequest, ORDER_DRAFT_FIELDS.concat(TRUSTED_ORDER_FIELDS));
  if (unexpectedFields.length) {
    errors.push("Order request includes unsupported fields.");
  }

  if (orderRequest.source !== SOURCE) {
    errors.push("Order source must be static-storefront.");
  }

  if (orderRequest.status !== INITIAL_STATUS) {
    errors.push("Initial order status must be needs_review.");
  }

  const itemResult = validateItems(orderRequest.items);
  errors.push(...itemResult.errors);

  const customerErrors = validateCustomer(orderRequest.customer);
  errors.push(...customerErrors);

  const subtotalCents = calculateSubtotalCents(itemResult.items);
  if (!Number.isInteger(orderRequest.subtotalCents) || orderRequest.subtotalCents !== subtotalCents) {
    errors.push("Order subtotal must match the server-side catalog calculation.");
  }

  if (subtotalCents < MIN_SUBTOTAL_CENTS || subtotalCents > MAX_SUBTOTAL_CENTS) {
    errors.push("Order subtotal is outside the supported checkout range.");
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    orderRequest: {
      source: SOURCE,
      status: INITIAL_STATUS,
      subtotalCents,
      items: itemResult.items,
      customer: normalizeCustomer(orderRequest.customer),
    },
  };
}

function buildItemsSummary(items) {
  return items.map((item) => `${item.sku}:${item.quantity}`).join(",");
}

function buildStripeMetadata(orderRequest, orderRequestId) {
  return {
    orderRequestId: String(orderRequestId),
    source: SOURCE,
    storefront: "theos-farm",
    schemaVersion: SCHEMA_VERSION,
    subtotalCents: String(orderRequest.subtotalCents),
    itemsSummary: buildItemsSummary(orderRequest.items),
    shippingZip: orderRequest.customer.shippingZip,
  };
}

function withoutUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
}

function buildTrustedOrderRequestForCreate(orderRequest, options = {}) {
  const serverTimestamp = options.serverTimestamp || "FIRESTORE_SERVER_TIMESTAMP_REQUIRED";
  const shippingSelection = options.shippingSelection || {};
  const shippingFields = shippingSelection.rate ? withoutUndefinedFields({
    shippingAddress: shippingSelection.shippingAddress,
    shippingRateId: shippingSelection.rate.rateId,
    shippingCarrier: shippingSelection.rate.provider,
    shippingService: shippingSelection.rate.serviceName,
    shippingAmountCents: shippingSelection.rate.amountCents,
    shippingCurrency: shippingSelection.rate.currency,
    shippingEstimatedDays: shippingSelection.rate.estimatedDays,
    shippingDurationTerms: shippingSelection.rate.durationTerms,
    shippingPackageRateIds: shippingSelection.rate.packageRateIds,
    shippingPackageCount: shippingSelection.rate.packageCount,
  }) : {};

  return {
    ...orderRequest,
    ...shippingFields,
    createdAt: serverTimestamp,
    paymentStatus: "unpaid",
    checkoutStatus: "open",
    checkoutCreatedAt: serverTimestamp,
    trustedUpdatedAt: serverTimestamp,
  };
}

module.exports = {
  INITIAL_STATUS,
  MAX_ITEM_QUANTITY,
  MAX_SUBTOTAL_CENTS,
  PRODUCT_CATALOG,
  SOURCE,
  TRUSTED_ORDER_FIELDS,
  buildItemsSummary,
  buildStripeMetadata,
  buildTrustedOrderRequestForCreate,
  calculateSubtotalCents,
  findTrustedFields,
  validateOrderRequestDraft,
};
