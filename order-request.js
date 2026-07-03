(function attachOrderRequestModule(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.TheosOrderRequests = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOrderRequestModule() {
  const PRODUCT_CATALOG = {
    "ear-corn-20lb": {
      name: "20 lb Ear Corn Bag",
      sku: "ear-corn-20lb",
      unitPriceCents: 1795,
    },
    "ear-corn-40lb": {
      name: "40 lb Ear Corn Bag",
      sku: "ear-corn-40lb",
      unitPriceCents: 2995,
    },
  };

  const CONTACT_METHODS = {
    email: "email",
    phone: "phone",
    "phone call": "phone",
    text: "text",
    "text message": "text",
  };

  const MAX_ITEM_QUANTITY = 50;
  const MAX_SUBTOTAL_CENTS = 84000;
  function cleanText(value) {
    return String(value || "").trim();
  }

  function normalizeContactMethod(value) {
    return CONTACT_METHODS[cleanText(value).toLowerCase()] || "";
  }

  function normalizeCartItem(item) {
    const sku = cleanText(item && item.sku);
    const catalogItem = PRODUCT_CATALOG[sku];
    const quantity = Number(item && item.quantity);

    if (!catalogItem) {
      return {
        error: "Choose a recognized Theo's Farm ear corn product before requesting checkout.",
      };
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      return {
        error: "Choose between 1 and 50 bags per product before requesting checkout.",
      };
    }

    return {
      item: {
        name: catalogItem.name,
        sku: catalogItem.sku,
        quantity,
        unitPriceCents: catalogItem.unitPriceCents,
      },
    };
  }

  function normalizeCustomer(customer) {
    const normalized = {
      name: cleanText(customer && customer.name),
      contact: cleanText(customer && customer.contact),
      shippingZip: cleanText(customer && customer.shippingZip),
      preferredContact: normalizeContactMethod(customer && customer.preferredContact),
    };

    const note = cleanText(customer && customer.note);
    if (note) {
      normalized.note = note;
    }

    return normalized;
  }

  function validateCustomer(customer) {
    if (!customer.name || !customer.contact || !customer.shippingZip || !customer.preferredContact) {
      return "Add your name, contact info, shipping ZIP, and preferred contact method so Theo's Farm can confirm delivery.";
    }

    if (customer.name.length > 120) {
      return "Use a shorter name before requesting checkout.";
    }

    if (customer.contact.length < 3 || customer.contact.length > 160) {
      return "Use a valid email or phone number before requesting checkout.";
    }

    if (!/^\d{5}$/.test(customer.shippingZip)) {
      return "Enter a 5-digit shipping ZIP so Theo's Farm can confirm delivery.";
    }

    if (!["email", "phone", "text"].includes(customer.preferredContact)) {
      return "Choose email, phone call, or text message as the preferred contact method.";
    }

    if (customer.note && customer.note.length > 1000) {
      return "Use a shorter order note before requesting checkout.";
    }

    return "";
  }

  function buildOrderRequest(input) {
    const cart = Array.isArray(input && input.cart) ? input.cart : [];
    const customer = normalizeCustomer(input && input.customer);

    if (!cart.length) {
      return {
        ok: false,
        message: "Add at least one bag to the cart before requesting a checkout link.",
      };
    }

    if (cart.length > 2) {
      return {
        ok: false,
        message: "Adjust the cart before requesting checkout.",
      };
    }

    const items = [];
    for (const cartItem of cart) {
      const normalized = normalizeCartItem(cartItem);
      if (normalized.error) {
        return { ok: false, message: normalized.error };
      }
      items.push(normalized.item);
    }

    const customerError = validateCustomer(customer);
    if (customerError) {
      return { ok: false, message: customerError };
    }

    const subtotalCents = items.reduce(
      (total, item) => total + item.unitPriceCents * item.quantity,
      0
    );

    if (subtotalCents < 1795 || subtotalCents > MAX_SUBTOTAL_CENTS) {
      return {
        ok: false,
        message: "Adjust the cart quantity before requesting checkout.",
      };
    }

    return {
      ok: true,
      message: "Order request prepared. Live submission is disabled until Theo's Farm adds a trusted Stripe Checkout endpoint.",
      payload: {
        source: "static-storefront",
        status: "needs_review",
        subtotalCents,
        items,
        customer,
      },
      firestoreWrite: {
        collection: "orderRequests",
        createdAt: "server_timestamp_required",
        trustedWriterRequired: true,
      },
      handoff: {
        type: "stripe_checkout",
        mode: "backend_required",
        nextStep: "A trusted backend should create the Stripe Checkout session, then Stripe webhooks should update payment status.",
      },
    };
  }

  return {
    PRODUCT_CATALOG,
    buildOrderRequest,
  };
});
