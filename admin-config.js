(function exposeAdminConfig(global) {
  global.TheosAdminConfig = Object.freeze({
    enabled: false,
    firebase: Object.freeze({
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
