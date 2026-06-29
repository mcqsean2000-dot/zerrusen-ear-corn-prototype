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
const orderRequests = window.TheosOrderRequests;
const checkoutConfig = window.TheosCheckoutConfig || {};
const orderSubmitButton = orderForm.querySelector('button[type="submit"]');
const checkoutFailureMessage = "Checkout could not be started. Please try again or contact Theo's Farm.";

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
          <strong>${formatCents(item.unitPriceCents * item.quantity)}</strong>
        </div>
      `
    )
    .join("");
}

function isLocalCheckoutEndpoint(url) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
}

function getCheckoutEndpoint() {
  const rawEndpoint = String(checkoutConfig.checkoutEndpoint || "").trim();

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

async function requestCheckoutSession(endpoint, orderRequest) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ orderRequest }),
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

  const formData = new FormData(orderForm);
  const result = orderRequests.buildOrderRequest({
    cart,
    customer: {
      name: formData.get("name"),
      contact: formData.get("contact"),
      shippingZip: formData.get("zip"),
      preferredContact: formData.get("contactMethod"),
      note: formData.get("note"),
    },
  });

  if (!result.ok) {
    orderStatus.textContent = result.message;
    return;
  }

  const checkoutEndpoint = getCheckoutEndpoint();
  if (!checkoutEndpoint) {
    orderStatus.textContent = result.message;
    return;
  }

  orderSubmitButton.disabled = true;
  orderStatus.textContent = "Starting secure checkout...";

  try {
    const handoff = await requestCheckoutSession(checkoutEndpoint, result.payload);
    window.location.assign(handoff.checkoutUrl);
  } catch (error) {
    orderStatus.textContent = checkoutFailureMessage;
    orderSubmitButton.disabled = false;
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

renderCart();
