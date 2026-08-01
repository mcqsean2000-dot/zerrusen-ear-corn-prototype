(function configureTheoAnalytics(root) {
  root.TheosAnalyticsConfig = {
    // GA4 measurement IDs are public configuration, not credentials. Set this to
    // the business-owned web stream's G-XXXXXXXXXX value during an approved deploy.
    measurementId: "",
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
