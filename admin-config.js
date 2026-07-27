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
      notificationHealth: "/api/admin/notifications",
      notificationRetry: "/api/admin/notifications/retry",
      socialReconciliation: "/api/admin/social-posts/reconciliation",
      socialReconciliationResolve: "/api/admin/social-posts/reconciliation/resolve",
      statusUpdate: "/api/admin/order-status",
    }),
  });
})(window);
