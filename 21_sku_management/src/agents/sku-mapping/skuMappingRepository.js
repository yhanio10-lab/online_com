import { MAPPING_STATUS } from "../../shared/constants.js";

function textIncludes(value, q) {
  return String(value || "").toLowerCase().includes(String(q || "").toLowerCase());
}

function tokenizeSearch(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function fieldsMatchAllTokens(fields, tokens) {
  if (!tokens.length) return true;
  return tokens.every((token) => fields.some((value) => textIncludes(value, token)));
}

export class SkuMappingRepository {
  constructor(db) {
    this.db = db;
  }

  listOptions({ platform, status, q, page, size }) {
    let rows = this.db.data.product_options.map((option) => {
      const product = this.db.data.products.find((item) => item.id === option.product_id);
      const activeMappings = this.db.data.sku_mappings.filter(
        (mapping) => mapping.product_option_id === option.id && mapping.mapping_status === MAPPING_STATUS.ACTIVE
      );
      const currentMapping = activeMappings[0] || null;
      const sku = currentMapping ? this.findSku(currentMapping.sku_code) : null;
      const conflictReasons = this.getConflictReasons(option, activeMappings);
      const mappingStatus = conflictReasons.length ? "conflict" : currentMapping ? "mapped" : "unmapped";
      return {
        ...option,
        platform_product_id: product?.product_id || "",
        product_name: product?.product_name || "",
        current_mapping_id: currentMapping?.id || null,
        current_sku_code: currentMapping?.sku_code || null,
        current_sku_name: sku?.sku_name || null,
        recommended_sku_code: this.recommendSku(option)?.sku_code || null,
        mapping_status: mappingStatus,
        conflict_reasons: conflictReasons
      };
    });

    if (platform) rows = rows.filter((row) => row.platform === platform);
    if (status) rows = rows.filter((row) => row.mapping_status === status || row.status === status);
    if (q) {
      rows = rows.filter((row) =>
        [row.platform_product_id, row.product_name, row.option_name, row.option_id, row.current_sku_code].some((value) => textIncludes(value, q))
      );
    }

    const total = rows.length;
    const start = (page - 1) * size;
    return { rows: rows.slice(start, start + size), total };
  }

  getKpis() {
    const all = this.listOptions({ page: 1, size: Number.MAX_SAFE_INTEGER }).rows;
    return {
      total_options: all.length,
      mapped: all.filter((row) => row.mapping_status === "mapped").length,
      unmapped: all.filter((row) => row.mapping_status === "unmapped").length,
      conflicts: all.filter((row) => row.mapping_status === "conflict").length
    };
  }

  searchSku(q, size = 200) {
    const tokens = tokenizeSearch(q);
    const limit = Math.min(500, Math.max(1, Number(size || 200)));
    return this.db.data.sku_master
      .filter((sku) => {
        return fieldsMatchAllTokens([sku.sku_code, sku.sku_name, sku.spec, sku.barcode], tokens);
      })
      .slice(0, limit);
  }

  findSku(skuCode) {
    return this.db.data.sku_master.find((sku) => sku.sku_code === skuCode) || null;
  }

  findOption(id) {
    return this.db.data.product_options.find((option) => option.id === Number(id)) || null;
  }

  findActiveMappingByOption(platform, productOptionId) {
    return this.db.data.sku_mappings.find(
      (mapping) =>
        mapping.platform === platform &&
        mapping.product_option_id === Number(productOptionId) &&
        mapping.mapping_status === MAPPING_STATUS.ACTIVE
    ) || null;
  }

  findMapping(id) {
    return this.db.data.sku_mappings.find((mapping) => mapping.id === Number(id)) || null;
  }

  createMapping(payload) {
    const timestamp = new Date().toISOString();
    const mapping = {
      id: this.db.nextId("sku_mappings"),
      platform: payload.platform,
      product_option_id: Number(payload.product_option_id),
      sku_code: payload.sku_code,
      mapping_status: MAPPING_STATUS.ACTIVE,
      created_by: payload.created_by,
      created_at: timestamp,
      updated_at: timestamp
    };
    this.db.data.sku_mappings.push(mapping);
    this.addHistory(mapping.id, null, mapping.sku_code, payload.created_by, payload.reason);
    return mapping;
  }

  updateMapping(mapping, payload) {
    const oldSku = mapping.sku_code;
    mapping.sku_code = payload.sku_code;
    mapping.mapping_status = payload.mapping_status || mapping.mapping_status;
    mapping.updated_at = new Date().toISOString();
    this.addHistory(mapping.id, oldSku, mapping.sku_code, payload.changed_by, payload.reason);
    return mapping;
  }

  deleteMapping(mapping, changedBy, reason) {
    const oldSku = mapping.sku_code;
    mapping.mapping_status = MAPPING_STATUS.INACTIVE;
    mapping.updated_at = new Date().toISOString();
    this.addHistory(mapping.id, oldSku, null, changedBy, reason);
    return mapping;
  }

  addHistory(mappingId, oldSkuCode, newSkuCode, changedBy, reason = "") {
    this.db.data.mapping_histories.push({
      id: this.db.nextId("mapping_histories"),
      mapping_id: Number(mappingId),
      old_sku_code: oldSkuCode,
      new_sku_code: newSkuCode,
      changed_by: changedBy || "system",
      changed_at: new Date().toISOString(),
      reason: reason || ""
    });
  }

  listConflicts() {
    return this.listOptions({ page: 1, size: Number.MAX_SAFE_INTEGER }).rows.filter((row) => row.conflict_reasons.length);
  }

  getConflictReasons(option, activeMappings) {
    const reasons = [];
    if (activeMappings.length > 1) reasons.push("동일 옵션에 활성 매핑이 여러 개 있습니다.");
    for (const mapping of activeMappings) {
      const sku = this.findSku(mapping.sku_code);
      if (!sku) reasons.push(`존재하지 않는 SKU입니다: ${mapping.sku_code}`);
      if (sku && !sku.is_active) reasons.push(`비활성 SKU입니다: ${mapping.sku_code}`);
      if (mapping.platform !== option.platform) reasons.push("옵션 플랫폼과 매핑 플랫폼이 다릅니다.");
    }
    return reasons;
  }

  recommendSku(option) {
    const normalized = `${option.option_name} ${option.option_id}`.toLowerCase();
    return this.db.data.sku_master.find((sku) => {
      if (!sku.is_active) return false;
      return sku.sku_code.toLowerCase().split("-").some((part) => part && normalized.includes(part.toLowerCase()));
    }) || null;
  }
}
