import { JsonDatabase } from "../src/db/jsonDatabase.js";
import { SmartstoreProductImportService } from "../src/agents/platform-sync/smartstoreProductImportService.js";

const filePath = process.argv[2] || "./스마트스토어상품_20260505_105831.xlsx";
const db = await new JsonDatabase().load();
const service = new SmartstoreProductImportService(db);
const summary = await service.importFile(filePath);

console.log(JSON.stringify(summary, null, 2));
