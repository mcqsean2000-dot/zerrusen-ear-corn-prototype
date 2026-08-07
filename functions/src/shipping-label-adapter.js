"use strict";

const { randomUUID } = require("node:crypto");

function isFunction(value) {
  return typeof value === "function";
}

function cleanText(value) {
  return String(value || "").trim();
}

function withoutUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, fieldValue]) => fieldValue !== undefined));
}

function validateAdminActor(admin) {
  const uid = cleanText(admin && admin.uid);
  const email = cleanText(admin && admin.email);

  if (!uid || email.length < 3 || email.length > 160) {
    const error = new Error("Shipping label purchase requires a bounded admin uid and email.");
    error.code = "admin_actor_invalid";
    throw error;
  }

  return {
    email,
    uid,
  };
}

function getMissingShippingLabelDependencies(dependencies = {}) {
  const missing = [];

  if (!isFunction(dependencies.createShippoTransaction)) missing.push("createShippoTransaction");
  if (!isFunction(dependencies.prepareLabelPurchase)) missing.push("prepareLabelPurchase");
  if (!isFunction(dependencies.recordLabelPurchase)) missing.push("recordLabelPurchase");
  if (!isFunction(dependencies.recordLabelPurchaseFailure)) missing.push("recordLabelPurchaseFailure");

  return missing;
}

function normalizeShippoLabelFields({ serverTimestamp, transaction }) {
  const shippoTransactionId = cleanText(transaction && (transaction.object_id || transaction.objectId));
  const labelUrl = cleanText(transaction && (transaction.label_url || transaction.labelUrl));

  if (!shippoTransactionId || !labelUrl) {
    const error = new Error("Shippo label transaction did not include the required label fields.");
    error.code = "shippo_label_transaction_incomplete";
    throw error;
  }

  return withoutUndefinedFields({
    labelPurchasedAt: serverTimestamp,
    labelUrl,
    shippoTransactionId,
    trackingNumber: cleanText(transaction.tracking_number || transaction.trackingNumber) || undefined,
    trackingUrl: cleanText(
      transaction.tracking_url_provider
      || transaction.tracking_url
      || transaction.trackingUrl,
    ) || undefined,
    trustedUpdatedAt: serverTimestamp,
  });
}

async function purchaseShippingLabel({
  admin,
  orderRequestId,
  rateId,
  createShippoTransaction,
  prepareLabelPurchase,
  recordLabelPurchase,
  recordLabelPurchaseFailure,
  serverTimestamp = "FIRESTORE_SERVER_TIMESTAMP_REQUIRED",
}) {
  const missingDependencies = getMissingShippingLabelDependencies({
    createShippoTransaction,
    prepareLabelPurchase,
    recordLabelPurchase,
    recordLabelPurchaseFailure,
  });

  if (missingDependencies.length) {
    const error = new Error("Shipping label purchase requires trusted Shippo and order persistence adapters.");
    error.code = "shipping_label_dependency_missing";
    error.missingDependencies = missingDependencies;
    throw error;
  }

  const id = cleanText(orderRequestId);
  if (!id) {
    const error = new Error("orderRequestId is required to purchase a shipping label.");
    error.code = "order_request_id_missing";
    throw error;
  }

  const selectedRateId = cleanText(rateId);
  if (!selectedRateId) {
    const error = new Error("A Shippo rate ID is required to purchase a shipping label.");
    error.code = "shippo_rate_id_missing";
    throw error;
  }

  const actor = validateAdminActor(admin);
  const purchaseAttemptId = randomUUID();
  const prepared = await prepareLabelPurchase({
    admin: actor,
    orderRequestId: id,
    purchaseAttemptId,
    rateId: selectedRateId,
  });
  let transaction;
  try {
    transaction = await createShippoTransaction({
      metadata: `theos:${id}:${prepared.packageId}`.slice(0, 100),
      rateId: selectedRateId,
    });
  } catch (error) {
    await recordLabelPurchaseFailure({
      admin: actor,
      ambiguous: !Number.isInteger(error && error.status),
      orderRequestId: id,
      packageId: prepared.packageId,
      purchaseAttemptId,
      rateId: selectedRateId,
    });
    throw error;
  }
  const labelFields = normalizeShippoLabelFields({
    serverTimestamp,
    transaction,
  });

  return recordLabelPurchase({
    admin: actor,
    fields: {
      ...labelFields,
      packageId: prepared.packageId,
      purchaseAttemptId,
      rateId: selectedRateId,
    },
    orderRequestId: id,
  });
}

module.exports = {
  getMissingShippingLabelDependencies,
  normalizeShippoLabelFields,
  purchaseShippingLabel,
};
