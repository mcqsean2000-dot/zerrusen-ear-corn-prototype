import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEnvironmentSource,
  validateDisabledNotificationConfig,
} from "./notification-activation-config.mjs";

const validSource = `
NOTIFICATION_ADMIN_EMAIL=theosfeedfarm@gmail.com
NOTIFICATION_FROM_EMAIL=Theo's Farm <orders@theosfarm.com>
NOTIFICATION_REPLY_TO=theosfeedfarm@gmail.com
NOTIFICATION_DELIVERY_ENABLED=false
NOTIFICATION_RECONCILIATION_ENABLED=false
DAILY_FULFILLMENT_SUMMARY_ENABLED=false
`;

test("accepts disabled notification config with the verified-domain-shaped sender", () => {
  assert.deepEqual(validateDisabledNotificationConfig(parseEnvironmentSource(validSource)), {
    adminEmail: "theosfeedfarm@gmail.com",
    flagsDisabled: true,
    replyTo: "theosfeedfarm@gmail.com",
    senderDomain: "theosfarm.com",
  });

  const subdomain = validSource.replace("orders@theosfarm.com", "orders@mail.theosfarm.com");
  assert.equal(
    validateDisabledNotificationConfig(parseEnvironmentSource(subdomain)).senderDomain,
    "mail.theosfarm.com",
  );
});

test("rejects malformed and duplicate environment entries", () => {
  assert.throws(() => parseEnvironmentSource("NOT AN ENV LINE"), /Invalid environment entry/);
  assert.throws(() => parseEnvironmentSource("KEY=one\nKEY=two"), /Duplicate environment key/);
});

test("rejects any notification enable flag that is not exactly false", () => {
  assert.throws(
    () => validateDisabledNotificationConfig(parseEnvironmentSource(
      validSource.replace("NOTIFICATION_DELIVERY_ENABLED=false", "NOTIFICATION_DELIVERY_ENABLED=true"),
    )),
    /NOTIFICATION_DELIVERY_ENABLED must be exactly false/,
  );
});

test("rejects Resend secrets in environment config", () => {
  assert.throws(
    () => validateDisabledNotificationConfig(parseEnvironmentSource(`${validSource}\nRESEND_API_KEY=re_not_a_real_key`)),
    /Firebase Secret Manager/,
  );
});

test("rejects Gmail and unrelated sender domains", () => {
  assert.throws(
    () => validateDisabledNotificationConfig(parseEnvironmentSource(
      validSource.replace("orders@theosfarm.com", "theosfeedfarm@gmail.com"),
    )),
    /must use theosfarm.com/,
  );
  assert.throws(
    () => validateDisabledNotificationConfig(parseEnvironmentSource(
      validSource.replace("orders@theosfarm.com", "orders@example.com"),
    )),
    /must use theosfarm.com/,
  );
});

test("requires the approved business recipient and reply-to", () => {
  assert.throws(
    () => validateDisabledNotificationConfig(parseEnvironmentSource(
      validSource.replace("NOTIFICATION_ADMIN_EMAIL=theosfeedfarm@gmail.com", "NOTIFICATION_ADMIN_EMAIL=other@example.com"),
    )),
    /NOTIFICATION_ADMIN_EMAIL must be/,
  );
  assert.throws(
    () => validateDisabledNotificationConfig(parseEnvironmentSource(
      validSource.replace("NOTIFICATION_REPLY_TO=theosfeedfarm@gmail.com", "NOTIFICATION_REPLY_TO=other@example.com"),
    )),
    /NOTIFICATION_REPLY_TO must be/,
  );
});
