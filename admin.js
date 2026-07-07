const adminStatusLabels = Object.freeze({
  needs_review: "Needs review",
  ready_to_pack: "Ready to pack",
  packed: "Packed",
});

const adminAllowedStatuses = Object.freeze(Object.keys(adminStatusLabels));

const adminStatusTransitions = Object.freeze({
  needs_review: Object.freeze(["ready_to_pack"]),
  ready_to_pack: Object.freeze(["needs_review", "packed"]),
  packed: Object.freeze(["ready_to_pack"]),
});

const adminBagSkus = Object.freeze({
  "ear-corn-20lb": "twenty",
  "ear-corn-40lb": "forty",
});

const sampleOrders = [
  {
    id: "REQ-1001",
    customer: { name: "M. Keller", contact: "mkeller@example.com", preferredContact: "email", shippingZip: "62401", note: "Confirm shipping rate before checkout link." },
    status: "needs_review",
    subtotalCents: 4790,
    items: [
      { sku: "ear-corn-20lb", name: "20 lb Ear Corn Bag", quantity: 1, unitPriceCents: 1795 },
      { sku: "ear-corn-40lb", name: "40 lb Ear Corn Bag", quantity: 1, unitPriceCents: 2995 },
    ],
  },
  {
    id: "REQ-1002",
    customer: { name: "J. Smith", contact: "217-555-0148", preferredContact: "text", shippingZip: "62462", note: "Repeat buyer. Wants two large bags this week." },
    status: "ready_to_pack",
    paymentStatus: "paid",
    subtotalCents: 5990,
    shippingCarrier: "UPS",
    shippingService: "Ground",
    shippingAmountCents: 4825,
    shippingCurrency: "USD",
    shippingPackageCount: 2,
    shippingPackageRateIds: ["rate_large_1", "rate_large_2"],
    items: [{ sku: "ear-corn-40lb", name: "40 lb Ear Corn Bag", quantity: 2, unitPriceCents: 2995 }],
  },
  {
    id: "REQ-1003",
    customer: { name: "A. Martin", contact: "amartin@example.com", preferredContact: "phone", shippingZip: "62565", note: "Packing complete; waiting on shipping confirmation." },
    status: "packed",
    paymentStatus: "paid",
    subtotalCents: 5385,
    shippingCarrier: "USPS",
    shippingService: "Ground Advantage",
    shippingAmountCents: 3642,
    shippingCurrency: "USD",
    shippingPackageCount: 3,
    shippoTransactionId: "shippo_txn_sample_1003",
    trackingNumber: "9400100000000000000000",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000",
    labelUrl: "https://example.com/theos-sample-label.pdf",
    labelPurchasedAt: "2026-07-07",
    items: [{ sku: "ear-corn-20lb", name: "20 lb Ear Corn Bag", quantity: 3, unitPriceCents: 1795 }],
  },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const summary = document.querySelector("[data-admin-summary]");
const rows = document.querySelector("[data-order-rows]");
const packingList = document.querySelector("[data-packing-list]");
const statusFilter = document.querySelector("[data-status-filter]");

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asWholeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function escapeHtml(value) {
  return asText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cents(value) {
  return money.format(asWholeNumber(value) / 100);
}

function safeUrl(value) {
  const url = asText(value);
  return /^https:\/\//i.test(url) ? url : "";
}

function isAllowedAdminStatus(status) {
  return Object.prototype.hasOwnProperty.call(adminStatusLabels, status);
}

function normalizeAdminStatus(status) {
  return isAllowedAdminStatus(status) ? status : "needs_review";
}

function getAllowedAdminStatusTransitions(status) {
  return isAllowedAdminStatus(status) ? adminStatusTransitions[status].slice() : [];
}

function canTransitionAdminStatus(fromStatus, toStatus) {
  if (!isAllowedAdminStatus(fromStatus) || !isAllowedAdminStatus(toStatus)) return false;
  return fromStatus === toStatus || adminStatusTransitions[fromStatus].includes(toStatus);
}

function normalizeAdminItem(item) {
  const quantity = asWholeNumber(item?.quantity);
  const unitPriceCents = asWholeNumber(item?.unitPriceCents);
  return {
    sku: asText(item?.sku),
    name: asText(item?.name) || asText(item?.sku) || "Unknown item",
    quantity,
    unitPriceCents,
    lineSubtotalCents: quantity * unitPriceCents,
  };
}

function normalizeAdminCustomer(customer) {
  return {
    name: asText(customer?.name) || "Unknown customer",
    contact: asText(customer?.contact) || "No contact provided",
    preferredContact: asText(customer?.preferredContact).toLowerCase() || "email",
    shippingZip: asText(customer?.shippingZip) || "Unknown",
    note: asText(customer?.note),
  };
}

function normalizeAdminShipping(order) {
  const source = order?.shipping || order || {};
  const packageRateIds = Array.isArray(source?.packageRateIds || source?.shippingPackageRateIds)
    ? (source.packageRateIds || source.shippingPackageRateIds).map(asText).filter(Boolean)
    : [];

  return {
    carrier: asText(source?.carrier || source?.shippingCarrier),
    service: asText(source?.service || source?.shippingService),
    amountCents: asWholeNumber(source?.amountCents || source?.shippingAmountCents),
    currency: asText(source?.currency || source?.shippingCurrency) || "USD",
    packageCount: asWholeNumber(source?.packageCount || source?.shippingPackageCount),
    packageRateIds,
    rateId: asText(source?.rateId || source?.shippingRateId),
    shippoTransactionId: asText(source?.shippoTransactionId),
    labelPurchasedAt: asText(source?.labelPurchasedAt),
    labelUrl: safeUrl(source?.labelUrl),
    trackingNumber: asText(source?.trackingNumber),
    trackingUrl: safeUrl(source?.trackingUrl),
  };
}

function normalizeAdminOrder(order) {
  const items = Array.isArray(order?.items) ? order.items.map(normalizeAdminItem).filter((item) => item.quantity > 0) : [];
  const calculatedSubtotalCents = items.reduce((total, item) => total + item.lineSubtotalCents, 0);
  const subtotalCents = asWholeNumber(order?.subtotalCents) || calculatedSubtotalCents;

  return {
    id: asText(order?.id) || "Unassigned",
    customer: normalizeAdminCustomer(order?.customer),
    paymentStatus: asText(order?.paymentStatus) || "unpaid",
    shipping: normalizeAdminShipping(order),
    status: normalizeAdminStatus(order?.status),
    subtotalCents,
    items,
  };
}

function normalizeAdminOrders(orders) {
  return Array.isArray(orders) ? orders.map(normalizeAdminOrder) : [];
}

function buildAdminOrderViewModel(order) {
  const normalizedOrder = normalizeAdminOrder(order);
  const itemSummary = normalizedOrder.items.map((item) => item.quantity + " x " + item.name).join(", ") || "No items";
  const shipping = buildAdminShippingViewModel(normalizedOrder.shipping);

  return {
    id: normalizedOrder.id,
    customerName: normalizedOrder.customer.name,
    shippingZip: normalizedOrder.customer.shippingZip,
    contact: normalizedOrder.customer.contact,
    preferredContact: normalizedOrder.customer.preferredContact,
    note: normalizedOrder.customer.note || "No notes",
    status: normalizedOrder.status,
    statusLabel: adminStatusLabels[normalizedOrder.status],
    allowedNextStatuses: getAllowedAdminStatusTransitions(normalizedOrder.status),
    itemSummary,
    paymentStatus: normalizedOrder.paymentStatus,
    shipping,
    subtotalLabel: cents(normalizedOrder.subtotalCents),
  };
}

function buildAdminShippingViewModel(shipping) {
  const carrierService = [asText(shipping?.carrier), asText(shipping?.service)].filter(Boolean).join(" ");
  const packageCount = asWholeNumber(shipping?.packageCount);
  const packageLabel = packageCount ? packageCount + " package" + (packageCount === 1 ? "" : "s") : "Package count pending";
  const amountLabel = asWholeNumber(shipping?.amountCents) ? cents(shipping.amountCents) + " shipping" : "Shipping not set";
  const trackingNumber = asText(shipping?.trackingNumber);
  const trackingUrl = safeUrl(shipping?.trackingUrl);
  const labelUrl = safeUrl(shipping?.labelUrl);

  return {
    amountLabel,
    carrierService: carrierService || "Carrier pending",
    hasLabel: Boolean(labelUrl),
    labelPurchasedAt: asText(shipping?.labelPurchasedAt),
    labelUrl,
    packageLabel,
    trackingLabel: trackingNumber || "Tracking pending",
    trackingNumber,
    trackingUrl,
  };
}

function calculateAdminBagCounts(orders) {
  return normalizeAdminOrders(orders).reduce((counts, order) => {
    order.items.forEach((item) => {
      const countKey = adminBagSkus[item.sku];
      if (countKey) counts[countKey] += item.quantity;
    });
    counts.total = counts.twenty + counts.forty;
    return counts;
  }, { twenty: 0, forty: 0, total: 0 });
}

function buildAdminFulfillmentSummary(orders) {
  const normalizedOrders = normalizeAdminOrders(orders);
  const counts = calculateAdminBagCounts(normalizedOrders);

  return {
    orderCount: normalizedOrders.length,
    needsReviewCount: normalizedOrders.filter((order) => order.status === "needs_review").length,
    readyToPackCount: normalizedOrders.filter((order) => order.status === "ready_to_pack").length,
    packedCount: normalizedOrders.filter((order) => order.status === "packed").length,
    bagCounts: counts,
  };
}

function getAdminPackableOrders(orders) {
  return normalizeAdminOrders(orders).filter((order) => order.status !== "needs_review");
}

const adminOrders = normalizeAdminOrders(sampleOrders);

if (typeof window !== "undefined") {
  window.TheosAdminOrders = {
    allowedStatuses: adminAllowedStatuses,
    statusLabels: adminStatusLabels,
    statusTransitions: adminStatusTransitions,
    normalizeOrder: normalizeAdminOrder,
    normalizeOrders: normalizeAdminOrders,
    buildOrderViewModel: buildAdminOrderViewModel,
    buildShippingViewModel: buildAdminShippingViewModel,
    calculateBagCounts: calculateAdminBagCounts,
    buildFulfillmentSummary: buildAdminFulfillmentSummary,
    getPackableOrders: getAdminPackableOrders,
    canTransitionStatus: canTransitionAdminStatus,
    getAllowedStatusTransitions: getAllowedAdminStatusTransitions,
  };
}

function renderSummary(orders) {
  const fulfillmentSummary = buildAdminFulfillmentSummary(orders);
  const metrics = [
    [fulfillmentSummary.orderCount, "Order requests"],
    [fulfillmentSummary.needsReviewCount, "Need review"],
    [fulfillmentSummary.readyToPackCount, "Ready to pack"],
    [fulfillmentSummary.bagCounts.total, "Bags today"],
  ];
  summary.innerHTML = metrics.map(([value, label]) => '<div class="metric"><strong>' + value + '</strong><span>' + escapeHtml(label) + '</span></div>').join("");
}

function renderRows(orders) {
  rows.innerHTML = normalizeAdminOrders(orders).map((order) => {
    const viewModel = buildAdminOrderViewModel(order);
    const trackingMarkup = viewModel.shipping.trackingUrl
      ? '<a class="admin-link" href="' + escapeHtml(viewModel.shipping.trackingUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(viewModel.shipping.trackingLabel) + "</a>"
      : escapeHtml(viewModel.shipping.trackingLabel);
    const labelMarkup = viewModel.shipping.labelUrl
      ? '<a class="admin-link" href="' + escapeHtml(viewModel.shipping.labelUrl) + '" target="_blank" rel="noreferrer">Label ready</a>'
      : "Label pending";
    return [
      "<tr>",
      "<td><strong>" + escapeHtml(viewModel.customerName) + "</strong><small>" + escapeHtml(viewModel.id) + " - ZIP " + escapeHtml(viewModel.shippingZip) + "</small></td>",
      "<td>" + escapeHtml(viewModel.itemSummary) + "<small>" + escapeHtml(viewModel.subtotalLabel) + " estimated subtotal</small></td>",
      '<td><span class="status-pill" data-status="' + escapeHtml(viewModel.status) + '">' + escapeHtml(viewModel.statusLabel) + "</span></td>",
      "<td><strong>" + escapeHtml(viewModel.shipping.carrierService) + "</strong><small>" + escapeHtml(viewModel.shipping.amountLabel) + " - " + escapeHtml(viewModel.shipping.packageLabel) + "</small><small>" + labelMarkup + " - " + trackingMarkup + "</small></td>",
      "<td>" + escapeHtml(viewModel.contact) + "<small>Prefers " + escapeHtml(viewModel.preferredContact) + "</small></td>",
      "<td>" + escapeHtml(viewModel.note) + "</td>",
      "</tr>",
    ].join("");
  }).join("");
}

function renderPackingList(orders) {
  const counts = calculateAdminBagCounts(getAdminPackableOrders(orders));
  packingList.innerHTML = [
    '<div class="packing-row"><span>20 lb bags</span><strong>' + counts.twenty + "</strong></div>",
    '<div class="packing-row"><span>40 lb bags</span><strong>' + counts.forty + "</strong></div>",
    '<div class="packing-row"><span>Total bags</span><strong>' + counts.total + "</strong></div>",
  ].join("");
}

function render() {
  const status = statusFilter.value;
  const visibleOrders = status === "all" ? adminOrders : adminOrders.filter((order) => order.status === status);
  renderSummary(visibleOrders);
  renderRows(visibleOrders);
  renderPackingList(visibleOrders);
}

statusFilter.addEventListener("change", render);
render();
