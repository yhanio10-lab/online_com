export class SalesRepository {
  constructor(db) {
    this.db = db;
  }

  platformFeeRate(platform) {
    const rule = (this.db.data.platform_fee_rules || []).find((item) => item.platform === platform && item.is_active !== false);
    return Number(rule?.fee_rate || 0);
  }

  calculateFinancials(item) {
    const amount = Number(item.gross_sales_amount ?? item.amount ?? 0);
    const costAmount = Number(item.cost_amount || 0);
    const feeRate = this.platformFeeRate(item.platform);
    const platformFeeAmount = Math.round(amount * feeRate * 100) / 100;
    const isMapped = item.mapping_status === "mapped" || Boolean(item.sku_code);
    const profitAmount = isMapped ? amount - costAmount - platformFeeAmount : 0;
    return {
      is_mapped: isMapped,
      amount,
      mapped_amount: isMapped ? amount : 0,
      unmapped_amount: isMapped ? 0 : amount,
      cost_amount: costAmount,
      platform_fee_rate: feeRate,
      platform_fee_amount: platformFeeAmount,
      mapped_platform_fee_amount: isMapped ? platformFeeAmount : 0,
      profit_amount: profitAmount,
      profit_rate: amount ? profitAmount / amount : 0
    };
  }

  saveOrder(order, items) {
    const timestamp = new Date().toISOString();
    const savedOrder = {
      id: this.db.nextId("sales_orders"),
      platform: order.platform,
      order_id: order.order_id,
      ordered_at: order.ordered_at,
      buyer_name: order.buyer_name || "",
      total_amount: Number(order.total_amount || 0),
      created_at: timestamp,
      updated_at: timestamp
    };
    this.db.data.sales_orders.push(savedOrder);
    for (const item of items) {
      this.db.data.sales_order_items.push({
        id: this.db.nextId("sales_order_items"),
        sales_order_id: savedOrder.id,
        platform: order.platform,
        option_id: item.option_id,
        product_option_id: item.product_option_id || null,
        sku_code: item.sku_code || null,
        quantity: Number(item.quantity || 0),
        amount: Number(item.amount || 0),
        mapping_status: item.mapping_status,
        created_at: timestamp
      });
    }
    return savedOrder;
  }

  summary({ from, to, groupBy }) {
    const ordersById = new Map(this.db.data.sales_orders.map((order) => [order.id, order]));
    const rows = this.db.data.sales_order_items.filter((item) => {
      const order = ordersById.get(item.sales_order_id);
      if (!order) return false;
      if (from && order.ordered_at < from) return false;
      if (to && order.ordered_at > to) return false;
      if (groupBy === "platform") return true;
      return item.sku_code;
    });
    const keyName = groupBy === "platform" ? "platform" : "sku_code";
    const grouped = new Map();
    for (const row of rows) {
      const key = row[keyName] || "unmapped";
      const current =
        grouped.get(key) || {
          key,
          quantity: 0,
          amount: 0,
          mapped_amount: 0,
          unmapped_amount: 0,
          cost_amount: 0,
          platform_fee_amount: 0,
          total_platform_fee_amount: 0,
          profit_amount: 0,
          profit_rate: 0,
          mapped_profit_rate: 0,
          item_count: 0,
          mapped_item_count: 0,
          unmapped_item_count: 0
        };
      const financials = this.calculateFinancials(row);
      current.quantity += row.quantity;
      current.amount += financials.amount;
      current.mapped_amount += financials.mapped_amount;
      current.unmapped_amount += financials.unmapped_amount;
      current.cost_amount += financials.cost_amount;
      current.platform_fee_amount += financials.mapped_platform_fee_amount;
      current.total_platform_fee_amount += financials.platform_fee_amount;
      current.profit_amount += financials.profit_amount;
      current.item_count += 1;
      if (financials.is_mapped) current.mapped_item_count += 1;
      else current.unmapped_item_count += 1;
      current.profit_rate = current.amount ? current.profit_amount / current.amount : 0;
      current.mapped_profit_rate = current.mapped_amount ? current.profit_amount / current.mapped_amount : 0;
      grouped.set(key, current);
    }
    return Array.from(grouped.values());
  }

  details({ from, to, groupBy, key, limit = 0 }) {
    const ordersById = new Map(this.db.data.sales_orders.map((order) => [order.id, order]));
    const keyName = groupBy === "platform" ? "platform" : "sku_code";
    const rows = this.db.data.sales_order_items
      .filter((item) => {
        const order = ordersById.get(item.sales_order_id);
        if (!order) return false;
        if (from && order.ordered_at < from) return false;
        if (to && order.ordered_at > to) return false;
        if (groupBy === "sku" && !item.sku_code) return false;
        return String(item[keyName] || "unmapped") === String(key || "");
      })
      .map((item) => {
        const order = ordersById.get(item.sales_order_id);
        const financials = this.calculateFinancials(item);
        return {
          id: item.id,
          ordered_at: order?.ordered_at || "",
          order_id: item.order_id || order?.order_id || "",
          platform: item.platform || order?.platform || "",
          platform_product_id: item.platform_product_id || "",
          product_name: item.product_name || "",
          option_name: item.option_name || "",
          sku_code: item.sku_code || "",
          quantity: Number(item.quantity || 0),
          amount: financials.amount,
          cost_amount: financials.cost_amount,
          platform_fee_rate: financials.platform_fee_rate,
          platform_fee_amount: financials.platform_fee_amount,
          profit_amount: financials.profit_amount,
          profit_rate: financials.profit_rate,
          mapping_status: item.mapping_status || "",
          mapping_reason: item.mapping_reason || ""
        };
      });
    const sortedRows = rows.reverse();
    return limit > 0 ? sortedRows.slice(0, limit) : sortedRows;
  }

  platformFees() {
    const platforms = new Set([
      ...(this.db.data.products || []).map((item) => item.platform),
      ...(this.db.data.sales_order_items || []).map((item) => item.platform),
      ...(this.db.data.platform_fee_rules || []).map((item) => item.platform)
    ]);
    return [...platforms]
      .filter(Boolean)
      .sort()
      .map((platform) => {
        const rule = (this.db.data.platform_fee_rules || []).find((item) => item.platform === platform);
        return {
          id: rule?.id || null,
          platform,
          fee_rate: Number(rule?.fee_rate || 0),
          is_active: rule?.is_active !== false
        };
      });
  }

  async savePlatformFees(rows) {
    const timestamp = new Date().toISOString();
    for (const row of rows || []) {
      const platform = String(row.platform || "").trim();
      if (!platform) continue;
      const feeRate = Number(row.fee_rate || 0);
      if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 1) {
        const error = new Error("수수료율은 0% 이상 100% 이하로 입력해야 합니다.");
        error.status = 400;
        error.code = "INVALID_PLATFORM_FEE_RATE";
        throw error;
      }
      let rule = (this.db.data.platform_fee_rules || []).find((item) => item.platform === platform);
      if (!rule) {
        rule = {
          id: this.db.nextId("platform_fee_rules"),
          platform,
          fee_rate: feeRate,
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp
        };
        this.db.data.platform_fee_rules.push(rule);
      } else {
        rule.fee_rate = feeRate;
        rule.is_active = row.is_active !== false;
        rule.updated_at = timestamp;
      }
    }
    await this.db.save();
    return this.platformFees();
  }

  importBatches() {
    return [...(this.db.data.sales_import_batches || [])].sort((a, b) => String(b.imported_at).localeCompare(String(a.imported_at)));
  }

  failedItems(limit = 100) {
    return this.db.data.sales_order_items
      .filter((item) => item.mapping_status === "mapping_failed")
      .slice(-limit)
      .reverse();
  }
}
