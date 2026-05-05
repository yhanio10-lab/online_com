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
      sales_orders: 1,
      sales_order_items: 1,
      inventory_snapshots: 3,
      inventory_movements: 1
    },
    products: [
      { id: 1, platform: "smartstore", product_id: "P-100", product_name: "데일리 텀블러", status: "active", created_at: createdAt, updated_at: createdAt },
      { id: 2, platform: "openmarket", product_id: "P-200", product_name: "코튼 파우치", status: "active", created_at: createdAt, updated_at: createdAt }
    ],
    product_options: [
      { id: 1, platform: "smartstore", product_id: 1, option_id: "OPT-RED-500", option_name: "레드 / 500ml", status: "active", created_at: createdAt, updated_at: createdAt },
      { id: 2, platform: "smartstore", product_id: 1, option_id: "OPT-BLK-500", option_name: "블랙 / 500ml", status: "active", created_at: createdAt, updated_at: createdAt },
      { id: 3, platform: "openmarket", product_id: 2, option_id: "POUCH-S", option_name: "소형", status: "active", created_at: createdAt, updated_at: createdAt },
      { id: 4, platform: "openmarket", product_id: 2, option_id: "POUCH-L", option_name: "대형", status: "active", created_at: createdAt, updated_at: createdAt }
    ],
    sku_master: [
      { sku_code: "EC-TUMBLER-RED-500", sku_name: "데일리 텀블러 레드 500ml", is_active: true, created_at: createdAt, updated_at: createdAt },
      { sku_code: "EC-TUMBLER-BLK-500", sku_name: "데일리 텀블러 블랙 500ml", is_active: true, created_at: createdAt, updated_at: createdAt },
      { sku_code: "EC-POUCH-S", sku_name: "코튼 파우치 소형", is_active: true, created_at: createdAt, updated_at: createdAt },
      { sku_code: "EC-POUCH-L-OLD", sku_name: "코튼 파우치 대형 구형", is_active: false, created_at: createdAt, updated_at: createdAt }
    ],
    sku_mappings: [
      { id: 1, platform: "smartstore", product_option_id: 1, sku_code: "EC-TUMBLER-RED-500", mapping_status: "active", created_by: "seed", created_at: createdAt, updated_at: createdAt }
    ],
    mapping_histories: [
      { id: 1, mapping_id: 1, old_sku_code: null, new_sku_code: "EC-TUMBLER-RED-500", changed_by: "seed", changed_at: createdAt, reason: "seed" }
    ],
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

export class JsonDatabase {
  constructor(filePath = DEFAULT_DB_PATH, initialData = null) {
    this.filePath = filePath;
    this.data = initialData;
  }

  async load() {
    if (this.data) return this;
    try {
      this.data = JSON.parse(await readFile(this.filePath, "utf8"));
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
}
