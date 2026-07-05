const cart = [];

const cartDrawer = document.querySelector("[data-cart]");
const cartItems = document.querySelector("[data-cart-items]");
const cartCount = document.querySelector("[data-cart-count]");
const cartTotal = document.querySelector("[data-cart-total]");
const openCartButton = document.querySelector("[data-open-cart]");
const closeCartButton = document.querySelector("[data-close-cart]");
const checkoutButton = document.querySelector("[data-checkout-button]");
const orderForm = document.querySelector("[data-order-form]");
const orderSummary = document.querySelector("[data-order-summary]");
const orderStatus = document.querySelector("[data-order-status]");
const shippingRatesContainer = document.querySelector("[data-shipping-rates]");
const orderRequests = window.TheosOrderRequests;
const checkoutConfig = window.TheosCheckoutConfig || {};
const orderSubmitButton = orderForm.querySelector('button[type="submit"]');
const checkoutFailureMessage = "Checkout could not be started. Please try again or contact Theo's Farm.";
const shippingRatesFailureMessage = "Shipping rates could not be calculated. Please check the address or contact Theo's Farm.";
let selectedShippingRate = null;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getCartTotals() {
  return cart.reduce(
    (totals, item) => ({
      itemCount: totals.itemCount + item.quantity,
      subtotalCents: totals.subtotalCents + item.unitPriceCents * item.quantity,
    }),
    { itemCount: 0, subtotalCents: 0 }
  );
}

function formatCents(cents) {
  return money.format(cents / 100);
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function renderOrderSummary(subtotalCents) {
  const lines = cart.map((item) =>
    "<p>" + item.quantity + " x " + item.name + " - " + formatCents(item.unitPriceCents * item.quantity) + "</p>"
  );

  orderSummary.innerHTML = [
    "<strong>Cart summary</strong>",
    cart.length ? lines.join("") : "<p>Add a bag to the cart and it will appear here before checkout.</p>",
    "<span>Estimated subtotal: <b data-order-subtotal>" + formatCents(subtotalCents) + "</b></span>",
  ].join("");
}

function renderCart() {
  const { itemCount, subtotalCents } = getCartTotals();

  cartCount.textContent = itemCount;
  cartTotal.textContent = formatCents(subtotalCents);
  checkoutButton.disabled = !cart.length;
  renderOrderSummary(subtotalCents);

  if (!cart.length) {
    cartItems.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
    return;
  }

  cartItems.innerHTML = cart
    .map(
      (item) => `
        <div class="cart-line">
          <span>
            <strong>${item.name}</strong>
            <small>Qty ${item.quantity} x ${formatCents(item.unitPriceCents)}</small>
          </span>
          <span class="cart-line-actions">
            <strong>${formatCents(item.unitPriceCents * item.quantity)}</strong>
            <button type="button" data-remove-cart-item="${item.sku}" aria-label="Remove ${item.name} from cart">Remove</button>
          </span>
        </div>
      `
    )
    .join("");

  cartItems.querySelectorAll("[data-remove-cart-item]").forEach((button) => {
    button.addEventListener("click", () => {
      removeCartItem(button.dataset.removeCartItem);
    });
  });
}

function isLocalCheckoutEndpoint(url) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
}

function getTrustedEndpoint(configKey) {
  const rawEndpoint = String(checkoutConfig[configKey] || "").trim();

  if (!rawEndpoint || /^replace-with-/i.test(rawEndpoint)) {
    return "";
  }

  try {
    const endpoint = new URL(rawEndpoint, window.location.href);
    if (endpoint.protocol === "https:" || isLocalCheckoutEndpoint(endpoint)) {
      return endpoint.href;
    }
  } catch (error) {
    return "";
  }

  return "";
}

function getCheckoutEndpoint() {
  return getTrustedEndpoint("checkoutEndpoint");
}

function getShippingRatesEndpoint() {
  return getTrustedEndpoint("shippingRatesEndpoint");
}

function clearSelectedShippingRate() {
  selectedShippingRate = null;
  shippingRatesContainer.hidden = true;
  shippingRatesContainer.innerHTML = "";
}

function removeCartItem(sku) {
  const index = cart.findIndex((item) => item.sku === sku);
  if (index < 0) {
    return;
  }

  cart.splice(index, 1);
  clearSelectedShippingRate();
  orderStatus.textContent = "";
  renderCart();
}

function getOrderFormInput() {
  const formData = new FormData(orderForm);
  const shippingAddress = {
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
  };

  return {
    cart,
    customer: {
      name: formData.get("name"),
      contact: formData.get("contact"),
      shippingZip: shippingAddress.zip,
      preferredContact: formData.get("contactMethod"),
      note: formData.get("note"),
    },
    shippingAddress,
  };
}

function isValidCheckoutHandoff(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const orderRequestId = String(payload.orderRequestId || "").trim();
  const checkoutSessionId = String(payload.checkoutSessionId || "").trim();
  const checkoutUrl = String(payload.checkoutUrl || "").trim();

  if (!orderRequestId || !/^cs_/.test(checkoutSessionId) || !checkoutUrl) {
    return false;
  }

  try {
    const url = new URL(checkoutUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === "checkout.stripe.com" &&
      url.pathname.startsWith("/c/pay/") &&
      url.href.includes(checkoutSessionId)
    );
  } catch (error) {
    return false;
  }
}

function isValidShippingRatesPayload(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    Array.isArray(payload.rates) &&
    payload.rates.every((rate) =>
      rate &&
      typeof rate === "object" &&
      typeof rate.rateId === "string" &&
      typeof rate.provider === "string" &&
      typeof rate.serviceName === "string" &&
      Number.isInteger(rate.amountCents) &&
      rate.currency === "USD"
    )
  );
}

function shippingRateLabel(rate) {
  return rate.provider + " " + rate.serviceName;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderShippingRates(rates) {
  shippingRatesContainer.hidden = false;
  shippingRatesContainer.innerHTML = [
    "<strong>Choose shipping</strong>",
    ...rates.map((rate, index) => `
      <label class="shipping-rate-option">
        <input type="radio" name="shippingRate" value="${escapeHtml(rate.rateId)}" ${index === 0 ? "checked" : ""}>
        <span>
          <strong>${escapeHtml(shippingRateLabel(rate))}</strong>
          <small>${escapeHtml(rate.durationTerms || "Estimated delivery shown by carrier")}</small>
        </span>
        <strong>${formatCents(rate.amountCents)}</strong>
      </label>
    `),
  ].join("");

  selectedShippingRate = rates[0] || null;

  shippingRatesContainer.querySelectorAll('input[name="shippingRate"]').forEach((input) => {
    input.addEventListener("change", () => {
      selectedShippingRate = rates.find((rate) => rate.rateId === input.value) || null;
      if (selectedShippingRate) {
        orderStatus.textContent = shippingRateLabel(selectedShippingRate) + " selected. Stripe checkout will be enabled after the Stripe account is ready.";
      }
    });
  });
}

async function requestShippingRates(endpoint, rateRequest) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      orderRequest: rateRequest.orderRequest,
      shippingAddress: rateRequest.shippingAddress,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !isValidShippingRatesPayload(payload)) {
    throw new Error("shipping_rates_unavailable");
  }

  return payload;
}

async function requestCheckoutSession(endpoint, checkoutRequest) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(checkoutRequest),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !isValidCheckoutHandoff(payload)) {
    throw new Error("checkout_unavailable");
  }

  return payload;
}

document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
  button.addEventListener("click", () => {
    const sku = button.dataset.sku;
    const name = button.dataset.name;
    const unitPriceCents = Number(button.dataset.priceCents);
    const existing = cart.find((item) => item.sku === sku);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ sku, name, unitPriceCents, quantity: 1 });
    }

    clearSelectedShippingRate();
    orderStatus.textContent = "";
    renderCart();
    openCart();
  });
});

openCartButton.addEventListener("click", openCart);
closeCartButton.addEventListener("click", closeCart);
checkoutButton.addEventListener("click", () => {
  closeCart();
  document.querySelector("#delivery").scrollIntoView({ behavior: "smooth" });
  orderForm.querySelector("input").focus();
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const result = orderRequests.buildShippingRateRequest(getOrderFormInput());

  if (!result.ok) {
    orderStatus.textContent = result.message;
    return;
  }

  const shippingRatesEndpoint = getShippingRatesEndpoint();
  if (!selectedShippingRate) {
    if (!shippingRatesEndpoint) {
      orderStatus.textContent = "Shipping-rate lookup is not connected yet. Theo's Farm can still confirm shipping manually.";
      return;
    }

    orderSubmitButton.disabled = true;
    orderStatus.textContent = "Calculating live shipping rates...";

    try {
      const payload = await requestShippingRates(shippingRatesEndpoint, result);
      renderShippingRates(payload.rates);
      orderStatus.textContent = "Choose a shipping option. Stripe checkout will be enabled after the Stripe account is ready.";
    } catch (error) {
      orderStatus.textContent = shippingRatesFailureMessage;
    } finally {
      orderSubmitButton.disabled = false;
    }
    return;
  }

  const checkoutEndpoint = getCheckoutEndpoint();
  if (!checkoutEndpoint) {
    orderStatus.textContent = shippingRateLabel(selectedShippingRate) + " selected. Stripe checkout will be enabled after the Stripe account is ready.";
    return;
  }

  orderSubmitButton.disabled = true;
  orderStatus.textContent = "Starting secure checkout...";

  try {
    const handoff = await requestCheckoutSession(checkoutEndpoint, {
      orderRequest: result.orderRequest,
      shippingAddress: result.shippingAddress,
      selectedShippingRate,
    });
    window.location.assign(handoff.checkoutUrl);
  } catch (error) {
    orderStatus.textContent = checkoutFailureMessage;
    orderSubmitButton.disabled = false;
  }
});

orderForm.addEventListener("input", (event) => {
  if (event.target && event.target.name === "shippingRate") {
    return;
  }
  clearSelectedShippingRate();
  orderStatus.textContent = "";
});

cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) {
    closeCart();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
  }
});

renderCart();
