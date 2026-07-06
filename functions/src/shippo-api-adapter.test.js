"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SHIPPO_SHIPMENTS_URL,
  SHIPPO_TRANSACTIONS_URL,
  createShippoShipmentWithFetch,
  createShippoTransactionWithFetch,
} = require("./shippo-api-adapter");

test("creates Shippo shipment with token auth and JSON payload", async () => {
  let request = null;
  const result = await createShippoShipmentWithFetch({
    token: "shippo_test_token",
    payload: { async: false },
    async fetchImpl(url, options) {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return { object_id: "shipment_123", rates: [] };
        },
      };
    },
  });

  assert.equal(request.url, SHIPPO_SHIPMENTS_URL);
  assert.equal(request.options.headers.authorization, "ShippoToken shippo_test_token");
  assert.equal(request.options.body, JSON.stringify({ async: false }));
  assert.equal(result.object_id, "shipment_123");
});

test("requires token without exposing it in errors", async () => {
  await assert.rejects(
    () => createShippoShipmentWithFetch({ token: "", payload: {}, fetchImpl() {} }),
    (error) => error.code === "shippo_token_missing" && !error.message.includes("shippo_test"),
  );
});

test("wraps Shippo API failures", async () => {
  await assert.rejects(
    () => createShippoShipmentWithFetch({
      token: "shippo_test_token",
      payload: {},
      async fetchImpl() {
        return {
          ok: false,
          status: 401,
          async json() {
            return { detail: "Unauthorized" };
          },
        };
      },
    }),
    (error) => error.code === "shippo_shipment_create_failed" && error.status === 401,
  );
});

test("creates Shippo label transaction with selected rate", async () => {
  let request = null;
  const result = await createShippoTransactionWithFetch({
    token: "shippo_test_token",
    rateId: "rate_123",
    async fetchImpl(url, options) {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return {
            object_id: "transaction_123",
            tracking_number: "9400100000000000000000",
          };
        },
      };
    },
  });

  assert.equal(request.url, SHIPPO_TRANSACTIONS_URL);
  assert.equal(request.options.headers.authorization, "ShippoToken shippo_test_token");
  assert.deepEqual(JSON.parse(request.options.body), {
    async: false,
    label_file_type: "PDF",
    rate: "rate_123",
  });
  assert.equal(result.object_id, "transaction_123");
});

test("requires a Shippo rate ID before buying a label", async () => {
  await assert.rejects(
    () => createShippoTransactionWithFetch({
      token: "shippo_test_token",
      rateId: "   ",
      fetchImpl() {},
    }),
    (error) => error.code === "shippo_rate_id_missing",
  );
});

test("wraps Shippo transaction API failures", async () => {
  await assert.rejects(
    () => createShippoTransactionWithFetch({
      token: "shippo_test_token",
      rateId: "rate_123",
      async fetchImpl() {
        return {
          ok: false,
          status: 422,
          async json() {
            return { messages: ["Rate expired"] };
          },
        };
      },
    }),
    (error) => error.code === "shippo_transaction_create_failed" && error.status === 422,
  );
});
