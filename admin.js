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
const actionStatus = document.querySelector("[data-admin-action-status]");
const notificationMetrics = document.querySelector("[data-notification-metrics]");
const notificationRows = document.querySelector("[data-notification-rows]");
const notificationHealthStatus = document.querySelector("[data-notification-health-status]");
const notificationRefreshButton = document.querySelector("[data-notification-refresh]");
const socialDrafts = document.querySelector("[data-social-drafts]");
const socialStatus = document.querySelector("[data-social-status]");
const socialDraftsRefreshButton = document.querySelector("[data-social-drafts-refresh]");
const socialWeekApproveButton = document.querySelector("[data-social-week-approve]");
const socialReconciliationRefreshButton = document.querySelector("[data-social-reconciliation-refresh]");
const socialReconciliationRows = document.querySelector("[data-social-reconciliation-rows]");

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

function getAdminLabelRateIds(shipping) {
  const rateIds = [];
  const rateId = asText(shipping?.rateId);
  if (rateId) rateIds.push(rateId);
  if (Array.isArray(shipping?.packageRateIds)) {
    shipping.packageRateIds.map(asText).filter(Boolean).forEach((packageRateId) => rateIds.push(packageRateId));
  }
  return Array.from(new Set(rateIds));
}

function normalizeAdminOrders(orders) {
  return Array.isArray(orders) ? orders.map(normalizeAdminOrder) : [];
}

function buildAdminOrderViewModel(order) {
  const normalizedOrder = normalizeAdminOrder(order);
  const itemSummary = normalizedOrder.items.map((item) => item.quantity + " x " + item.name).join(", ") || "No items";
  const shipping = buildAdminShippingViewModel(normalizedOrder.shipping);
  const labelAction = buildAdminLabelActionViewModel(normalizedOrder);

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
    labelAction,
    subtotalLabel: cents(normalizedOrder.subtotalCents),
  };
}

function buildAdminLabelActionViewModel(order) {
  const normalizedOrder = normalizeAdminOrder(order);
  const rateIds = getAdminLabelRateIds(normalizedOrder.shipping);
  const paid = normalizedOrder.paymentStatus === "paid";
  const hasLabel = Boolean(normalizedOrder.shipping.labelUrl || normalizedOrder.shipping.shippoTransactionId);
  const labelCount = rateIds.length || asWholeNumber(normalizedOrder.shipping.packageCount) || 1;
  const labelNoun = labelCount === 1 ? "label" : "labels";

  if (hasLabel) {
    return {
      disabled: true,
      endpoint: "",
      label: "Label ready",
      reason: "Tracking stored",
      requestBody: null,
      state: "complete",
    };
  }

  if (!paid) {
    return {
      disabled: true,
      endpoint: "",
      label: "Payment required",
      reason: "Awaiting paid order",
      requestBody: null,
      state: "blocked",
    };
  }

  if (!rateIds.length) {
    return {
      disabled: true,
      endpoint: "",
      label: "Rate required",
      reason: "No trusted rate",
      requestBody: null,
      state: "blocked",
    };
  }

  return {
    disabled: true,
    endpoint: "/api/admin/shippo-labels",
    label: "Queue " + labelCount + " " + labelNoun,
    reason: "Auth required",
    requestBody: {
      orderRequestId: normalizedOrder.id,
      rateId: rateIds[0],
    },
    state: "auth_required",
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
let currentAdminOrders = adminOrders;
let currentAdminActions = null;
let currentNotificationHealth = {
  counts: {},
  jobs: [],
  truncatedStatuses: [],
};
let currentSocialDrafts = [];
let currentSocialWeekOf = "";
let currentSocialExceptions = [];

function setAdminOrders(orders) {
  currentAdminOrders = normalizeAdminOrders(orders);
  render(currentAdminOrders);
}

function hasAdminActions() {
  return Boolean(
    currentAdminActions &&
      typeof currentAdminActions.postAdminJson === "function" &&
      currentAdminActions.user &&
      currentAdminActions.endpoints &&
      asText(currentAdminActions.endpoints.labelPurchase) &&
      asText(currentAdminActions.endpoints.statusUpdate),
  );
}

function setAdminActions(actions) {
  currentAdminActions = actions && typeof actions.postAdminJson === "function" ? actions : null;
  render(currentAdminOrders);
  renderNotificationHealth();
  renderSocialDrafts();
  renderSocialExceptions();
  if (currentAdminActions) {
    refreshNotificationHealth();
    loadSocialDrafts();
    refreshSocialExceptions();
  }
}

function clearAdminActions() {
  currentAdminActions = null;
  currentSocialDrafts = [];
  currentSocialWeekOf = "";
  currentSocialExceptions = [];
  setAdminActionStatus("");
  render(currentAdminOrders);
  setNotificationHealth();
  renderSocialDrafts();
  renderSocialExceptions();
}

function socialActionsReady() {
  return Boolean(
    currentAdminActions &&
      typeof currentAdminActions.postAdminJson === "function" &&
      typeof currentAdminActions.getAdminJson === "function" &&
      currentAdminActions.user,
  );
}

function normalizedSocialDraft(value) {
  const draft = value && typeof value === "object" ? value : {};
  return {
    caption: asText(draft.caption),
    hashtags: Array.isArray(draft.hashtags) ? draft.hashtags.map(asText).filter(Boolean) : [],
    imageUrl: safeUrl(draft.imageUrl),
    platforms: Array.isArray(draft.platforms)
      ? draft.platforms.map(asText).filter((platform) => ["facebook", "instagram"].includes(platform))
      : [],
    postId: asText(draft.postId),
    scheduledAt: asText(draft.scheduledAt),
    state: asText(draft.state || draft.status) || "draft",
  };
}

function renderSocialDrafts() {
  if (!socialDrafts || !socialStatus) return;
  if (!currentSocialDrafts.length) {
    socialDrafts.innerHTML = "";
    if (socialWeekApproveButton) socialWeekApproveButton.disabled = true;
    if (!currentAdminActions) socialStatus.textContent = "Social drafts load after admin sign-in.";
    return;
  }
  const queueReady = socialActionsReady() && asText(currentAdminActions.endpoints?.socialQueue);
  const allQueued = currentSocialDrafts.every((draft) => draft.state === "queued");
  if (socialWeekApproveButton) {
    socialWeekApproveButton.disabled = !queueReady || allQueued;
    socialWeekApproveButton.textContent = allQueued ? "Week approved" : "Approve entire week";
  }
  socialDrafts.innerHTML = currentSocialDrafts.map((draft) => {
    const queued = draft.state === "queued";
    const scheduled = new Date(draft.scheduledAt);
    const scheduleLabel = Number.isFinite(scheduled.getTime())
      ? scheduled.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
      : "Invalid schedule";
    return [
      '<article class="social-draft">',
      "<h3>" + escapeHtml(draft.postId) + "</h3>",
      "<p>" + escapeHtml(draft.caption) + "</p>",
      '<div class="social-draft-meta"><span>' + escapeHtml(scheduleLabel) + "</span><span>" +
        escapeHtml(draft.platforms.join(" + ")) + "</span><span>" +
        escapeHtml(draft.hashtags.join(" ")) + "</span></div>",
      '<button class="admin-action" type="button" data-social-approve="' + escapeHtml(draft.postId) +
        '" data-state="' + escapeHtml(draft.state) + '"' +
        (!queueReady || queued ? " disabled" : "") + ">" +
        (queued ? "Queued" : "Approve and queue") + "</button>",
      "</article>",
    ].join("");
  }).join("");
  socialStatus.textContent = "Review all seven posts, then approve the week once.";
}

async function loadSocialDrafts() {
  if (!socialDrafts || !socialStatus) return;
  if (socialDraftsRefreshButton) socialDraftsRefreshButton.disabled = true;
  socialStatus.textContent = "Loading the review-only batch...";
  try {
    if (!currentAdminActions || typeof currentAdminActions.loadSocialDraftBatch !== "function") {
      throw new Error("Social draft loader is unavailable.");
    }
    const batch = await currentAdminActions.loadSocialDraftBatch();
    if (batch.reviewStatus !== "draft" || !Array.isArray(batch.posts) || batch.posts.length !== 7) {
      throw new Error("Social draft batch is invalid.");
    }
    currentSocialWeekOf = asText(batch.weekOf);
    currentSocialDrafts = batch.posts.map(normalizedSocialDraft).filter((draft) => draft.postId);
    renderSocialDrafts();
  } catch (error) {
    currentSocialWeekOf = "";
    currentSocialDrafts = [];
    socialDrafts.innerHTML = "";
    socialStatus.textContent = "Social drafts could not be loaded. Refresh the page and try again.";
  } finally {
    if (socialDraftsRefreshButton) socialDraftsRefreshButton.disabled = false;
  }
}

function socialDraftRequestBody(draft) {
  return {
    caption: draft.caption,
    hashtags: draft.hashtags,
    imageUrl: draft.imageUrl,
    platforms: draft.platforms,
    postId: draft.postId,
    scheduledAt: draft.scheduledAt,
  };
}

async function approveSocialDraft(target) {
  const postId = asText(target?.dataset?.socialApprove);
  const draft = currentSocialDrafts.find((candidate) => candidate.postId === postId);
  if (
    !draft ||
    !socialActionsReady() ||
    !asText(currentAdminActions.endpoints?.socialQueue)
  ) {
    return;
  }
  const approved = window.confirm(
    "Approve " + postId + " for " + draft.platforms.join(" and ") +
      " at its displayed scheduled time? This adds it to the guarded queue.",
  );
  if (!approved) return;

  target.disabled = true;
  try {
    await currentAdminActions.postAdminJson({
      endpoint: currentAdminActions.endpoints.socialQueue,
      user: currentAdminActions.user,
      body: socialDraftRequestBody(draft),
    });
    currentSocialDrafts = currentSocialDrafts.map((candidate) => (
      candidate.postId === postId ? { ...candidate, state: "queued" } : candidate
    ));
    setAdminActionStatus("Social post approved and added to the guarded queue.");
    renderSocialDrafts();
  } catch (error) {
    target.disabled = false;
    setAdminActionStatus("Social post approval failed. Check the draft and admin access.", "error");
  }
}

async function approveSocialWeek() {
  if (
    !socialWeekApproveButton ||
    !currentSocialDrafts.length ||
    !socialActionsReady() ||
    !asText(currentAdminActions.endpoints?.socialQueue)
  ) {
    return;
  }
  const pending = currentSocialDrafts.filter((draft) => draft.state !== "queued");
  if (!pending.length) return;
  const approved = window.confirm(
    "Approve all " + pending.length + " posts for the week of " + currentSocialWeekOf +
      "? This queues the displayed Facebook and Instagram posts at their scheduled times.",
  );
  if (!approved) return;

  socialWeekApproveButton.disabled = true;
  setAdminActionStatus("Approving the weekly social batch...");
  try {
    for (const draft of pending) {
      await currentAdminActions.postAdminJson({
        endpoint: currentAdminActions.endpoints.socialQueue,
        user: currentAdminActions.user,
        body: socialDraftRequestBody(draft),
      });
      currentSocialDrafts = currentSocialDrafts.map((candidate) => (
        candidate.postId === draft.postId ? { ...candidate, state: "queued" } : candidate
      ));
      renderSocialDrafts();
    }
    setAdminActionStatus("Weekly social batch approved and scheduled.");
  } catch (error) {
    socialWeekApproveButton.disabled = false;
    setAdminActionStatus(
      "Weekly approval stopped before every post was queued. Review the batch and retry; completed posts are idempotent.",
      "error",
    );
  }
}

function normalizedSocialException(value) {
  const post = value && typeof value === "object" ? value : {};
  return {
    facebookPostId: asText(post.facebookPostId),
    instagramPostId: asText(post.instagramPostId),
    lastErrorCode: asText(post.lastErrorCode),
    platforms: Array.isArray(post.platforms) ? post.platforms.map(asText).filter(Boolean) : [],
    postId: asText(post.postId),
    publishAttempts: asWholeNumber(post.publishAttempts),
  };
}

function renderSocialExceptions() {
  if (!socialReconciliationRows) return;
  if (!currentSocialExceptions.length) {
    socialReconciliationRows.innerHTML = '<tr><td colspan="5">No publishing exceptions require review.</td></tr>';
    return;
  }
  const resolveReady = socialActionsReady() &&
    asText(currentAdminActions.endpoints?.socialReconciliationResolve);
  socialReconciliationRows.innerHTML = currentSocialExceptions.map((post) => [
    "<tr>",
    "<td><strong>" + escapeHtml(post.postId) + "</strong></td>",
    "<td>" + escapeHtml(post.platforms.join(", ")) + "</td>",
    "<td>" + post.publishAttempts + "</td>",
    "<td>" + escapeHtml(post.lastErrorCode || "Unknown") +
      (post.facebookPostId ? "<br>Facebook: " + escapeHtml(post.facebookPostId) : "") +
      (post.instagramPostId ? "<br>Instagram: " + escapeHtml(post.instagramPostId) : "") + "</td>",
    '<td><div class="social-resolution-actions">',
    '<button class="admin-action" type="button" data-social-resolution="mark_published" data-social-post-id="' +
      escapeHtml(post.postId) + '"' + (resolveReady ? "" : " disabled") + ">Confirm published</button>",
    '<button class="admin-action" type="button" data-social-resolution="retry_confirmed_not_published" data-social-post-id="' +
      escapeHtml(post.postId) + '"' + (resolveReady ? "" : " disabled") + ">Confirmed absent: retry</button>",
    '<button class="admin-action" type="button" data-social-resolution="skip" data-social-post-id="' +
      escapeHtml(post.postId) + '"' + (resolveReady ? "" : " disabled") + ">Skip</button>",
    "</div></td>",
    "</tr>",
  ].join("")).join("");
}

async function refreshSocialExceptions() {
  if (
    !socialActionsReady() ||
    !asText(currentAdminActions.endpoints?.socialReconciliation)
  ) {
    return;
  }
  if (socialReconciliationRefreshButton) socialReconciliationRefreshButton.disabled = true;
  try {
    const result = await currentAdminActions.getAdminJson({
      endpoint: currentAdminActions.endpoints.socialReconciliation,
      user: currentAdminActions.user,
    });
    currentSocialExceptions = Array.isArray(result.posts)
      ? result.posts.map(normalizedSocialException).filter((post) => post.postId)
      : [];
    renderSocialExceptions();
  } catch (error) {
    if (socialStatus) socialStatus.textContent = "Publishing exceptions could not be loaded.";
  } finally {
    if (socialReconciliationRefreshButton) socialReconciliationRefreshButton.disabled = false;
  }
}

async function resolveSocialException(target) {
  const postId = asText(target?.dataset?.socialPostId);
  const resolution = asText(target?.dataset?.socialResolution);
  if (
    !postId ||
    !["mark_published", "retry_confirmed_not_published", "skip"].includes(resolution) ||
    !socialActionsReady() ||
    !asText(currentAdminActions.endpoints?.socialReconciliationResolve)
  ) {
    return;
  }
  const post = currentSocialExceptions.find((candidate) => candidate.postId === postId);
  const providerPostIds = {};
  if (resolution === "mark_published") {
    if (!post) return;
    if (post.platforms.includes("facebook")) {
      const facebookPostId = post.facebookPostId || window.prompt(
        "Enter the verified Facebook post ID. Cancel if the post cannot be confirmed.",
        "",
      );
      if (!asText(facebookPostId)) return;
      providerPostIds.facebookPostId = asText(facebookPostId);
    }
    if (post.platforms.includes("instagram")) {
      const instagramPostId = post.instagramPostId || window.prompt(
        "Enter the verified Instagram post ID. Cancel if the post cannot be confirmed.",
        "",
      );
      if (!asText(instagramPostId)) return;
      providerPostIds.instagramPostId = asText(instagramPostId);
    }
  }
  const warning = resolution === "retry_confirmed_not_published"
    ? "Retry only after checking both selected Meta platforms and confirming the post does not exist. Confirm retry?"
    : resolution === "mark_published"
      ? "Mark this post published only after verifying every selected platform post ID?"
      : "Skip this ambiguous post permanently without republishing it?";
  if (!window.confirm(warning)) return;

  target.disabled = true;
  try {
    await currentAdminActions.postAdminJson({
      endpoint: currentAdminActions.endpoints.socialReconciliationResolve,
      user: currentAdminActions.user,
      body: {
        postId,
        resolution,
        ...(resolution === "mark_published" ? { providerPostIds } : {}),
      },
    });
    setAdminActionStatus(
      resolution === "skip"
        ? "Ambiguous social post skipped."
        : resolution === "mark_published"
          ? "Social post marked published with verified platform IDs."
          : "Social post returned to the approved queue.",
    );
    await refreshSocialExceptions();
  } catch (error) {
    target.disabled = false;
    setAdminActionStatus("Social publishing exception could not be resolved.", "error");
  }
}

function normalizeNotificationHealth(value) {
  const source = value && typeof value === "object" ? value : {};
  const counts = source.counts && typeof source.counts === "object" ? source.counts : {};
  const jobs = Array.isArray(source.jobs) ? source.jobs : [];
  return {
    counts: Object.fromEntries(
      ["pending", "processing", "retry_pending", "sent", "failed"].map((status) => [
        status,
        asWholeNumber(counts[status]),
      ]),
    ),
    jobs: jobs.map((job) => ({
      attempts: asWholeNumber(job?.attempts),
      eventName: asText(job?.eventName) || "unknown",
      id: asText(job?.id),
      lastErrorCode: asText(job?.lastErrorCode),
      maxAttempts: asWholeNumber(job?.maxAttempts),
      recipientCategory: asText(job?.recipientCategory) || "unknown",
      status: asText(job?.status) || "unknown",
    })).filter((job) => job.id),
    truncatedStatuses: Array.isArray(source.truncatedStatuses)
      ? source.truncatedStatuses.map(asText).filter(Boolean)
      : [],
  };
}

function setNotificationHealth(value) {
  currentNotificationHealth = normalizeNotificationHealth(value);
  renderNotificationHealth();
}

function renderNotificationHealth() {
  if (!notificationMetrics || !notificationRows || !notificationHealthStatus) return;
  const health = currentNotificationHealth;
  const labels = {
    pending: "Pending",
    processing: "Processing",
    retry_pending: "Retrying",
    sent: "Sent",
    failed: "Failed",
  };
  notificationMetrics.innerHTML = Object.keys(labels).map((status) => (
    '<div class="notification-metric"><strong>' +
    health.counts[status] +
    "</strong><span>" +
    escapeHtml(labels[status]) +
    "</span></div>"
  )).join("");

  notificationRows.innerHTML = health.jobs.map((job) => {
    const retryable = ["failed", "retry_pending"].includes(job.status) &&
      currentAdminActions &&
      currentAdminActions.endpoints &&
      asText(currentAdminActions.endpoints.notificationRetry);
    return [
      "<tr>",
      "<td><strong>" + escapeHtml(job.id) + "</strong><small>" + escapeHtml(job.recipientCategory) + "</small></td>",
      "<td>" + escapeHtml(job.eventName) + "</td>",
      '<td><span class="status-pill" data-status="' + escapeHtml(job.status) + '">' + escapeHtml(job.status.replace(/_/g, " ")) + "</span></td>",
      "<td>" + job.attempts + (job.maxAttempts ? " / " + job.maxAttempts : "") + "</td>",
      "<td>" + escapeHtml(job.lastErrorCode || "None") + "</td>",
      '<td><button class="admin-action notification-retry" type="button" data-notification-retry="' + escapeHtml(job.id) + '"' + (retryable ? "" : " disabled") + ">Retry</button></td>",
      "</tr>",
    ].join("");
  }).join("");

  const total = Object.values(health.counts).reduce((sum, count) => sum + count, 0);
  notificationHealthStatus.textContent = health.truncatedStatuses.length
    ? "Showing a bounded result; high-volume statuses: " + health.truncatedStatuses.join(", ") + "."
    : total
      ? "Notification health loaded."
      : "No notification jobs found.";
}

function setAdminActionStatus(message, tone = "") {
  if (!actionStatus) return;
  actionStatus.textContent = asText(message);
  if (tone) {
    actionStatus.dataset.tone = tone;
  } else {
    delete actionStatus.dataset.tone;
  }
}

function updateCurrentAdminOrder(orderId, patch) {
  currentAdminOrders = currentAdminOrders.map((order) => {
    if (order.id !== orderId) return order;
    const nextOrder = {
      ...order,
      ...patch,
    };
    if (patch.shipping) {
      nextOrder.shipping = {
        ...order.shipping,
        ...patch.shipping,
      };
    }
    return normalizeAdminOrder(nextOrder);
  });
}

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
    buildLabelActionViewModel: buildAdminLabelActionViewModel,
    canTransitionStatus: canTransitionAdminStatus,
    getAllowedStatusTransitions: getAllowedAdminStatusTransitions,
    normalizeSocialDraft: normalizedSocialDraft,
    normalizeSocialException: normalizedSocialException,
    clearActions: clearAdminActions,
    hasActions: hasAdminActions,
    render,
    setActions: setAdminActions,
    setNotificationHealth,
    setOrders: setAdminOrders,
    loadSocialDrafts,
    refreshSocialExceptions,
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
  const actionsEnabled = hasAdminActions();
  rows.innerHTML = normalizeAdminOrders(orders).map((order) => {
    const viewModel = buildAdminOrderViewModel(order);
    const statusOptions = [viewModel.status].concat(viewModel.allowedNextStatuses);
    const statusSelectMarkup = [
      '<select class="admin-status-action" data-status-action="update" data-order-id="' + escapeHtml(viewModel.id) + '" data-current-status="' + escapeHtml(viewModel.status) + '" data-status-endpoint="/api/admin/order-status"' + (actionsEnabled ? "" : " disabled") + ">",
      statusOptions.map((status) => '<option value="' + escapeHtml(status) + '"' + (status === viewModel.status ? " selected" : "") + ">" + escapeHtml(adminStatusLabels[status]) + "</option>").join(""),
      "</select>",
    ].join("");
    const trackingMarkup = viewModel.shipping.trackingUrl
      ? '<a class="admin-link" href="' + escapeHtml(viewModel.shipping.trackingUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(viewModel.shipping.trackingLabel) + "</a>"
      : escapeHtml(viewModel.shipping.trackingLabel);
    const labelMarkup = viewModel.shipping.labelUrl
      ? '<a class="admin-link" href="' + escapeHtml(viewModel.shipping.labelUrl) + '" target="_blank" rel="noreferrer">Label ready</a>'
      : "Label pending";
    const actionPayload = viewModel.labelAction.requestBody ? JSON.stringify(viewModel.labelAction.requestBody) : "";
    const labelButtonDisabled = viewModel.labelAction.disabled && !(actionsEnabled && viewModel.labelAction.state === "auth_required");
    const actionMarkup = [
      '<button class="admin-action" type="button"' + (!actionsEnabled || labelButtonDisabled ? " disabled" : "") + ' data-label-action="' + escapeHtml(viewModel.labelAction.state) + '" data-label-endpoint="' + escapeHtml(viewModel.labelAction.endpoint) + '" data-label-payload="' + escapeHtml(actionPayload) + '">',
      escapeHtml(viewModel.labelAction.label),
      "</button>",
      "<small>" + escapeHtml(actionsEnabled && viewModel.labelAction.state === "auth_required" ? "Ready for admin action" : viewModel.labelAction.reason) + "</small>",
    ].join("");
    return [
      "<tr>",
      "<td><strong>" + escapeHtml(viewModel.customerName) + "</strong><small>" + escapeHtml(viewModel.id) + " - ZIP " + escapeHtml(viewModel.shippingZip) + "</small></td>",
      "<td>" + escapeHtml(viewModel.itemSummary) + "<small>" + escapeHtml(viewModel.subtotalLabel) + " estimated subtotal</small></td>",
      '<td><span class="status-pill" data-status="' + escapeHtml(viewModel.status) + '">' + escapeHtml(viewModel.statusLabel) + "</span>" + statusSelectMarkup + "</td>",
      "<td><strong>" + escapeHtml(viewModel.shipping.carrierService) + "</strong><small>" + escapeHtml(viewModel.shipping.amountLabel) + " - " + escapeHtml(viewModel.shipping.packageLabel) + "</small><small>" + labelMarkup + " - " + trackingMarkup + "</small></td>",
      "<td>" + escapeHtml(viewModel.contact) + "<small>Prefers " + escapeHtml(viewModel.preferredContact) + "</small></td>",
      "<td>" + escapeHtml(viewModel.note) + "</td>",
      "<td>" + actionMarkup + "</td>",
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

function render(orders = currentAdminOrders) {
  const status = statusFilter.value;
  const visibleOrders = status === "all" ? orders : orders.filter((order) => order.status === status);
  renderSummary(visibleOrders);
  renderRows(visibleOrders);
  renderPackingList(visibleOrders);
}

async function handleStatusAction(target) {
  if (!hasAdminActions()) return;
  const orderRequestId = asText(target?.dataset?.orderId);
  const currentStatus = asText(target?.dataset?.currentStatus);
  const status = asText(target?.value);
  if (!orderRequestId || !canTransitionAdminStatus(currentStatus, status)) {
    target.value = currentStatus;
    setAdminActionStatus("That status change is not allowed.", "error");
    return;
  }

  try {
    setAdminActionStatus("Updating order status...");
    const result = await currentAdminActions.postAdminJson({
      endpoint: currentAdminActions.endpoints.statusUpdate,
      user: currentAdminActions.user,
      body: { orderRequestId, status },
    });
    updateCurrentAdminOrder(orderRequestId, { status: normalizeAdminStatus(result.status || status) });
    setAdminActionStatus("Order status updated.");
    render(currentAdminOrders);
  } catch (error) {
    target.value = currentStatus;
    setAdminActionStatus("Status update failed. Check admin access and try again.", "error");
  }
}

async function handleLabelAction(target) {
  if (!hasAdminActions() || target.disabled || target.dataset.labelAction !== "auth_required") return;
  const payloadText = asText(target.dataset.labelPayload);
  let payload = null;
  try {
    payload = payloadText ? JSON.parse(payloadText) : null;
  } catch (error) {
    return;
  }
  if (!payload || !payload.orderRequestId || !payload.rateId) return;

  target.disabled = true;
  try {
    setAdminActionStatus("Buying shipping label...");
    const result = await currentAdminActions.postAdminJson({
      endpoint: currentAdminActions.endpoints.labelPurchase,
      user: currentAdminActions.user,
      body: payload,
    });
    updateCurrentAdminOrder(payload.orderRequestId, {
      shipping: {
        labelUrl: result.labelUrl,
        shippoTransactionId: result.shippoTransactionId,
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl,
      },
    });
    setAdminActionStatus("Shipping label saved.");
    render(currentAdminOrders);
  } catch (error) {
    target.disabled = false;
    setAdminActionStatus("Label purchase failed. Check the paid order and selected rate.", "error");
  }
}

async function refreshNotificationHealth() {
  if (
    !currentAdminActions ||
    typeof currentAdminActions.getAdminJson !== "function" ||
    !asText(currentAdminActions.endpoints?.notificationHealth)
  ) {
    return;
  }

  if (notificationRefreshButton) notificationRefreshButton.disabled = true;
  if (notificationHealthStatus) notificationHealthStatus.textContent = "Loading notification health...";
  try {
    const result = await currentAdminActions.getAdminJson({
      endpoint: currentAdminActions.endpoints.notificationHealth,
      user: currentAdminActions.user,
    });
    setNotificationHealth(result);
  } catch (error) {
    if (notificationHealthStatus) notificationHealthStatus.textContent = "Notification health could not be loaded.";
  } finally {
    if (notificationRefreshButton) notificationRefreshButton.disabled = false;
  }
}

async function handleNotificationRetry(target) {
  const idempotencyKey = asText(target?.dataset?.notificationRetry);
  if (
    !idempotencyKey ||
    !currentAdminActions ||
    typeof currentAdminActions.postAdminJson !== "function" ||
    !asText(currentAdminActions.endpoints?.notificationRetry)
  ) {
    return;
  }

  target.disabled = true;
  try {
    await currentAdminActions.postAdminJson({
      endpoint: currentAdminActions.endpoints.notificationRetry,
      user: currentAdminActions.user,
      body: { idempotencyKey },
    });
    setAdminActionStatus("Notification retry queued.");
    await refreshNotificationHealth();
  } catch (error) {
    target.disabled = false;
    setAdminActionStatus("Notification retry could not be queued.", "error");
  }
}

statusFilter.addEventListener("change", () => render());
rows.addEventListener("change", (event) => {
  if (event.target && event.target.dataset && event.target.dataset.statusAction === "update") {
    handleStatusAction(event.target);
  }
});
rows.addEventListener("click", (event) => {
  if (event.target && event.target.dataset && event.target.dataset.labelAction) {
    handleLabelAction(event.target);
  }
});
if (notificationRefreshButton) {
  notificationRefreshButton.addEventListener("click", refreshNotificationHealth);
}
if (notificationRows) {
  notificationRows.addEventListener("click", (event) => {
    if (event.target && event.target.dataset && event.target.dataset.notificationRetry) {
      handleNotificationRetry(event.target);
    }
  });
}
if (socialDraftsRefreshButton) {
  socialDraftsRefreshButton.addEventListener("click", loadSocialDrafts);
}
if (socialWeekApproveButton) {
  socialWeekApproveButton.addEventListener("click", approveSocialWeek);
}
if (socialReconciliationRefreshButton) {
  socialReconciliationRefreshButton.addEventListener("click", refreshSocialExceptions);
}
if (socialDrafts) {
  socialDrafts.addEventListener("click", (event) => {
    if (event.target && event.target.dataset && event.target.dataset.socialApprove) {
      approveSocialDraft(event.target);
    }
  });
}
if (socialReconciliationRows) {
  socialReconciliationRows.addEventListener("click", (event) => {
    if (event.target && event.target.dataset && event.target.dataset.socialResolution) {
      resolveSocialException(event.target);
    }
  });
}
render();
renderNotificationHealth();
renderSocialDrafts();
renderSocialExceptions();
