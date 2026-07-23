"use strict";

const {
  DEFAULT_ADMIN_EMAIL,
  normalizeEmail,
} = require("./notification-builder");

const MAX_SUMMARY_ORDERS = 500;
const MAX_FOLLOW_UP_ORDERS = 20;
const SUPPORTED_STATUSES = Object.freeze([
  "needs_review",
  "ready_to_pack",
  "packed",
]);
const SUPPORTED_SKUS = Object.freeze([
  "ear-corn-20lb",
  "ear-corn-40lb",
]);

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanLine(value, maxLength = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function requireSummaryDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("Daily fulfillment summary requires a YYYY-MM-DD date.");
    error.code = "notification_summary_date_invalid";
    throw error;
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    const error = new Error("Daily fulfillment summary date is not a calendar date.");
    error.code = "notification_summary_date_invalid";
    throw error;
  }
  return date;
}

function requireOrders(orders) {
  if (!Array.isArray(orders) || orders.length > MAX_SUMMARY_ORDERS) {
    const error = new Error("Daily fulfillment summary requires a bounded order list.");
    error.code = "notification_summary_orders_invalid";
    throw error;
  }
  return orders;
}

function normalizeOrder(order) {
  const rawId = String(order && (order.id || order.orderRequestId) || "").trim();
  const id = cleanText(rawId, 160);
  const status = cleanText(order && order.status, 40);
  const customerName = cleanLine(order && order.customer && order.customer.name, 120);

  if (
    rawId.length > 160 ||
    !/^[A-Za-z0-9_-]+$/.test(id) ||
    !order ||
    order.paymentStatus !== "paid" ||
    !SUPPORTED_STATUSES.includes(status) ||
    !customerName ||
    !Array.isArray(order.items) ||
    order.items.length < 1 ||
    order.items.length > 2
  ) {
    const error = new Error("Daily fulfillment summary received an invalid trusted order.");
    error.code = "notification_summary_order_invalid";
    throw error;
  }

  const quantities = Object.fromEntries(SUPPORTED_SKUS.map((sku) => [sku, 0]));
  for (const item of order.items) {
    const sku = cleanText(item && item.sku, 80);
    const quantity = Number(item && item.quantity);
    if (!SUPPORTED_SKUS.includes(sku) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      const error = new Error("Daily fulfillment summary received invalid supported items.");
      error.code = "notification_summary_order_invalid";
      throw error;
    }
    quantities[sku] += quantity;
  }

  return { customerName, id, quantities, status };
}

function buildDailyFulfillmentSummary({
  adminEmail = DEFAULT_ADMIN_EMAIL,
  orders,
  summaryDate,
} = {}) {
  const date = requireSummaryDate(summaryDate);
  const to = normalizeEmail(adminEmail);
  if (!to) {
    const error = new Error("Daily fulfillment summary requires a valid admin email.");
    error.code = "notification_admin_email_invalid";
    throw error;
  }

  const normalizedOrders = requireOrders(orders).map(normalizeOrder);
  const counts = Object.fromEntries(SUPPORTED_STATUSES.map((status) => [status, 0]));
  const bagTotals = Object.fromEntries(SUPPORTED_SKUS.map((sku) => [sku, 0]));

  for (const order of normalizedOrders) {
    counts[order.status] += 1;
    for (const sku of SUPPORTED_SKUS) {
      bagTotals[sku] += order.quantities[sku];
    }
  }

  const followUpOrders = normalizedOrders
    .filter((order) => order.status === "needs_review")
    .slice(0, MAX_FOLLOW_UP_ORDERS);
  const omittedFollowUpCount = counts.needs_review - followUpOrders.length;
  const followUpLines = followUpOrders.length
    ? followUpOrders.map((order) => `- ${order.id}: ${order.customerName}`)
    : ["- None"];
  if (omittedFollowUpCount > 0) {
    followUpLines.push(`- ${omittedFollowUpCount} additional order(s) omitted; open the admin dashboard.`);
  }

  return {
    eventName: "admin.daily_fulfillment_summary",
    idempotencyKey: `admin.daily_fulfillment_summary:${date}`,
    recipientCategory: "admin",
    status: "pending",
    subject: `Theo's Farm fulfillment summary for ${date}`,
    summaryDate: date,
    text: [
      `Theo's Farm fulfillment summary for ${date}`,
      "",
      `Needs review: ${counts.needs_review}`,
      `Ready to pack: ${counts.ready_to_pack}`,
      `Packed: ${counts.packed}`,
      `20 lb bags: ${bagTotals["ear-corn-20lb"]}`,
      `40 lb bags: ${bagTotals["ear-corn-40lb"]}`,
      "",
      "Orders needing follow-up:",
      ...followUpLines,
    ].join("\n"),
    to,
  };
}

module.exports = {
  MAX_FOLLOW_UP_ORDERS,
  MAX_SUMMARY_ORDERS,
  buildDailyFulfillmentSummary,
};
