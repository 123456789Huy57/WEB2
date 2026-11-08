// Ký và kiểm tra dữ liệu theo chuẩn VNPay 2.1.0 (HMAC-SHA512 trên chuỗi tham số đã sắp xếp).
// Hàm thuần: cổng giả lập (mock) dùng lại đúng định dạng này nên luồng test giống hệt VNPay thật.
const { createHmac, timingSafeEqual } = require('node:crypto');

const encode = value => encodeURIComponent(String(value)).replace(/%20/g, '+');
const signData = params => Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').sort().map(k => `${k}=${encode(params[k])}`).join('&');
const hmac = (secret, data) => createHmac('sha512', secret).update(Buffer.from(data, 'utf8')).digest('hex');

// yyyyMMddHHmmss theo giờ Việt Nam (VNPay yêu cầu GMT+7)
const vnTime = (ms = Date.now()) => new Date(ms + 7 * 3600000).toISOString().replace(/[-:T]/g, '').slice(0, 14);

function buildPaymentUrl({ baseUrl, tmnCode, secret, amount, txnRef, orderInfo, returnUrl, ipAddr, now = Date.now(), expireMinutes = 15 }) {
  const params = {
    vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: tmnCode, vnp_Amount: Math.round(amount) * 100,
    vnp_CurrCode: 'VND', vnp_TxnRef: txnRef, vnp_OrderInfo: orderInfo, vnp_OrderType: 'other', vnp_Locale: 'vn',
    vnp_ReturnUrl: returnUrl, vnp_IpAddr: ipAddr || '127.0.0.1', vnp_CreateDate: vnTime(now), vnp_ExpireDate: vnTime(now + expireMinutes * 60000),
  };
  const data = signData(params);
  return `${baseUrl}?${data}&vnp_SecureHash=${hmac(secret, data)}`;
}

// Kiểm tra dữ liệu VNPay gửi về (return URL hoặc IPN). Không tin bất kỳ trường nào nếu chữ ký sai.
function verify(query, secret) {
  const { vnp_SecureHash: hash, vnp_SecureHashType: _type, ...rest } = query;
  const params = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('vnp_')));
  const expected = hmac(secret, signData(params));
  const valid = typeof hash === 'string' && hash.length === expected.length && timingSafeEqual(Buffer.from(hash.toLowerCase()), Buffer.from(expected));
  return {
    valid,
    success: valid && params.vnp_ResponseCode === '00' && (params.vnp_TransactionStatus ?? '00') === '00',
    txnRef: params.vnp_TxnRef, amount: Number(params.vnp_Amount) / 100, transactionNo: params.vnp_TransactionNo || '',
    responseCode: params.vnp_ResponseCode,
  };
}

// Dùng cho cổng giả lập: tạo dữ liệu "VNPay trả về" có chữ ký hợp lệ.
function signedReturn(secret, params) {
  const data = signData(params);
  return `${data}&vnp_SecureHash=${hmac(secret, data)}`;
}

module.exports = { buildPaymentUrl, verify, signedReturn, signData, vnTime };
