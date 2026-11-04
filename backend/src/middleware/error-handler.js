function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }
  if (error instanceof require('../lib/http-error').HttpError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE_VALUE', message: 'Email, số điện thoại hoặc slug đã được sử dụng.' } });
  }
  if (error.code === 'DATABASE_UNAVAILABLE' && error.status === 503) {
    return res.status(503).json({ error: { code: error.code, message: error.message } });
  }
  console.error('Unhandled API error:', error.name);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
}

module.exports = { notFound, errorHandler };
