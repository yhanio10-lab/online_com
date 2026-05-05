import { ERROR_CODES, MAPPING_STATUS } from "../../shared/constants.js";
import { HttpError, badRequest, notFound } from "../../shared/httpError.js";

export class SkuMappingService {
  constructor(repository, db) {
    this.repository = repository;
    this.db = db;
  }

  listOptions(query) {
    const page = Math.max(1, Number(query.page || 1));
    const requestedSize = Number(query.size || 20);
    const size = Math.min(100, Math.max(1, requestedSize));
    const result = this.repository.listOptions({
      platform: query.platform || "",
      status: query.status || "",
      q: query.q || "",
      page,
      size
    });
    return {
      kpis: this.repository.getKpis(),
      page,
      size,
      total: result.total,
      items: result.rows
    };
  }

  searchSku(q, size = 200) {
    return this.repository.searchSku(q, size);
  }

  async createMapping(payload) {
    this.validateRequired(payload, ["platform", "product_option_id", "sku_code"]);
    const option = this.assertOption(payload.product_option_id, payload.platform);
    this.assertSkuCanMap(payload.sku_code);
    this.assertNoActiveMapping(option.platform, option.id);
    const mapping = this.repository.createMapping({
      platform: option.platform,
      product_option_id: option.id,
      sku_code: payload.sku_code,
      created_by: payload.created_by || "admin",
      reason: payload.reason || "create"
    });
    await this.db.save();
    return mapping;
  }

  async bulkCreate(payload) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) {
      throw new HttpError(400, ERROR_CODES.INVALID_BULK_REQUEST, "items must contain at least one mapping request");
    }
    const results = [];
    for (const item of items) {
      try {
        const mapping = await this.createMapping({ ...item, created_by: payload.created_by || item.created_by || "admin" });
        results.push({ ok: true, mapping });
      } catch (error) {
        results.push({
          ok: false,
          request: item,
          error: { code: error.code || "INTERNAL_ERROR", message: error.message, details: error.details || {} }
        });
      }
    }
    return { total: items.length, success: results.filter((item) => item.ok).length, results };
  }

  async updateMapping(id, payload) {
    this.validateRequired(payload, ["sku_code"]);
    const mapping = this.repository.findMapping(id);
    if (!mapping || mapping.mapping_status !== MAPPING_STATUS.ACTIVE) {
      throw notFound("Active mapping not found", { mapping_id: id });
    }
    this.assertSkuCanMap(payload.sku_code);
    const duplicate = this.repository.findActiveMappingByOption(mapping.platform, mapping.product_option_id);
    if (duplicate && duplicate.id !== mapping.id) {
      throw new HttpError(409, ERROR_CODES.DUPLICATE_ACTIVE_MAPPING, "Option already has another active mapping", {
        platform: mapping.platform,
        product_option_id: mapping.product_option_id,
        mapping_id: duplicate.id
      });
    }
    const updated = this.repository.updateMapping(mapping, {
      sku_code: payload.sku_code,
      changed_by: payload.changed_by || payload.created_by || "admin",
      reason: payload.reason || "update"
    });
    await this.db.save();
    return updated;
  }

  async deleteMapping(id, payload = {}) {
    const mapping = this.repository.findMapping(id);
    if (!mapping || mapping.mapping_status !== MAPPING_STATUS.ACTIVE) {
      throw notFound("Active mapping not found", { mapping_id: id });
    }
    const deleted = this.repository.deleteMapping(mapping, payload.changed_by || "admin", payload.reason || "delete");
    await this.db.save();
    return deleted;
  }

  conflicts() {
    return this.repository.listConflicts();
  }

  validateRequired(payload, fields) {
    const missing = fields.filter((field) => !payload[field]);
    if (missing.length) throw badRequest("Required field is missing", { missing });
  }

  assertOption(productOptionId, platform) {
    const option = this.repository.findOption(productOptionId);
    if (!option) throw notFound("Product option not found", { product_option_id: productOptionId });
    if (platform && option.platform !== platform) {
      throw badRequest("Platform does not match product option", { platform, option_platform: option.platform });
    }
    return option;
  }

  assertSkuCanMap(skuCode) {
    const sku = this.repository.findSku(skuCode);
    if (!sku) throw new HttpError(404, ERROR_CODES.SKU_NOT_FOUND, "SKU code does not exist", { sku_code: skuCode });
    if (!sku.is_active) throw new HttpError(409, ERROR_CODES.SKU_INACTIVE, "Inactive SKU cannot be mapped", { sku_code: skuCode });
    return sku;
  }

  assertNoActiveMapping(platform, productOptionId) {
    const existing = this.repository.findActiveMappingByOption(platform, productOptionId);
    if (existing) {
      throw new HttpError(409, ERROR_CODES.DUPLICATE_ACTIVE_MAPPING, "Option already has an active mapping", {
        platform,
        product_option_id: productOptionId,
        mapping_id: existing.id
      });
    }
  }
}
