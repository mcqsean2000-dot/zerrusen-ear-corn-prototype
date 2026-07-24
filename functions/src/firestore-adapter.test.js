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
  constructor(collection, filters = [], size = Infinity) {
    this.collection = collection;
    this.filters = filters;
    this.size = size;
  }

  where(field, op, value) {
    assert.ok(["==", "<="].includes(op));
    return new MemoryQuery(this.collection, [...this.filters, [field, op, value]], this.size);
  }

  limit(size) {
    return new MemoryQuery(this.collection, this.filters, size);
  }

  async get() {
    const docs = [];

    for (const [id, value] of this.collection.docs.entries()) {
      if (this.filters.every(([field, op, expected]) => (
        op === "=="
          ? value[field] === expected
          : new Date(value[field]).getTime() <= new Date(expected).getTime()
      ))) {
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
    return new MemoryQuery(this).where(field, op, value);
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
      update(ref, fields) {
        return ref.update(fields);
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

function notificationJob(overrides = {}) {
  return {
    eventName: "admin.paid_order_created",
    idempotencyKey: "admin.paid_order_created:order_123:evt_123",
    orderRequestId: "order_123",
    paidEventId: "evt_123",
    recipientCategory: "admin",
    status: "pending",
    subject: "Paid order",
    text: "Trusted order summary",
    to: "theosfeedfarm@gmail.com",
    ...overrides,
  };
}

function dailySummaryJob(overrides = {}) {
  return {
    eventName: "admin.daily_fulfillment_summary",
    idempotencyKey: "admin.daily_fulfillment_summary:2026-07-23",
    recipientCategory: "admin",
    status: "pending",
    subject: "Daily fulfillment summary",
    summaryDate: "2026-07-23",
    text: "Trusted daily fulfillment totals",
    to: "theosfeedfarm@gmail.com",
    ...overrides,
  };
}

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

test("updates admin order status with audit metadata", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    serverTimestamp: () => "SERVER_TIMESTAMP",
  });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });
  const result = await adapter.updateAdminOrderStatus({
    admin: {
      email: "admin@example.test",
      uid: "admin-user-001",
    },
    orderRequestId: "orderRequests_1",
    status: "ready_to_pack",
  });

  assert.deepEqual(result, {
    audit: {
      lastAction: "status_changed",
      updatedAt: "SERVER_TIMESTAMP",
      updatedByEmail: "admin@example.test",
      updatedByUid: "admin-user-001",
    },
    fromStatus: "needs_review",
    id: "orderRequests_1",
    status: "ready_to_pack",
  });
  assert.deepEqual(collectionDocs(firestore, "orderRequests").get("orderRequests_1"), {
    ...trustedOrderRequest,
    audit: {
      lastAction: "status_changed",
      updatedAt: "SERVER_TIMESTAMP",
      updatedByEmail: "admin@example.test",
      updatedByUid: "admin-user-001",
    },
    status: "ready_to_pack",
  });
});

test("admin status updates reject unsupported transitions and future statuses", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });

  await assert.rejects(
    adapter.updateAdminOrderStatus({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "orderRequests_1",
      status: "packed",
    }),
    (error) => {
      assert.equal(error.code, "admin_status_transition_invalid");
      assert.equal(error.fromStatus, "needs_review");
      assert.equal(error.toStatus, "packed");
      return true;
    },
  );

  await assert.rejects(
    adapter.updateAdminOrderStatus({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "orderRequests_1",
      status: "shipped",
    }),
    (error) => {
      assert.equal(error.code, "admin_next_status_invalid");
      assert.equal(error.status, "shipped");
      return true;
    },
  );
});

test("admin status updates require admin identity and an existing order", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await assert.rejects(
    adapter.updateAdminOrderStatus({
      admin: {
        email: "admin@example.test",
      },
      orderRequestId: "orderRequests_1",
      status: "ready_to_pack",
    }),
    (error) => {
      assert.equal(error.code, "admin_actor_invalid");
      return true;
    },
  );

  await assert.rejects(
    adapter.updateAdminOrderStatus({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "missing",
      status: "ready_to_pack",
    }),
    (error) => {
      assert.equal(error.code, "order_request_not_found");
      return true;
    },
  );
});

test("records admin label purchase with tracking fields and audit metadata", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    serverTimestamp: () => "SERVER_TIMESTAMP",
  });

  await adapter.createOrderRequest({
    orderRequest: {
      ...trustedOrderRequest,
      paymentStatus: "paid",
    },
  });
  const result = await adapter.recordLabelPurchase({
    admin: {
      email: "admin@example.test",
      uid: "admin-user-001",
    },
    orderRequestId: "orderRequests_1",
    fields: {
      labelPurchasedAt: "SERVER_TIMESTAMP",
      labelUrl: "https://shippo.example/label.pdf",
      shippoTransactionId: "transaction_123",
      trackingNumber: "9400100000000000000000",
      trackingUrl: "https://carrier.example/track/9400",
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
  });

  assert.deepEqual(result, {
    audit: {
      lastAction: "label_purchased",
      updatedAt: "SERVER_TIMESTAMP",
      updatedByEmail: "admin@example.test",
      updatedByUid: "admin-user-001",
    },
    id: "orderRequests_1",
    labelPurchasedAt: "SERVER_TIMESTAMP",
    labelUrl: "https://shippo.example/label.pdf",
    shippoTransactionId: "transaction_123",
    trackingNumber: "9400100000000000000000",
    trackingUrl: "https://carrier.example/track/9400",
    trustedUpdatedAt: "SERVER_TIMESTAMP",
  });
  assert.equal(
    collectionDocs(firestore, "orderRequests").get("orderRequests_1").shippoTransactionId,
    "transaction_123",
  );
  assert.deepEqual(collectionDocs(firestore, "orderRequests").get("orderRequests_1").audit, result.audit);
});

test("prepares admin label purchase only for paid orders with owned rates", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({
    orderRequest: {
      ...trustedOrderRequest,
      paymentStatus: "paid",
      shippingRateId: JSON.stringify(["rate_20", "rate_40"]),
      shippingPackageRateIds: ["rate_20", "rate_40"],
    },
  });

  assert.deepEqual(await adapter.prepareLabelPurchase({
    admin: {
      email: "admin@example.test",
      uid: "admin-user-001",
    },
    orderRequestId: "orderRequests_1",
    rateId: "rate_20",
  }), {
    id: "orderRequests_1",
    paymentStatus: "paid",
    rateId: "rate_20",
  });

  await assert.rejects(
    adapter.prepareLabelPurchase({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "orderRequests_1",
      rateId: "rate_other",
    }),
    (error) => error.code === "shipping_label_rate_mismatch",
  );
});

test("admin label purchase requires a paid order and trusted fields", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });

  await assert.rejects(
    adapter.prepareLabelPurchase({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "orderRequests_1",
      rateId: "rate_123",
    }),
    (error) => error.code === "shipping_label_order_not_paid",
  );

  await adapter.updateOrderRequest({
    orderRequestId: "orderRequests_1",
    fields: {
      paymentStatus: "paid",
    },
  });

  await assert.rejects(
    adapter.recordLabelPurchase({
      admin: {
        email: "admin@example.test",
        uid: "admin-user-001",
      },
      orderRequestId: "orderRequests_1",
      fields: {
        customer: {
          name: "Not trusted here",
        },
      },
    }),
    (error) => error.code === "firestore_adapter_untrusted_field",
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

test("atomically completes paid orders with notification jobs and event processing", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });
  const jobs = [{
    eventName: "admin.paid_order_created",
    idempotencyKey: "admin.paid_order_created:orderRequests_1:evt_paid_123",
    orderRequestId: "orderRequests_1",
    paidEventId: "evt_paid_123",
    recipientCategory: "admin",
    status: "pending",
    subject: "Paid order",
    text: "Trusted order summary",
    to: "theosfeedfarm@gmail.com",
  }];
  const input = {
    eventId: "evt_paid_123",
    eventType: "checkout.session.completed",
    fields: {
      paymentStatus: "paid",
      checkoutStatus: "complete",
      lastStripeEventId: "evt_paid_123",
      trustedUpdatedAt: "SERVER_TIMESTAMP",
    },
    jobs,
    orderRequestId: "orderRequests_1",
    result: {
      action: "updated_order",
      orderRequestId: "orderRequests_1",
    },
  };

  assert.equal(await adapter.completePaidOrderEvent(input), true);
  assert.equal(await adapter.completePaidOrderEvent(input), false);
  assert.equal(collectionDocs(firestore, "orderRequests").get("orderRequests_1").paymentStatus, "paid");
  assert.deepEqual(collectionDocs(firestore, "notificationOutbox").get(jobs[0].idempotencyKey), {
    ...jobs[0],
    createdAt: "SERVER_TIMESTAMP",
  });
  assert.deepEqual(collectionDocs(firestore, "stripeEvents").get("evt_paid_123"), {
    eventId: "evt_paid_123",
    eventType: "checkout.session.completed",
    status: "processed",
    processedAt: "SERVER_TIMESTAMP",
    result: input.result,
  });
});

test("rejects mismatched paid event jobs before changing Firestore", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });
  await adapter.createOrderRequest({ orderRequest: trustedOrderRequest });

  await assert.rejects(
    adapter.completePaidOrderEvent({
      eventId: "evt_paid_123",
      eventType: "checkout.session.completed",
      fields: {
        paymentStatus: "paid",
        checkoutStatus: "complete",
        lastStripeEventId: "evt_paid_123",
      },
      jobs: [{
        eventName: "admin.paid_order_created",
        idempotencyKey: "admin.paid_order_created:different_order:evt_paid_123",
        orderRequestId: "different_order",
        paidEventId: "evt_paid_123",
        recipientCategory: "admin",
        status: "pending",
        subject: "Paid order",
        text: "Trusted order summary",
        to: "theosfeedfarm@gmail.com",
      }],
      orderRequestId: "orderRequests_1",
      result: { action: "updated_order", orderRequestId: "orderRequests_1" },
    }),
    (error) => error.code === "paid_order_event_mismatch",
  );
  assert.equal(collectionDocs(firestore, "orderRequests").get("orderRequests_1").paymentStatus, "unpaid");
  assert.equal(collectionDocs(firestore, "notificationOutbox").size, 0);
  assert.equal(collectionDocs(firestore, "stripeEvents").size, 0);
});

test("enqueues notification jobs once with deterministic document ids", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    notificationOutboxCollection: "mailOutbox",
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  const jobs = [{
    eventName: "customer.order_confirmation",
    idempotencyKey: "customer.order_confirmation:order_123:evt_123",
    orderRequestId: "order_123",
    paidEventId: "evt_123",
    recipientCategory: "customer",
    status: "pending",
    subject: "Payment confirmed",
    text: "Trusted order summary",
    to: "customer@example.com",
  }];

  assert.deepEqual(await adapter.enqueueNotificationJobs({ jobs }), {
    created: 1,
    duplicates: 0,
    results: [{
      created: true,
      idempotencyKey: "customer.order_confirmation:order_123:evt_123",
    }],
  });
  assert.deepEqual(await adapter.enqueueNotificationJobs({ jobs }), {
    created: 0,
    duplicates: 1,
    results: [{
      created: false,
      idempotencyKey: "customer.order_confirmation:order_123:evt_123",
    }],
  });
  assert.deepEqual(collectionDocs(firestore, "mailOutbox").get(jobs[0].idempotencyKey), {
    ...jobs[0],
    createdAt: "SERVER_TIMESTAMP",
  });
});

test("enqueues one deterministic daily summary and rejects malformed summary identity", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore, serverTimestamp: "SERVER_TIMESTAMP" });
  const job = dailySummaryJob();

  assert.equal((await adapter.enqueueNotificationJobs({ jobs: [job] })).created, 1);
  assert.equal((await adapter.enqueueNotificationJobs({ jobs: [job] })).duplicates, 1);
  assert.deepEqual(collectionDocs(firestore, "notificationOutbox").get(job.idempotencyKey), {
    ...job,
    createdAt: "SERVER_TIMESTAMP",
  });

  for (const invalidJob of [
    dailySummaryJob({ summaryDate: "2026-02-30", idempotencyKey: "admin.daily_fulfillment_summary:2026-02-30" }),
    dailySummaryJob({ orderRequestId: "order_123" }),
    dailySummaryJob({ idempotencyKey: "admin.daily_fulfillment_summary:2026-07-24" }),
  ]) {
    await assert.rejects(
      adapter.enqueueNotificationJobs({ jobs: [invalidJob] }),
      (error) => error.code === "notification_outbox_job_invalid",
    );
  }
});

test("lists a bounded paid fulfillment queue across supported statuses", async () => {
  const firestore = new MemoryFirestore();
  const orders = firestore.collection("orderRequests");
  await orders.doc("order_review").set({ ...trustedOrderRequest, paymentStatus: "paid", status: "needs_review" });
  await orders.doc("order_pack").set({ ...trustedOrderRequest, paymentStatus: "paid", status: "ready_to_pack" });
  await orders.doc("order_packed").set({ ...trustedOrderRequest, paymentStatus: "paid", status: "packed" });
  await orders.doc("order_unpaid").set({ ...trustedOrderRequest, paymentStatus: "unpaid", status: "needs_review" });
  await orders.doc("order_shipped").set({ ...trustedOrderRequest, paymentStatus: "paid", status: "shipped" });
  const adapter = createFirestoreAdapter({ firestore });

  const result = await adapter.listPaidFulfillmentOrders();
  assert.deepEqual(result.map((order) => order.id).sort(), [
    "order_pack",
    "order_packed",
    "order_review",
  ]);
  assert.equal(result.every((order) => order.paymentStatus === "paid"), true);

  await assert.rejects(
    adapter.listPaidFulfillmentOrders({ limit: 2 }),
    (error) => error.code === "fulfillment_query_result_limit_exceeded",
  );
  await assert.rejects(
    adapter.listPaidFulfillmentOrders({ limit: 0 }),
    (error) => error.code === "fulfillment_query_limit_invalid",
  );
});

test("lists only bounded pending and retryable notification job IDs", async () => {
  const firestore = new MemoryFirestore();
  const jobs = collectionDocs(firestore, "notificationOutbox");
  jobs.set("pending-job", { status: "pending" });
  jobs.set("pending-job-2", { status: "pending" });
  jobs.set("pending-job-3", { status: "pending" });
  jobs.set("retry-job", { status: "retry_pending" });
  jobs.set("sent-job", { status: "sent" });
  const adapter = createFirestoreAdapter({ firestore, serverTimestamp: "SERVER_TIMESTAMP" });

  assert.deepEqual(
    (await adapter.listPendingNotificationJobs({ limit: 2 })).sort(),
    ["pending-job", "retry-job"],
  );
  await assert.rejects(
    () => adapter.listPendingNotificationJobs({ limit: 0 }),
    (error) => error.code === "notification_reconciliation_limit_invalid",
  );
});

test("recovers only expired processing leases and terminates exhausted jobs", async () => {
  const firestore = new MemoryFirestore();
  const jobs = collectionDocs(firestore, "notificationOutbox");
  jobs.set("stale-job", {
    attempts: 1,
    lastAttemptAt: new Date("2026-07-23T17:00:00Z"),
    maxAttempts: 3,
    status: "processing",
  });
  jobs.set("fresh-job", {
    attempts: 1,
    lastAttemptAt: new Date("2026-07-23T17:55:00Z"),
    maxAttempts: 3,
    status: "processing",
  });
  jobs.set("exhausted-job", {
    attempts: 3,
    lastAttemptAt: new Date("2026-07-23T16:00:00Z"),
    maxAttempts: 3,
    status: "processing",
  });
  const adapter = createFirestoreAdapter({
    firestore,
    serverTimestamp: () => "SERVER_TIMESTAMP",
  });

  assert.deepEqual(await adapter.recoverStaleNotificationJobs({
    limit: 10,
    staleBefore: new Date("2026-07-23T17:45:00Z"),
  }), { failed: 1, recovered: 1 });
  assert.equal(jobs.get("stale-job").status, "retry_pending");
  assert.equal(jobs.get("stale-job").lastErrorCode, "processing_lease_expired");
  assert.equal(jobs.get("fresh-job").status, "processing");
  assert.equal(jobs.get("exhausted-job").status, "failed");
});

test("claims one notification attempt and rejects concurrent claims", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  const job = notificationJob();
  await adapter.enqueueNotificationJobs({ jobs: [job] });

  assert.deepEqual(await adapter.claimNotificationJob({
    idempotencyKey: job.idempotencyKey,
    maxAttempts: 3,
  }), {
    attempt: 1,
    job,
  });
  assert.equal(await adapter.claimNotificationJob({
    idempotencyKey: job.idempotencyKey,
    maxAttempts: 3,
  }), null);
  assert.deepEqual(collectionDocs(firestore, "notificationOutbox").get(job.idempotencyKey), {
    ...job,
    attempts: 1,
    createdAt: "SERVER_TIMESTAMP",
    lastAttemptAt: "SERVER_TIMESTAMP",
    maxAttempts: 3,
    status: "processing",
  });
});

test("records retry, rejects stale attempts, and records delivery success", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({
    firestore,
    serverTimestamp() {
      return "SERVER_TIMESTAMP";
    },
  });
  const job = notificationJob();
  await adapter.enqueueNotificationJobs({ jobs: [job] });
  await adapter.claimNotificationJob({ idempotencyKey: job.idempotencyKey, maxAttempts: 3 });
  assert.deepEqual(await adapter.recordNotificationFailure({
    attempt: 1,
    errorCode: "rate_limited",
    idempotencyKey: job.idempotencyKey,
    retryable: true,
  }), { retryable: true });
  assert.equal(collectionDocs(firestore, "notificationOutbox").get(job.idempotencyKey).status, "retry_pending");

  assert.equal((await adapter.claimNotificationJob({
    idempotencyKey: job.idempotencyKey,
    maxAttempts: 3,
  })).attempt, 2);
  await assert.rejects(
    adapter.recordNotificationSuccess({
      attempt: 1,
      idempotencyKey: job.idempotencyKey,
      providerMessageId: "message_stale",
    }),
    (error) => error.code === "notification_delivery_state_conflict",
  );
  assert.equal(await adapter.recordNotificationSuccess({
    attempt: 2,
    idempotencyKey: job.idempotencyKey,
    providerMessageId: "message_123",
  }), true);
  assert.equal(await adapter.recordNotificationSuccess({
    attempt: 2,
    idempotencyKey: job.idempotencyKey,
    providerMessageId: "message_123",
  }), true);
  const stored = collectionDocs(firestore, "notificationOutbox").get(job.idempotencyKey);
  assert.equal(stored.status, "sent");
  assert.equal(stored.providerMessageId, "message_123");
  assert.equal(await adapter.claimNotificationJob({ idempotencyKey: job.idempotencyKey, maxAttempts: 3 }), null);
});

test("moves exhausted notification attempts to terminal failure", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });
  const job = notificationJob();
  await adapter.enqueueNotificationJobs({ jobs: [job] });
  await adapter.claimNotificationJob({ idempotencyKey: job.idempotencyKey, maxAttempts: 1 });

  assert.deepEqual(await adapter.recordNotificationFailure({
    attempt: 1,
    errorCode: "provider_unavailable",
    idempotencyKey: job.idempotencyKey,
    retryable: true,
  }), { retryable: false });
  const stored = collectionDocs(firestore, "notificationOutbox").get(job.idempotencyKey);
  assert.equal(stored.status, "failed");
  assert.equal(stored.lastErrorCode, "provider_unavailable");
});

test("rejects unsupported notification job fields before persistence", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await assert.rejects(
    adapter.enqueueNotificationJobs({
      jobs: [{
        eventName: "admin.paid_order_created",
        idempotencyKey: "admin.paid_order_created:order_123:evt_123",
        orderRequestId: "order_123",
        paidEventId: "evt_123",
        rawStripeEvent: { secret: true },
        recipientCategory: "admin",
        status: "pending",
        subject: "Paid order",
        text: "Trusted order summary",
        to: "theosfeedfarm@gmail.com",
      }],
    }),
    (error) => {
      assert.equal(error.code, "notification_outbox_untrusted_field");
      assert.deepEqual(error.untrustedFields, ["rawStripeEvent"]);
      return true;
    },
  );
  assert.equal(collectionDocs(firestore, "notificationOutbox").size, 0);
});

test("rejects notification jobs with mismatched deterministic keys", async () => {
  const firestore = new MemoryFirestore();
  const adapter = createFirestoreAdapter({ firestore });

  await assert.rejects(
    adapter.enqueueNotificationJobs({
      jobs: [{
        eventName: "admin.paid_order_created",
        idempotencyKey: "admin.paid_order_created:other_order:evt_123",
        orderRequestId: "order_123",
        paidEventId: "evt_123",
        recipientCategory: "admin",
        status: "pending",
        subject: "Paid order",
        text: "Trusted order summary",
        to: "theosfeedfarm@gmail.com",
      }],
    }),
    (error) => error.code === "notification_outbox_job_invalid",
  );
  assert.equal(collectionDocs(firestore, "notificationOutbox").size, 0);
});
