import assert from "node:assert/strict";
import { createTestServer, test } from "./testUtils.js";

test("mapping create, update and delete API flow", async () => {
  const server = await createTestServer();
  try {
    const createResponse = await fetch(`${server.baseUrl}/api/mapping`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform: "smartstore",
        product_option_id: 2,
        sku_code: "EC-TUMBLER-BLK-500",
        created_by: "api-test"
      })
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.data.sku_code, "EC-TUMBLER-BLK-500");

    const updateResponse = await fetch(`${server.baseUrl}/api/mapping/${created.data.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku_code: "EC-POUCH-S", changed_by: "api-test" })
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.data.sku_code, "EC-POUCH-S");

    const deleteResponse = await fetch(`${server.baseUrl}/api/mapping/${created.data.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changed_by: "api-test" })
    });
    assert.equal(deleteResponse.status, 200);
    const deleted = await deleteResponse.json();
    assert.equal(deleted.data.mapping_status, "inactive");
  } finally {
    await server.close();
  }
});

test("API returns clear conflict errors", async () => {
  const server = await createTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/mapping`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform: "smartstore",
        product_option_id: 1,
        sku_code: "EC-TUMBLER-BLK-500"
      })
    });
    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.equal(payload.error.code, "DUPLICATE_ACTIVE_MAPPING");
  } finally {
    await server.close();
  }
});
