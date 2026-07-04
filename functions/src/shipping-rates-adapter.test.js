"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildParcels,
  buildShippoShipmentPayload,
  combineMatchingPackageRates,
  createShippingRates,
  filterCustomerRates,
  getMissingShippingRateDependencies,
  normalizeShipFromAddress,
  validateShippingAddress,
} = require("./shipping-rates-adapter");

const validOrderRequest = {
  source: "static-storefront",
  status: "needs_review",
  subtotalCents: 4790,
  items: [
    {
      name: "20 lb Ear Corn Bag",
      sku: "ear-corn-20lb",
      quantity: 1,
      unitPriceCents: 1795,
    },
    {
      name: "40 lb Ear Corn Bag",
      sku: "ear-corn-40lb",
      quantity: 1,
      unitPriceCents: 2995,
    },
  ],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    preferredContact: "email",
    shippingZip: "62401",
  },
};

const validAddress = {
  addressLine1: "123 Oak Street",
  addressLine2: "Dock 2",
  city: "Effingham",
  state: "il",
  zip: "62401",
};

function shippoRate(overrides = {}) {
  return {
    object_id: "rate_ground",
    provider: "UPS",
    servicelevel: {
      name: "Ground",
      token: "ups_ground",
    },
    amount: "18.42",
    currency: "USD",
    estimated_days: 2,
    duration_terms: "2 business days",
    ...overrides,
  };
}

test("validates and normalizes full shipping address", () => {
  const result = validateShippingAddress(validAddress);

  assert.deepEqual(result.errors, []);
  assert.equal(result.address.state, "IL");
  assert.equal(result.address.addressLine2, "Dock 2");
});

test("rejects incomplete or unsupported shipping address fields", () => {
  const result = validateShippingAddress({
    addressLine1: "",
    city: "Effingham",
    state: "Illinois",
    zip: "bad",
    country: "US",
  });

  assert(result.errors.length >= 3);
});

test("builds separate Shippo parcels for each ordered bag", () => {
  const parcels = buildParcels(validOrderRequest.items);

  assert.equal(parcels.length, 2);
  assert.deepEqual(parcels.map((parcel) => parcel.metadata), ["ear-corn-20lb", "ear-corn-40lb"]);
  assert.deepEqual(parcels[0], {
    length: "29",
    width: "17",
    height: "5",
    distance_unit: "in",
    weight: "22",
    mass_unit: "lb",
    metadata: "ear-corn-20lb",
  });
});

test("builds Shippo shipment payload with server-owned package specs", () => {
  const payload = buildShippoShipmentPayload({
    orderRequest: validOrderRequest,
    shippingAddress: validateShippingAddress(validAddress).address,
    shipFromAddress: {
      street1: "456 Farm Road",
      city: "Teutopolis",
      state: "IL",
      zip: "62467",
    },
  });

  assert.equal(payload.address_from.zip, "62467");
  assert.equal(payload.address_from.street1, "456 Farm Road");
  assert.equal(payload.address_from.city, "Teutopolis");
  assert.equal(payload.address_to.street1, "123 Oak Street");
  assert.equal(payload.address_to.state, "IL");
  assert.equal(payload.parcels.length, 2);
  assert.equal(payload.async, false);
});

test("normalizes ship-from address with 62467 fallback", () => {
  const address = normalizeShipFromAddress({
    name: " Theo's Farm ",
    street1: " 456 Farm Road ",
    city: " Teutopolis ",
    state: " il ",
  });

  assert.equal(address.name, "Theo's Farm");
  assert.equal(address.street1, "456 Farm Road");
  assert.equal(address.city, "Teutopolis");
  assert.equal(address.state, "IL");
  assert.equal(address.zip, "62467");
});

test("filters express rates and sorts customer-safe rates cheapest first", () => {
  const rates = filterCustomerRates([
    shippoRate({ object_id: "rate_next_day", servicelevel: { name: "Next Day Air", token: "ups_next_day_air" }, amount: "54.20" }),
    shippoRate({ object_id: "rate_ground_high", amount: "20.00" }),
    shippoRate({ object_id: "rate_ground_low", provider: "USPS", servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" }, amount: "17.50" }),
  ]);

  assert.deepEqual(rates.map((rate) => rate.rateId), ["rate_ground_low", "rate_ground_high"]);
  assert.equal(rates[0].amountCents, 1750);
});

test("combines matching per-package rates into customer-facing totals", () => {
  const combined = combineMatchingPackageRates([
    filterCustomerRates([
      shippoRate({ object_id: "rate_20_ups", amount: "18.42" }),
      shippoRate({ object_id: "rate_20_usps", provider: "USPS", servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" }, amount: "24.36" }),
    ]),
    filterCustomerRates([
      shippoRate({ object_id: "rate_40_ups", amount: "25.00" }),
      shippoRate({ object_id: "rate_40_usps", provider: "USPS", servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" }, amount: "35.00" }),
    ]),
  ]);

  assert.equal(combined[0].provider, "UPS");
  assert.equal(combined[0].amountCents, 4342);
  assert.deepEqual(combined[0].packageRateIds, ["rate_20_ups", "rate_40_ups"]);
  assert.equal(combined[0].packageCount, 2);
});

test("creates shipping rates through injected Shippo dependency", async () => {
  let receivedPayload = null;
  const payloads = [];
  const result = await createShippingRates({
    orderRequestDraft: validOrderRequest,
    shippingAddress: validAddress,
    shipFromAddress: {
      street1: "456 Farm Road",
      city: "Teutopolis",
      state: "IL",
      zip: "62467",
    },
    createShippoShipment({ payload }) {
      receivedPayload = payload;
      payloads.push(payload);
      return {
        rates: [
          shippoRate({ object_id: `rate_ground_low_${payloads.length}`, provider: "USPS", servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" }, amount: "17.50" }),
        ],
      };
    },
  });

  assert.equal(receivedPayload.address_from.zip, "62467");
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].parcels.length, 1);
  assert.equal(result.packageCount, 2);
  assert.equal(result.rates[0].amountCents, 3500);
  assert.deepEqual(result.rates[0].packageRateIds, ["rate_ground_low_1", "rate_ground_low_2"]);
});

test("reports missing shipping rate dependencies", () => {
  assert.deepEqual(getMissingShippingRateDependencies({}), ["createShippoShipment"]);
});
