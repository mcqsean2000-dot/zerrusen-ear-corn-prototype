const sampleOrders = [
  {
    id: "REQ-1001",
    customer: { name: "M. Keller", contact: "mkeller@example.com", preferredContact: "email", shippingZip: "62401", note: "Confirm shipping quote before checkout link." },
    status: "needs_review",
    subtotalCents: 4400,
    items: [
      { sku: "ear-corn-20lb", name: "20 lb Ear Corn Bag", quantity: 1, unitPriceCents: 1600 },
      { sku: "ear-corn-40lb", name: "40 lb Ear Corn Bag", quantity: 1, unitPriceCents: 2800 },
    ],
  },
  {
    id: "REQ-1002",
    customer: { name: "J. Smith", contact: "217-555-0148", preferredContact: "text", shippingZip: "62462", note: "Repeat buyer. Wants two large bags this week." },
    status: "ready_to_pack",
    subtotalCents: 5600,
    items: [{ sku: "ear-corn-40lb", name: "40 lb Ear Corn Bag", quantity: 2, unitPriceCents: 2800 }],
  },
  {
    id: "REQ-1003",
    customer: { name: "A. Martin", contact: "amartin@example.com", preferredContact: "phone", shippingZip: "62565", note: "Packing complete; waiting on shipping confirmation." },
    status: "packed",
    subtotalCents: 4800,
    items: [{ sku: "ear-corn-20lb", name: "20 lb Ear Corn Bag", quantity: 3, unitPriceCents: 1600 }],
  },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const statusLabels = { needs_review: "Needs review", ready_to_pack: "Ready to pack", packed: "Packed" };
const summary = document.querySelector("[data-admin-summary]");
const rows = document.querySelector("[data-order-rows]");
const packingList = document.querySelector("[data-packing-list]");
const statusFilter = document.querySelector("[data-status-filter]");

function cents(value) { return money.format(value / 100); }
function itemSummary(order) { return order.items.map((item) => item.quantity + " x " + item.name).join(", "); }
function bagCounts(orders) {
  return orders.reduce((counts, order) => {
    order.items.forEach((item) => {
      if (item.sku === "ear-corn-20lb") counts.twenty += item.quantity;
      if (item.sku === "ear-corn-40lb") counts.forty += item.quantity;
    });
    return counts;
  }, { twenty: 0, forty: 0 });
}

function renderSummary(orders) {
  const counts = bagCounts(orders);
  const needsReview = orders.filter((order) => order.status === "needs_review").length;
  const ready = orders.filter((order) => order.status === "ready_to_pack").length;
  const metrics = [[orders.length, "Order requests"], [needsReview, "Need review"], [ready, "Ready to pack"], [counts.twenty + counts.forty, "Bags today"]];
  summary.innerHTML = metrics.map(([value, label]) => '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>').join("");
}

function renderRows(orders) {
  rows.innerHTML = orders.map((order) => {
    return [
      "<tr>",
      "<td><strong>" + order.customer.name + "</strong><small>" + order.id + " · ZIP " + order.customer.shippingZip + "</small></td>",
      "<td>" + itemSummary(order) + "<small>" + cents(order.subtotalCents) + " estimated subtotal</small></td>",
      '<td><span class="status-pill" data-status="' + order.status + '">' + statusLabels[order.status] + '</span></td>',
      "<td>" + order.customer.contact + "<small>Prefers " + order.customer.preferredContact + "</small></td>",
      "<td>" + order.customer.note + "</td>",
      "</tr>",
    ].join("");
  }).join("");
}

function renderPackingList(orders) {
  const counts = bagCounts(orders.filter((order) => order.status !== "needs_review"));
  packingList.innerHTML = [
    '<div class="packing-row"><span>20 lb bags</span><strong>' + counts.twenty + '</strong></div>',
    '<div class="packing-row"><span>40 lb bags</span><strong>' + counts.forty + '</strong></div>',
    '<div class="packing-row"><span>Total bags</span><strong>' + (counts.twenty + counts.forty) + '</strong></div>',
  ].join("");
}

function render() {
  const status = statusFilter.value;
  const visibleOrders = status === "all" ? sampleOrders : sampleOrders.filter((order) => order.status === status);
  renderSummary(visibleOrders);
  renderRows(visibleOrders);
  renderPackingList(visibleOrders);
}

statusFilter.addEventListener("change", render);
render();
