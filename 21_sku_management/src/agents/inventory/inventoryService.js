export class InventoryService {
  constructor(repository) {
    this.repository = repository;
  }

  summary(query) {
    return this.repository.latestSnapshots(query.sku || "").map((snapshot) => {
      const movements = this.repository.movementsSince(snapshot.sku_code, snapshot.snapshot_at);
      const movementDelta = movements.reduce((sum, movement) => sum + Number(movement.quantity_delta || 0), 0);
      const quantityOnHand = Number(snapshot.quantity_on_hand || 0) + movementDelta;
      const reservedQuantity = Number(snapshot.reserved_quantity || 0);
      return {
        sku_code: snapshot.sku_code,
        quantity_on_hand: quantityOnHand,
        reserved_quantity: reservedQuantity,
        available_quantity: quantityOnHand - reservedQuantity,
        snapshot_at: snapshot.snapshot_at,
        movement_delta: movementDelta
      };
    });
  }
}
