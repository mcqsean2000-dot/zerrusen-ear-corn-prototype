"use strict";

const {
  PRODUCT_CATALOG,
  validateOrderRequestDraft,
} = require("./order-validation");

const SHIP_FROM_ZIP = "62467";
const SHIP_FROM_STATE = "IL";
const RATE_CURRENCY = "USD";
const MAX_RATE_OPTIONS = 8;

const PACKAGE_CATALOG = Object.freeze({
  "ear-corn-20lb": Object.freeze({
    sku: "ear-corn-20lb",
    length: "29",
    width: "17",
    height: "5",
    distanceUnit: "in",
    weight: "22",
    massUnit: "lb",
  }),
  "ear-corn-40lb": Object.freeze({
    sku: "ear-corn-40lb",
    length: "32",
    width: "18",
    height: "8",
    distanceUnit: "in",
    weight: "42",
    massUnit: "lb",
  }),
});

const SHIPPING_ADDRESS_FIELDS = Object.freeze([
  "addressLine1",
  "addressLine2",
  "city",
  "estimateOnly",
  "state",
  "zip",
]);

const GROUND_SERVICE_PATTERNS = Object.freeze([
  /ground/i,
  /ground advantage/i,
  /priority mail/i,
  /surepost/i,
]);

const EXPRESS_SERVICE_PATTERNS = Object.freeze([
  /next day/i,
  /1 day/i,
  /one day/i,
  /2nd day/i,
  /2 day/i,
  /second day/i,
  /3 day/i,
  /three day/i,
  /express/i,
  /overnight/i,
  /air/i,
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

function normalizeState(value) {
  return cleanText(value).toUpperCase();
}

function normalizeShippingAddress(address) {
  const normalized = {
    addressLine1: cleanText(address && address.addressLine1),
    city: cleanText(address && address.city),
    state: normalizeState(address && address.state),
    zip: cleanText(address && address.zip),
  };

  const addressLine2 = cleanText(address && address.addressLine2);
  if (addressLine2) {
    normalized.addressLine2 = addressLine2;
  }

  return normalized;
}

function validateShippingAddress(address, options = {}) {
  const errors = [];
  const estimateOnly = options.estimateOnly === true;

  if (!isPlainObject(address)) {
    return {
      errors: ["Shipping address is required before calculating rates."],
      address: normalizeShippingAddress({}),
    };
  }

  const unexpectedFields = findUnexpectedKeys(address, SHIPPING_ADDRESS_FIELDS);
  if (unexpectedFields.length) {
    errors.push("Shipping address includes unsupported fields.");
  }

  const normalized = normalizeShippingAddress(address);

  if (estimateOnly) {
    if (!/^\d{5}$/.test(normalized.zip)) {
      errors.push("Shipping ZIP must be a 5-digit ZIP code.");
    }

    return {
      errors,
      address: normalized,
    };
  }

  if (!normalized.addressLine1 || !normalized.city || !normalized.state || !normalized.zip) {
    errors.push("Street address, city, state, and ZIP are required before calculating shipping.");
  }

  if (normalized.addressLine1.length > 140 || (normalized.addressLine2 && normalized.addressLine2.length > 140)) {
    errors.push("Shipping street address lines must be 140 characters or fewer.");
  }

  if (normalized.city.length > 80) {
    errors.push("Shipping city must be 80 characters or fewer.");
  }

  if (!/^[A-Z]{2}$/.test(normalized.state)) {
    errors.push("Shipping state must use a 2-letter state code.");
  }

  if (!/^\d{5}$/.test(normalized.zip)) {
    errors.push("Shipping ZIP must be a 5-digit ZIP code.");
  }

  return {
    errors,
    address: normalized,
  };
}

function buildParcels(items) {
  const parcels = [];

  for (const item of items) {
    const packageSpec = PACKAGE_CATALOG[item.sku];
    if (!packageSpec) {
      continue;
    }

    for (let index = 0; index < item.quantity; index += 1) {
      parcels.push({
        length: packageSpec.length,
        width: packageSpec.width,
        height: packageSpec.height,
        distance_unit: packageSpec.distanceUnit,
        weight: packageSpec.weight,
        mass_unit: packageSpec.massUnit,
        metadata: item.sku,
      });
    }
  }

  return parcels;
}

function normalizeShipFromAddress(address = {}) {
  return {
    name: cleanText(address.name) || "Theo's Farm",
    street1: cleanText(address.street1),
    street2: cleanText(address.street2),
    city: cleanText(address.city),
    state: normalizeState(address.state) || SHIP_FROM_STATE,
    zip: cleanText(address.zip) || SHIP_FROM_ZIP,
    country: "US",
  };
}

function buildShippoShipmentPayload({ orderRequest, shippingAddress, parcels, shipFromAddress }) {
  const normalizedShipFrom = normalizeShipFromAddress(shipFromAddress);
  const addressTo = {
    name: orderRequest.customer.name,
    zip: shippingAddress.zip,
    country: "US",
  };

  if (shippingAddress.addressLine1) addressTo.street1 = shippingAddress.addressLine1;
  if (shippingAddress.addressLine2) addressTo.street2 = shippingAddress.addressLine2;
  if (shippingAddress.city) addressTo.city = shippingAddress.city;
  if (shippingAddress.state) addressTo.state = shippingAddress.state;

  return {
    address_from: {
      name: normalizedShipFrom.name,
      street1: normalizedShipFrom.street1,
      street2: normalizedShipFrom.street2,
      city: normalizedShipFrom.city,
      state: normalizedShipFrom.state,
      zip: normalizedShipFrom.zip,
      country: normalizedShipFrom.country,
    },
    address_to: addressTo,
    parcels: parcels || buildParcels(orderRequest.items),
    async: false,
  };
}

function rateAmountCents(rate) {
  const amount = Number(rate && rate.amount);
  if (!Number.isFinite(amount)) {
    return null;
  }
  return Math.round(amount * 100);
}

function rateDurationTerms(rate) {
  const days = Number(rate && rate.estimated_days);
  if (!Number.isFinite(days) || days < 1) {
    return "";
  }
  return `${days} business day${days === 1 ? "" : "s"}`;
}

function rateServiceText(rate) {
  return `${cleanText(rate && rate.provider)} ${cleanText(rate && rate.servicelevel && rate.servicelevel.name)}`.trim();
}

function isExpressRate(rate) {
  const text = rateServiceText(rate);
  return EXPRESS_SERVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function isGroundLikeRate(rate) {
  const text = rateServiceText(rate);
  return GROUND_SERVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeShippoRate(rate) {
  const amountCents = rateAmountCents(rate);
  const currency = cleanText(rate && rate.currency).toUpperCase();
  const objectId = cleanText(rate && rate.object_id);
  const provider = cleanText(rate && rate.provider);
  const serviceName = cleanText(rate && rate.servicelevel && rate.servicelevel.name);
  const serviceToken = cleanText(rate && rate.servicelevel && rate.servicelevel.token);

  if (!objectId || !provider || !serviceName || !amountCents || currency !== RATE_CURRENCY) {
    return null;
  }

  return {
    rateId: objectId,
    provider,
    serviceName,
    serviceToken,
    amountCents,
    currency,
    estimatedDays: Number.isFinite(Number(rate.estimated_days)) ? Number(rate.estimated_days) : null,
    durationTerms: cleanText(rate.duration_terms) || rateDurationTerms(rate),
  };
}

function filterCustomerRates(rates) {
  const normalizedRates = (Array.isArray(rates) ? rates : [])
    .filter((rate) => !isExpressRate(rate))
    .map(normalizeShippoRate)
    .filter(Boolean)
    .sort((left, right) => left.amountCents - right.amountCents);

  const groundRates = normalizedRates.filter((rate) => {
    const rawRate = rates.find((candidate) => cleanText(candidate && candidate.object_id) === rate.rateId);
    return rawRate ? isGroundLikeRate(rawRate) : true;
  });

  return (groundRates.length ? groundRates : normalizedRates).slice(0, MAX_RATE_OPTIONS);
}

function combineMatchingPackageRates(packageRateGroups) {
  if (!packageRateGroups.length) {
    return [];
  }

  const combined = new Map();
  const firstGroup = packageRateGroups[0];

  for (const rate of firstGroup) {
    const key = `${rate.provider}|${rate.serviceToken || rate.serviceName}`;
    combined.set(key, {
      ...rate,
      rateId: key,
      amountCents: rate.amountCents,
      packageRateIds: [rate.rateId],
      packageCount: 1,
    });
  }

  for (const group of packageRateGroups.slice(1)) {
    const groupByKey = new Map(group.map((rate) => [`${rate.provider}|${rate.serviceToken || rate.serviceName}`, rate]));

    for (const [key, rate] of [...combined.entries()]) {
      const nextRate = groupByKey.get(key);
      if (!nextRate) {
        combined.delete(key);
        continue;
      }

      combined.set(key, {
        ...rate,
        amountCents: rate.amountCents + nextRate.amountCents,
        estimatedDays: Math.max(rate.estimatedDays || 0, nextRate.estimatedDays || 0) || null,
        durationTerms: rate.durationTerms || nextRate.durationTerms,
        packageRateIds: [...rate.packageRateIds, nextRate.rateId],
        packageCount: rate.packageCount + 1,
        rateId: key,
      });
    }
  }

  return [...combined.values()]
    .sort((left, right) => left.amountCents - right.amountCents)
    .slice(0, MAX_RATE_OPTIONS);
}

function getMissingShippingRateDependencies(dependencies = {}) {
  return [
    "createShippoShipment",
  ].filter((name) => typeof dependencies[name] !== "function");
}

function findSelectedShippingRate(rates, selectedShippingRate) {
  const selectedRateId = cleanText(
    selectedShippingRate && selectedShippingRate.rateId
      ? selectedShippingRate.rateId
      : selectedShippingRate,
  );

  if (!selectedRateId) {
    return null;
  }

  return (Array.isArray(rates) ? rates : []).find((rate) => rate.rateId === selectedRateId) || null;
}

async function createShippingRates({ orderRequestDraft, shippingAddress, createShippoShipment, shipFromAddress }) {
  if (typeof createShippoShipment !== "function") {
    const error = new Error("Shipping rates require a trusted Shippo shipment creator.");
    error.code = "shipping_rate_dependency_missing";
    throw error;
  }

  const orderValidation = validateOrderRequestDraft(orderRequestDraft);
  const addressValidation = validateShippingAddress(shippingAddress, {
    estimateOnly: shippingAddress && shippingAddress.estimateOnly === true,
  });
  const errors = [
    ...(!orderValidation.ok ? orderValidation.errors : []),
    ...addressValidation.errors,
  ];

  if (errors.length) {
    const error = new Error("Shipping rate request is invalid.");
    error.code = "invalid_shipping_rate_request";
    error.errors = errors;
    throw error;
  }

  const parcels = buildParcels(orderValidation.orderRequest.items);
  const packageRateGroups = [];

  for (const parcel of parcels) {
    const shipment = await createShippoShipment({
      payload: buildShippoShipmentPayload({
        orderRequest: orderValidation.orderRequest,
        shippingAddress: addressValidation.address,
        parcels: [parcel],
        shipFromAddress,
      }),
    });
    packageRateGroups.push(filterCustomerRates(shipment && shipment.rates));
  }

  const rates = combineMatchingPackageRates(packageRateGroups);

  if (!rates.length) {
    const error = new Error("Shippo returned no supported customer shipping rates.");
    error.code = "shipping_rates_unavailable";
    throw error;
  }

  return {
    shipFromZip: SHIP_FROM_ZIP,
    shippingAddress: addressValidation.address,
    packageCount: parcels.length,
    rates,
  };
}

module.exports = {
  PACKAGE_CATALOG,
  SHIP_FROM_STATE,
  SHIP_FROM_ZIP,
  buildParcels,
  buildShippoShipmentPayload,
  combineMatchingPackageRates,
  createShippingRates,
  findSelectedShippingRate,
  filterCustomerRates,
  getMissingShippingRateDependencies,
  normalizeShipFromAddress,
  validateShippingAddress,
};
