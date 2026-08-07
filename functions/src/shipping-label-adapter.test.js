"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getMissingShippingLabelDependencies,
  normalizeShippoLabelFields,
  purchaseShippingLabel,
} = require("./shipping-label-adapter");

test("reports missing trusted label purchase dependencies", () => {
  assert.deepEqual(getMissingShippingLabelDependencies({}), [
    "createShippoTransaction",
    "prepareLabelPurchase",
    "recordLabelPurchase",
    "recordLabelPurchaseFailure",
  ]);
});

test("normalizes Shippo transaction fields for trusted order persistence", () => {
  assert.deepEqual(normalizeShippoLabelFields({
    serverTimestamp: "SERVER_TIMESTAMP",
    transaction: {
      object_id: "transaction_123",
      label_url: "https://shippo.example/label.pdf",
      tracking_number: "9400100000000000000000",
      tracking_url_provider: "https://carrier.example/track/9400",
    },
  }), {
    labelPurchasedAt: "SERVER_TIMESTAMP",
    labelUrl: "https://shippo.example/label.pdf",
    shippoTransactionId: "transaction_123",
    trackingNumber: "9400100000000000000000",
    trackingUrl: "https://carrier.example/track/9400",
    trustedUpdatedAt: "SERVER_TIMESTAMP",
  });
});

test("requires complete Shippo label transaction data", () => {
  assert.throws(
    () => normalizeShippoLabelFields({
      serverTimestamp: "SERVER_TIMESTAMP",
      transaction: {
        object_id: "transaction_123",
      },
    }),
    (error) => error.code === "shippo_label_transaction_incomplete",
  );
});

test("purchases label and records trusted label fields", async () => {
  let requestedRateId = "";
  let recorded = null;
  const result = await purchaseShippingLabel({
    admin: {
      email: "admin@example.test",
      uid: "admin-user-001",
    },
    orderRequestId: "order_123",
    rateId: " rate_123 ",
    serverTimestamp: "SERVER_TIMESTAMP",
    createShippoTransaction({ rateId }) {
      requestedRateId = rateId;
      return {
        object_id: "transaction_123",
        label_url: "https://shippo.example/label.pdf",
        tracking_number: "9400100000000000000000",
      };
    },
    prepareLabelPurchase({ purchaseAttemptId, rateId }) {
      assert.equal(rateId, "rate_123");
      assert.match(purchaseAttemptId, /^[a-f0-9-]{36}$/);
      return { packageId: "package-1" };
    },
    recordLabelPurchase(args) {
      recorded = args;
      return {
        id: args.orderRequestId,
        ...args.fields,
      };
    },
    recordLabelPurchaseFailure() {},
  });

  assert.equal(requestedRateId, "rate_123");
  assert.equal(recorded.admin.email, "admin@example.test");
  assert.equal(recorded.fields.shippoTransactionId, "transaction_123");
  assert.equal(result.labelUrl, "https://shippo.example/label.pdf");
});

test("validates admin, order id, and rate id before creating a transaction", async () => {
  await assert.rejects(
    () => purchaseShippingLabel({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      rateId: " ",
      createShippoTransaction() {
        throw new Error("should not buy label without a rate");
      },
      prepareLabelPurchase() {},
      recordLabelPurchase() {},
      recordLabelPurchaseFailure() {},
    }),
    (error) => error.code === "shippo_rate_id_missing",
  );
});

test("does not create Shippo transaction when preflight rejects the order", async () => {
  let transactionCreated = false;

  await assert.rejects(
    () => purchaseShippingLabel({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "order_123",
      rateId: "rate_123",
      createShippoTransaction() {
        transactionCreated = true;
      },
      prepareLabelPurchase() {
        const error = new Error("Order is not paid.");
        error.code = "shipping_label_order_not_paid";
        throw error;
      },
      recordLabelPurchase() {},
      recordLabelPurchaseFailure() {},
    }),
    (error) => error.code === "shipping_label_order_not_paid",
  );

  assert.equal(transactionCreated, false);
});

test("records confirmed and ambiguous provider failures against the claimed package", async () => {
  for (const providerError of [
    Object.assign(new Error("provider rejected"), { status: 400 }),
    new Error("network outcome unknown"),
  ]) {
    let failure = null;
    await assert.rejects(() => purchaseShippingLabel({
      admin: { email: "admin@example.test", uid: "admin-user-001" },
      orderRequestId: "order_123",
      rateId: "rate_123",
      createShippoTransaction() {
        throw providerError;
      },
      prepareLabelPurchase() {
        return { packageId: "package-1" };
      },
      recordLabelPurchase() {},
      recordLabelPurchaseFailure(input) {
        failure = input;
      },
    }), providerError);
    assert.equal(failure.packageId, "package-1");
    assert.equal(failure.ambiguous, !Number.isInteger(providerError.status));
  }
});
