(function exposeAdminConfig(global) {
  global.TheosAdminConfig = Object.freeze({
    enabled: true,
    firebase: Object.freeze({
      autoConfig: true,
      apiKey: "",
      appId: "",
      authDomain: "",
      projectId: "",
    }),
    endpoints: Object.freeze({
      labelPurchase: "/api/admin/shippo-labels",
      statusUpdate: "/api/admin/order-status",
    }),
  });
})(window);
