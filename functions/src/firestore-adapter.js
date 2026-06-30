"use strict";

const { TRUSTED_ORDER_FIELDS } = require("./order-validation");

const DEFAULT_ORDER_COLLECTION = "orderRequests";
const DEFAULT_STRIPE_EVENT_COLLECTION = "stripeEvents";
const SERVER_TIMESTAMP_SENTINEL = "FIRESTORE_SERVER_TIMESTAMP_REQUIRED";

function isFunction(value) {
  return typeof value === "function";
}

function cleanName(value, fallback) {
  const name = String(value || "").trim();
  return name || fallback;
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

  return {
    claimStripeEventProcessing,
    createOrderRequest,
    findOrderByCheckoutSessionId,
    findOrderByPaymentIntentId,
    markCheckoutSessionFailed,
    markStripeEventProcessed,
    updateOrderRequest,
  };
}

module.exports = {
  DEFAULT_ORDER_COLLECTION,
  DEFAULT_STRIPE_EVENT_COLLECTION,
  SERVER_TIMESTAMP_SENTINEL,
  createFirestoreAdapter,
};
