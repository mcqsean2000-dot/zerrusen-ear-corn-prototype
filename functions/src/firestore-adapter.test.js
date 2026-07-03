"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createFirestoreAdapter,
} = require("./firestore-adapter");

class MemoryDocSnapshot {
  constructor(id, value) {
    this.id = id;
    this.exists = value !== undefined;
    this._value = value;
  }

  data() {
    return this._value ? { ...this._value } : undefined;
  }
}

class MemoryDocRef {
  constructor(collection, id) {
    this.collection = collection;
    this.id = id;
  }

  async get() {
    return new MemoryDocSnapshot(this.id, this.collection.docs.get(this.id));
  }

  async set(value, options = {}) {
    const current = this.collection.docs.get(this.id) || {};
    this.collection.docs.set(this.id, options.merge ? { ...current, ...value } : { ...value });
  }

  async update(fields) {
    if (!this.collection.docs.has(this.id)) {
      const error = new Error("Document does not exist.");
      error.code = "not-found";
      throw error;
    }

    this.collection.docs.set(this.id, {
      ...this.collection.docs.get(this.id),
      ...fields,
    });
  }
}

class MemoryQuery {
  constructor(collection, field, value, size) {
    this.collection = collection;
    this.field = field;
    this.value = value;
    this.size = size || Infinity;
  }

  limit(size) {
    return new MemoryQuery(this.collection, this.field, this.value, size);
  }

  async get() {
    const docs = [];

    for (const [id, value] of this.collection.docs.entries()) {
      if (value[this.field] === this.value) {
        docs.push(new MemoryDocSnapshot(id, value));
      }

      if (docs.length >= this.size) break;
    }

    return {
      docs,
      empty: docs.length === 0,
    };
  }
}

class MemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = new Map();
    this.nextId = 1;
  }

  doc(id) {
    const docId = id || `${this.name}_${this.nextId++}`;
    return new MemoryDocRef(this, docId);
  }

  where(field, op, value) {
    assert.equal(op, "==");
    return new MemoryQuery(this, field, value);
  }
}

class MemoryFirestore {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MemoryCollection(name));
    }

    return this.collections.get(name);
  }

  async runTransaction(callback) {
    return callback({
      get(ref) {
        return ref.get();
      },
      set(ref, value, options) {
        return ref.set(value, options);
      },
    });
  }
}

function collectionDocs(firestore, name) {
  return firestore.collection(name).docs;
}

const trustedOrderRequest = {
  source: "static-storefront",
  status: "needs_review",
  subtotalCents: 1795,
  createdAt: "SERVER_TIMESTAMP",
  paymentStatus: "unpaid",
  checkoutStatus: "open",
  checkoutCreatedAt: "SERVER_TIMESTAMP",
  trustedUpdatedAt: "SERVER_TIMESTAMP",
  items: [
    {
      name: "20 lb Ear Corn Bag",
      sku: "ear-corn-20lb",
      quantity: 1,
      unitPriceCents: 1795,
    },
  ],
  customer: {
    name: "Customer Name",
    contact: "customer@example.com",
    preferredContact: "email",
    shippingZip: "62401",
  },
};

test("creates order requests in the configured collection", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    orderCollection: "customOrders",
  });

  const result = await adapter.createOrderRequest({
    orderRequest: trustedOrderRequest,
  });

  assert.deepEqual(result, { id: "customOrders_1" });
  assert.deepEqual(collectionDocs(firestore, "customOrders").get("customOrders_1"), trustedOrderRequest);
  assert.equal(collectionDocs(firestore, "orderRequests").size, 0);
});

test("updates trusted order fields and omits undefined values", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });
  await adapter.updateOrderRequest({
    orderRequestId: "orderRequests_1",
    fields: {
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: undefined,
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
  });

  assert.deepEqual(collectionDocs(firestore, "orderRequests").get("orderRequests_1"), {
    ...trustedOrderRequest,
    stripeCheckoutSessionId: "cs_test_123",
    trustedUpdatedAt: "SERVER_TIMESTAMP",
  });
});

test("rejects non-trusted order update fields", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });

  await assert.rejects(
    adapter.updateOrderRequest({
      orderRequestId: "orderRequests_1",
      fields: {
        customer: { name: "Not trusted here" },
      },
    }),
    (error) => {
      assert.equal(error.code, "firestore_adapter_untrusted_field");
      assert.deepEqual(error.untrustedFields, ["customer"]);
      return true;
    },
  );
});

test("failure marker updates through the same trusted field boundary", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });
  await adapter.markCheckoutSessionFailed({
    orderRequestId: "orderRequests_1",
    fields: {
      paymentStatus: "unpaid",
      checkoutStatus: "error",
      checkoutErrorCode: "stripe_checkout_session_failed",
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
  });

  assert.equal(collectionDocs(firestore, "orderRequests").get("orderRequests_1").checkoutStatus, "error");
  assert.equal(
    collectionDocs(firestore, "orderRequests").get("orderRequests_1").checkoutErrorCode,
    "stripe_checkout_session_failed",
  );
});

test("finds orders by trusted Stripe checkout session and payment intent IDs", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });
  await adapter.updateOrderRequest({
    orderRequestId: "orderRequests_1",
    fields: {
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_test_123",
    },
  });

  assert.deepEqual(await adapter.findOrderByCheckoutSessionId({
    stripeCheckoutSessionId: "cs_test_123",
  }), {
    id: "orderRequests_1",
    ...trustedOrderRequest,
    stripeCheckoutSessionId: "cs_test_123",
    stripePaymentIntentId: "pi_test_123",
  });
  assert.equal((await adapter.findOrderByPaymentIntentId({
    stripePaymentIntentId: "missing",
  })), null);
});

test("falls back to metadata order ID before checkout session ID is persisted", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });

  assert.deepEqual(await adapter.findOrderByCheckoutSessionId({
    stripeCheckoutSessionId: "cs_test_not_yet_persisted",
    orderRequestId: "orderRequests_1",
  }), {
    id: "orderRequests_1",
    ...trustedOrderRequest,
  });
});

test("atomically claims Stripe event processing once and treats replays as misses", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    stripeEventCollection: "stripeEventClaims",
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });

  assert.equal(await adapter.claimStripeEventProcessing({
    eventId: "evt_123",
    eventType: "checkout.session.completed",
  }), true);
  assert.equal(await adapter.claimStripeEventProcessing({
    eventId: "evt_123",
    eventType: "checkout.session.completed",
  }), false);

  assert.deepEqual(collectionDocs(firestore, "stripeEventClaims").get("evt_123"), {
    eventId: "evt_123",
    eventType: "checkout.session.completed",
    status: "processing",
    claimedAt: "SERVER_TIMESTAMP",
  });
});

test("marks Stripe events processed without losing claim data", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });

  await adapter.claimStripeEventProcessing({
    eventId: "evt_123",
    eventType: "customer.created",
  });
  await adapter.markStripeEventProcessed({
    eventId: "evt_123",
    eventType: "customer.created",
    result: {
      action: "no_op",
      reason: "unsupported_event_type",
    },
  });

  assert.deepEqual(collectionDocs(firestore, "stripeEvents").get("evt_123"), {
    eventId: "evt_123",
    eventType: "customer.created",
    status: "processed",
    claimedAt: "SERVER_TIMESTAMP",
    processedAt: "SERVER_TIMESTAMP",
    result: {
      action: "no_op",
      reason: "unsupported_event_type",
    },
  });
});
