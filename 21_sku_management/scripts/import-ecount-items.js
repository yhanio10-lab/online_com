import { JsonDatabase } from "../src/db/jsonDatabase.js";
import { EcountSkuImportService } from "../src/agents/sku-mapping/ecountSkuImportService.js";

const filePath = process.argv[2] || "./이카운트_품목.xlsx";
const db = await new JsonDatabase().load();
const service = new EcountSkuImportService(db);
const summary = await service.importFile(filePath, { changedBy: "cli" });

console.log(JSON.stringify(summary, null, 2));
