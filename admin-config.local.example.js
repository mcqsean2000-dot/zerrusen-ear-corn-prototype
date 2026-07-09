(function exposeLocalAdminConfig(global) {
  global.TheosAdminConfig = Object.freeze({
    enabled: true,
    firebase: Object.freeze({
      apiKey: "replace-with-public-firebase-web-api-key",
      appId: "replace-with-public-firebase-app-id",
      authDomain: "replace-with-project.firebaseapp.com",
      projectId: "replace-with-firebase-project-id",
    }),
    endpoints: Object.freeze({
      labelPurchase: "/api/admin/shippo-labels",
      statusUpdate: "/api/admin/order-status",
    }),
  });
})(window);
