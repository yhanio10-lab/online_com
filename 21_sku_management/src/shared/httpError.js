import { ERROR_CODES } from "./constants.js";

export class HttpError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message, details = {}) {
  return new HttpError(400, ERROR_CODES.BAD_REQUEST, message, details);
}

export function notFound(message, details = {}) {
  return new HttpError(404, ERROR_CODES.NOT_FOUND, message, details);
}

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

export function sendError(res, error) {
  const status = error.status || 500;
  const code = error.code || "INTERNAL_ERROR";
  const message = status === 500 ? "Internal server error" : error.message;
  sendJson(res, status, {
    ok: false,
    error: {
      code,
      message,
      details: error.details || {}
    }
  });
}
