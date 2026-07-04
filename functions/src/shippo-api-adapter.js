"use strict";

const SHIPPO_SHIPMENTS_URL = "https://api.goshippo.com/shipments/";

async function createShippoShipmentWithFetch({ payload, token, fetchImpl = fetch }) {
  if (!token || /^replace-with-/i.test(token)) {
    const error = new Error("Shippo API token is required.");
    error.code = "shippo_token_missing";
    throw error;
  }

  if (typeof fetchImpl !== "function") {
    const error = new Error("A fetch implementation is required for Shippo API calls.");
    error.code = "shippo_fetch_missing";
    throw error;
  }

  const response = await fetchImpl(SHIPPO_SHIPMENTS_URL, {
    method: "POST",
    headers: {
      authorization: `ShippoToken ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }

  if (!response.ok) {
    const error = new Error("Shippo shipment creation failed.");
    error.code = "shippo_shipment_create_failed";
    error.status = response.status;
    throw error;
  }

  return body;
}

module.exports = {
  SHIPPO_SHIPMENTS_URL,
  createShippoShipmentWithFetch,
};
