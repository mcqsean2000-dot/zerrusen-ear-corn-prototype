import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

const projectId = "demo-theos-farm";
const [host, portText] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const port = Number(portText);
let testEnv;

function validOrder(overrides = {}) {
  return {
    createdAt: serverTimestamp(),
    customer: {
      contact: "customer@example.test",
      name: "Test Customer",
      note: "Leave at side door.",
      preferredContact: "email",
      shippingZip: "62401",
    },
    items: [
      {
        name: "20 lb Ear Corn Bag",
        quantity: 1,
        sku: "ear-corn-20lb",
        unitPriceCents: 1795,
      },
      {
        name: "40 lb Ear Corn Bag",
        quantity: 1,
        sku: "ear-corn-40lb",
        unitPriceCents: 2995,
      },
    ],
    source: "static-storefront",
    status: "needs_review",
    subtotalCents: 4790,
    ...overrides,
  };
}

async function seedOrder(orderId = "existing-order") {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "orderRequests", orderId), {
      ...validOrder(),
      createdAt: Timestamp.fromMillis(1_700_000_000_000),
    });
  });
}

before(async () => {
  assert(Number.isInteger(port), "FIRESTORE_EMULATOR_HOST must include a numeric port.");
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test("public customer can create a valid order request", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, "orderRequests", "public-valid"), validOrder()));
});

test("public customer cannot create an order with backend payment fields", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "orderRequests", "public-payment"), validOrder({
    stripeCheckoutSessionId: "cs_test_not_allowed",
  })));
});

test("public customer cannot create a malformed order", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "orderRequests", "public-malformed"), validOrder({
    customer: {
      contact: "customer@example.test",
      name: "Test Customer",
      preferredContact: "email",
      shippingZip: "invalid",
    },
  })));
});

test("public customer cannot mismatch a product SKU, name, and price", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "orderRequests", "public-mismatched-product"), validOrder({
    items: [
      {
        name: "40 lb Ear Corn Bag",
        quantity: 1,
        sku: "ear-corn-20lb",
        unitPriceCents: 2995,
      },
    ],
    subtotalCents: 2995,
  })));
});

test("public customer cannot submit a subtotal that disagrees with the items", async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "orderRequests", "public-wrong-subtotal"), validOrder({
    subtotalCents: 1795,
  })));
});

test("public and non-admin users cannot read orders", async () => {
  await seedOrder();
  const publicDb = testEnv.unauthenticatedContext().firestore();
  const userDb = testEnv.authenticatedContext("user-001").firestore();
  await assertFails(getDoc(doc(publicDb, "orderRequests", "existing-order")));
  await assertFails(getDoc(doc(userDb, "orderRequests", "existing-order")));
});

test("admin can read orders", async () => {
  await seedOrder();
  const db = testEnv.authenticatedContext("admin-001", { admin: true }).firestore();
  const snapshot = await assertSucceeds(getDoc(doc(db, "orderRequests", "existing-order")));
  assert.equal(snapshot.exists(), true);
});

test("admin can update approved fulfillment fields with an audit record", async () => {
  await seedOrder();
  const db = testEnv.authenticatedContext("admin-001", { admin: true }).firestore();
  await assertSucceeds(updateDoc(doc(db, "orderRequests", "existing-order"), {
    audit: {
      lastAction: "status_changed",
      updatedAt: serverTimestamp(),
      updatedByEmail: "admin@example.test",
      updatedByUid: "admin-001",
    },
    internalNotes: [],
    status: "ready_to_pack",
  }));
});

test("admin cannot update backend payment fields or unsupported fields", async () => {
  await seedOrder();
  const db = testEnv.authenticatedContext("admin-001", { admin: true }).firestore();
  const orderRef = doc(db, "orderRequests", "existing-order");
  await assertFails(updateDoc(orderRef, { stripePaymentIntentId: "pi_test_not_allowed" }));
  await assertFails(updateDoc(orderRef, { subtotalCents: 1 }));
});

test("admin cannot use an unsupported status or delete an order", async () => {
  await seedOrder();
  const db = testEnv.authenticatedContext("admin-001", { admin: true }).firestore();
  const orderRef = doc(db, "orderRequests", "existing-order");
  await assertFails(updateDoc(orderRef, { status: "paid" }));
  await assertFails(deleteDoc(orderRef));
});
