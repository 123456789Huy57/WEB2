// Kiểm tra kết nối MongoDB và in lý do lỗi (đã che mật khẩu). Chạy: npm run check:db
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');

(async () => {
  if (!env.mongodbUri) return console.log('LỖI: MONGODB_URI đang trống. Kiểm tra file backend/.env.');
  try {
    const db = await connectDatabase(env.mongodbUri, env.mongodbDb);
    console.log('KẾT NỐI OK. Database:', db.databaseName);
  } catch (error) {
    const message = String(error.message).replace(/\/\/[^@/]*@/g, '//***@').slice(0, 400);
    console.log('LỖI:', error.name, error.code || '', '|', message);
    if (/querySrv|ENOTFOUND|ECONNREFUSED/.test(message)) console.log('GỢI Ý: máy không tra được địa chỉ Atlas (lỗi DNS). Đổi DNS sang 8.8.8.8 hoặc dùng Legacy URI String.');
    if (/Authentication failed|bad auth/i.test(message)) console.log('GỢI Ý: sai username hoặc mật khẩu database.');
    if (/Server selection timed out|whitelist|not allowed/i.test(message)) console.log('GỢI Ý: Atlas đang chặn IP. Vào Network Access, thêm 0.0.0.0/0.');
  } finally {
    await disconnectDatabase();
  }
})();
