import { badRequest, notFound } from "../../shared/httpError.js";

export class SkuBundleService {
  constructor(repository, db) {
    this.repository = repository;
    this.db = db;
  }

  list(query) {
    const page = Math.max(1, Number(query.page || 1));
    const size = Math.min(100, Math.max(1, Number(query.size || 50)));
    const result = this.repository.listBundleParents({ q: query.q || "", page, size });
    return { page, size, total: result.total, items: result.rows, kpis: this.kpis() };
  }

  kpis() {
    const parentCodes = new Set(this.db.data.sku_bundle_components.map((item) => item.parent_sku_code));
    const bundles = this.db.data.sku_master.filter((sku) => sku.is_set || parentCodes.has(sku.sku_code));
    const configured = bundles.filter((sku) =>
      this.db.data.sku_bundle_components.some((item) => item.parent_sku_code === sku.sku_code && item.is_active)
    );
    return {
      bundle_count: bundles.length,
      configured: configured.length,
      incomplete: bundles.length - configured.length,
      inactive_components: this.db.data.sku_bundle_components.filter((item) => !item.is_active).length
    };
  }

  detail(skuCode) {
    const sku = this.repository.findSku(skuCode);
    if (!sku) throw notFound("Bundle SKU not found", { sku_code: skuCode });
    return {
      bundle: this.repository.buildBundleSummary(sku),
      components: this.repository.listComponents(skuCode)
    };
  }

  async addComponent(parentSkuCode, payload) {
    const parent = this.repository.findSku(parentSkuCode);
    if (!parent) throw notFound("Parent SKU not found", { sku_code: parentSkuCode });
    const componentSkuCode = payload.component_sku_code;
    const quantity = Number(payload.component_quantity || 1);
    if (!componentSkuCode) throw badRequest("component_sku_code is required");
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest("component_quantity must be greater than zero");
    if (parentSkuCode === componentSkuCode) throw badRequest("Bundle SKU cannot contain itself");
    const component = this.repository.findSku(componentSkuCode);
    if (!component) throw notFound("Component SKU not found", { sku_code: componentSkuCode });
    const existing = this.repository.findComponentBySku(parentSkuCode, componentSkuCode);
    if (existing) {
      this.repository.updateComponent(existing, quantity, true);
    } else {
      this.repository.addComponent(parentSkuCode, componentSkuCode, quantity);
    }
    parent.is_set = true;
    parent.updated_at = new Date().toISOString();
    await this.db.save();
    return this.detail(parentSkuCode);
  }

  async updateComponent(parentSkuCode, componentId, payload) {
    const component = this.repository.findComponent(componentId);
    if (!component || component.parent_sku_code !== parentSkuCode) throw notFound("Bundle component not found", { component_id: componentId });
    const quantity = Number(payload.component_quantity || component.component_quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest("component_quantity must be greater than zero");
    this.repository.updateComponent(component, quantity, payload.is_active ?? component.is_active);
    await this.db.save();
    return this.detail(parentSkuCode);
  }

  async deleteComponent(parentSkuCode, componentId) {
    const component = this.repository.findComponent(componentId);
    if (!component || component.parent_sku_code !== parentSkuCode) throw notFound("Bundle component not found", { component_id: componentId });
    this.repository.deactivateComponent(component);
    await this.db.save();
    return this.detail(parentSkuCode);
  }

  availability(parentSkuCode, inventoryService) {
    const detail = this.detail(parentSkuCode);
    const stockBySku = new Map(inventoryService.summary({}).map((row) => [row.sku_code, row.available_quantity]));
    const activeComponents = detail.components.filter((item) => item.is_active);
    const available = activeComponents.length
      ? Math.min(...activeComponents.map((item) => Math.floor(Number(stockBySku.get(item.component_sku_code) || 0) / item.component_quantity)))
      : 0;
    return { sku_code: parentSkuCode, available_quantity: available, components: activeComponents };
  }
}
