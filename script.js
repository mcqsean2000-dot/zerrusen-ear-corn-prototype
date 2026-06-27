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

orderForm.addEventListener("submit", (event) => {
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

  orderStatus.textContent = result.message;
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
