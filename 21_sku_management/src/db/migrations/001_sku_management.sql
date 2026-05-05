CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  product_id TEXT NOT NULL,
  seller_product_code TEXT,
  product_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  category_code TEXT,
  sale_price REAL NOT NULL DEFAULT 0,
  tax_type TEXT,
  brand TEXT,
  manufacturer TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, product_id)
);

CREATE TABLE IF NOT EXISTS product_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  option_id TEXT NOT NULL,
  option_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  option_price REAL NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  raw_option_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, option_id)
);

CREATE TABLE IF NOT EXISTS sku_master (
  sku_code TEXT PRIMARY KEY,
  sku_name TEXT NOT NULL,
  spec TEXT,
  unit TEXT,
  barcode TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  purchase_price_vat_included INTEGER NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  sale_price_vat_included INTEGER NOT NULL DEFAULT 0,
  item_type TEXT,
  is_set INTEGER NOT NULL DEFAULT 0,
  inventory_managed INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  price_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sku_price_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku_code TEXT NOT NULL REFERENCES sku_master(sku_code),
  old_purchase_price REAL,
  new_purchase_price REAL,
  old_sale_price REAL,
  new_sale_price REAL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS sku_bundle_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_sku_code TEXT NOT NULL REFERENCES sku_master(sku_code),
  component_sku_code TEXT NOT NULL REFERENCES sku_master(sku_code),
  component_quantity INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(parent_sku_code, component_sku_code)
);

CREATE TABLE IF NOT EXISTS sku_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  product_option_id INTEGER NOT NULL REFERENCES product_options(id),
  sku_code TEXT NOT NULL REFERENCES sku_master(sku_code),
  mapping_status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mapping_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mapping_id INTEGER NOT NULL REFERENCES sku_mappings(id),
  old_sku_code TEXT,
  new_sku_code TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  order_id TEXT NOT NULL,
  ordered_at TEXT NOT NULL,
  buyer_name TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, order_id)
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id),
  platform TEXT NOT NULL,
  option_id TEXT NOT NULL,
  product_option_id INTEGER REFERENCES product_options(id),
  sku_code TEXT REFERENCES sku_master(sku_code),
  quantity INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  mapping_status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku_code TEXT NOT NULL REFERENCES sku_master(sku_code),
  quantity_on_hand INTEGER NOT NULL,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  snapshot_at TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku_code TEXT NOT NULL REFERENCES sku_master(sku_code),
  movement_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reason TEXT,
  moved_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_options_platform_option
  ON product_options(platform, option_id);
CREATE INDEX IF NOT EXISTS idx_sku_mappings_platform_option
  ON sku_mappings(platform, product_option_id);
CREATE INDEX IF NOT EXISTS idx_sku_mappings_sku_code
  ON sku_mappings(sku_code);
CREATE INDEX IF NOT EXISTS idx_sku_price_histories_sku_code
  ON sku_price_histories(sku_code);
CREATE INDEX IF NOT EXISTS idx_sku_bundle_components_parent
  ON sku_bundle_components(parent_sku_code);
CREATE INDEX IF NOT EXISTS idx_sku_bundle_components_component
  ON sku_bundle_components(component_sku_code);
CREATE INDEX IF NOT EXISTS idx_sales_items_sku_code
  ON sales_order_items(sku_code);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_sku_at
  ON inventory_snapshots(sku_code, snapshot_at);
