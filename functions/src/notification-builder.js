"use strict";

const DEFAULT_ADMIN_EMAIL = "theosfeedfarm@gmail.com";
const SUPPORTED_PRODUCTS = Object.freeze({
  "ear-corn-20lb": "20 lb Ear Corn Bag",
  "ear-corn-40lb": "40 lb Ear Corn Bag",
});

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function requireSafeId(value, fieldName) {
  const id = String(value || "").trim();
  if (id.length > 160 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    const error = new Error(`${fieldName} must be a bounded identifier.`);
    error.code = "notification_identifier_invalid";
    throw error;
  }
  return id;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "";
  }
  return email;
}

function formatMoney(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 2) {
    const error = new Error("Paid order notifications require supported order items.");
    error.code = "notification_items_invalid";
    throw error;
  }

  return items.map((item) => {
    const sku = cleanText(item && item.sku, 80);
    const quantity = Number(item && item.quantity);
    const unitPriceCents = Number(item && item.unitPriceCents);
    if (
      !SUPPORTED_PRODUCTS[sku] ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50 ||
      !Number.isInteger(unitPriceCents) ||
      unitPriceCents < 1
    ) {
      const error = new Error("Paid order notifications require valid supported item lines.");
      error.code = "notification_items_invalid";
      throw error;
    }

    return {
      name: SUPPORTED_PRODUCTS[sku],
      quantity,
      sku,
      unitPriceCents,
    };
  });
}

function itemLines(items) {
  return items.map((item) => (
    `${item.quantity} x ${item.name} - ${formatMoney(item.quantity * item.unitPriceCents)}`
  ));
}

function requirePaidOrder(order) {
  if (!order || typeof order !== "object" || order.paymentStatus !== "paid") {
    const error = new Error("Paid order notifications can only be built after trusted payment confirmation.");
    error.code = "notification_order_not_paid";
    throw error;
  }
}

function buildCustomerJob({ customer, itemSummary, orderRequestId, paidEventId, shippingZip, subtotalCents }) {
  const to = normalizeEmail(customer.contact);
  if (!to) {
    return null;
  }

  const idempotencyKey = `customer.order_confirmation:${orderRequestId}:${paidEventId}`;
  return {
    eventName: "customer.order_confirmation",
    idempotencyKey,
    orderRequestId,
    paidEventId,
    recipientCategory: "customer",
    status: "pending",
    subject: `Theo's Farm order ${orderRequestId} payment confirmed`,
    text: [
      `Thanks ${cleanText(customer.name, 120)},`,
      "",
      `Payment for Theo's Farm order ${orderRequestId} has been confirmed.`,
      "",
      "Items:",
      ...itemSummary,
      `Subtotal: ${formatMoney(subtotalCents)}`,
      `Shipping destination: ZIP ${shippingZip}`,
      "",
      "We will prepare your freshly packed ear corn for shipment.",
      "Questions? Contact Theo's Farm at theosfeedfarm@gmail.com.",
    ].join("\n"),
    to,
  };
}

function buildAdminJob({ adminEmail, customer, itemSummary, notePresent, orderRequestId, paidEventId, shippingZip, subtotalCents }) {
  const to = normalizeEmail(adminEmail);
  if (!to) {
    const error = new Error("Paid order notifications require a valid admin email.");
    error.code = "notification_admin_email_invalid";
    throw error;
  }

  const idempotencyKey = `admin.paid_order_created:${orderRequestId}:${paidEventId}`;
  return {
    eventName: "admin.paid_order_created",
    idempotencyKey,
    orderRequestId,
    paidEventId,
    recipientCategory: "admin",
    status: "pending",
    subject: `Paid Theo's Farm order ${orderRequestId}`,
    text: [
      `Paid order: ${orderRequestId}`,
      `Customer: ${cleanText(customer.name, 120)}`,
      `Preferred contact: ${cleanText(customer.preferredContact, 20) || "not specified"}`,
      `Contact: ${cleanText(customer.contact, 160)}`,
      `Shipping ZIP: ${shippingZip}`,
      `Customer note present: ${notePresent ? "yes" : "no"}`,
      "",
      "Items:",
      ...itemSummary,
      `Subtotal: ${formatMoney(subtotalCents)}`,
      "Payment status: paid",
      "Fulfillment status: needs review",
    ].join("\n"),
    to,
  };
}

function buildPaidOrderNotifications({
  adminEmail = DEFAULT_ADMIN_EMAIL,
  order,
  orderRequestId: requestedOrderId,
  paidEventId: requestedEventId,
} = {}) {
  requirePaidOrder(order);

  const orderRequestId = requireSafeId(requestedOrderId || order.id || order.orderRequestId, "orderRequestId");
  const paidEventId = requireSafeId(requestedEventId || order.lastStripeEventId, "paidEventId");
  const items = normalizeItems(order.items);
  const rawCustomer = order.customer && typeof order.customer === "object" ? order.customer : {};
  const customer = {
    contact: cleanText(rawCustomer.contact, 160),
    name: cleanText(rawCustomer.name, 120),
    note: cleanText(rawCustomer.note, 1000),
    preferredContact: cleanText(rawCustomer.preferredContact, 20),
    shippingZip: cleanText(rawCustomer.shippingZip, 10),
  };
  const shippingZip = cleanText(
    customer.shippingZip || order.shippingAddress && order.shippingAddress.zip,
    10,
  );
  const subtotalCents = Number(order.subtotalCents);
  const calculatedSubtotalCents = items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );

  if (
    !customer.name ||
    customer.contact.length < 3 ||
    !/^\d{5}$/.test(shippingZip) ||
    !Number.isInteger(subtotalCents) ||
    subtotalCents !== calculatedSubtotalCents
  ) {
    const error = new Error("Paid order notifications require a valid subtotal and shipping ZIP.");
    error.code = "notification_order_summary_invalid";
    throw error;
  }

  const summary = itemLines(items);
  const common = {
    customer,
    itemSummary: summary,
    notePresent: Boolean(customer.note),
    orderRequestId,
    paidEventId,
    shippingZip,
    subtotalCents,
  };
  const customerJob = buildCustomerJob(common);
  const adminJob = buildAdminJob({ ...common, adminEmail });

  return [customerJob, adminJob].filter(Boolean);
}

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  buildPaidOrderNotifications,
  normalizeEmail,
};
