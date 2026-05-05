import path from "node:path";
import { readFirstSheetRows } from "../../shared/xlsxReader.js";

const ECOUNT_COLUMNS = Object.freeze({
  sku_code: "품목코드",
  sku_name: "품목명",
  spec: "규격",
  unit: "단위",
  barcode: "바코드",
  item_type: "품목구분",
  inventory_managed: "재고수량관리",
  purchase_price: "입고단가",
  purchase_price_vat_included: "입고단가 VAT포함여부",
  sale_price: "출고단가",
  sale_price_vat_included: "출고단가 VAT포함여부",
  location: "상품위치"
});

function toNumber(value) {
  const normalized = String(value || "").replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBool(value) {
  return ["1", "true", "Y", "y", "예"].includes(String(value || "").trim());
}

function buildHeaderMap(headerRow) {
  const map = new Map();
  for (const [column, value] of Object.entries(headerRow.cells)) {
    map.set(String(value || "").trim(), column);
  }
  return map;
}

function getByHeader(row, headerMap, headerName) {
  const column = headerMap.get(headerName);
  return column ? String(row.cells[column] || "").trim() : "";
}

export class EcountSkuImportService {
  constructor(db) {
    this.db = db;
  }

  async importFile(filePath, { changedBy = "ecount-import" } = {}) {
    const resolvedPath = path.resolve(filePath);
    const rows = await readFirstSheetRows(resolvedPath);
    const headerRow = rows[0];
    if (!headerRow) throw new Error("Excel file has no header row");
    const headerMap = buildHeaderMap(headerRow);
    const timestamp = new Date().toISOString();
    const summary = {
      file_path: resolvedPath,
      total_rows: Math.max(0, rows.length - 1),
      created: 0,
      updated: 0,
      skipped: 0,
      price_changed: 0,
      sample_errors: []
    };

    for (const row of rows.slice(1)) {
      const skuCode = getByHeader(row, headerMap, ECOUNT_COLUMNS.sku_code);
      const skuName = getByHeader(row, headerMap, ECOUNT_COLUMNS.sku_name);
      if (!skuCode || !skuName) {
        summary.skipped += 1;
        if (summary.sample_errors.length < 5) summary.sample_errors.push({ row: row.rowNumber, reason: "품목코드 또는 품목명 없음" });
        continue;
      }

      const next = {
        sku_code: skuCode,
        sku_name: skuName,
        spec: getByHeader(row, headerMap, ECOUNT_COLUMNS.spec),
        unit: getByHeader(row, headerMap, ECOUNT_COLUMNS.unit),
        barcode: getByHeader(row, headerMap, ECOUNT_COLUMNS.barcode),
        purchase_price: toNumber(getByHeader(row, headerMap, ECOUNT_COLUMNS.purchase_price)),
        purchase_price_vat_included: toBool(getByHeader(row, headerMap, ECOUNT_COLUMNS.purchase_price_vat_included)),
        sale_price: toNumber(getByHeader(row, headerMap, ECOUNT_COLUMNS.sale_price)),
        sale_price_vat_included: toBool(getByHeader(row, headerMap, ECOUNT_COLUMNS.sale_price_vat_included)),
        item_type: getByHeader(row, headerMap, ECOUNT_COLUMNS.item_type),
        inventory_managed: toBool(getByHeader(row, headerMap, ECOUNT_COLUMNS.inventory_managed)),
        location: getByHeader(row, headerMap, ECOUNT_COLUMNS.location),
        is_active: true,
        price_updated_at: timestamp,
        updated_at: timestamp
      };

      const existing = this.db.data.sku_master.find((sku) => sku.sku_code === skuCode);
      if (!existing) {
        this.db.data.sku_master.push({ ...next, created_at: timestamp });
        summary.created += 1;
        if (next.purchase_price || next.sale_price) this.addPriceHistory(skuCode, null, next, changedBy, "ecount import");
        continue;
      }

      const priceChanged = Number(existing.purchase_price || 0) !== next.purchase_price || Number(existing.sale_price || 0) !== next.sale_price;
      if (priceChanged) {
        summary.price_changed += 1;
        this.addPriceHistory(skuCode, existing, next, changedBy, "ecount import");
      }
      Object.assign(existing, next);
      summary.updated += 1;
    }

    await this.db.save();
    return summary;
  }

  addPriceHistory(skuCode, oldSku, nextSku, changedBy, reason) {
    if (!Array.isArray(this.db.data.sku_price_histories)) this.db.data.sku_price_histories = [];
    this.db.data.sku_price_histories.push({
      id: this.db.nextId("sku_price_histories"),
      sku_code: skuCode,
      old_purchase_price: oldSku ? Number(oldSku.purchase_price || 0) : null,
      new_purchase_price: Number(nextSku.purchase_price || 0),
      old_sale_price: oldSku ? Number(oldSku.sale_price || 0) : null,
      new_sale_price: Number(nextSku.sale_price || 0),
      changed_by: changedBy,
      changed_at: new Date().toISOString(),
      reason
    });
  }
}
