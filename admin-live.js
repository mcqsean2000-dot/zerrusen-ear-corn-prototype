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

  function completeFirebaseConfig(firebase) {
    return Boolean(
      text(firebase.apiKey) &&
        text(firebase.appId) &&
        text(firebase.authDomain) &&
        text(firebase.projectId),
    );
  }

  function configuredFirebase(config = adminConfig()) {
    const firebase = config.firebase || {};
    return config.enabled === true && (firebase.autoConfig === true || completeFirebaseConfig(firebase));
  }

  async function resolveFirebaseConfig(config = adminConfig(), fetchImpl = fetch) {
    const firebase = config.firebase || {};
    if (completeFirebaseConfig(firebase)) {
      return firebase;
    }

    if (config.enabled !== true || firebase.autoConfig !== true || typeof fetchImpl !== "function") {
      throw new Error("Firebase admin configuration is unavailable.");
    }

    const response = await fetchImpl("/__/firebase/init.json", {
      headers: { accept: "application/json" },
    });
    if (!response || !response.ok) {
      throw new Error("Firebase Hosting configuration could not be loaded.");
    }

    const hostedConfig = await response.json();
    if (!completeFirebaseConfig(hostedConfig || {})) {
      throw new Error("Firebase Hosting returned an incomplete public configuration.");
    }
    return hostedConfig;
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

  function setAuthState(message, authorized, authenticated = authorized) {
    const status = document.querySelector("[data-admin-auth-status]");
    if (status) status.textContent = message;
    document.documentElement.toggleAttribute("data-admin-signed-in", Boolean(authorized));
    const signOutButton = document.querySelector("[data-admin-sign-out]");
    if (signOutButton) signOutButton.hidden = !authenticated;
    if (typeof document.querySelectorAll === "function") {
      document.querySelectorAll("[data-admin-content]").forEach((element) => {
        element.hidden = !authorized;
      });
    }
  }

  function setAuthHelp(message) {
    const help = document.querySelector("[data-admin-auth-help]");
    if (help) help.textContent = message;
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

  function setSignInDisabled(disabled) {
    [
      "[data-admin-sign-in-email]",
      "[data-admin-sign-in-password]",
      "[data-admin-sign-in-submit]",
      "[data-admin-google-sign-in]",
    ].forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) element.disabled = Boolean(disabled);
    });
  }

  function configureSignInForm({ auth, authModule }) {
    const form = document.querySelector("[data-admin-sign-in-form]");
    const emailInput = document.querySelector("[data-admin-sign-in-email]");
    const passwordInput = document.querySelector("[data-admin-sign-in-password]");
    const googleButton = document.querySelector("[data-admin-google-sign-in]");
    const signOutButton = document.querySelector("[data-admin-sign-out]");

    if (!form || !emailInput || !passwordInput) return;

    setSignInDisabled(false);
    setAuthHelp("Sign in with Google or a Firebase admin account to load live order requests.");

    if (googleButton) {
      googleButton.addEventListener("click", async () => {
        if (
          typeof authModule.GoogleAuthProvider !== "function" ||
          typeof authModule.signInWithPopup !== "function"
        ) {
          setAuthState("Google sign in unavailable", false);
          return;
        }

        const provider = new authModule.GoogleAuthProvider();
        if (typeof provider.setCustomParameters === "function") {
          provider.setCustomParameters({ prompt: "select_account" });
        }

        setSignInDisabled(true);
        setAuthState("Opening Google sign in...", false);
        try {
          await authModule.signInWithPopup(auth, provider);
        } catch (error) {
          setAuthState("Google sign in failed", false);
        } finally {
          setSignInDisabled(false);
        }
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = text(emailInput.value);
      const password = passwordInput.value || "";
      if (!email || !password || typeof authModule.signInWithEmailAndPassword !== "function") {
        setAuthState("Sign in failed", false);
        return;
      }

      setSignInDisabled(true);
      setAuthState("Signing in...", false);
      try {
        await authModule.signInWithEmailAndPassword(auth, email, password);
        passwordInput.value = "";
      } catch (error) {
        setAuthState("Sign in failed", false);
      } finally {
        setSignInDisabled(false);
      }
    });

    if (signOutButton) {
      signOutButton.addEventListener("click", async () => {
        if (typeof authModule.signOut !== "function") return;
        setAuthState("Signing out...", true);
        try {
          await authModule.signOut(auth);
        } catch (error) {
          setAuthState("Sign out failed", true);
        }
      });
    }
  }

  async function initializeAdminLive(options = {}) {
    const config = adminConfig();
    if (!configuredFirebase(config)) {
      clearAdminActions();
      setSignInDisabled(true);
      setAuthHelp("Firebase admin sign-in is not configured for this static preview.");
      setAuthState("Sample mode", false);
      return { enabled: false };
    }

    const firebaseConfig = await resolveFirebaseConfig(config, options.fetchImpl);
    const modules = await loadFirebase(options.importModule);
    const app = modules.app.initializeApp(firebaseConfig);
    const auth = modules.auth.getAuth(app);
    const db = modules.firestore.getFirestore(app);
    const spec = orderQuerySpec();
    configureSignInForm({ auth, authModule: modules.auth });

    modules.auth.onAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearAdminActions();
        setAuthState("Sign in required", false);
        return;
      }

      try {
        if (typeof user.getIdTokenResult !== "function") {
          throw new Error("Admin claim verification is unavailable.");
        }
        const tokenResult = await user.getIdTokenResult(true);
        if (!tokenResult || !tokenResult.claims || tokenResult.claims.admin !== true) {
          throw new Error("Authenticated account does not have admin access.");
        }

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
        setAuthState("Admin access denied", false, true);
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
    resolveFirebaseConfig,
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
