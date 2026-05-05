import assert from "node:assert/strict";
import { createTestDb, test } from "./testUtils.js";
import { SkuMappingRepository } from "../src/agents/sku-mapping/skuMappingRepository.js";
import { PlayautoSalesImportService, playautoInternals } from "../src/agents/sales/playautoSalesImportService.js";

test("Playauto option text normalizes labeled option values", () => {
  assert.equal(playautoInternals.normalizeOptionText("종류: 레드 / 용량: 500ml"), "레드 / 500ml");
});

test("Playauto sales import maps options and calculates gross profit", async () => {
  const db = createTestDb();
  const service = new PlayautoSalesImportService(db, new SkuMappingRepository(db));
  const csv = [
    "No,판매사이트명,상품명,주문선택사항,추가구매옵션,주문수량,판매가,주문고유번호,판매사이트 상품코드",
    "1,스마트스토어,데일리 텀블러,색상=레드 / 용량=500ml,,2,1000,ORDER-1,P-100"
  ].join("\n");

  const result = await service.importCsvText(csv, "test.csv");

  assert.equal(result.imported_rows, 1);
  assert.equal(result.mapped_rows, 1);
  assert.equal(db.data.sales_order_items[0].sku_code, "EC-TUMBLER-RED-500");
  assert.equal(db.data.sales_order_items[0].profit_amount, 1000);
});
