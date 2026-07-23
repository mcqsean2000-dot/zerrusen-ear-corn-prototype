"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildPaidOrderNotifications,
} = require("./notification-builder");

function paidOrder(overrides = {}) {
  return {
    id: "order_123",
    customer: {
      contact: "customer@example.com",
      name: "Customer Name",
      note: "Please leave this private note out of email.",
      preferredContact: "email",
      shippingZip: "62401",
    },
    items: [
      {
        name: "Untrusted old product name",
        quantity: 2,
        sku: "ear-corn-20lb",
        unitPriceCents: 1795,
      },
      {
        quantity: 1,
        sku: "ear-corn-40lb",
        unitPriceCents: 2995,
      },
    ],
    lastStripeEventId: "evt_paid_123",
    paymentStatus: "paid",
    stripeCheckoutSessionId: "cs_secret_not_for_email",
    subtotalCents: 6585,
    ...overrides,
  };
}

test("builds customer and admin jobs from trusted paid order fields", () => {
  const jobs = buildPaidOrderNotifications({ order: paidOrder() });

  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((job) => job.eventName), [
    "customer.order_confirmation",
    "admin.paid_order_created",
  ]);
  assert.equal(jobs[0].to, "customer@example.com");
  assert.equal(jobs[1].to, "theosfeedfarm@gmail.com");
  assert.match(jobs[0].text, /2 x 20 lb Ear Corn Bag - \$35\.90/);
  assert.match(jobs[0].text, /Subtotal: \$65\.85/);
  assert.match(jobs[1].text, /Customer note present: yes/);
});

test("omits customer confirmation when the order has no valid customer email", () => {
  const jobs = buildPaidOrderNotifications({
    order: paidOrder({
      customer: {
        contact: "217-555-0100",
        name: "Phone Customer",
        preferredContact: "phone",
        shippingZip: "62401",
      },
    }),
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].eventName, "admin.paid_order_created");
});

test("uses stable idempotency keys for repeated paid webhook events", () => {
  const first = buildPaidOrderNotifications({ order: paidOrder() });
  const second = buildPaidOrderNotifications({ order: paidOrder() });

  assert.deepEqual(first.map((job) => job.idempotencyKey), second.map((job) => job.idempotencyKey));
  assert.equal(first[0].idempotencyKey, "customer.order_confirmation:order_123:evt_paid_123");
  assert.equal(first[1].idempotencyKey, "admin.paid_order_created:order_123:evt_paid_123");
});

test("does not copy free-form notes or raw Stripe fields into jobs", () => {
  const serialized = JSON.stringify(buildPaidOrderNotifications({ order: paidOrder() }));

  assert.equal(serialized.includes("Please leave this private note out of email."), false);
  assert.equal(serialized.includes("cs_secret_not_for_email"), false);
  assert.equal(serialized.includes("Untrusted old product name"), false);
});

test("refuses to build jobs before trusted payment confirmation", () => {
  assert.throws(
    () => buildPaidOrderNotifications({ order: paidOrder({ paymentStatus: "unpaid" }) }),
    (error) => error.code === "notification_order_not_paid",
  );
});

test("rejects paid orders with inconsistent trusted summaries", () => {
  assert.throws(
    () => buildPaidOrderNotifications({ order: paidOrder({ subtotalCents: 1 }) }),
    (error) => error.code === "notification_order_summary_invalid",
  );
  assert.throws(
    () => buildPaidOrderNotifications({
      order: paidOrder({
        customer: {
          contact: "customer@example.com",
          name: "",
          preferredContact: "email",
          shippingZip: "62401",
        },
      }),
    }),
    (error) => error.code === "notification_order_summary_invalid",
  );
});

test("rejects identifiers that cannot be safe Firestore document ids", () => {
  assert.throws(
    () => buildPaidOrderNotifications({
      order: paidOrder(),
      orderRequestId: "orders/order_123",
    }),
    (error) => error.code === "notification_identifier_invalid",
  );
  assert.throws(
    () => buildPaidOrderNotifications({
      order: paidOrder(),
      orderRequestId: "x".repeat(161),
    }),
    (error) => error.code === "notification_identifier_invalid",
  );
});
