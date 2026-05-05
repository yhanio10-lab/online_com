import assert from "node:assert/strict";
import { createMappingService, test } from "./testUtils.js";

test("creates a mapping for an unmapped option and writes history", async () => {
  const { db, service } = createMappingService();
  const mapping = await service.createMapping({
    platform: "smartstore",
    product_option_id: 2,
    sku_code: "EC-TUMBLER-BLK-500",
    created_by: "tester"
  });

  assert.equal(mapping.sku_code, "EC-TUMBLER-BLK-500");
  assert.equal(db.data.mapping_histories.at(-1).new_sku_code, "EC-TUMBLER-BLK-500");
});

test("rejects missing SKU", async () => {
  const { service } = createMappingService();
  await assert.rejects(
    service.createMapping({ platform: "smartstore", product_option_id: 2, sku_code: "NOPE" }),
    /SKU code does not exist/
  );
});

test("rejects inactive SKU", async () => {
  const { service } = createMappingService();
  await assert.rejects(
    service.createMapping({ platform: "openmarket", product_option_id: 4, sku_code: "EC-POUCH-L-OLD" }),
    /Inactive SKU cannot be mapped/
  );
});

test("rejects duplicate active mapping for same option", async () => {
  const { service } = createMappingService();
  await assert.rejects(
    service.createMapping({ platform: "smartstore", product_option_id: 1, sku_code: "EC-TUMBLER-BLK-500" }),
    /Option already has an active mapping/
  );
});
