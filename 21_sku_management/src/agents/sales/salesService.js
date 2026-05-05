export class SalesService {
  constructor(salesRepository, mappingRepository) {
    this.salesRepository = salesRepository;
    this.mappingRepository = mappingRepository;
  }

  normalizeOrderItems(order) {
    return (order.items || []).map((item) => {
      const option = this.mappingRepository.db.data.product_options.find(
        (candidate) => candidate.platform === order.platform && candidate.option_id === item.option_id
      );
      const mapping = option ? this.mappingRepository.findActiveMappingByOption(order.platform, option.id) : null;
      return {
        option_id: item.option_id,
        product_option_id: option?.id || null,
        sku_code: mapping?.sku_code || null,
        quantity: Number(item.quantity || 0),
        amount: Number(item.amount || 0),
        mapping_status: mapping ? "mapped" : "mapping_failed"
      };
    });
  }

  async ingest(order) {
    const normalizedItems = this.normalizeOrderItems(order);
    const saved = this.salesRepository.saveOrder(order, normalizedItems);
    await this.salesRepository.db.save();
    return {
      order: saved,
      mapped_items: normalizedItems.filter((item) => item.mapping_status === "mapped"),
      failed_items: normalizedItems.filter((item) => item.mapping_status === "mapping_failed")
    };
  }

  summary(query) {
    return this.salesRepository.summary({
      from: query.from || "",
      to: query.to || "",
      groupBy: query.groupBy || "sku"
    });
  }

  details(query) {
    const parsedLimit = Number(query.limit || 0);
    return this.salesRepository.details({
      from: query.from || "",
      to: query.to || "",
      groupBy: query.groupBy || "sku",
      key: query.key || "",
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 0
    });
  }

  platformFees() {
    return this.salesRepository.platformFees();
  }

  async savePlatformFees(body = {}) {
    return this.salesRepository.savePlatformFees(body.fees || []);
  }

  importBatches() {
    return this.salesRepository.importBatches();
  }

  failedItems(query = {}) {
    return this.salesRepository.failedItems(Number(query.limit || 100));
  }
}
