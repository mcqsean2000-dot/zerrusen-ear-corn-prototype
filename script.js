const CART_STORAGE_KEY = "theos-farm-cart-v1";
const productButtons = Array.from(document.querySelectorAll("[data-add-to-cart]"));
const productCatalog = new Map(
  productButtons.map((button) => [
    button.dataset.sku,
    {
      sku: button.dataset.sku,
      name: button.dataset.name,
      unitPriceCents: Number(button.dataset.priceCents),
    },
  ])
);
const cart = restoreCart();

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
const checkoutButtonLabel = "Choose shipping method";
const stripeCheckoutButtonLabel = "Continue to Stripe Checkout";
const estimateResetFieldNames = ["zip"];
let selectedShippingRate = null;
let latestShippingRates = [];
let shippingModalMode = "estimate";
let pendingCheckoutRequest = null;

function getCartStorage() {
  try {
    return window.localStorage || null;
  } catch (error) {
    return null;
  }
}

function restoreCart() {
  const storage = getCartStorage();
  if (!storage) {
    return [];
  }

  try {
    const storedLines = JSON.parse(storage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(storedLines)) {
      return [];
    }

    const restored = [];
    const restoredSkus = new Set();
    storedLines.forEach((line) => {
      const product = productCatalog.get(String(line && line.sku || ""));
      const quantity = Number(line && line.quantity);
      if (
        !product ||
        restoredSkus.has(product.sku) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 50
      ) {
        return;
      }

      restoredSkus.add(product.sku);
      restored.push({ ...product, quantity });
    });
    return restored;
  } catch (error) {
    return [];
  }
}

function persistCart() {
  const storage = getCartStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cart.map(({ sku, quantity }) => ({ sku, quantity })))
    );
  } catch (error) {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
}

function clearCart() {
  cart.splice(0, cart.length);
  persistCart();
}

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
    continueToCheckoutButton.disabled = shippingModalMode === "method" && !selectedShippingRate;
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
  selectedShippingRate = null;
  pendingCheckoutRequest = null;
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
    if (/^cs_/.test(state.sessionId)) {
      clearCart();
    }
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
  persistCart();

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
  pendingCheckoutRequest = null;
  shippingModalMode = "estimate";
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

function setShippingModalCopy({ kicker, title, note, actionLabel, closeLabel }) {
  const modalKicker = document.querySelector("[data-shipping-modal-kicker]");
  const modalTitle = document.querySelector("[data-shipping-modal-title]");
  const modalNote = document.querySelector("[data-shipping-modal-note]");

  if (modalKicker) modalKicker.textContent = kicker;
  if (modalTitle) modalTitle.textContent = title;
  if (modalNote) modalNote.textContent = note;
  if (continueToCheckoutButton) continueToCheckoutButton.textContent = actionLabel;
  if (closeShippingModalButton) closeShippingModalButton.textContent = closeLabel;
}

function shippingRateMarkup(rate, options = {}) {
  const selectable = options.selectable === true;
  const index = Number(options.index || 0);
  const input = selectable
    ? `<input type="radio" name="shippingRate" value="${escapeHtml(rate.rateId)}" ${index === 0 ? "checked" : ""}>`
    : "";

  return `
    <label class="shipping-rate-option ${selectable ? "" : "shipping-rate-estimate"}">
      ${input}
      <span>
        <strong>${escapeHtml(shippingRateLabel(rate))}</strong>
        <small>${escapeHtml(rate.durationTerms || "Estimated delivery shown by carrier")}</small>
      </span>
      <strong>${formatCents(rate.amountCents)}</strong>
    </label>
  `;
}

function renderShippingEstimates(rates) {
  latestShippingRates = rates;
  selectedShippingRate = null;
  pendingCheckoutRequest = null;
  shippingModalMode = "estimate";
  shippingRatesContainer.innerHTML = rates.map((rate) => shippingRateMarkup(rate)).join("");
  setShippingModalCopy({
    kicker: "Shipping estimate",
    title: "Estimated shipping",
    note: "These rates are estimated from ZIP only. Final shipping is checked again with the full delivery address before Stripe Checkout.",
    actionLabel: "Continue to checkout",
    closeLabel: "Keep shopping",
  });
  setOrderSubmitButton("Continue to checkout");
  if (continueToCheckoutButton) {
    continueToCheckoutButton.disabled = false;
  }
  openShippingModal();
}

function renderShippingMethods(rates, checkoutRequest) {
  latestShippingRates = rates;
  pendingCheckoutRequest = checkoutRequest;
  shippingModalMode = "method";
  shippingRatesContainer.innerHTML = rates.map((rate, index) => shippingRateMarkup(rate, { selectable: true, index })).join("");
  selectedShippingRate = rates[0] || null;
  setShippingModalCopy({
    kicker: "Shipping method",
    title: "Choose shipping method",
    note: "These rates use the full delivery address and will be included in Stripe Checkout.",
    actionLabel: stripeCheckoutButtonLabel,
    closeLabel: "Back to form",
  });
  setOrderSubmitButton(selectedShippingRate ? "View shipping methods" : checkoutButtonLabel);
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
        orderStatus.textContent = shippingRateLabel(selectedShippingRate) + " selected. Continue to Stripe Checkout when ready.";
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

async function startStripeCheckout(checkoutRequest, shippingRate) {
  const checkoutEndpoint = getCheckoutEndpoint();
  if (!checkoutEndpoint) {
    orderStatus.textContent = shippingRateLabel(shippingRate) + " selected. Stripe checkout is not connected yet.";
    return;
  }

  if (!checkoutRequest || !shippingRate) {
    orderStatus.textContent = "Choose a shipping method before starting checkout.";
    return;
  }

  setOrderSubmitButton("Starting checkout...", true);
  if (continueToCheckoutButton) {
    continueToCheckoutButton.disabled = true;
    continueToCheckoutButton.textContent = "Starting checkout...";
  }
  orderStatus.textContent = "Starting secure checkout...";

  try {
    const handoff = await requestCheckoutSession(checkoutEndpoint, {
      orderRequest: checkoutRequest.orderRequest,
      shippingAddress: checkoutRequest.shippingAddress,
      selectedShippingRate: shippingRate,
    });
    window.location.assign(handoff.checkoutUrl);
  } catch (error) {
    orderStatus.textContent = checkoutFailureMessage;
    setOrderSubmitButton(checkoutButtonLabel);
    if (continueToCheckoutButton) {
      continueToCheckoutButton.disabled = false;
      continueToCheckoutButton.textContent = stripeCheckoutButtonLabel;
    }
  }
}

productButtons.forEach((button) => {
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
  continueToCheckoutButton.addEventListener("click", async () => {
    if (shippingModalMode === "estimate") {
      orderStatus.textContent = "Add delivery details to get final shipping methods.";
      showCheckoutDetails();
      return;
    }

    if (!selectedShippingRate) {
      orderStatus.textContent = "Choose a shipping method before continuing to checkout.";
      return;
    }

    await startStripeCheckout(pendingCheckoutRequest, selectedShippingRate);
  });
}
checkoutButton.addEventListener("click", () => {
  closeCart();
  document.querySelector("#delivery").scrollIntoView({ behavior: "smooth" });
  orderForm.querySelector("input").focus();
});

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const shippingRatesEndpoint = getShippingRatesEndpoint();
  if (checkoutDetails && checkoutDetails.hidden) {
    const result = orderRequests.buildShippingRateRequest(getOrderFormInput());

    if (!result.ok) {
      orderStatus.textContent = result.message;
      return;
    }

    if (!shippingRatesEndpoint) {
      orderStatus.textContent = "Shipping-rate lookup is not connected yet. Theo's Farm can still confirm shipping manually.";
      return;
    }

    setOrderSubmitButton("Estimating shipping...", true);
    orderStatus.textContent = "Estimating shipping from ZIP...";

    try {
      const payload = await requestShippingRates(shippingRatesEndpoint, result);
      renderShippingEstimates(payload.rates);
      orderStatus.textContent = "Review estimated shipping, then continue to checkout for final rates.";
    } catch (error) {
      orderStatus.textContent = shippingRatesFailureMessage;
      setOrderSubmitButton(shippingRatesButtonLabel);
    } finally {
      orderSubmitButton.disabled = false;
    }
    return;
  }

  const checkoutRequest = orderRequests.buildCheckoutRequest(getOrderFormInput());

  if (!checkoutRequest.ok) {
    orderStatus.textContent = checkoutRequest.message;
    return;
  }

  if (!shippingRatesEndpoint) {
    orderStatus.textContent = "Shipping-rate lookup is not connected yet. Theo's Farm can still confirm shipping manually.";
    return;
  }

  setOrderSubmitButton("Finding shipping methods...", true);
  orderStatus.textContent = "Checking final shipping methods from the full address...";

  try {
    const payload = await requestShippingRates(shippingRatesEndpoint, checkoutRequest);
    renderShippingMethods(payload.rates, checkoutRequest);
    orderStatus.textContent = "Choose a shipping method to continue to Stripe Checkout.";
  } catch (error) {
    orderStatus.textContent = shippingRatesFailureMessage;
    setOrderSubmitButton(checkoutButtonLabel);
  } finally {
    orderSubmitButton.disabled = false;
  }
});

orderForm.addEventListener("input", (event) => {
  if (event.target && event.target.name === "shippingRate") {
    return;
  }
  if (event.target && estimateResetFieldNames.includes(event.target.name)) {
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
