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

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getCartTotals() {
  return cart.reduce(
    (totals, item) => ({
      itemCount: totals.itemCount + item.quantity,
      subtotal: totals.subtotal + item.price * item.quantity,
    }),
    { itemCount: 0, subtotal: 0 }
  );
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function renderOrderSummary(subtotal) {
  const lines = cart.map((item) =>
    "<p>" + item.quantity + " x " + item.name + " - " + money.format(item.price * item.quantity) + "</p>"
  );

  orderSummary.innerHTML = [
    "<strong>Cart summary</strong>",
    cart.length ? lines.join("") : "<p>Add a bag to the cart and it will appear here before checkout.</p>",
    "<span>Estimated subtotal: <b data-order-subtotal>" + money.format(subtotal) + "</b></span>",
  ].join("");
}

function renderCart() {
  const { itemCount, subtotal } = getCartTotals();

  cartCount.textContent = itemCount;
  cartTotal.textContent = money.format(subtotal);
  checkoutButton.disabled = !cart.length;
  renderOrderSummary(subtotal);

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
            <small>Qty ${item.quantity} x ${money.format(item.price)}</small>
          </span>
          <strong>${money.format(item.price * item.quantity)}</strong>
        </div>
      `
    )
    .join("");
}

document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.name;
    const price = Number(button.dataset.price);
    const existing = cart.find((item) => item.name === name);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ name, price, quantity: 1 });
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

  if (!cart.length) {
    orderStatus.textContent = "Add at least one bag to the cart before requesting a checkout link.";
    return;
  }

  const formData = new FormData(orderForm);
  const name = formData.get("name").trim();
  const contact = formData.get("contact").trim();
  const zip = formData.get("zip").trim();
  const contactMethod = formData.get("contactMethod");

  if (!name || !contact || !zip || !contactMethod) {
    orderStatus.textContent = "Add your name, contact info, shipping ZIP, and preferred contact method so Theo's Farm can confirm delivery.";
    return;
  }

  if (!/^\d{5}$/.test(zip)) {
    orderStatus.textContent = "Enter a 5-digit shipping ZIP so Theo's Farm can confirm delivery.";
    return;
  }

  orderStatus.textContent = "Prototype only: this would send the order request to Stripe Checkout and the order notification workflow.";
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
