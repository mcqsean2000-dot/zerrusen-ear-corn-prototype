(function configureTheoCheckout(root) {
  root.TheosCheckoutConfig = {
    checkoutEndpoint: "/api/checkout-sessions",
    shippingRatesEndpoint: "/api/shipping-rates",
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
