(function installTheoAnalytics(root, factory) {
  const api = factory(root, root.TheosAnalyticsConfig || {});
  root.TheosAnalytics = api;
  if (typeof module === "object" && module.exports) {
    module.exports = { createTheoAnalytics: factory };
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createTheoAnalytics(root, config) {
  const measurementId = String(config.measurementId || "").trim();
  const enabled = /^G-[A-Z0-9]+$/i.test(measurementId);
  const purchaseStoragePrefix = "theos-farm-ga4-purchase-v1:";
  const sentPurchaseIds = new Set();

  function getStorage() {
    try {
      return root.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function itemPayload(item) {
    return {
      item_id: String(item && (item.item_id || item.sku) || ""),
      item_name: String(item && (item.item_name || item.name) || ""),
      price: Number(item && (item.price ?? Number(item.unitPriceCents || 0) / 100) || 0),
      quantity: Math.max(1, Number(item && item.quantity || 1)),
    };
  }

  function itemsPayload(items) {
    return (Array.isArray(items) ? items : [])
      .map(itemPayload)
      .filter((item) => item.item_id && item.item_name && Number.isFinite(item.price));
  }

  function cartValue(items, shippingCents = 0) {
    const productTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
    return Number((productTotal + Number(shippingCents || 0) / 100).toFixed(2));
  }

  function send(eventName, parameters) {
    if (!enabled || typeof root.gtag !== "function") {
      return false;
    }
    root.gtag("event", eventName, parameters);
    return true;
  }

  function wasPurchaseSent(storage, transactionId) {
    if (sentPurchaseIds.has(transactionId)) {
      return true;
    }
    try {
      return Boolean(storage && storage.getItem(purchaseStoragePrefix + transactionId) === "sent");
    } catch (error) {
      return false;
    }
  }

  function rememberPurchase(storage, transactionId) {
    sentPurchaseIds.add(transactionId);
    try {
      if (storage) storage.setItem(purchaseStoragePrefix + transactionId, "sent");
    } catch (error) {
      // The in-memory guard still prevents duplicate events on this page.
    }
  }

  function initialize() {
    if (!enabled || !root.document) {
      return false;
    }
    root.dataLayer = root.dataLayer || [];
    root.gtag = root.gtag || function gtag() {
      root.dataLayer.push(arguments);
    };
    root.gtag("js", new Date());
    root.gtag("config", measurementId, { send_page_view: false });

    if (!root.document.querySelector('script[data-theos-ga4]')) {
      const script = root.document.createElement("script");
      script.async = true;
      script.dataset.theosGa4 = "true";
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
      root.document.head.appendChild(script);
    }
    return true;
  }

  function pageView() {
    return send("page_view", {
      page_location: String(root.location && root.location.href || ""),
      page_title: String(root.document && root.document.title || ""),
    });
  }

  function viewItem(item) {
    const items = itemsPayload([item]);
    if (!items.length) return false;
    return send("view_item", {
      currency: "USD",
      value: cartValue(items),
      items,
    });
  }

  function addToCart(item) {
    const items = itemsPayload([item]);
    if (!items.length) return false;
    return send("add_to_cart", {
      currency: "USD",
      value: cartValue(items),
      items,
    });
  }

  function beginCheckout(items, shippingCents) {
    const safeItems = itemsPayload(items);
    if (!safeItems.length) return false;
    return send("begin_checkout", {
      currency: "USD",
      value: cartValue(safeItems, shippingCents),
      shipping: Number((Number(shippingCents || 0) / 100).toFixed(2)),
      items: safeItems,
    });
  }

  function purchase(transactionId, items, shippingCents) {
    const safeTransactionId = String(transactionId || "").trim();
    const safeItems = itemsPayload(items);
    if (!/^cs_[A-Za-z0-9_]+$/.test(safeTransactionId) || !safeItems.length) return false;

    const storage = getStorage();
    if (wasPurchaseSent(storage, safeTransactionId)) return false;

    const sent = send("purchase", {
      transaction_id: safeTransactionId,
      currency: "USD",
      value: cartValue(safeItems, shippingCents),
      shipping: Number((Number(shippingCents || 0) / 100).toFixed(2)),
      items: safeItems,
    });
    if (sent) rememberPurchase(storage, safeTransactionId);
    return sent;
  }

  function checkoutError(errorClass, step) {
    const allowedErrors = new Set([
      "shipping_rates_unavailable",
      "checkout_unavailable",
      "checkout_configuration_missing",
    ]);
    const allowedSteps = new Set(["shipping_estimate", "shipping_method", "checkout_handoff"]);
    const safeError = allowedErrors.has(errorClass) ? errorClass : "checkout_unavailable";
    const safeStep = allowedSteps.has(step) ? step : "checkout_handoff";
    return send("checkout_error", { error_class: safeError, step: safeStep });
  }

  return {
    enabled,
    initialize,
    pageView,
    viewItem,
    addToCart,
    beginCheckout,
    purchase,
    checkoutError,
  };
});
