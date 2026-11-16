import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import mariadb from "mariadb";

async function main() {
  const database = `codex_order_test_${randomBytes(6).toString("hex")}`;
  if (!/^codex_order_test_[a-f0-9]{12}$/.test(database)) throw new Error("Invalid isolated database name");
  const configuredUrl = process.env.ORDER_TEST_ADMIN_URL;
  if (!configuredUrl) throw new Error("Set ORDER_TEST_ADMIN_URL to a local MySQL account that can create a temporary database");
  const adminUrl = new URL(configuredUrl);
  if (adminUrl.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(adminUrl.hostname)) throw new Error("Integration tests only allow a local MySQL server");
  const admin = await mariadb.createConnection({ host: adminUrl.hostname, port: Number(adminUrl.port || 3306), user: decodeURIComponent(adminUrl.username), password: decodeURIComponent(adminUrl.password), connectTimeout: 3000 });
  let created = false;
  let disconnect: (() => Promise<void>) | undefined;
  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    await admin.query(`USE \`${database}\``);
    const schema = await readFile("prisma/migrations/0_baseline_013/migration.sql", "utf8");
    for (const statement of schema.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean)) await admin.query(statement);
    await admin.query("INSERT INTO category_013_tb (id, name, sort_order) VALUES (1, 'Test category', 0)");
    await admin.query("INSERT INTO food_013_tb (id, category_id, name, description, price, image_url, is_available) VALUES (1, 1, 'Test food', '', 65.00, '/foods/test.jpg', 1), (2, 1, 'Unavailable', '', 45.00, '/foods/test2.jpg', 0)");

    const testUrl = new URL(adminUrl);
    testUrl.pathname = `/${database}`;
    process.env.DATABASE_URL = testUrl.toString();
    const { prisma } = await import("../lib/prisma");
    disconnect = () => prisma.$disconnect();
    const { createOrder } = await import("../app/actions/order");
    const { findTrackedOrder } = await import("../lib/order-tracking-service");
    const { POST: trackOrder } = await import("../app/api/orders/track/route");
    const input = { customerName: "Test customer", trackCode: "TestOrder001", items: [{ id: 1, quantity: 2, priceSatang: 6500 }] };

    const result = await createOrder(input);
    if (!result.ok) throw new Error(result.message);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderNumber }, include: { items: true } });
    assert.equal(order.status, "pending");
    assert.equal(order.total.toString(), "130");
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].foodName, "Test food");
    assert.equal(order.items[0].price.toString(), "65");
    assert.equal(order.items[0].quantity, 2);

    const tracked = await findTrackedOrder(input.trackCode);
    assert.ok(tracked);
    assert.equal(tracked.orderNumber, order.id);
    assert.equal(tracked.customerName, "Test customer");
    assert.equal(tracked.totalSatang, 13000);
    assert.deepEqual(tracked.items, [{ name: "Test food", quantity: 2, priceSatang: 6500 }]);
    assert.equal(await findTrackedOrder("testOrder001"), null, "tracking codes must be case-sensitive even with a case-insensitive database collation");
    assert.equal(await findTrackedOrder("invalid"), null);
    const request = (body: string) => new Request("http://localhost/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const trackResponse = await trackOrder(request(JSON.stringify({ trackCode: input.trackCode })));
    assert.equal(trackResponse.status, 200);
    assert.match(trackResponse.headers.get("cache-control") ?? "", /no-store/);
    const trackedBody = await trackResponse.json();
    assert.equal(trackedBody.order.orderNumber, order.id);
    assert.equal("trackCode" in trackedBody.order, false);
    assert.equal((await trackOrder(request(JSON.stringify({ trackCode: "testOrder001" })))).status, 404);
    assert.equal((await trackOrder(request("not-json"))).status, 400);
    assert.equal((await trackOrder(request(JSON.stringify({ trackCode: "short" })))).status, 400);
    for (const status of ["pending", "preparing", "ready", "completed"] as const) {
      await prisma.order.update({ where: { id: order.id }, data: { status } });
      assert.equal((await findTrackedOrder(input.trackCode))?.status, status);
    }

    const { NextRequest } = await import("next/server");
    const { createVendorSession, VENDOR_COOKIE } = await import("../lib/vendor-auth");
    const { GET: vendorGet, PATCH: vendorPatch } = await import("../app/api/vendor/orders/route");
    const { POST: vendorLogin } = await import("../app/api/vendor/session/route");
    process.env.VENDOR_PASSWORD = "test-only-strong-password";
    const vendorRequest = (method: string, body?: unknown, authorized = true, query = "") => new NextRequest(`http://localhost/api/vendor/orders${query}`, { method, headers: { ...(authorized ? { cookie: `${VENDOR_COOKIE}=${createVendorSession(process.env.VENDOR_PASSWORD!)}` } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await vendorGet(vendorRequest("GET", undefined, false))).status, 401);
    assert.equal((await vendorPatch(vendorRequest("PATCH", { id: order.id, status: "pending" }, false))).status, 401);
    const loginRequest = (password: string) => new Request("http://localhost/api/vendor/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    assert.equal((await vendorLogin(loginRequest("wrong"))).status, 401);
    const loginResponse = await vendorLogin(loginRequest(process.env.VENDOR_PASSWORD));
    assert.equal(loginResponse.status, 200);
    assert.match(loginResponse.headers.get("set-cookie") ?? "", /HttpOnly/i);
    await prisma.order.update({ where: { id: order.id }, data: { status: "pending" } });
    const listResponse = await vendorGet(vendorRequest("GET"));
    assert.equal(listResponse.status, 200);
    const vendorList = await listResponse.json();
    assert.equal(vendorList.counts.pending, 1);
    assert.equal(vendorList.orders[0].customerName, "Test customer");
    assert.equal("trackCode" in vendorList.orders[0], false);
    assert.equal((await vendorGet(vendorRequest("GET", undefined, true, "?status=bad"))).status, 400);
    assert.equal((await vendorPatch(vendorRequest("PATCH", { id: order.id, status: "preparing" }))).status, 409, "cannot skip a state");
    const update = () => vendorPatch(vendorRequest("PATCH", { id: order.id, status: "pending" }));
    const concurrent = await Promise.all([update(), update()]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409], "only one stale update may succeed");
    assert.equal((await findTrackedOrder(input.trackCode))?.status, "preparing");
    assert.equal((await vendorPatch(vendorRequest("PATCH", { id: order.id, status: "preparing" }))).status, 200);
    assert.equal((await findTrackedOrder(input.trackCode))?.status, "ready");
    assert.equal((await vendorPatch(vendorRequest("PATCH", { id: order.id, status: "ready" }))).status, 200);
    assert.equal((await findTrackedOrder(input.trackCode))?.status, "completed");
    assert.equal((await vendorPatch(vendorRequest("PATCH", { id: order.id, status: "completed" }))).status, 409);

    const retry = await createOrder(input);
    assert.equal(retry.ok, true);
    if (retry.ok) assert.equal(retry.orderNumber, result.orderNumber);
    const wrongCaseRetry = await createOrder({ ...input, trackCode: "testOrder001" });
    assert.equal(wrongCaseRetry.ok, false, "retry must not reveal a tracking code with different letter case");
    assert.equal(await prisma.order.count(), 1);
    const conflict = await createOrder({ ...input, customerName: "Different customer" });
    assert.equal(conflict.ok, false);
    const stale = await createOrder({ ...input, trackCode: randomBytes(9).toString("base64url"), items: [{ id: 1, quantity: 1, priceSatang: 1 }] });
    assert.equal(stale.ok, false);
    const unavailable = await createOrder({ ...input, trackCode: randomBytes(9).toString("base64url"), items: [{ id: 2, quantity: 1, priceSatang: 4500 }] });
    assert.equal(unavailable.ok, false);
    assert.equal(await prisma.order.count(), 1);

    await admin.query("START TRANSACTION");
    try {
      await admin.query("UPDATE food_013_tb SET price = 70.00 WHERE id = 1");
      const waitingOrder = createOrder({ ...input, trackCode: randomBytes(9).toString("base64url") });
      const earlyResult = await Promise.race([waitingOrder.then(() => "finished"), new Promise<string>((resolve) => setTimeout(() => resolve("waiting"), 300))]);
      assert.equal(earlyResult, "waiting", "checkout must wait for a concurrent price update");
      await admin.query("COMMIT");
      const changed = await waitingOrder;
      assert.equal(changed.ok, false, "checkout must reject the committed new price");
      if (!changed.ok) assert.match(changed.message, /ราคา/);
    } finally {
      await admin.query("ROLLBACK");
    }
    await admin.query("UPDATE food_013_tb SET price = 65.00 WHERE id = 1");
    assert.equal(await prisma.order.count(), 1);

    const retriedInput = { ...input, trackCode: randomBytes(9).toString("base64url") };
    await admin.query("START TRANSACTION");
    try {
      await admin.query("UPDATE food_013_tb SET price = 70.00 WHERE id = 1");
      const saved = await admin.query("INSERT INTO order_013_tb (track_code, customer_name, total, status, created_at, updated_at) VALUES (?, ?, 130.00, 'pending', NOW(), NOW())", [retriedInput.trackCode, retriedInput.customerName]);
      await admin.query("INSERT INTO order_item_013_tb (order_id, food_id, food_name, price, quantity) VALUES (?, 1, 'Test food', 65.00, 2)", [saved.insertId]);
      const retryWhileLocked = createOrder(retriedInput);
      const earlyRetry = await Promise.race([retryWhileLocked.then(() => "finished"), new Promise<string>((resolve) => setTimeout(() => resolve("waiting"), 300))]);
      assert.equal(earlyRetry, "waiting", "retry must wait for the in-flight order and price change");
      await admin.query("COMMIT");
      const recovered = await retryWhileLocked;
      assert.equal(recovered.ok, true, "retry must recover the existing order even after the menu price changes");
      if (recovered.ok) assert.equal(recovered.orderNumber, Number(saved.insertId));
    } finally {
      await admin.query("ROLLBACK");
    }
    await admin.query("UPDATE food_013_tb SET price = 65.00 WHERE id = 1");
    assert.equal(await prisma.order.count(), 2);

    const parallelInput = { ...input, trackCode: randomBytes(9).toString("base64url") };
    const [first, second] = await Promise.all([createOrder(parallelInput), createOrder(parallelInput)]);
    assert.equal(first.ok, true, "first concurrent attempt should succeed");
    assert.equal(second.ok, true, "second concurrent attempt should safely return the same order");
    if (first.ok && second.ok) assert.equal(first.orderNumber, second.orderNumber);
    assert.equal(await prisma.order.count(), 3);

    await admin.query("CREATE TRIGGER codex_reject_test BEFORE INSERT ON order_item_013_tb FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test rollback'");
    const failure = await createOrder({ ...input, trackCode: randomBytes(9).toString("base64url") });
    assert.equal(failure.ok, false);
    assert.equal(await prisma.order.count(), 3, "failed line item must roll back the order");
    console.log("PASS: creation, tracking, snapshots, retries, concurrent price checks, validation, and rollback on isolated local MySQL");
  } finally {
    try {
      if (disconnect) await disconnect();
    } finally {
      try {
        if (created) {
          await admin.query("USE information_schema");
          await admin.query(`DROP DATABASE \`${database}\``);
        }
      } finally {
        await admin.end();
      }
    }
  }
}

main().catch((error: Error) => { console.error("Isolated checkout verification failed:", error.name, error.message); process.exitCode = 1; });
