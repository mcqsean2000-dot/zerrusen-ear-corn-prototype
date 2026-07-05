"use strict";

const { buildStripeMetadata } = require("./order-validation");

const DEFAULT_ORDER_COLLECTION = "orderRequests";
const DEFAULT_CURRENCY = "usd";

function isFunction(value) {
  return typeof value === "function";
}

function getOrderCollection(env) {
  return String(env.FIRESTORE_ORDER_COLLECTION || DEFAULT_ORDER_COLLECTION).trim() || DEFAULT_ORDER_COLLECTION;
}

function getCustomerEmail(orderRequest) {
  const contact = String(orderRequest.customer && orderRequest.customer.contact || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : "";
}

function buildLineItems(orderRequest, options = {}) {
  const currency = String(options.currency || DEFAULT_CURRENCY).toLowerCase();

  const lineItems = orderRequest.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: item.unitPriceCents,
      product_data: {
        name: item.name,
        metadata: {
          sku: item.sku,
        },
      },
    },
  }));

  if (Number.isInteger(orderRequest.shippingAmountCents) && orderRequest.shippingAmountCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: orderRequest.shippingAmountCents,
        product_data: {
          name: `Shipping - ${orderRequest.shippingCarrier} ${orderRequest.shippingService}`.trim(),
          metadata: {
            type: "shipping",
            rateId: String(orderRequest.shippingRateId || ""),
          },
        },
      },
    });
  }

  return lineItems;
}

function buildCheckoutSessionParams({ env, orderRequest, orderRequestId }) {
  const metadata = buildStripeMetadata(orderRequest, orderRequestId);
  const params = {
    mode: "payment",
    success_url: env.STRIPE_SUCCESS_URL,
    cancel_url: env.STRIPE_CANCEL_URL,
    client_reference_id: String(orderRequestId),
    line_items: buildLineItems(orderRequest, { currency: env.STRIPE_CURRENCY }),
    metadata,
  };
  const customerEmail = getCustomerEmail(orderRequest);

  if (customerEmail) {
    params.customer_email = customerEmail;
  }

  return params;
}

function normalizeOrderId(result) {
  if (typeof result === "string") return result;
  if (result && typeof result.id === "string") return result.id;
  if (result && typeof result.orderRequestId === "string") return result.orderRequestId;
  return "";
}

function normalizeCheckoutSession(result) {
  return {
    id: result && typeof result.id === "string" ? result.id : "",
    url: result && typeof result.url === "string" ? result.url : "",
    paymentIntentId: normalizeStripeId(result && result.payment_intent),
    customerId: normalizeStripeId(result && result.customer),
  };
}

function normalizeStripeId(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.id === "string") return value.id;
  return "";
}

function withoutUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
}

async function safelyMarkCheckoutError({ deps, collection, orderRequest, orderRequestId, fields }) {
  if (!isFunction(deps.markCheckoutSessionFailed)) {
    return;
  }

  await deps.markCheckoutSessionFailed({
    collection,
    orderRequestId,
    fields: withoutUndefinedFields({
      paymentStatus: "unpaid",
      trustedUpdatedAt: orderRequest.trustedUpdatedAt,
      ...fields,
    }),
  });
}

function getMissingCheckoutAdapterDependencies(deps = {}) {
  const missing = [];

  if (!isFunction(deps.createOrderRequest)) missing.push("createOrderRequest");
  if (!isFunction(deps.createStripeCheckoutSession)) missing.push("createStripeCheckoutSession");
  if (!isFunction(deps.updateOrderRequest)) missing.push("updateOrderRequest");

  return missing;
}

function assertAdapterDependencies(deps) {
  const missing = getMissingCheckoutAdapterDependencies(deps);

  if (missing.length) {
    const error = new Error("Checkout adapter dependencies are not configured.");
    error.code = "checkout_adapter_dependency_missing";
    error.missingDependencies = missing;
    throw error;
  }
}

function createCheckoutSessionAdapter(deps = {}) {
  return async function createCheckoutSession({ env, orderRequest }) {
    assertAdapterDependencies(deps);

    const collection = getOrderCollection(env);
    const createdOrder = await deps.createOrderRequest({
      collection,
      orderRequest,
    });
    const orderRequestId = normalizeOrderId(createdOrder);

    if (!orderRequestId) {
      const error = new Error("Trusted order storage did not return an order request ID.");
      error.code = "order_request_id_missing";
      throw error;
    }

    const sessionParams = buildCheckoutSessionParams({ env, orderRequest, orderRequestId });
    let session;

    try {
      session = normalizeCheckoutSession(await deps.createStripeCheckoutSession({
        env,
        orderRequest,
        orderRequestId,
        params: sessionParams,
      }));

      if (!session.id || !session.url) {
        const error = new Error("Stripe Checkout Session result is missing an ID or URL.");
        error.code = "checkout_session_result_invalid";
        throw error;
      }
    } catch (error) {
      await safelyMarkCheckoutError({
        deps,
        collection,
        orderRequest,
        orderRequestId,
        fields: {
          checkoutStatus: "error",
          checkoutErrorCode: error.code || "checkout_session_create_failed",
        },
      });
      throw error;
    }

    try {
      await deps.updateOrderRequest({
        collection,
        orderRequestId,
        fields: withoutUndefinedFields({
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.paymentIntentId || undefined,
          stripeCustomerId: session.customerId || undefined,
          trustedUpdatedAt: orderRequest.trustedUpdatedAt,
        }),
      });
    } catch (error) {
      await safelyMarkCheckoutError({
        deps,
        collection,
        orderRequest,
        orderRequestId,
        fields: {
          checkoutStatus: "open",
          checkoutErrorCode: error.code || "checkout_session_persist_failed",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.paymentIntentId || undefined,
          stripeCustomerId: session.customerId || undefined,
        },
      });
      throw error;
    }

    return {
      orderRequestId,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
    };
  };
}

module.exports = {
  buildCheckoutSessionParams,
  buildLineItems,
  createCheckoutSessionAdapter,
  getMissingCheckoutAdapterDependencies,
};
