import { JsonDatabase } from "../src/db/jsonDatabase.js";
import { SkuMappingRepository } from "../src/agents/sku-mapping/skuMappingRepository.js";
import { PlayautoSalesImportService } from "../src/agents/sales/playautoSalesImportService.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm.cmd run import:playauto -- <playauto-sales.xls|csv>");
  process.exit(1);
}

const db = await new JsonDatabase().load();
const service = new PlayautoSalesImportService(db, new SkuMappingRepository(db));
const summary = await service.importFile(filePath);

console.log(JSON.stringify(summary, null, 2));
