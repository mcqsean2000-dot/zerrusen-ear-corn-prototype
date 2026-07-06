"use strict";

const SHIPPO_SHIPMENTS_URL = "https://api.goshippo.com/shipments/";
const SHIPPO_TRANSACTIONS_URL = "https://api.goshippo.com/transactions/";

function requireShippoToken(token) {
  if (!token || /^replace-with-/i.test(token)) {
    const error = new Error("Shippo API token is required.");
    error.code = "shippo_token_missing";
    throw error;
  }
}

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    const error = new Error("A fetch implementation is required for Shippo API calls.");
    error.code = "shippo_fetch_missing";
    throw error;
  }
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function createShippoShipmentWithFetch({ payload, token, fetchImpl = fetch }) {
  requireShippoToken(token);
  requireFetch(fetchImpl);

  const response = await fetchImpl(SHIPPO_SHIPMENTS_URL, {
    method: "POST",
    headers: {
      authorization: `ShippoToken ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error("Shippo shipment creation failed.");
    error.code = "shippo_shipment_create_failed";
    error.status = response.status;
    throw error;
  }

  return body;
}

async function createShippoTransactionWithFetch({
  rateId,
  token,
  labelFileType = "PDF",
  asyncLabel = false,
  fetchImpl = fetch,
}) {
  requireShippoToken(token);
  requireFetch(fetchImpl);

  if (!rateId || typeof rateId !== "string" || !rateId.trim()) {
    const error = new Error("A Shippo rate ID is required to buy a label.");
    error.code = "shippo_rate_id_missing";
    throw error;
  }

  const response = await fetchImpl(SHIPPO_TRANSACTIONS_URL, {
    method: "POST",
    headers: {
      authorization: `ShippoToken ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      async: asyncLabel,
      label_file_type: labelFileType,
      rate: rateId,
    }),
  });

  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error("Shippo label transaction creation failed.");
    error.code = "shippo_transaction_create_failed";
    error.status = response.status;
    throw error;
  }

  return body;
}

module.exports = {
  SHIPPO_SHIPMENTS_URL,
  SHIPPO_TRANSACTIONS_URL,
  createShippoShipmentWithFetch,
  createShippoTransactionWithFetch,
};
