"use strict";

const { TRUSTED_ORDER_FIELDS } = require("./order-validation");

const DEFAULT_ORDER_COLLECTION = "orderRequests";
const DEFAULT_STRIPE_EVENT_COLLECTION = "stripeEvents";
const DEFAULT_NOTIFICATION_OUTBOX_COLLECTION = "notificationOutbox";
const SERVER_TIMESTAMP_SENTINEL = "FIRESTORE_SERVER_TIMESTAMP_REQUIRED";
const NOTIFICATION_JOB_FIELDS = Object.freeze([
  "eventName",
  "idempotencyKey",
  "orderRequestId",
  "paidEventId",
  "recipientCategory",
  "status",
  "subject",
  "text",
  "to",
]);
const ADMIN_ORDER_STATUSES = Object.freeze([
  "needs_review",
  "ready_to_pack",
  "packed",
]);
const ADMIN_STATUS_TRANSITIONS = Object.freeze({
  needs_review: Object.freeze(["ready_to_pack"]),
  ready_to_pack: Object.freeze(["needs_review", "packed"]),
  packed: Object.freeze(["ready_to_pack"]),
});

function isFunction(value) {
  return typeof value === "function";
}

function cleanName(value, fallback) {
  const name = String(value || "").trim();
  return name || fallback;
}

function cleanText(value) {
  return String(value || "").trim();
}

function withoutUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, fieldValue]) => fieldValue !== undefined));
}

function trustedUpdateFields(fields) {
  const cleaned = withoutUndefinedFields(fields);
  const untrustedFields = Object.keys(cleaned).filter((field) => !TRUSTED_ORDER_FIELDS.includes(field));

  if (untrustedFields.length) {
    const error = new Error("Firestore adapter tried to update non-trusted order fields.");
    error.code = "firestore_adapter_untrusted_field";
    error.untrustedFields = untrustedFields;
    throw error;
  }

  return cleaned;
}

function requireFirestore(firestore) {
  if (!firestore || !isFunction(firestore.collection)) {
    const error = new Error("A Firestore-like backend with collection(name) is required.");
    error.code = "firestore_backend_missing";
    throw error;
  }
}

function orderCollectionName(options, override) {
  return cleanName(override || options.orderCollection, DEFAULT_ORDER_COLLECTION);
}

function eventCollectionName(options) {
  return cleanName(options.stripeEventCollection, DEFAULT_STRIPE_EVENT_COLLECTION);
}

function notificationOutboxCollectionName(options, override) {
  return cleanName(override || options.notificationOutboxCollection, DEFAULT_NOTIFICATION_OUTBOX_COLLECTION);
}

function trustedNotificationJob(job) {
  const cleaned = withoutUndefinedFields(job);
  const unexpectedFields = Object.keys(cleaned).filter((field) => !NOTIFICATION_JOB_FIELDS.includes(field));
  const idempotencyKey = cleanText(cleaned.idempotencyKey);
  const orderRequestId = cleanText(cleaned.orderRequestId);
  const paidEventId = cleanText(cleaned.paidEventId);
  const subject = cleanText(cleaned.subject);
  const text = cleanText(cleaned.text);
  const to = cleanText(cleaned.to).toLowerCase();
  const expectedRecipient = cleaned.eventName === "customer.order_confirmation" ? "customer" : "admin";
  const expectedIdempotencyKey = `${cleaned.eventName}:${orderRequestId}:${paidEventId}`;

  if (unexpectedFields.length) {
    const error = new Error("Notification outbox job includes unsupported fields.");
    error.code = "notification_outbox_untrusted_field";
    error.untrustedFields = unexpectedFields;
    throw error;
  }

  if (
    !idempotencyKey ||
    idempotencyKey.length > 500 ||
    idempotencyKey.includes("/") ||
    !["customer.order_confirmation", "admin.paid_order_created"].includes(cleaned.eventName) ||
    cleaned.recipientCategory !== expectedRecipient ||
    cleaned.status !== "pending" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(orderRequestId) ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(paidEventId) ||
    idempotencyKey !== expectedIdempotencyKey ||
    to.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
    !subject ||
    subject.length > 200 ||
    !text ||
    text.length > 10000
  ) {
    const error = new Error("Notification outbox job is invalid.");
    error.code = "notification_outbox_job_invalid";
    throw error;
  }

  return {
    ...cleaned,
    idempotencyKey,
    orderRequestId,
    paidEventId,
    subject,
    text,
    to,
  };
}

function storedNotificationJob(value) {
  const data = value && typeof value === "object" ? value : {};
  const job = Object.fromEntries(
    NOTIFICATION_JOB_FIELDS.map((field) => [field, data[field]]),
  );
  return trustedNotificationJob({ ...job, status: "pending" });
}

function collectionRef(firestore, name) {
  const ref = firestore.collection(name);

  if (!ref || !isFunction(ref.doc)) {
    const error = new Error("Firestore-like collection references must provide doc(id).");
    error.code = "firestore_collection_invalid";
    throw error;
  }

  return ref;
}

function requireDocRef(ref, operation) {
  if (!ref || (!isFunction(ref.set) && !isFunction(ref.update))) {
    const error = new Error(`Firestore-like document reference cannot ${operation}.`);
    error.code = "firestore_document_ref_invalid";
    throw error;
  }
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || snapshot.exists === false) {
    return null;
  }

  const data = isFunction(snapshot.data) ? snapshot.data() : snapshot.data || {};
  const id = snapshot.id || snapshot.ref && snapshot.ref.id || data.id || "";

  return {
    id,
    ...data,
  };
}

function firstQuerySnapshot(querySnapshot) {
  if (!querySnapshot || querySnapshot.empty) {
    return null;
  }

  if (Array.isArray(querySnapshot.docs)) {
    return querySnapshot.docs[0] || null;
  }

  let first = null;
  if (isFunction(querySnapshot.forEach)) {
    querySnapshot.forEach((doc) => {
      if (!first) first = doc;
    });
  }

  return first;
}

function validateAdminActor(admin) {
  const uid = cleanText(admin && admin.uid);
  const email = cleanText(admin && admin.email);

  if (!uid || email.length < 3 || email.length > 160) {
    const error = new Error("Admin status updates require a bounded admin uid and email.");
    error.code = "admin_actor_invalid";
    throw error;
  }

  return {
    email,
    uid,
  };
}

function assertAdminStatus(status, code) {
  const cleanStatus = cleanText(status);
  if (!ADMIN_ORDER_STATUSES.includes(cleanStatus)) {
    const error = new Error("Admin status update used an unsupported fulfillment status.");
    error.code = code;
    error.status = cleanStatus;
    throw error;
  }

  return cleanStatus;
}

function assertAdminStatusTransition(fromStatus, toStatus) {
  const from = assertAdminStatus(fromStatus, "admin_current_status_invalid");
  const to = assertAdminStatus(toStatus, "admin_next_status_invalid");

  if (from === to) {
    return {
      from,
      to,
    };
  }

  if (!ADMIN_STATUS_TRANSITIONS[from].includes(to)) {
    const error = new Error("Admin status update attempted an unsupported transition.");
    error.code = "admin_status_transition_invalid";
    error.fromStatus = from;
    error.toStatus = to;
    throw error;
  }

  return {
    from,
    to,
  };
}

function normalizeRateIdList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  const text = cleanText(value);
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(cleanText).filter(Boolean);
    }
  } catch (error) {
    return [text];
  }

  return [text];
}

function orderOwnsShippoRate(order, rateId) {
  const selectedRateId = cleanText(rateId);
  if (!selectedRateId) {
    return false;
  }

  return [
    cleanText(order && order.shippingRateId),
    ...normalizeRateIdList(order && order.shippingPackageRateIds),
  ].includes(selectedRateId);
}

async function setDoc(ref, data, options) {
  if (!isFunction(ref.set)) {
    const error = new Error("Firestore-like document reference must provide set(data).");
    error.code = "firestore_set_missing";
    throw error;
  }

  await ref.set(data, options);
}

async function updateDoc(ref, fields) {
  if (!isFunction(ref.update)) {
    const error = new Error("Firestore-like document reference must provide update(fields).");
    error.code = "firestore_update_missing";
    throw error;
  }

  await ref.update(fields);
}

async function getDoc(ref) {
  if (!isFunction(ref.get)) {
    const error = new Error("Firestore-like document reference must provide get().");
    error.code = "firestore_get_missing";
    throw error;
  }

  return ref.get();
}

async function queryFirstByField(collection, field, value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  if (!isFunction(collection.where)) {
    const error = new Error("Firestore-like collection reference must provide where(field, op, value).");
    error.code = "firestore_query_missing";
    throw error;
  }

  const query = collection.where(field, "==", value);
  const limitedQuery = query && isFunction(query.limit) ? query.limit(1) : query;

  if (!limitedQuery || !isFunction(limitedQuery.get)) {
    const error = new Error("Firestore-like query must provide get().");
    error.code = "firestore_query_get_missing";
    throw error;
  }

  return normalizeSnapshot(firstQuerySnapshot(await limitedQuery.get()));
}

async function findByDocumentId(collection, id) {
  const cleanId = String(id || "").trim();
  if (!cleanId) {
    return null;
  }

  return normalizeSnapshot(await getDoc(collection.doc(cleanId)));
}

function createFirestoreAdapter(options = {}) {
  requireFirestore(options.firestore);

  const firestore = options.firestore;
  const timestamp = isFunction(options.serverTimestamp)
    ? options.serverTimestamp
    : () => options.serverTimestamp || SERVER_TIMESTAMP_SENTINEL;

  async function createOrderRequest({ collection, orderRequest }) {
    const orders = collectionRef(firestore, orderCollectionName(options, collection));
    const ref = orders.doc();
    requireDocRef(ref, "create an order request");

    await setDoc(ref, orderRequest);

    return {
      id: ref.id,
    };
  }

  async function updateOrderRequest({ collection, orderRequestId, fields }) {
    const id = String(orderRequestId || "").trim();
    if (!id) {
      const error = new Error("orderRequestId is required to update an order request.");
      error.code = "order_request_id_missing";
      throw error;
    }

    const ref = collectionRef(firestore, orderCollectionName(options, collection)).doc(id);
    await updateDoc(ref, trustedUpdateFields(fields));

    return {
      id,
    };
  }

  async function markCheckoutSessionFailed({ collection, orderRequestId, fields }) {
    return updateOrderRequest({
      collection,
      orderRequestId,
      fields,
    });
  }

  async function findOrderByCheckoutSessionId({ collection, stripeCheckoutSessionId, orderRequestId }) {
    const orders = collectionRef(firestore, orderCollectionName(options, collection));
    const sessionMatch = await queryFirstByField(
      orders,
      "stripeCheckoutSessionId",
      stripeCheckoutSessionId,
    );

    if (sessionMatch || !orderRequestId) {
      return sessionMatch;
    }

    return findByDocumentId(orders, orderRequestId);
  }

  async function findOrderByPaymentIntentId({ collection, stripePaymentIntentId }) {
    return queryFirstByField(
      collectionRef(firestore, orderCollectionName(options, collection)),
      "stripePaymentIntentId",
      stripePaymentIntentId,
    );
  }

  async function updateAdminOrderStatus({ admin, collection, orderRequestId, status }) {
    const id = cleanText(orderRequestId);
    if (!id) {
      const error = new Error("orderRequestId is required to update admin order status.");
      error.code = "order_request_id_missing";
      throw error;
    }

    const actor = validateAdminActor(admin);
    const orders = collectionRef(firestore, orderCollectionName(options, collection));
    const ref = orders.doc(id);
    const existingOrder = normalizeSnapshot(await getDoc(ref));

    if (!existingOrder) {
      const error = new Error("Order request was not found for admin status update.");
      error.code = "order_request_not_found";
      throw error;
    }

    const transition = assertAdminStatusTransition(existingOrder.status, status);
    const updatedAt = timestamp();

    await updateDoc(ref, {
      audit: {
        lastAction: "status_changed",
        updatedAt,
        updatedByEmail: actor.email,
        updatedByUid: actor.uid,
      },
      status: transition.to,
    });

    return {
      audit: {
        lastAction: "status_changed",
        updatedAt,
        updatedByEmail: actor.email,
        updatedByUid: actor.uid,
      },
      fromStatus: transition.from,
      id,
      status: transition.to,
    };
  }

  async function prepareAdminLabelPurchase({ admin, collection, orderRequestId, rateId }) {
    const id = cleanText(orderRequestId);
    if (!id) {
      const error = new Error("orderRequestId is required to prepare a shipping label purchase.");
      error.code = "order_request_id_missing";
      throw error;
    }

    validateAdminActor(admin);
    const orders = collectionRef(firestore, orderCollectionName(options, collection));
    const ref = orders.doc(id);
    const existingOrder = normalizeSnapshot(await getDoc(ref));

    if (!existingOrder) {
      const error = new Error("Order request was not found for shipping label purchase.");
      error.code = "order_request_not_found";
      throw error;
    }

    if (existingOrder.paymentStatus !== "paid") {
      const error = new Error("Shipping labels can only be purchased for paid orders.");
      error.code = "shipping_label_order_not_paid";
      error.paymentStatus = existingOrder.paymentStatus || "";
      throw error;
    }

    if (!orderOwnsShippoRate(existingOrder, rateId)) {
      const error = new Error("Shipping label purchase used a rate that does not belong to the order.");
      error.code = "shipping_label_rate_mismatch";
      throw error;
    }

    return {
      id,
      paymentStatus: existingOrder.paymentStatus,
      rateId: cleanText(rateId),
    };
  }

  async function recordAdminLabelPurchase({ admin, collection, orderRequestId, fields }) {
    const id = cleanText(orderRequestId);
    if (!id) {
      const error = new Error("orderRequestId is required to record a shipping label purchase.");
      error.code = "order_request_id_missing";
      throw error;
    }

    const actor = validateAdminActor(admin);
    const orders = collectionRef(firestore, orderCollectionName(options, collection));
    const ref = orders.doc(id);
    const existingOrder = normalizeSnapshot(await getDoc(ref));

    if (!existingOrder) {
      const error = new Error("Order request was not found for shipping label purchase.");
      error.code = "order_request_not_found";
      throw error;
    }

    if (existingOrder.paymentStatus !== "paid") {
      const error = new Error("Shipping labels can only be purchased for paid orders.");
      error.code = "shipping_label_order_not_paid";
      error.paymentStatus = existingOrder.paymentStatus || "";
      throw error;
    }

    const labelFields = trustedUpdateFields(fields);
    const updatedAt = labelFields.trustedUpdatedAt || timestamp();
    const updateFields = {
      ...labelFields,
      audit: {
        lastAction: "label_purchased",
        updatedAt,
        updatedByEmail: actor.email,
        updatedByUid: actor.uid,
      },
    };

    await updateDoc(ref, updateFields);

    return {
      audit: updateFields.audit,
      id,
      ...labelFields,
    };
  }

  async function claimStripeEventProcessing({ eventId, eventType }) {
    const id = String(eventId || "").trim();
    if (!id) {
      const error = new Error("eventId is required to claim Stripe event processing.");
      error.code = "stripe_event_id_missing";
      throw error;
    }

    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for Stripe event claims.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const ref = collectionRef(firestore, eventCollectionName(options)).doc(id);

    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot && snapshot.exists) {
        return false;
      }

      transaction.set(ref, withoutUndefinedFields({
        eventId: id,
        eventType,
        status: "processing",
        claimedAt: timestamp(),
      }));

      return true;
    });
  }

  async function markStripeEventProcessed({ eventId, eventType, result }) {
    const id = String(eventId || "").trim();
    if (!id) {
      const error = new Error("eventId is required to mark Stripe event processed.");
      error.code = "stripe_event_id_missing";
      throw error;
    }

    const ref = collectionRef(firestore, eventCollectionName(options)).doc(id);
    await setDoc(ref, withoutUndefinedFields({
      eventId: id,
      eventType,
      result,
      status: "processed",
      processedAt: timestamp(),
    }), { merge: true });

    return {
      id,
    };
  }

  async function completePaidOrderEvent({
    collection,
    eventId,
    eventType,
    fields,
    jobs,
    orderRequestId,
    result,
  }) {
    const id = cleanText(eventId);
    const orderId = cleanText(orderRequestId);
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(id) || !/^[A-Za-z0-9_-]{1,160}$/.test(orderId)) {
      const error = new Error("Paid Stripe event completion requires bounded event and order IDs.");
      error.code = "paid_order_event_identifier_invalid";
      throw error;
    }
    if (eventType !== "checkout.session.completed") {
      const error = new Error("Paid order completion requires a checkout.session.completed event.");
      error.code = "paid_order_event_type_invalid";
      throw error;
    }
    if (!Array.isArray(jobs) || jobs.length < 1 || jobs.length > 2) {
      const error = new Error("Paid order completion requires one or two notification jobs.");
      error.code = "notification_outbox_jobs_invalid";
      throw error;
    }
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for paid order completion.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const updateFields = trustedUpdateFields(fields);
    const notificationJobs = jobs.map(trustedNotificationJob);
    if (
      updateFields.paymentStatus !== "paid" ||
      updateFields.checkoutStatus !== "complete" ||
      updateFields.lastStripeEventId !== id ||
      !result ||
      result.action !== "updated_order" ||
      result.orderRequestId !== orderId ||
      notificationJobs.some((job) => job.orderRequestId !== orderId || job.paidEventId !== id)
    ) {
      const error = new Error("Paid order completion inputs do not describe the same trusted payment event.");
      error.code = "paid_order_event_mismatch";
      throw error;
    }
    const orderRef = collectionRef(firestore, orderCollectionName(options, collection)).doc(orderId);
    const eventRef = collectionRef(firestore, eventCollectionName(options)).doc(id);
    const outbox = collectionRef(firestore, notificationOutboxCollectionName(options));
    const notificationRefs = notificationJobs.map((job) => outbox.doc(job.idempotencyKey));

    return firestore.runTransaction(async (transaction) => {
      const [eventSnapshot, ...notificationSnapshots] = await Promise.all([
        transaction.get(eventRef),
        ...notificationRefs.map((ref) => transaction.get(ref)),
      ]);
      if (eventSnapshot && eventSnapshot.exists) {
        return false;
      }

      transaction.update(orderRef, updateFields);
      notificationJobs.forEach((job, index) => {
        if (!notificationSnapshots[index] || !notificationSnapshots[index].exists) {
          transaction.set(notificationRefs[index], {
            ...job,
            createdAt: timestamp(),
          });
        }
      });
      transaction.set(eventRef, {
        eventId: id,
        eventType,
        status: "processed",
        processedAt: timestamp(),
        result,
      });
      return true;
    });
  }

  async function enqueueNotificationJobs({ collection, jobs }) {
    if (!Array.isArray(jobs) || jobs.length < 1 || jobs.length > 2) {
      const error = new Error("Notification outbox requires one or two jobs.");
      error.code = "notification_outbox_jobs_invalid";
      throw error;
    }

    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for notification jobs.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const outbox = collectionRef(firestore, notificationOutboxCollectionName(options, collection));
    const results = [];

    for (const rawJob of jobs) {
      const job = trustedNotificationJob(rawJob);
      const ref = outbox.doc(job.idempotencyKey);
      const created = await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot && snapshot.exists) {
          return false;
        }

        transaction.set(ref, {
          ...job,
          createdAt: timestamp(),
        });
        return true;
      });

      results.push({
        created,
        idempotencyKey: job.idempotencyKey,
      });
    }

    return {
      created: results.filter((result) => result.created).length,
      duplicates: results.filter((result) => !result.created).length,
      results,
    };
  }

  async function claimNotificationJob({ idempotencyKey, maxAttempts }) {
    const id = cleanText(idempotencyKey);
    const attemptLimit = Number(maxAttempts);
    if (!id || id.length > 500 || id.includes("/")) {
      const error = new Error("Notification claim requires a safe idempotency key.");
      error.code = "notification_delivery_key_invalid";
      throw error;
    }
    if (!Number.isInteger(attemptLimit) || attemptLimit < 1 || attemptLimit > 10) {
      const error = new Error("Notification claim requires a bounded attempt limit.");
      error.code = "notification_delivery_attempt_limit_invalid";
      throw error;
    }
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for notification claims.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const ref = collectionRef(firestore, notificationOutboxCollectionName(options)).doc(id);
    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = normalizeSnapshot(snapshot);
      if (!data || !["pending", "retry_pending"].includes(data.status)) {
        return null;
      }

      const previousAttempts = Number(data.attempts || 0);
      if (!Number.isInteger(previousAttempts) || previousAttempts < 0 || previousAttempts >= attemptLimit) {
        transaction.update(ref, {
          status: "failed",
          lastErrorCode: "attempt_limit_reached",
          lastAttemptFinishedAt: timestamp(),
        });
        return null;
      }

      const attempt = previousAttempts + 1;
      const job = storedNotificationJob(data);
      transaction.update(ref, {
        attempts: attempt,
        maxAttempts: attemptLimit,
        status: "processing",
        lastAttemptAt: timestamp(),
      });
      return { attempt, job };
    });
  }

  async function recordNotificationSuccess({ attempt, idempotencyKey, providerMessageId }) {
    const id = cleanText(idempotencyKey);
    const attemptNumber = Number(attempt);
    const messageId = cleanText(providerMessageId);
    if (!id || id.length > 500 || id.includes("/") || !Number.isInteger(attemptNumber) || attemptNumber < 1) {
      const error = new Error("Notification success requires a safe key and attempt.");
      error.code = "notification_delivery_result_invalid";
      throw error;
    }
    if (!messageId || messageId.length > 200) {
      const error = new Error("Notification success requires a bounded provider message ID.");
      error.code = "notification_delivery_provider_id_invalid";
      throw error;
    }
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for notification results.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const ref = collectionRef(firestore, notificationOutboxCollectionName(options)).doc(id);
    return firestore.runTransaction(async (transaction) => {
      const data = normalizeSnapshot(await transaction.get(ref));
      if (data && data.status === "sent" && data.attempts === attemptNumber && data.providerMessageId === messageId) {
        return true;
      }
      if (!data || data.status !== "processing" || data.attempts !== attemptNumber) {
        const error = new Error("Notification success does not match the active delivery attempt.");
        error.code = "notification_delivery_state_conflict";
        throw error;
      }

      transaction.update(ref, {
        lastAttemptFinishedAt: timestamp(),
        lastErrorCode: null,
        providerMessageId: messageId,
        sentAt: timestamp(),
        status: "sent",
      });
      return true;
    });
  }

  async function recordNotificationFailure({ attempt, errorCode, idempotencyKey, retryable }) {
    const id = cleanText(idempotencyKey);
    const attemptNumber = Number(attempt);
    const code = cleanText(errorCode);
    if (
      !id ||
      id.length > 500 ||
      id.includes("/") ||
      !Number.isInteger(attemptNumber) ||
      attemptNumber < 1 ||
      !/^[A-Za-z0-9_.-]{1,80}$/.test(code) ||
      typeof retryable !== "boolean"
    ) {
      const error = new Error("Notification failure requires safe bounded result fields.");
      error.code = "notification_delivery_result_invalid";
      throw error;
    }
    if (!isFunction(firestore.runTransaction)) {
      const error = new Error("Firestore-like backend must provide runTransaction() for notification results.");
      error.code = "firestore_transaction_missing";
      throw error;
    }

    const ref = collectionRef(firestore, notificationOutboxCollectionName(options)).doc(id);
    return firestore.runTransaction(async (transaction) => {
      const data = normalizeSnapshot(await transaction.get(ref));
      if (!data || data.status !== "processing" || data.attempts !== attemptNumber) {
        const error = new Error("Notification failure does not match the active delivery attempt.");
        error.code = "notification_delivery_state_conflict";
        throw error;
      }

      const canRetry = retryable && attemptNumber < Number(data.maxAttempts || 0);
      transaction.update(ref, {
        lastAttemptFinishedAt: timestamp(),
        lastErrorCode: code,
        status: canRetry ? "retry_pending" : "failed",
      });
      return { retryable: canRetry };
    });
  }

  return {
    claimStripeEventProcessing,
    claimNotificationJob,
    completePaidOrderEvent,
    createOrderRequest,
    enqueueNotificationJobs,
    findOrderByCheckoutSessionId,
    findOrderByPaymentIntentId,
    markCheckoutSessionFailed,
    markStripeEventProcessed,
    prepareLabelPurchase: prepareAdminLabelPurchase,
    prepareAdminLabelPurchase,
    recordLabelPurchase: recordAdminLabelPurchase,
    recordAdminLabelPurchase,
    recordNotificationFailure,
    recordNotificationSuccess,
    updateAdminOrderStatus,
    updateOrderRequest,
  };
}

module.exports = {
  ADMIN_ORDER_STATUSES,
  ADMIN_STATUS_TRANSITIONS,
  DEFAULT_NOTIFICATION_OUTBOX_COLLECTION,
  DEFAULT_ORDER_COLLECTION,
  DEFAULT_STRIPE_EVENT_COLLECTION,
  SERVER_TIMESTAMP_SENTINEL,
  createFirestoreAdapter,
};
