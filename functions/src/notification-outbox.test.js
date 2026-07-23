"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createNotificationOutbox } = require("./notification-outbox");

const order = {
  id: "order_123",
  customer: {
    contact: "customer@example.com",
    name: "Customer Name",
    preferredContact: "email",
    shippingZip: "62401",
  },
  items: [{
    quantity: 1,
    sku: "ear-corn-20lb",
    unitPriceCents: 1795,
  }],
  lastStripeEventId: "evt_paid_123",
  paymentStatus: "paid",
  subtotalCents: 1795,
};

test("builds and delegates paid-order jobs to trusted persistence", async () => {
  let receivedJobs;
  const outbox = createNotificationOutbox({
    enqueueNotificationJobs({ jobs }) {
      receivedJobs = jobs;
      return { created: 2, duplicates: 0 };
    },
  });

  const result = await outbox.queuePaidOrderNotifications({ order });

  assert.equal(receivedJobs.length, 2);
  assert.equal(result.created, 2);
  assert.equal(result.duplicates, 0);
  assert.deepEqual(result.jobs.map((job) => job.recipientCategory), ["customer", "admin"]);
});

test("fails closed without trusted outbox persistence", () => {
  assert.throws(
    () => createNotificationOutbox(),
    (error) => error.code === "notification_outbox_dependency_missing",
  );
});
