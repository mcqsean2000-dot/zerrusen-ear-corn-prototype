(function prepareAdminLive(global) {
  const firebaseModules = Object.freeze({
    app: "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js",
    auth: "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js",
    firestore: "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js",
  });

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function adminConfig() {
    return global.TheosAdminConfig || {};
  }

  function configuredFirebase(config = adminConfig()) {
    const firebase = config.firebase || {};
    return Boolean(
      config.enabled === true &&
        text(firebase.apiKey) &&
        text(firebase.appId) &&
        text(firebase.authDomain) &&
        text(firebase.projectId),
    );
  }

  function endpointFor(name, config = adminConfig()) {
    const endpoints = config.endpoints || {};
    return text(endpoints[name]);
  }

  async function authHeaders(user) {
    if (!user || typeof user.getIdToken !== "function") {
      throw new Error("Admin Firebase user is required before calling admin endpoints.");
    }

    return {
      authorization: "Bearer " + await user.getIdToken(),
      "content-type": "application/json",
    };
  }

  function orderQuerySpec() {
    return Object.freeze({
      collectionName: "orderRequests",
      orderBy: Object.freeze(["createdAt", "desc"]),
      limit: 50,
    });
  }

  function orderFromSnapshot(snapshot) {
    const data = snapshot && typeof snapshot.data === "function" ? snapshot.data() : {};
    return {
      id: text(snapshot && snapshot.id),
      ...data,
    };
  }

  async function postAdminJson({ endpoint, user, body, fetchImpl = fetch }) {
    const target = text(endpoint);
    if (!target) {
      throw new Error("Admin endpoint is not configured.");
    }

    const response = await fetchImpl(target, {
      method: "POST",
      headers: await authHeaders(user),
      body: JSON.stringify(body || {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error && payload.error.message || "Admin request failed.");
      error.code = payload.error && payload.error.code || "admin_request_failed";
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function setAuthState(message, signedIn) {
    const status = document.querySelector("[data-admin-auth-status]");
    if (status) status.textContent = message;
    document.documentElement.toggleAttribute("data-admin-signed-in", Boolean(signedIn));
  }

  function clearAdminActions() {
    if (global.TheosAdminOrders && typeof global.TheosAdminOrders.clearActions === "function") {
      global.TheosAdminOrders.clearActions();
    }
  }

  function setAdminActions(user) {
    if (global.TheosAdminOrders && typeof global.TheosAdminOrders.setActions === "function") {
      global.TheosAdminOrders.setActions({
        endpoints: {
          labelPurchase: endpointFor("labelPurchase"),
          statusUpdate: endpointFor("statusUpdate"),
        },
        postAdminJson,
        user,
      });
    }
  }

  async function loadFirebase(importModule) {
    const importer = importModule || ((specifier) => import(specifier));
    const [app, auth, firestore] = await Promise.all([
      importer(firebaseModules.app),
      importer(firebaseModules.auth),
      importer(firebaseModules.firestore),
    ]);
    return { app, auth, firestore };
  }

  async function initializeAdminLive(options = {}) {
    const config = adminConfig();
    if (!configuredFirebase(config)) {
      clearAdminActions();
      setAuthState("Sample mode", false);
      return { enabled: false };
    }

    const modules = await loadFirebase(options.importModule);
    const app = modules.app.initializeApp(config.firebase);
    const auth = modules.auth.getAuth(app);
    const db = modules.firestore.getFirestore(app);
    const spec = orderQuerySpec();

    modules.auth.onAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearAdminActions();
        setAuthState("Sign in required", false);
        return;
      }

      try {
        const queryRef = modules.firestore.query(
          modules.firestore.collection(db, spec.collectionName),
          modules.firestore.orderBy(spec.orderBy[0], spec.orderBy[1]),
          modules.firestore.limit(spec.limit),
        );
        const snapshot = await modules.firestore.getDocs(queryRef);
        const orders = snapshot.docs.map(orderFromSnapshot);
        if (global.TheosAdminOrders && typeof global.TheosAdminOrders.setOrders === "function") {
          global.TheosAdminOrders.setOrders(orders);
        }
        setAdminActions(user);
        setAuthState("Signed in", true);
      } catch (error) {
        clearAdminActions();
        setAuthState("Admin access denied", false);
      }
    });

    return {
      auth,
      db,
      enabled: true,
    };
  }

  global.TheosAdminLive = Object.freeze({
    adminConfig,
    authHeaders,
    configuredFirebase,
    endpointFor,
    initializeAdminLive,
    orderFromSnapshot,
    orderQuerySpec,
    postAdminJson,
    setAdminActions,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeAdminLive().catch(() => {
        clearAdminActions();
        setAuthState("Sample mode", false);
      });
    });
  } else {
    initializeAdminLive().catch(() => {
      clearAdminActions();
      setAuthState("Sample mode", false);
    });
  }
})(window);
