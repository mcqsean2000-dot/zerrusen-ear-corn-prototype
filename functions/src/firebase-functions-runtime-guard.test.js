"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  adminShippingLabelsHandler,
  checkoutSessionsHandler,
  stripeWebhookHandler,
} = require("./index");
const {
  createFirebaseFunctionsRuntime,
  getMissingRuntimeClientCapabilities,
  getMissingRuntimeEnv,
} = require("./firebase-functions-runtime-guard");

const configuredEnv = {
  CORS_ALLOWED_ORIGINS: "https://theos.example",
  FIREBASE_PROJECT_ID: "theos-farm-test",
  FIRESTORE_ORDER_COLLECTION: "runtimeOrders",
  STRIPE_CANCEL_URL: "https://theos.example/#cart",
  STRIPE_SECRET_KEY: "sk_test_configured_for_unit_tests",
  STRIPE_SUCCESS_URL: "https://theos.example/checkout/success?session_id={CHECKOUT_SESSION_ID}",
  STRIPE_WEBHOOK_SIGNING_SECRET: "whsec_configured_for_unit_tests",
};

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
    this.collection.docs.set(this.id, {
      ...this.collection.docs.get(this.id),
      ...fields,
    });
  }
}

class MemoryQuery {
  constructor(collection, field, value) {
    this.collection = collection;
    this.field = field;
    this.value = value;
  }

  limit() {
    return this;
  }

  async get() {
    const docs = [];
    for (const [id, value] of this.collection.docs.entries()) {
      if (value[this.field] === this.value) docs.push(new MemoryDocSnapshot(id, value));
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
    return new MemoryDocRef(this, id || `${this.name}_${this.nextId++}`);
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

function fakeStripe() {
  return {
    checkout: {
      sessions: {
        create(params) {
          return {
            id: "cs_test_runtime",
            url: "https://checkout.stripe.com/c/pay/cs_test_runtime",
            payment_intent: "pi_test_runtime",
            customer: "cus_test_runtime",
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

test("runtime guard reports missing env and injected runtime capabilities without exposing values", () => {
  assert.deepEqual(getMissingRuntimeEnv({
    ...configuredEnv,
    STRIPE_SECRET_KEY: "replace-with-stripe-test-secret-key",
  }), ["STRIPE_SECRET_KEY"]);
  assert.deepEqual(getMissingRuntimeClientCapabilities({}), [
    "firestore",
    "stripe",
    "serverTimestamp",
  ]);

  assert.throws(
    () => createFirebaseFunctionsRuntime({
      env: { FIREBASE_PROJECT_ID: "theos-farm-test" },
      firestore: { collection() {} },
      stripe: { checkout: { sessions: {} }, webhooks: {} },
    }),
    (error) => {
      assert.equal(error.code, "firebase_functions_runtime_guard_failed");
      assert(error.missingEnv.includes("STRIPE_SECRET_KEY"));
      assert(error.missingRuntime.includes("firestore.runTransaction"));
      assert(error.missingRuntime.includes("stripe.checkout.sessions.create"));
      assert(error.missingRuntime.includes("stripe.webhooks.constructEvent"));
      assert(error.missingRuntime.includes("serverTimestamp"));
      assert.equal(JSON.stringify(error).includes("sk_test"), false);
      return true;
    },
  );

  assert.throws(
    () => createFirebaseFunctionsRuntime({
      env: configuredEnv,
      firestore: { collection() {} },
      stripe: { checkout: { sessions: {} }, webhooks: {} },
    }),
    (error) => {
      const serializedError = JSON.stringify(error);
      assert.equal(serializedError.includes(configuredEnv.STRIPE_SECRET_KEY), false);
      assert.equal(serializedError.includes(configuredEnv.STRIPE_WEBHOOK_SIGNING_SECRET), false);
      assert.deepEqual(error.missingEnv, []);
      assert(error.missingRuntime.includes("stripe.checkout.sessions.create"));
      assert(error.missingRuntime.includes("stripe.webhooks.constructEvent"));
      return true;
    },
  );
});

test("runtime guard composes checkout handler options with injected fake clients", async () => {
  const firestore = new MemoryFirestore();
  const runtime = createFirebaseFunctionsRuntime({
    env: configuredEnv,
    firestore,
    stripe: fakeStripe(),
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  const res = mockRes();

  await checkoutSessionsHandler(mockReq({
    body: { orderRequest: validOrderRequest, ...validShippingCheckoutFields() },
  }), res, {
    ...runtime,
    createShippingRates: createFakeShippingRates,
  });

  const body = parseJson(res);
  const order = firestore.collection("runtimeOrders").docs.get("runtimeOrders_1");
  assert.equal(res.statusCode, 200);
  assert.equal(body.checkoutSessionId, "cs_test_runtime");
  assert.equal(order.createdAt, "SERVER_TIMESTAMP");
  assert.equal(order.stripeCheckoutSessionId, "cs_test_runtime");
});

test("runtime guard composes webhook handler options with injected fake clients", async () => {
  const firestore = new MemoryFirestore();
  const runtime = createFirebaseFunctionsRuntime({
    env: configuredEnv,
    firestore,
    stripe: fakeStripe(),
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  await checkoutSessionsHandler(mockReq({
    body: { orderRequest: validOrderRequest, ...validShippingCheckoutFields() },
  }), mockRes(), {
    ...runtime,
    createShippingRates: createFakeShippingRates,
  });

  const event = {
    id: "evt_runtime",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_runtime",
        payment_intent: "pi_test_runtime",
        payment_status: "paid",
        client_reference_id: "runtimeOrders_1",
        metadata: {
          orderRequestId: "runtimeOrders_1",
        },
      },
    },
  };
  const res = mockRes();

  await stripeWebhookHandler(mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from(JSON.stringify(event)),
  }), res, runtime);

  const order = firestore.collection("runtimeOrders").docs.get("runtimeOrders_1");
  assert.equal(res.statusCode, 200);
  assert.equal(order.paymentStatus, "paid");
  assert.equal(order.lastStripeEventId, "evt_runtime");
});

test("runtime guard composes admin shipping label handler options with injected fake clients", async () => {
  const firestore = new MemoryFirestore();
  const runtime = createFirebaseFunctionsRuntime({
    env: configuredEnv,
    firestore,
    stripe: fakeStripe(),
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  await checkoutSessionsHandler(mockReq({
    body: { orderRequest: validOrderRequest, ...validShippingCheckoutFields() },
  }), mockRes(), {
    ...runtime,
    createShippingRates: createFakeShippingRates,
  });
  await stripeWebhookHandler(mockReq({
    headers: { "stripe-signature": "t=123,v1=test" },
    body: Buffer.from(JSON.stringify({
      id: "evt_runtime_label",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_runtime",
          payment_intent: "pi_test_runtime",
          payment_status: "paid",
          client_reference_id: "runtimeOrders_1",
          metadata: {
            orderRequestId: "runtimeOrders_1",
          },
        },
      },
    })),
  }), mockRes(), runtime);

  const res = mockRes();
  await adminShippingLabelsHandler(mockReq({
    body: {
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "runtimeOrders_1",
      rateId: "rate_20",
    },
  }), res, {
    ...runtime,
    shippingLabelDependencies: {
      ...runtime.shippingLabelDependencies,
      createShippoTransaction({ rateId }) {
        assert.equal(rateId, "rate_20");
        return {
          object_id: "transaction_runtime",
          label_url: "https://shippo.example/runtime-label.pdf",
          tracking_number: "9400100000000000000000",
        };
      },
    },
  });

  const order = firestore.collection("runtimeOrders").docs.get("runtimeOrders_1");
  assert.equal(res.statusCode, 200);
  assert.equal(parseJson(res).shippoTransactionId, "transaction_runtime");
  assert.equal(order.shippoTransactionId, "transaction_runtime");
  assert.equal(order.audit.lastAction, "label_purchased");
});

test("runtime guard module remains SDK-free and secret-free", () => {
  const source = fs.readFileSync(path.join(__dirname, "firebase-functions-runtime-guard.js"), "utf8");

  assert.equal(source.includes("firebase-admin"), false);
  assert.equal(source.includes("firebase-functions"), false);
  assert.equal(source.includes("require(\"stripe\")"), false);
  assert.equal(source.includes("require('stripe')"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("sk_test"), false);
  assert.equal(source.includes("whsec"), false);
});
