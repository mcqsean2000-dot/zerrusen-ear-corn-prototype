(function configureTheoCheckout(root) {
  root.TheosCheckoutConfig = {
    checkoutEndpoint: "",
    shippingRatesEndpoint: "/api/shipping-rates",
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
