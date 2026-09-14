"use strict";
const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const { initializeApp, deleteApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createFirebaseAdminAuthenticator } = require("../src/admin-auth");
const { createFirestoreAdapter } = require("../src/firestore-adapter");
const { createStripeWebhookEventAdapter } = require("../src/stripe-webhook-adapter");
const { createNotificationDeliveryWorker } = require("../src/notification-delivery");
for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  assert.match(process.env[key] || "", /^(127\.0\.0\.1|localhost):\d+$/, `${key} must point to a local emulator`);
}
const projectId = "demo-theos-farm";
const { privateKey } = require("node:crypto").generateKeyPairSync("rsa", { modulusLength: 2048 });
const credential = cert({ projectId, clientEmail: "emulator@demo-theos-farm.iam.gserviceaccount.com", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) });
const app = initializeApp({ projectId, credential }, "sdk-maintenance");
const db = getFirestore(app);
const auth = getAuth(app);
const persistence = createFirestoreAdapter({ firestore: db, serverTimestamp: () => FieldValue.serverTimestamp() });
after(async () => { await db.terminate(); await deleteApp(app); });

test("installed Functions runtime exports load with the upgraded SDK", () => {
  const runtime = require("../src/firebase-runtime");
  for (const name of ["api", "notificationOutboxDelivery", "dailyFulfillmentSummary", "socialPostPublishing"]) {
    assert.equal(typeof runtime[name], "function");
  }
});

test("real Auth SDK verifies admin claims and rejects ordinary accounts", async () => {
  const email = "maintenance@example.test";
  const password = "Emulator-only-password-123";
  const user = await auth.createUser({ email, password });
  try {
    const authenticate = createFirebaseAdminAuthenticator({ verifyIdToken: token => auth.verifyIdToken(token) });
    async function signIn() {
      const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      assert.equal(response.status, 200);
      return (await response.json()).idToken;
    }
    await assert.rejects(authenticate({ req: { headers: { authorization: `Bearer ${await signIn()}` } } }), { code: "admin_forbidden" });
    await auth.setCustomUserClaims(user.uid, { admin: true });
    assert.deepEqual(await authenticate({ req: { headers: { authorization: `Bearer ${await signIn()}` } } }), { uid: user.uid, email });
  } finally { await auth.deleteUser(user.uid); }
});

test("real Firestore transactions persist payments, deduplicate alerts, and preserve refunds", async () => {
  const orderId = "sdk_maintenance_order";
  const orderRef = db.collection("orderRequests").doc(orderId);
  await orderRef.set({
    status: "needs_review", stripeCheckoutSessionId: "cs_test_sdk", stripePaymentIntentId: "pi_sdk",
    subtotalCents: 1795, customer: { name: "Test Customer", contact: "customer@example.test", preferredContact: "email", shippingZip: "62401" },
    items: [{ sku: "ear-corn-20lb", name: "20 lb Ear Corn Bag", quantity: 1, unitPriceCents: 1795 }],
  });
  const handle = createStripeWebhookEventAdapter(persistence);
  const paid = { id: "evt_sdk_paid", type: "checkout.session.completed", data: { object: {
    id: "cs_test_sdk", payment_intent: "pi_sdk", payment_status: "paid", client_reference_id: orderId, metadata: { orderRequestId: orderId },
  } } };
  const invoke = event => handle({ event, serverTimestamp: FieldValue.serverTimestamp() });
  assert.equal((await invoke(paid)).action, "updated_order");
  assert.equal((await invoke(paid)).action, "replayed_event");
  assert.equal((await orderRef.get()).data().paymentStatus, "paid");
  const jobs = await db.collection("notificationOutbox").where("orderRequestId", "==", orderId).get();
  assert.equal(jobs.size, 2);
  let sends = 0;
  const deliver = createNotificationDeliveryWorker({ ...persistence, sendNotification: async () => { sends++; return { providerMessageId: "fake_provider_message" }; } });
  const idempotencyKey = jobs.docs[0].id;
  assert.equal((await deliver({ idempotencyKey })).action, "sent");
  assert.equal((await deliver({ idempotencyKey })).action, "skipped");
  assert.equal(sends, 1);
  assert.equal((await invoke({ id: "evt_sdk_refund", type: "charge.refunded", data: { object: {
    id: "ch_sdk", payment_intent: "pi_sdk", refunded: true, amount: 1795, amount_refunded: 1795,
  } } })).action, "updated_order");
  assert.equal((await invoke({ ...paid, id: "evt_sdk_delayed" })).action, "ignored_terminal_order");
  assert.equal((await orderRef.get()).data().paymentStatus, "refunded");
  assert.equal((await db.collection("notificationOutbox").where("orderRequestId", "==", orderId).get()).size, 2);
});