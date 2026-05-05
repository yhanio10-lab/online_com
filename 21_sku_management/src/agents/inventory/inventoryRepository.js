export class InventoryRepository {
  constructor(db) {
    this.db = db;
  }

  latestSnapshots(skuCode = "") {
    const latest = new Map();
    for (const snapshot of this.db.data.inventory_snapshots) {
      if (skuCode && snapshot.sku_code !== skuCode) continue;
      const current = latest.get(snapshot.sku_code);
      if (!current || snapshot.snapshot_at > current.snapshot_at) latest.set(snapshot.sku_code, snapshot);
    }
    return Array.from(latest.values());
  }

  movementsSince(skuCode, since) {
    return this.db.data.inventory_movements.filter((movement) => {
      if (skuCode && movement.sku_code !== skuCode) return false;
      if (since && movement.moved_at <= since) return false;
      return true;
    });
  }
}
