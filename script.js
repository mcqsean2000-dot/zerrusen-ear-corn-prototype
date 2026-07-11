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
const shippingModal = document.querySelector("[data-shipping-modal]");
const closeShippingModalButton = document.querySelector("[data-close-shipping-modal]");
const continueToCheckoutButton = document.querySelector("[data-continue-to-checkout]");
const checkoutDetails = document.querySelector("[data-checkout-details]");
const checkoutResult = document.querySelector("[data-checkout-result]");
const checkoutResultKicker = document.querySelector("[data-checkout-result-kicker]");
const checkoutResultTitle = document.querySelector("[data-checkout-result-title]");
const checkoutResultCopy = document.querySelector("[data-checkout-result-copy]");
const checkoutResultReference = document.querySelector("[data-checkout-result-reference]");
const orderRequests = window.TheosOrderRequests;
const checkoutConfig = window.TheosCheckoutConfig || {};
const orderSubmitButton = orderForm.querySelector('button[type="submit"]');
const checkoutFailureMessage = "Checkout could not be started. Please try again or contact Theo's Farm.";
const shippingRatesFailureMessage = "Shipping rates could not be calculated. Please check the address or contact Theo's Farm.";
const shippingRatesButtonLabel = "Estimate shipping";
const checkoutButtonLabel = "Proceed to checkout";
const shippingAddressFieldNames = ["addressLine1", "addressLine2", "city", "state", "zip"];
let selectedShippingRate = null;
let latestShippingRates = [];

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

function openShippingModal() {
  if (!shippingModal) {
    return;
  }

  shippingModal.hidden = false;
  shippingModal.classList.add("is-open");
  shippingModal.setAttribute("aria-hidden", "false");
  if (continueToCheckoutButton) {
    continueToCheckoutButton.disabled = !selectedShippingRate;
  }
}

function closeShippingModal() {
  if (!shippingModal) {
    return;
  }

  shippingModal.classList.remove("is-open");
  shippingModal.setAttribute("aria-hidden", "true");
  shippingModal.hidden = true;
}

function showCheckoutDetails() {
  setCheckoutDetailsVisible(true);
  setOrderSubmitButton(checkoutButtonLabel);
  closeShippingModal();
  document.querySelector("#delivery").scrollIntoView({ behavior: "smooth" });
  const firstDetailInput = checkoutDetails && checkoutDetails.querySelector("input");
  if (firstDetailInput) {
    firstDetailInput.focus();
  }
}

function getCheckoutReturnState() {
  const url = new URL(window.location.href);
  const path = url.pathname.replace(/\/+$/, "");

  if (path.endsWith("/checkout/success") || url.searchParams.get("checkout") === "success") {
    return {
      type: "success",
      sessionId: String(url.searchParams.get("session_id") || "").trim(),
    };
  }

  if (path.endsWith("/checkout/cancel") || url.searchParams.get("checkout") === "cancel") {
    return {
      type: "cancel",
      sessionId: "",
    };
  }

  return {
    type: "",
    sessionId: "",
  };
}

function shortCheckoutReference(sessionId) {
  if (!/^cs_/.test(sessionId)) {
    return "";
  }

  return sessionId.length > 16 ? "Stripe reference ending " + sessionId.slice(-8) : "Stripe reference received";
}

function renderCheckoutReturnState() {
  const state = getCheckoutReturnState();

  if (!state.type) {
    return;
  }

  checkoutResult.hidden = false;
  checkoutResult.scrollIntoView({ block: "start", behavior: "smooth" });
  checkoutResult.focus({ preventScroll: true });

  if (state.type === "success") {
    checkoutResultKicker.textContent = "Checkout received";
    checkoutResultTitle.textContent = "Thanks, your payment is being confirmed.";
    checkoutResultCopy.textContent = "Stripe has sent the checkout result back to Theo's Farm. The order will move into fulfillment after the trusted webhook confirms payment.";
    const reference = shortCheckoutReference(state.sessionId);
    checkoutResultReference.hidden = !reference;
    checkoutResultReference.textContent = reference;
    return;
  }

  checkoutResultKicker.textContent = "Checkout paused";
  checkoutResultTitle.textContent = "Your cart is still here.";
  checkoutResultCopy.textContent = "Checkout was canceled before payment. You can review the order details, choose shipping again if needed, and return to Stripe Checkout when ready.";
  checkoutResultReference.hidden = true;
  checkoutResultReference.textContent = "";
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
            <small>${formatCents(item.unitPriceCents)} each</small>
          </span>
          <span class="cart-line-actions">
            <strong>${formatCents(item.unitPriceCents * item.quantity)}</strong>
            <span class="quantity-controls" aria-label="Quantity for ${item.name}">
              <button type="button" data-adjust-cart-item="${item.sku}" data-cart-delta="-1" aria-label="Decrease ${item.name} quantity">-</button>
              <input type="number" min="1" max="50" inputmode="numeric" value="${item.quantity}" data-cart-quantity="${item.sku}" aria-label="${item.name} quantity">
              <button type="button" data-adjust-cart-item="${item.sku}" data-cart-delta="1" aria-label="Increase ${item.name} quantity">+</button>
            </span>
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

  cartItems.querySelectorAll("[data-adjust-cart-item]").forEach((button) => {
    button.addEventListener("click", () => {
      adjustCartItem(button.dataset.adjustCartItem, Number(button.dataset.cartDelta));
    });
  });

  cartItems.querySelectorAll("[data-cart-quantity]").forEach((input) => {
    input.addEventListener("change", () => {
      setCartItemQuantity(input.dataset.cartQuantity, Number(input.value));
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

function setOrderSubmitButton(label, disabled = false) {
  orderSubmitButton.textContent = label;
  orderSubmitButton.disabled = disabled;
}

function setCheckoutDetailsVisible(isVisible) {
  if (!checkoutDetails) {
    return;
  }

  checkoutDetails.hidden = !isVisible;
}

function clearSelectedShippingRate() {
  selectedShippingRate = null;
  latestShippingRates = [];
  shippingRatesContainer.innerHTML = "";
  setCheckoutDetailsVisible(false);
  closeShippingModal();
  setOrderSubmitButton(shippingRatesButtonLabel);
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

function adjustCartItem(sku, delta) {
  const item = cart.find((cartItem) => cartItem.sku === sku);
  if (!item || !Number.isInteger(delta) || delta === 0) {
    return;
  }

  item.quantity = Math.max(0, Math.min(50, item.quantity + delta));
  if (item.quantity === 0) {
    removeCartItem(sku);
    return;
  }

  clearSelectedShippingRate();
  orderStatus.textContent = "";
  renderCart();
}

function setCartItemQuantity(sku, quantity) {
  const item = cart.find((cartItem) => cartItem.sku === sku);
  if (!item) {
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    quantity = 1;
  }

  item.quantity = Math.min(50, quantity);
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
  latestShippingRates = rates;
  shippingRatesContainer.innerHTML = [
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
  setOrderSubmitButton(selectedShippingRate ? "View shipping options" : shippingRatesButtonLabel);
  if (continueToCheckoutButton) {
    continueToCheckoutButton.disabled = !selectedShippingRate;
  }
  openShippingModal();

  shippingRatesContainer.querySelectorAll('input[name="shippingRate"]').forEach((input) => {
    input.addEventListener("change", () => {
      selectedShippingRate = rates.find((rate) => rate.rateId === input.value) || null;
      if (continueToCheckoutButton) {
        continueToCheckoutButton.disabled = !selectedShippingRate;
      }
      if (selectedShippingRate) {
        orderStatus.textContent = shippingRateLabel(selectedShippingRate) + " selected. Continue to checkout to enter delivery details.";
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
if (closeShippingModalButton) {
  closeShippingModalButton.addEventListener("click", closeShippingModal);
}
if (continueToCheckoutButton) {
  continueToCheckoutButton.addEventListener("click", () => {
    if (!selectedShippingRate) {
      orderStatus.textContent = "Choose a shipping option before continuing to checkout.";
      return;
    }

    orderStatus.textContent = shippingRateLabel(selectedShippingRate) + " selected. Add delivery details to continue to secure Stripe Checkout.";
    showCheckoutDetails();
  });
}
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

    setOrderSubmitButton("Estimating shipping...", true);
    orderStatus.textContent = "Estimating shipping from ZIP...";

    try {
      const payload = await requestShippingRates(shippingRatesEndpoint, result);
      renderShippingRates(payload.rates);
      orderStatus.textContent = "Choose an estimated shipping option to continue checkout.";
    } catch (error) {
      orderStatus.textContent = shippingRatesFailureMessage;
      setOrderSubmitButton(shippingRatesButtonLabel);
    } finally {
      orderSubmitButton.disabled = false;
    }
    return;
  }

  if (checkoutDetails && checkoutDetails.hidden && latestShippingRates.length) {
    openShippingModal();
    orderStatus.textContent = "Choose a shipping option to continue checkout.";
    return;
  }

  const checkoutRequest = orderRequests.buildCheckoutRequest(getOrderFormInput());

  if (!checkoutRequest.ok) {
    orderStatus.textContent = checkoutRequest.message;
    return;
  }

  const checkoutEndpoint = getCheckoutEndpoint();
  if (!checkoutEndpoint) {
    orderStatus.textContent = shippingRateLabel(selectedShippingRate) + " selected. Stripe checkout is not connected yet.";
    return;
  }

  setOrderSubmitButton("Starting checkout...", true);
  orderStatus.textContent = "Starting secure checkout...";

  try {
    const handoff = await requestCheckoutSession(checkoutEndpoint, {
      orderRequest: checkoutRequest.orderRequest,
      shippingAddress: checkoutRequest.shippingAddress,
      selectedShippingRate,
    });
    window.location.assign(handoff.checkoutUrl);
  } catch (error) {
    orderStatus.textContent = checkoutFailureMessage;
    setOrderSubmitButton(checkoutButtonLabel);
  }
});

orderForm.addEventListener("input", (event) => {
  if (event.target && event.target.name === "shippingRate") {
    return;
  }
  if (event.target && shippingAddressFieldNames.includes(event.target.name)) {
    clearSelectedShippingRate();
    orderStatus.textContent = "";
  }
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

renderCheckoutReturnState();
renderCart();
