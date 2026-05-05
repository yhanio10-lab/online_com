import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PLAYAUTO_COLUMNS = Object.freeze({
  site: "판매사이트명",
  productName: "상품명",
  orderOption: "주문선택사항",
  addOption: "추가구매옵션",
  quantity: "주문수량",
  salesAmount: "판매가",
  orderId: "주문고유번호",
  platformProductId: "판매사이트 상품코드"
});

const PLATFORM_MAP = Object.freeze({
  "스마트스토어": "smartstore",
  "쿠팡(신)": "coupang",
  "카페24(신)": "cafe24",
  "11번가": "11st",
  "G마켓": "gmarket",
  "옥션": "auction",
  "올웨이즈": "allways"
});

function toNumber(value) {
  const normalized = String(value || "").replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0] || [];
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [String(header || "").trim(), row[index] || ""])));
}

function normalizeOptionText(value) {
  return String(value || "")
    .split("/")
    .map((part) => part.replace(/^[^:=]+[:=]\s*/, "").trim())
    .filter(Boolean)
    .join(" / ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeComparable(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[,:=]/g, "")
    .toLowerCase();
}

function convertXlsToCsv(filePath) {
  const tempDir = mkdtemp(path.join(os.tmpdir(), "playauto-"));
  return tempDir.then((dir) => {
    const csvPath = path.join(dir, "playauto.csv");
    const scriptPath = path.resolve("scripts", "convert-xls-to-csv.ps1");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-InputPath", filePath, "-OutputPath", csvPath],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      throw new Error(`Excel conversion failed: ${result.stderr || result.stdout}`);
    }
    return { csvPath, tempDir: dir };
  });
}

export class PlayautoSalesImportService {
  constructor(db, mappingRepository) {
    this.db = db;
    this.mappingRepository = mappingRepository;
  }

  async importFile(filePath) {
    const resolvedPath = path.resolve(filePath);
    let csvPath = resolvedPath;
    let tempDir = "";
    if (resolvedPath.toLowerCase().endsWith(".xls")) {
      const converted = await convertXlsToCsv(resolvedPath);
      csvPath = converted.csvPath;
      tempDir = converted.tempDir;
    }

    try {
      const text = await readFile(csvPath, "utf8");
      return await this.importCsvText(text, resolvedPath);
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
    }
  }

  async importCsvText(text, filePath = "inline") {
    const rows = rowsToObjects(parseCsv(text));
    const timestamp = new Date().toISOString();
    this.removeExistingImport(filePath);
    const batch = {
      id: this.db.nextId("sales_import_batches"),
      source: "playauto",
      file_path: filePath,
      imported_at: timestamp,
      total_rows: rows.length,
      imported_rows: 0,
      mapped_rows: 0,
      failed_rows: 0,
      gross_sales_amount: 0,
      cost_amount: 0,
      profit_amount: 0
    };
    this.db.data.sales_import_batches.push(batch);

    for (const row of rows) {
      const normalized = this.normalizeRow(row);
      if (!normalized.order_id || !normalized.platform_product_id) {
        batch.failed_rows += 1;
        continue;
      }
      const matched = this.matchOption(normalized);
      const sku = matched.mapping?.sku_code ? this.mappingRepository.findSku(matched.mapping.sku_code) : null;
      const costAmount = sku ? this.calculateCost(sku.sku_code, normalized.quantity) : 0;
      const profitAmount = matched.mapping ? normalized.gross_sales_amount - costAmount : 0;
      const profitRate = matched.mapping && normalized.gross_sales_amount ? profitAmount / normalized.gross_sales_amount : 0;
      const order = this.upsertOrder(normalized, timestamp);
      this.db.data.sales_order_items.push({
        id: this.db.nextId("sales_order_items"),
        sales_order_id: order.id,
        platform: normalized.platform,
        sales_import_batch_id: batch.id,
        order_id: normalized.order_id,
        product_name: normalized.product_name,
        option_name: normalized.option_name,
        platform_product_id: normalized.platform_product_id,
        option_id: matched.option?.option_id || normalized.option_name,
        product_option_id: matched.option?.id || null,
        sku_code: matched.mapping?.sku_code || null,
        quantity: normalized.quantity,
        amount: normalized.gross_sales_amount,
        gross_sales_amount: normalized.gross_sales_amount,
        cost_amount: costAmount,
        profit_amount: profitAmount,
        profit_rate: profitRate,
        mapping_status: matched.mapping ? "mapped" : "mapping_failed",
        mapping_reason: matched.reason,
        created_at: timestamp
      });
      batch.imported_rows += 1;
      if (matched.mapping) batch.mapped_rows += 1;
      else batch.failed_rows += 1;
      batch.gross_sales_amount += normalized.gross_sales_amount;
      batch.cost_amount += costAmount;
      batch.profit_amount += profitAmount;
    }
    await this.db.save();
    return {
      ...batch,
      profit_rate: batch.gross_sales_amount ? batch.profit_amount / batch.gross_sales_amount : 0
    };
  }

  removeExistingImport(filePath) {
    const existingBatchIds = new Set(
      (this.db.data.sales_import_batches || [])
        .filter((batch) => batch.source === "playauto" && batch.file_path === filePath)
        .map((batch) => batch.id)
    );
    if (!existingBatchIds.size) return;
    const removedOrderIds = new Set(
      this.db.data.sales_order_items
        .filter((item) => existingBatchIds.has(item.sales_import_batch_id))
        .map((item) => item.sales_order_id)
    );
    this.db.data.sales_order_items = this.db.data.sales_order_items.filter((item) => !existingBatchIds.has(item.sales_import_batch_id));
    this.db.data.sales_import_batches = this.db.data.sales_import_batches.filter((batch) => !existingBatchIds.has(batch.id));
    const remainingOrderIds = new Set(this.db.data.sales_order_items.map((item) => item.sales_order_id));
    this.db.data.sales_orders = this.db.data.sales_orders.filter((order) => !removedOrderIds.has(order.id) || remainingOrderIds.has(order.id));
  }

  normalizeRow(row) {
    const site = String(row[PLAYAUTO_COLUMNS.site] || "").trim();
    const platform = PLATFORM_MAP[site] || site;
    return {
      source_site: site,
      platform,
      product_name: String(row[PLAYAUTO_COLUMNS.productName] || "").trim(),
      option_name: normalizeOptionText(row[PLAYAUTO_COLUMNS.orderOption]),
      add_option_name: normalizeOptionText(row[PLAYAUTO_COLUMNS.addOption]),
      quantity: toNumber(row[PLAYAUTO_COLUMNS.quantity]),
      gross_sales_amount: toNumber(row[PLAYAUTO_COLUMNS.salesAmount]),
      order_id: String(row[PLAYAUTO_COLUMNS.orderId] || "").trim(),
      platform_product_id: String(row[PLAYAUTO_COLUMNS.platformProductId] || "").trim()
    };
  }

  matchOption(row) {
    const product = this.db.data.products.find((item) => item.platform === row.platform && item.product_id === row.platform_product_id);
    if (!product) return { option: null, mapping: null, reason: "product_not_found" };
    const options = this.db.data.product_options.filter((option) => option.product_id === product.id && option.platform === row.platform);
    const orderOption = normalizeComparable(row.option_name);
    const option =
      options.find((candidate) => normalizeComparable(candidate.option_name) === orderOption) ||
      options.find((candidate) => {
        const candidateText = normalizeComparable(candidate.option_name);
        return orderOption && (candidateText.includes(orderOption) || orderOption.includes(candidateText));
      });
    if (!option) return { option: null, mapping: null, reason: "option_not_found" };
    const mapping = this.mappingRepository.findActiveMappingByOption(row.platform, option.id);
    if (!mapping) return { option, mapping: null, reason: "mapping_not_found" };
    return { option, mapping, reason: "mapped" };
  }

  calculateCost(skuCode, quantity) {
    const components = (this.db.data.sku_bundle_components || []).filter((item) => item.parent_sku_code === skuCode && item.is_active);
    if (components.length) {
      return components.reduce((sum, item) => {
        const sku = this.mappingRepository.findSku(item.component_sku_code);
        return sum + Number(sku?.purchase_price || 0) * Number(item.component_quantity || 0) * quantity;
      }, 0);
    }
    const sku = this.mappingRepository.findSku(skuCode);
    return Number(sku?.purchase_price || 0) * quantity;
  }

  upsertOrder(row, timestamp) {
    let order = this.db.data.sales_orders.find((item) => item.platform === row.platform && item.order_id === row.order_id);
    if (!order) {
      order = {
        id: this.db.nextId("sales_orders"),
        platform: row.platform,
        order_id: row.order_id,
        ordered_at: timestamp.slice(0, 10),
        buyer_name: "",
        total_amount: 0,
        created_at: timestamp,
        updated_at: timestamp
      };
      this.db.data.sales_orders.push(order);
    }
    order.total_amount += row.gross_sales_amount;
    order.updated_at = timestamp;
    return order;
  }
}

export const playautoInternals = {
  parseCsv,
  normalizeOptionText,
  normalizeComparable,
  PLATFORM_MAP
};
