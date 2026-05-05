import assert from "node:assert/strict";
import { createTestServer, test } from "./testUtils.js";

test("bundle component API adds, updates and deactivates components", async () => {
  const server = await createTestServer();
  try {
    server.db.data.sku_master.push({
      sku_code: "SET-TEST",
      sku_name: "테스트 세트",
      spec: "",
      unit: "",
      barcode: "",
      purchase_price: 0,
      purchase_price_vat_included: false,
      sale_price: 10000,
      sale_price_vat_included: false,
      item_type: "",
      is_set: true,
      inventory_managed: false,
      location: "",
      is_active: true,
      price_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const addResponse = await fetch(`${server.baseUrl}/api/bundles/SET-TEST/components`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ component_sku_code: "EC-POUCH-S", component_quantity: 2 })
    });
    assert.equal(addResponse.status, 201);
    const added = await addResponse.json();
    assert.equal(added.data.components[0].component_quantity, 2);

    const componentId = added.data.components[0].id;
    const updateResponse = await fetch(`${server.baseUrl}/api/bundles/SET-TEST/components/${componentId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ component_quantity: 3, is_active: true })
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.data.components[0].component_quantity, 3);

    const deleteResponse = await fetch(`${server.baseUrl}/api/bundles/SET-TEST/components/${componentId}`, {
      method: "DELETE"
    });
    assert.equal(deleteResponse.status, 200);
    const deleted = await deleteResponse.json();
    assert.equal(deleted.data.components[0].is_active, false);
  } finally {
    await server.close();
  }
});
