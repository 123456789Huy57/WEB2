const { HttpError } = require('./http-error');
const bad = message => { throw new HttpError(400, 'VALIDATION_ERROR', message); };
function object(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad('Body phải là object JSON.');
  const extra = Object.keys(value).filter(key => !fields.includes(key));
  if (extra.length) bad(`Không được gửi các trường: ${extra.join(', ')}.`);
  return value;
}
function text(value, name, min = 0, max = 500) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) bad(`${name} cần từ ${min} đến ${max} ký tự.`);
  return value.trim();
}
function number(value, name, min = 0, max = 1000000000, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) bad(`${name} không hợp lệ.`);
  return value;
}
function boolean(value, name) {
  if (typeof value !== 'boolean') bad(`${name} phải là boolean.`);
  return value;
}
function email(value) {
  const result = text(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) bad('Email không hợp lệ.');
  return result;
}
function phone(value) {
  const result = text(value, 'Số điện thoại', 10, 10);
  if (!/^0\d{9}$/.test(result)) bad('Số điện thoại cần 10 số, bắt đầu bằng 0.');
  return result;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) bad('Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.');
  return value;
}
function strings(value, name, max = 30) {
  if (!Array.isArray(value) || value.length > max) bad(`${name} phải là mảng tối đa ${max} phần tử.`);
  return value.map(item => text(item, name, 0, 1000));
}
function id(value) {
  const result = text(value, 'ID', 1, 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result)) bad('ID không hợp lệ.');
  return result;
}
function slug(value) {
  const result = text(value, 'Slug', 1, 200);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) bad('Slug chỉ gồm chữ thường, số và dấu gạch ngang.');
  return result;
}
function slugify(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function searchRegex(value) {
  return text(value, 'Từ khóa', 0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function page(query) {
  const parse = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) bad('Phân trang không hợp lệ.');
    const n = Number(value);
    if (n < 1 || n > max) bad('Phân trang không hợp lệ.');
    return n;
  };
  return { page: parse(query.page, 1, 1000000), pageSize: parse(query.pageSize, 20, 100) };
}
module.exports = { object, text, number, boolean, email, phone, password, strings, id, slug, slugify, searchRegex, page, bad };
