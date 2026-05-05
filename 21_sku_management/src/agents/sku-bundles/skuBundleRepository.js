export class SkuBundleRepository {
  constructor(db) {
    this.db = db;
  }

  findSku(skuCode) {
    return this.db.data.sku_master.find((sku) => sku.sku_code === skuCode) || null;
  }

  listBundleParents({ q = "", page = 1, size = 50 }) {
    const term = String(q || "").trim().toLowerCase();
    const parentCodes = new Set(this.db.data.sku_bundle_components.map((item) => item.parent_sku_code));
    let rows = this.db.data.sku_master.filter((sku) => sku.is_set || parentCodes.has(sku.sku_code));
    if (term) {
      rows = rows.filter((sku) =>
        [sku.sku_code, sku.sku_name, sku.spec, sku.barcode].some((value) => String(value || "").toLowerCase().includes(term))
      );
    }
    const total = rows.length;
    const start = (page - 1) * size;
    return { total, rows: rows.slice(start, start + size).map((sku) => this.buildBundleSummary(sku)) };
  }

  buildBundleSummary(sku) {
    const components = this.listComponents(sku.sku_code);
    const componentCost = components.reduce((sum, item) => sum + Number(item.component?.purchase_price || 0) * item.component_quantity, 0);
    return {
      ...sku,
      component_count: components.filter((item) => item.is_active).length,
      component_cost: componentCost,
      margin_amount: Number(sku.sale_price || 0) - componentCost
    };
  }

  listComponents(parentSkuCode) {
    return this.db.data.sku_bundle_components
      .filter((item) => item.parent_sku_code === parentSkuCode)
      .map((item) => ({
        ...item,
        component: this.findSku(item.component_sku_code)
      }));
  }

  findComponent(id) {
    return this.db.data.sku_bundle_components.find((item) => item.id === Number(id)) || null;
  }

  findComponentBySku(parentSkuCode, componentSkuCode) {
    return this.db.data.sku_bundle_components.find(
      (item) => item.parent_sku_code === parentSkuCode && item.component_sku_code === componentSkuCode
    ) || null;
  }

  addComponent(parentSkuCode, componentSkuCode, quantity) {
    const timestamp = new Date().toISOString();
    const row = {
      id: this.db.nextId("sku_bundle_components"),
      parent_sku_code: parentSkuCode,
      component_sku_code: componentSkuCode,
      component_quantity: Number(quantity),
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp
    };
    this.db.data.sku_bundle_components.push(row);
    return row;
  }

  updateComponent(component, quantity, isActive = component.is_active) {
    component.component_quantity = Number(quantity);
    component.is_active = Boolean(isActive);
    component.updated_at = new Date().toISOString();
    return component;
  }

  deactivateComponent(component) {
    component.is_active = false;
    component.updated_at = new Date().toISOString();
    return component;
  }
}
