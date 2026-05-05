import assert from "node:assert/strict";
import { createTestDb, test } from "./testUtils.js";
import { SkuMappingRepository } from "../src/agents/sku-mapping/skuMappingRepository.js";
import { PlayautoSalesImportService, playautoInternals } from "../src/agents/sales/playautoSalesImportService.js";
import { SalesRepository } from "../src/agents/sales/salesRepository.js";

function sampleCsv() {
  return [
    "No,판매사이트명,상품명,주문선택사항,추가구매옵션,주문수량,판매가,주문고유번호,판매사이트 상품코드",
    "1,스마트스토어,데일리 텀블러,색상=레드 / 용량=500ml,,2,1000,ORDER-1,P-100"
  ].join("\n");
}

test("Playauto option text normalizes labeled option values", () => {
  assert.equal(playautoInternals.normalizeOptionText("종류: 레드 / 용량: 500ml"), "레드 / 500ml");
});

test("Playauto sales import maps options and calculates gross profit", async () => {
  const db = createTestDb();
  const service = new PlayautoSalesImportService(db, new SkuMappingRepository(db));

  const result = await service.importCsvText(sampleCsv(), "test.csv");

  assert.equal(result.imported_rows, 1);
  assert.equal(result.mapped_rows, 1);
  assert.equal(db.data.sales_order_items[0].sku_code, "EC-TUMBLER-RED-500");
  assert.equal(db.data.sales_order_items[0].profit_amount, 1000);
});

test("sales details returns rows for a clicked summary key", async () => {
  const db = createTestDb();
  const service = new PlayautoSalesImportService(db, new SkuMappingRepository(db));

  await service.importCsvText(sampleCsv(), "detail-test.csv");
  const details = new SalesRepository(db).details({ groupBy: "sku", key: "EC-TUMBLER-RED-500" });

  assert.equal(details.length, 1);
  assert.equal(details[0].order_id, "ORDER-1");
  assert.equal(details[0].amount, 1000);
  assert.equal(details[0].profit_rate, 1);
});

test("sales details can return all rows without the old 200 row cap", () => {
  const db = createTestDb();
  const salesRepository = new SalesRepository(db);
  const timestamp = new Date().toISOString();
  db.data.sales_orders.push({
    id: 101,
    platform: "smartstore",
    order_id: "ORDER-BULK",
    ordered_at: timestamp.slice(0, 10),
    buyer_name: "",
    total_amount: 0,
    created_at: timestamp,
    updated_at: timestamp
  });
  for (let index = 0; index < 250; index += 1) {
    db.data.sales_order_items.push({
      id: index + 1,
      sales_order_id: 101,
      platform: "smartstore",
      order_id: `ORDER-BULK-${index}`,
      platform_product_id: "P-100",
      product_name: "테스트 상품",
      option_name: "레드 / 500ml",
      option_id: "OPT-RED-500",
      product_option_id: 1,
      sku_code: "EC-TUMBLER-RED-500",
      quantity: 1,
      amount: 1000,
      gross_sales_amount: 1000,
      cost_amount: 0,
      mapping_status: "mapped",
      created_at: timestamp
    });
  }

  const details = salesRepository.details({ groupBy: "platform", key: "smartstore", limit: 0 });

  assert.equal(details.length, 250);
});

test("platform fee rules reduce mapped sales profit", async () => {
  const db = createTestDb();
  const salesRepository = new SalesRepository(db);
  const service = new PlayautoSalesImportService(db, new SkuMappingRepository(db));

  await service.importCsvText(sampleCsv(), "fee-test.csv");
  await salesRepository.savePlatformFees([{ platform: "smartstore", fee_rate: 0.1 }]);
  const [summary] = salesRepository.summary({ groupBy: "platform" });

  assert.equal(summary.platform_fee_amount, 100);
  assert.equal(summary.profit_amount, 900);
  assert.equal(summary.profit_rate, 0.9);
  assert.equal(summary.mapped_profit_rate, 0.9);
});

test("sales summary separates total and mapped profit rates", () => {
  const db = createTestDb();
  const salesRepository = new SalesRepository(db);
  const timestamp = new Date().toISOString();
  db.data.sales_orders.push({
    id: 201,
    platform: "smartstore",
    order_id: "ORDER-MIXED",
    ordered_at: timestamp.slice(0, 10),
    buyer_name: "",
    total_amount: 2000,
    created_at: timestamp,
    updated_at: timestamp
  });
  db.data.sales_order_items.push(
    {
      id: 201,
      sales_order_id: 201,
      platform: "smartstore",
      order_id: "ORDER-MIXED-1",
      option_id: "OPT-RED-500",
      product_option_id: 1,
      sku_code: "EC-TUMBLER-RED-500",
      quantity: 1,
      amount: 1000,
      gross_sales_amount: 1000,
      cost_amount: 600,
      mapping_status: "mapped",
      created_at: timestamp
    },
    {
      id: 202,
      sales_order_id: 201,
      platform: "smartstore",
      order_id: "ORDER-MIXED-2",
      option_id: "UNKNOWN",
      product_option_id: null,
      sku_code: null,
      quantity: 1,
      amount: 1000,
      gross_sales_amount: 1000,
      cost_amount: 0,
      mapping_status: "mapping_failed",
      mapping_reason: "mapping_not_found",
      created_at: timestamp
    }
  );

  const [summary] = salesRepository.summary({ groupBy: "platform" });

  assert.equal(summary.amount, 2000);
  assert.equal(summary.mapped_amount, 1000);
  assert.equal(summary.unmapped_amount, 1000);
  assert.equal(summary.profit_amount, 400);
  assert.equal(summary.profit_rate, 0.2);
  assert.equal(summary.mapped_profit_rate, 0.4);
});
