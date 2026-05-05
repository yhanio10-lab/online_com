import path from "node:path";
import { readFirstSheetRows } from "../../shared/xlsxReader.js";

const PLATFORM = "smartstore";
const HEADER_ROW_NUMBER = 2;
const DATA_START_ROW_NUMBER = 6;

const COLUMNS = Object.freeze({
  product_id: "상품번호",
  seller_product_code: "판매자 상품코드",
  category_code: "카테고리코드",
  product_name: "상품명",
  product_status: "상품상태",
  sale_price: "판매가",
  stock_quantity: "재고수량",
  option_type: "옵션형태",
  raw_option_name: "옵션명",
  option_id: "옵션번호",
  option_value: "옵션값",
  option_price: "옵션가",
  option_stock_quantity: "옵션 재고수량",
  option_enabled: "옵션 사용여부",
  tax_type: "부가세",
  brand: "브랜드",
  manufacturer: "제조사"
});

function toNumber(value) {
  const normalized = String(value || "").replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildHeaderMap(row) {
  const map = new Map();
  for (const [column, value] of Object.entries(row.cells)) {
    map.set(String(value || "").replace(/\s+/g, " ").trim(), column);
  }
  return map;
}

function getByHeader(row, headerMap, headerName) {
  const column = headerMap.get(headerName);
  return column ? String(row.cells[column] || "").trim() : "";
}

function normalizeStatus(productStatus, optionEnabled) {
  if (String(optionEnabled || "Y").trim().toUpperCase() === "N") return "inactive";
  if (String(productStatus || "").includes("판매중지")) return "inactive";
  return "active";
}

function buildOptionRows(row, headerMap, product) {
  const optionType = getByHeader(row, headerMap, COLUMNS.option_type);
  const optionIds = splitLines(getByHeader(row, headerMap, COLUMNS.option_id));
  const optionValues = splitLines(getByHeader(row, headerMap, COLUMNS.option_value));
  const optionPrices = splitLines(getByHeader(row, headerMap, COLUMNS.option_price));
  const optionStocks = splitLines(getByHeader(row, headerMap, COLUMNS.option_stock_quantity));
  const optionEnabled = splitLines(getByHeader(row, headerMap, COLUMNS.option_enabled));
  const rawOptionName = getByHeader(row, headerMap, COLUMNS.raw_option_name);

  if (optionType === "설정안함" || (!optionIds.length && !optionValues.length)) {
    return [{
      option_id: product.product_id,
      option_name: "기본옵션",
      status: normalizeStatus(product.status, "Y"),
      option_price: 0,
      stock_quantity: toNumber(getByHeader(row, headerMap, COLUMNS.stock_quantity)),
      raw_option_name: ""
    }];
  }

  const max = Math.max(optionIds.length, optionValues.length, optionStocks.length, optionPrices.length, optionEnabled.length);
  const rows = [];
  for (let index = 0; index < max; index += 1) {
    const optionId = optionIds[index] || `${product.product_id}-${index + 1}`;
    const optionValue = optionValues[index] || `옵션 ${index + 1}`;
    rows.push({
      option_id: optionId,
      option_name: optionValue.replace(/,/g, " / "),
      status: normalizeStatus(product.status, optionEnabled[index] || "Y"),
      option_price: toNumber(optionPrices[index]),
      stock_quantity: toNumber(optionStocks[index]),
      raw_option_name: rawOptionName
    });
  }
  return rows;
}

export class SmartstoreProductImportService {
  constructor(db) {
    this.db = db;
  }

  async importFile(filePath) {
    const resolvedPath = path.resolve(filePath);
    const rows = await readFirstSheetRows(resolvedPath);
    const headerRow = rows.find((row) => row.rowNumber === HEADER_ROW_NUMBER);
    if (!headerRow) throw new Error("Smartstore header row not found");

    const headerMap = buildHeaderMap(headerRow);
    const timestamp = new Date().toISOString();
    const summary = {
      platform: PLATFORM,
      file_path: resolvedPath,
      total_rows: rows.filter((row) => row.rowNumber >= DATA_START_ROW_NUMBER).length,
      products_created: 0,
      products_updated: 0,
      options_created: 0,
      options_updated: 0,
      skipped: 0,
      sample_errors: []
    };

    for (const row of rows.filter((item) => item.rowNumber >= DATA_START_ROW_NUMBER)) {
      const productId = getByHeader(row, headerMap, COLUMNS.product_id);
      const productName = getByHeader(row, headerMap, COLUMNS.product_name);
      if (!productId || !productName) {
        summary.skipped += 1;
        if (summary.sample_errors.length < 5) summary.sample_errors.push({ row: row.rowNumber, reason: "상품번호 또는 상품명 없음" });
        continue;
      }

      const productPayload = {
        platform: PLATFORM,
        product_id: productId,
        seller_product_code: getByHeader(row, headerMap, COLUMNS.seller_product_code),
        product_name: productName,
        status: "active",
        category_code: getByHeader(row, headerMap, COLUMNS.category_code),
        sale_price: toNumber(getByHeader(row, headerMap, COLUMNS.sale_price)),
        tax_type: getByHeader(row, headerMap, COLUMNS.tax_type),
        brand: getByHeader(row, headerMap, COLUMNS.brand),
        manufacturer: getByHeader(row, headerMap, COLUMNS.manufacturer),
        updated_at: timestamp
      };

      let product = this.db.data.products.find((item) => item.platform === PLATFORM && item.product_id === productId);
      if (!product) {
        product = { id: this.db.nextId("products"), ...productPayload, created_at: timestamp };
        this.db.data.products.push(product);
        summary.products_created += 1;
      } else {
        Object.assign(product, productPayload);
        summary.products_updated += 1;
      }

      const options = buildOptionRows(row, headerMap, productPayload);
      for (const optionPayload of options) {
        let option = this.db.data.product_options.find((item) => item.platform === PLATFORM && item.option_id === optionPayload.option_id);
        const nextOption = {
          platform: PLATFORM,
          product_id: product.id,
          option_id: optionPayload.option_id,
          option_name: optionPayload.option_name,
          status: optionPayload.status,
          option_price: optionPayload.option_price,
          stock_quantity: optionPayload.stock_quantity,
          raw_option_name: optionPayload.raw_option_name,
          updated_at: timestamp
        };

        if (!option) {
          option = { id: this.db.nextId("product_options"), ...nextOption, created_at: timestamp };
          this.db.data.product_options.push(option);
          summary.options_created += 1;
        } else {
          Object.assign(option, nextOption);
          summary.options_updated += 1;
        }
      }
    }

    await this.db.save();
    return summary;
  }
}
