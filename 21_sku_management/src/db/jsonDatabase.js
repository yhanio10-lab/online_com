import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const DEFAULT_DB_PATH = path.join(DATA_DIR, "dev.json");

function now() {
  return new Date().toISOString();
}

export function createSeedData() {
  const createdAt = now();
  return {
    sequences: {
      products: 2,
      product_options: 4,
      sku_mappings: 1,
      mapping_histories: 1,
      sku_price_histories: 0,
      sku_bundle_components: 0,
      sales_import_batches: 0,
      sales_orders: 1,
      sales_order_items: 1,
      inventory_snapshots: 3,
      inventory_movements: 1
    },
    products: [
      createSeedProduct(1, "smartstore", "P-100", "데일리 텀블러", createdAt),
      createSeedProduct(2, "openmarket", "P-200", "코튼 파우치", createdAt)
    ],
    product_options: [
      createSeedOption(1, "smartstore", 1, "OPT-RED-500", "레드 / 500ml", createdAt),
      createSeedOption(2, "smartstore", 1, "OPT-BLK-500", "블랙 / 500ml", createdAt),
      createSeedOption(3, "openmarket", 2, "POUCH-S", "소형", createdAt),
      createSeedOption(4, "openmarket", 2, "POUCH-L", "대형", createdAt)
    ],
    sku_master: [
      createSeedSku("EC-TUMBLER-RED-500", "데일리 텀블러 레드 500ml", true, createdAt),
      createSeedSku("EC-TUMBLER-BLK-500", "데일리 텀블러 블랙 500ml", true, createdAt),
      createSeedSku("EC-POUCH-S", "코튼 파우치 소형", true, createdAt),
      createSeedSku("EC-POUCH-L-OLD", "코튼 파우치 대형 구형", false, createdAt)
    ],
    sku_price_histories: [],
    sku_bundle_components: [],
    sku_mappings: [
      { id: 1, platform: "smartstore", product_option_id: 1, sku_code: "EC-TUMBLER-RED-500", mapping_status: "active", created_by: "seed", created_at: createdAt, updated_at: createdAt }
    ],
    mapping_histories: [
      { id: 1, mapping_id: 1, old_sku_code: null, new_sku_code: "EC-TUMBLER-RED-500", changed_by: "seed", changed_at: createdAt, reason: "seed" }
    ],
    sales_import_batches: [],
    sales_orders: [],
    sales_order_items: [],
    inventory_snapshots: [
      { id: 1, sku_code: "EC-TUMBLER-RED-500", quantity_on_hand: 20, reserved_quantity: 2, snapshot_at: createdAt, source: "seed", created_at: createdAt },
      { id: 2, sku_code: "EC-TUMBLER-BLK-500", quantity_on_hand: 12, reserved_quantity: 1, snapshot_at: createdAt, source: "seed", created_at: createdAt },
      { id: 3, sku_code: "EC-POUCH-S", quantity_on_hand: 40, reserved_quantity: 0, snapshot_at: createdAt, source: "seed", created_at: createdAt }
    ],
    inventory_movements: []
  };
}

function createSeedSku(skuCode, skuName, isActive, createdAt) {
  return {
    sku_code: skuCode,
    sku_name: skuName,
    spec: "",
    unit: "",
    barcode: "",
    purchase_price: 0,
    purchase_price_vat_included: false,
    sale_price: 0,
    sale_price_vat_included: false,
    item_type: "",
    is_set: false,
    inventory_managed: false,
    location: "",
    is_active: isActive,
    price_updated_at: createdAt,
    created_at: createdAt,
    updated_at: createdAt
  };
}

function createSeedProduct(id, platform, productId, productName, createdAt) {
  return {
    id,
    platform,
    product_id: productId,
    seller_product_code: "",
    product_name: productName,
    status: "active",
    category_code: "",
    sale_price: 0,
    tax_type: "",
    brand: "",
    manufacturer: "",
    created_at: createdAt,
    updated_at: createdAt
  };
}

function createSeedOption(id, platform, productId, optionId, optionName, createdAt) {
  return {
    id,
    platform,
    product_id: productId,
    option_id: optionId,
    option_name: optionName,
    status: "active",
    option_price: 0,
    stock_quantity: 0,
    raw_option_name: "",
    created_at: createdAt,
    updated_at: createdAt
  };
}

export class JsonDatabase {
  constructor(filePath = DEFAULT_DB_PATH, initialData = null) {
    this.filePath = filePath;
    this.data = initialData;
  }

  async load() {
    if (this.data) return this;
    try {
      this.data = JSON.parse(await readFile(this.filePath, "utf8"));
      this.normalize();
    } catch {
      this.data = createSeedData();
      await this.save();
    }
    return this;
  }

  async save() {
    if (this.filePath === ":memory:") return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
  }

  nextId(table) {
    this.data.sequences[table] = (this.data.sequences[table] || 0) + 1;
    return this.data.sequences[table];
  }

  normalize() {
    if (!this.data.sequences) this.data.sequences = {};
    if (!Array.isArray(this.data.sku_price_histories)) this.data.sku_price_histories = [];
    if (!Array.isArray(this.data.sku_bundle_components)) this.data.sku_bundle_components = [];
    if (!Array.isArray(this.data.sales_import_batches)) this.data.sales_import_batches = [];
    if (!this.data.sequences.sku_price_histories) {
      this.data.sequences.sku_price_histories = this.data.sku_price_histories.reduce((max, item) => Math.max(max, item.id || 0), 0);
    }
    if (!this.data.sequences.sku_bundle_components) {
      this.data.sequences.sku_bundle_components = this.data.sku_bundle_components.reduce((max, item) => Math.max(max, item.id || 0), 0);
    }
    if (!this.data.sequences.sales_import_batches) {
      this.data.sequences.sales_import_batches = this.data.sales_import_batches.reduce((max, item) => Math.max(max, item.id || 0), 0);
    }
    const timestamp = new Date().toISOString();
    for (const product of this.data.products || []) {
      product.seller_product_code ??= "";
      product.category_code ??= "";
      product.sale_price ??= 0;
      product.tax_type ??= "";
      product.brand ??= "";
      product.manufacturer ??= "";
    }
    for (const option of this.data.product_options || []) {
      option.option_price ??= 0;
      option.stock_quantity ??= 0;
      option.raw_option_name ??= "";
    }
    for (const sku of this.data.sku_master || []) {
      sku.spec ??= "";
      sku.unit ??= "";
      sku.barcode ??= "";
      sku.purchase_price ??= 0;
      sku.purchase_price_vat_included ??= false;
      sku.sale_price ??= 0;
      sku.sale_price_vat_included ??= false;
      sku.item_type ??= "";
      sku.is_set ??= false;
      sku.inventory_managed ??= false;
      sku.location ??= "";
      sku.price_updated_at ??= timestamp;
    }
  }
}
