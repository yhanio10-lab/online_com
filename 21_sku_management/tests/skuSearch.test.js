import assert from "node:assert/strict";
import { createMappingService, test } from "./testUtils.js";

test("SKU search uses AND matching across whitespace keywords", () => {
  const { service } = createMappingService();
  service.db.data.sku_master.push(
    {
      sku_code: "TEST-FRIXION-05-BLACK",
      sku_name: "프릭션 테스트",
      spec: "0.5 블랙",
      barcode: "",
      purchase_price: 0,
      sale_price: 0,
      is_active: true
    },
    {
      sku_code: "TEST-FRIXION-07-BLACK",
      sku_name: "프릭션 테스트",
      spec: "0.7 블랙",
      barcode: "",
      purchase_price: 0,
      sale_price: 0,
      is_active: true
    }
  );

  const rows = service.searchSku("프릭션 0.5", 500);
  const codes = rows.map((sku) => sku.sku_code);

  assert.ok(codes.includes("TEST-FRIXION-05-BLACK"));
  assert.ok(!codes.includes("TEST-FRIXION-07-BLACK"));
});
