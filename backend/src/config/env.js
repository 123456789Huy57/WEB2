const dotenv = require('dotenv');
const { randomBytes } = require('node:crypto');
dotenv.config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
const mongodbUri = process.env.MONGODB_URI?.trim() || '';
const configuredSecret = process.env.SESSION_SECRET?.trim() || '';
if (configuredSecret && configuredSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters.');
}
if (nodeEnv === 'production' && (!mongodbUri || !configuredSecret)) {
  throw new Error('Production requires MONGODB_URI and SESSION_SECRET.');
}

// Số proxy đứng trước backend khi deploy: Vercel (chuyển tiếp /api) -> bộ cân bằng tải của Render -> Express.
// Express cần biết để nhận đúng HTTPS (cookie Secure) và IP thật của khách (giới hạn số lần đăng nhập).
const trustProxy = Number(process.env.TRUST_PROXY || 0);
if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) throw new Error('TRUST_PROXY must be an integer between 0 and 5.');

module.exports = {
  port,
  trustProxy,
  nodeEnv,
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200',
  mongodbUri,
  mongodbDb: process.env.MONGODB_DB?.trim() || 'freshmart',
  sessionSecret: configuredSecret || randomBytes(32).toString('hex'),
  temporarySessionSecret: !configuredSecret,
  sessionCookieName: 'freshmart.sid',
  sessionMaxAge: 60 * 60 * 1000,
  // Địa chỉ backend mà trình duyệt/cổng thanh toán gọi tới (để tạo return URL)
  backendUrl: (process.env.BACKEND_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  payment: {
    provider: process.env.PAYMENT_PROVIDER || (process.env.VNPAY_TMN_CODE ? 'vnpay' : 'mock'),
    vnpTmnCode: process.env.VNPAY_TMN_CODE?.trim() || '',
    vnpHashSecret: process.env.VNPAY_HASH_SECRET?.trim() || '',
    vnpUrl: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  },
  // Chuyển khoản QR, tự xác nhận qua webhook SePay. Thiếu một trong bốn biến thì ẩn lựa chọn này.
  bank: {
    code: process.env.BANK_CODE?.trim() || '',
    account: process.env.BANK_ACCOUNT?.trim() || '',
    holder: process.env.BANK_HOLDER?.trim() || '',
    sepayApiKey: process.env.SEPAY_API_KEY?.trim() || '',
    get enabled() { return Boolean(this.code && this.account && this.holder && this.sepayApiKey); },
  },
};
