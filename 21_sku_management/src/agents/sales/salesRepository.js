export class SalesRepository {
  constructor(db) {
    this.db = db;
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
      const current = grouped.get(key) || { key, quantity: 0, amount: 0, cost_amount: 0, profit_amount: 0, profit_rate: 0, item_count: 0 };
      current.quantity += row.quantity;
      current.amount += Number(row.gross_sales_amount ?? row.amount ?? 0);
      current.cost_amount += Number(row.cost_amount || 0);
      current.profit_amount += Number(row.profit_amount || 0);
      current.item_count += 1;
      current.profit_rate = current.amount ? current.profit_amount / current.amount : 0;
      grouped.set(key, current);
    }
    return Array.from(grouped.values());
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
