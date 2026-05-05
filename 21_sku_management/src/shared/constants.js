export const MAPPING_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  CONFLICT: "conflict"
});

export const OPTION_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive"
});

export const ERROR_CODES = Object.freeze({
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  SKU_NOT_FOUND: "SKU_NOT_FOUND",
  SKU_INACTIVE: "SKU_INACTIVE",
  DUPLICATE_ACTIVE_MAPPING: "DUPLICATE_ACTIVE_MAPPING",
  INVALID_BULK_REQUEST: "INVALID_BULK_REQUEST"
});

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
