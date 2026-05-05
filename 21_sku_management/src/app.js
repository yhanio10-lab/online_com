import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { JsonDatabase } from "./db/jsonDatabase.js";
import { SkuMappingRepository } from "./agents/sku-mapping/skuMappingRepository.js";
import { SkuMappingService } from "./agents/sku-mapping/skuMappingService.js";
import { EcountSkuImportService } from "./agents/sku-mapping/ecountSkuImportService.js";
import { SmartstoreProductImportService } from "./agents/platform-sync/smartstoreProductImportService.js";
import { SkuBundleRepository } from "./agents/sku-bundles/skuBundleRepository.js";
import { SkuBundleService } from "./agents/sku-bundles/skuBundleService.js";
import { SalesRepository } from "./agents/sales/salesRepository.js";
import { SalesService } from "./agents/sales/salesService.js";
import { PlayautoSalesImportService } from "./agents/sales/playautoSalesImportService.js";
import { InventoryRepository } from "./agents/inventory/inventoryRepository.js";
import { InventoryService } from "./agents/inventory/inventoryService.js";
import { sendError, sendJson } from "./shared/httpError.js";

const PUBLIC_DIR = path.resolve("public");

function parsePathname(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(":")) params[patternParts[i].slice(1)] = pathParts[i];
    else if (patternParts[i] !== pathParts[i]) return null;
  }
  return params;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const requestPath = url.pathname === "/" || url.pathname === "/admin" ? "/admin/index.html" : url.pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestPath}`);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return false;
    const contentType = filePath.endsWith(".html")
      ? "text/html; charset=utf-8"
      : filePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filePath.endsWith(".json")
          ? "application/json; charset=utf-8"
          : "application/javascript; charset=utf-8";
    res.writeHead(200, { "content-type": contentType });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

export async function createApp({ db = new JsonDatabase() } = {}) {
  await db.load();
  const mappingRepository = new SkuMappingRepository(db);
  const mappingService = new SkuMappingService(mappingRepository, db);
  const ecountSkuImportService = new EcountSkuImportService(db);
  const smartstoreProductImportService = new SmartstoreProductImportService(db);
  const salesService = new SalesService(new SalesRepository(db), mappingRepository);
  const playautoSalesImportService = new PlayautoSalesImportService(db, mappingRepository);
  const inventoryService = new InventoryService(new InventoryRepository(db));
  const bundleService = new SkuBundleService(new SkuBundleRepository(db), db);

  return async function app(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      const query = Object.fromEntries(url.searchParams.entries());

      if (req.method === "GET" && url.pathname === "/api/mapping/options") {
        return sendJson(res, 200, { ok: true, data: mappingService.listOptions(query) });
      }
      if (req.method === "GET" && url.pathname === "/api/sku/search") {
        return sendJson(res, 200, { ok: true, data: mappingService.searchSku(query.q || "", query.size || 200) });
      }
      if (req.method === "POST" && url.pathname === "/api/sku/import/ecount") {
        const body = await readBody(req);
        const filePath = body.file_path || "./이카운트_품목.xlsx";
        return sendJson(res, 200, {
          ok: true,
          data: await ecountSkuImportService.importFile(filePath, { changedBy: body.changed_by || "api" })
        });
      }
      if (req.method === "POST" && url.pathname === "/api/platform/smartstore/import/products") {
        const body = await readBody(req);
        const filePath = body.file_path || "./스마트스토어상품_20260505_105831.xlsx";
        return sendJson(res, 200, { ok: true, data: await smartstoreProductImportService.importFile(filePath) });
      }
      if (req.method === "GET" && url.pathname === "/api/mapping/conflicts") {
        return sendJson(res, 200, { ok: true, data: mappingService.conflicts() });
      }
      if (req.method === "GET" && url.pathname === "/api/bundles") {
        return sendJson(res, 200, { ok: true, data: bundleService.list(query) });
      }
      const bundleAvailability = parsePathname("/api/bundles/:skuCode/availability", url.pathname);
      if (bundleAvailability && req.method === "GET") {
        return sendJson(res, 200, { ok: true, data: bundleService.availability(decodeURIComponent(bundleAvailability.skuCode), inventoryService) });
      }
      const bundleComponent = parsePathname("/api/bundles/:skuCode/components/:componentId", url.pathname);
      if (bundleComponent && req.method === "PUT") {
        return sendJson(res, 200, {
          ok: true,
          data: await bundleService.updateComponent(decodeURIComponent(bundleComponent.skuCode), bundleComponent.componentId, await readBody(req))
        });
      }
      if (bundleComponent && req.method === "DELETE") {
        return sendJson(res, 200, {
          ok: true,
          data: await bundleService.deleteComponent(decodeURIComponent(bundleComponent.skuCode), bundleComponent.componentId)
        });
      }
      const bundleComponents = parsePathname("/api/bundles/:skuCode/components", url.pathname);
      if (bundleComponents && req.method === "POST") {
        return sendJson(res, 201, {
          ok: true,
          data: await bundleService.addComponent(decodeURIComponent(bundleComponents.skuCode), await readBody(req))
        });
      }
      const bundleDetail = parsePathname("/api/bundles/:skuCode", url.pathname);
      if (bundleDetail && req.method === "GET") {
        return sendJson(res, 200, { ok: true, data: bundleService.detail(decodeURIComponent(bundleDetail.skuCode)) });
      }
      if (req.method === "POST" && url.pathname === "/api/mapping") {
        return sendJson(res, 201, { ok: true, data: await mappingService.createMapping(await readBody(req)) });
      }
      if (req.method === "POST" && url.pathname === "/api/mapping/bulk") {
        return sendJson(res, 207, { ok: true, data: await mappingService.bulkCreate(await readBody(req)) });
      }
      const mappingUpdate = parsePathname("/api/mapping/:id", url.pathname);
      if (mappingUpdate && req.method === "PUT") {
        return sendJson(res, 200, { ok: true, data: await mappingService.updateMapping(mappingUpdate.id, await readBody(req)) });
      }
      if (mappingUpdate && req.method === "DELETE") {
        return sendJson(res, 200, { ok: true, data: await mappingService.deleteMapping(mappingUpdate.id, await readBody(req)) });
      }
      if (req.method === "POST" && url.pathname === "/api/sales/ingest") {
        return sendJson(res, 201, { ok: true, data: await salesService.ingest(await readBody(req)) });
      }
      if (req.method === "POST" && url.pathname === "/api/sales/import/playauto") {
        const body = await readBody(req);
        return sendJson(res, 200, { ok: true, data: await playautoSalesImportService.importFile(body.file_path) });
      }
      if (req.method === "GET" && url.pathname === "/api/sales/imports") {
        return sendJson(res, 200, { ok: true, data: salesService.importBatches() });
      }
      if (req.method === "GET" && url.pathname === "/api/sales/mapping-failures") {
        return sendJson(res, 200, { ok: true, data: salesService.failedItems(query) });
      }
      if (req.method === "GET" && url.pathname === "/api/sales/details") {
        return sendJson(res, 200, { ok: true, data: salesService.details(query) });
      }
      if (req.method === "GET" && url.pathname === "/api/sales/summary") {
        return sendJson(res, 200, { ok: true, data: salesService.summary(query) });
      }
      if (req.method === "GET" && url.pathname === "/api/inventory/summary") {
        return sendJson(res, 200, { ok: true, data: inventoryService.summary(query) });
      }
      if (req.method === "GET" && await serveStatic(req, res)) return;
      sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
    } catch (error) {
      sendError(res, error);
    }
  };
}
