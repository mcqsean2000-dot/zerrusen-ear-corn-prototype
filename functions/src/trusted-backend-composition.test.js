"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  checkoutSessionsHandler,
  stripeWebhookHandler,
} = require("./index");
const {
  createTrustedBackendComposition,
  getMissingTrustedBackendClients,
} = require("./trusted-backend-composition");

const validOrderRequest = {
  source: "static-storefront",
  status: "needs_review",
  subtotalCents: 1795,
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

const configuredEnv = {
  CORS_ALLOWED_ORIGINS: "https://theos.example",
  FIREBASE_PROJECT_ID: "theos-farm-test",
  FIRESTORE_ORDER_COLLECTION: "testOrders",
  STRIPE_CANCEL_URL: "https://theos.example/#cart",
  STRIPE_SECRET_KEY: "sk_test_configured_for_unit_tests",
  STRIPE_SUCCESS_URL: "https://theos.example/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_configured_for_unit_tests",
};

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

function mockReq({ method = "POST", headers = {}, body = {} } = {}) {
  return {
    method,
    headers,
    body,
  };
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

function parseJson(res) {
  return res.body ? JSON.parse(res.body) : {};
}

function validShippingCheckoutFields() {
  return {
    shippingAddress: {
      addressLine1: "123 Oak Street",
      city: "Effingham",
      state: "IL",
      zip: "62401",
    },
    selectedShippingRate: {
      rateId: "rate_ground",
    },
  };
}

function createFakeShippingRates() {
  return {
    shippingAddress: validShippingCheckoutFields().shippingAddress,
    rates: [
      {
        rateId: "rate_ground",
        provider: "UPS",
        serviceName: "Ground",
        amountCents: 4342,
        currency: "USD",
        estimatedDays: 2,
        durationTerms: "2 business days",
        packageRateIds: ["rate_20", "rate_40"],
        packageCount: 2,
      },
    ],
  };
}

function collectionDocs(firestore, name) {
  return firestore.collection(name).docs;
}

function fakeStripe(overrides = {}) {
  return {
    checkout: {
      sessions: {
        create(params) {
          return {
            id: "cs_test_composed",
            url: "https://checkout.stripe.com/c/pay/cs_test_composed",
            payment_intent: "pi_test_composed",
            customer: "cus_test_composed",
            ...overrides.session,
            params,
          };
        },
      },
    },
    webhooks: {
      constructEvent(rawBody, signature, signingSecret) {
        assert.equal(signature, "t=123,v1=test");
        assert.equal(signingSecret, configuredEnv.STRIPE_WEBHOOK_SIGNING_SECRET);
        return JSON.parse(Buffer.from(rawBody).toString("utf8"));
      },
    },
  };
}

test("composition exposes the handler dependency shapes expected by index.js", () => {
  const composition = createTrustedBackendComposition({
    firestore: new MemoryFirestore(),
    stripe: fakeStripe(),
    serverTimestamp: "SERVER_TIMESTAMP",
  });

  assert.equal(typeof composition.serverTimestamp, "function");
  assert.equal(composition.serverTimestamp(), "SERVER_TIMESTAMP");
  assert.equal(typeof composition.verifyStripeWebhookEvent, "function");
  assert.deepEqual(Object.keys(composition.checkoutAdapterDependencies).sort(), [
    "createOrderRequest",
    "createStripeCheckoutSession",
    "markCheckoutSessionFailed",
    "updateOrderRequest",
  ].sort());
  assert.deepEqual(Object.keys(composition.stripeWebhookAdapterDependencies).sort(), [
    "claimStripeEventProcessing",
    "findOrderByCheckoutSessionId",
    "findOrderByPaymentIntentId",
    "markStripeEventProcessed",
    "updateOrderRequest",
  ].sort());
});

test("checkout handler starts a fake Stripe session through composed dependencies", async () => {
  const firestore = new MemoryFirestore();
  const composition = createTrustedBackendComposition({
    firestore,
    stripe: fakeStripe(),
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  const req = mockReq({ body: { orderRequest: validOrderRequest, ...validShippingCheckoutFields() } });
  const res = mockRes();

  await checkoutSessionsHandler(req, res, {
    env: configuredEnv,
    ...composition,
    createShippingRates: createFakeShippingRates,
  });

  const body = parseJson(res);
  assert.equal(res.statusCode, 200);
  assert.equal(body.orderRequestId, "testOrders_1");
  assert.equal(body.checkoutSessionId, "cs_test_composed");
  assert.equal(body.checkoutUrl, "https://checkout.stripe.com/c/pay/cs_test_composed");
  assert.deepEqual(collectionDocs(firestore, "testOrders").get("testOrders_1"), {
    ...validOrderRequest,
    createdAt: "SERVER_TIMESTAMP",
    paymentStatus: "unpaid",
    checkoutStatus: "open",
    checkoutCreatedAt: "SERVER_TIMESTAMP",
    trustedUpdatedAt: "SERVER_TIMESTAMP",
    stripeCheckoutSessionId: "cs_test_composed",
    stripePaymentIntentId: "pi_test_composed",
    stripeCustomerId: "cus_test_composed",
    shippingAddress: validShippingCheckoutFields().shippingAddress,
    shippingRateId: "rate_ground",
    shippingCarrier: "UPS",
    shippingService: "Ground",
    shippingAmountCents: 4342,
    shippingCurrency: "USD",
    shippingEstimatedDays: 2,
    shippingDurationTerms: "2 business days",
    shippingPackageRateIds: ["rate_20", "rate_40"],
    shippingPackageCount: 2,
  });
});

test("webhook handler verifies a fake event and updates fake storage through composition", async () => {
  const firestore = new MemoryFirestore();
  const composition = createTrustedBackendComposition({
    firestore,
    stripe: fakeStripe(),
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  await checkoutSessionsHandler(
    mockReq({ body: { orderRequest: validOrderRequest, ...validShippingCheckoutFields() } }),
    mockRes(),
    { env: configuredEnv, ...composition, createShippingRates: createFakeShippingRates },
  );

  const event = {
    id: "evt_composed",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_composed",
        payment_intent: "pi_test_composed",
        customer: "cus_test_composed",
        payment_status: "paid",
        client_reference_id: "testOrders_1",
        metadata: {
          orderRequestId: "testOrders_1",
        },
      },
    },
  };
  const req = mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from(JSON.stringify(event)),
  });
  const res = mockRes();

  await stripeWebhookHandler(req, res, {
    env: configuredEnv,
    ...composition,
  });

  const body = parseJson(res);
  const order = collectionDocs(firestore, "testOrders").get("testOrders_1");
  const stripeEvent = collectionDocs(firestore, "stripeEvents").get("evt_composed");
  assert.equal(res.statusCode, 200);
  assert.equal(body.received, true);
  assert.equal(order.paymentStatus, "paid");
  assert.equal(order.checkoutStatus, "complete");
  assert.equal(order.lastStripeEventId, "evt_composed");
  assert.equal(stripeEvent.status, "processed");
  assert.equal(stripeEvent.result.action, "updated_order");
});

test("missing injected clients fail before any SDK or network setup is attempted", () => {
  assert.deepEqual(getMissingTrustedBackendClients({}), ["firestore", "stripe"]);
  assert.deepEqual(getMissingTrustedBackendClients({ firestore: {} }), ["stripe"]);

  assert.throws(
    () => createTrustedBackendComposition({ firestore: new MemoryFirestore() }),
    (error) => {
      assert.equal(error.code, "trusted_backend_composition_client_missing");
      assert.deepEqual(error.missingClients, ["stripe"]);
      return true;
    },
  );
});

test("composition module remains SDK-free and secret-free", () => {
  const source = fs.readFileSync(path.join(__dirname, "trusted-backend-composition.js"), "utf8");

  assert.equal(source.includes("firebase-admin"), false);
  assert.equal(source.includes("firebase-functions"), false);
  assert.equal(source.includes("require(\"stripe\")"), false);
  assert.equal(source.includes("require('stripe')"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("STRIPE_SECRET"), false);
});
