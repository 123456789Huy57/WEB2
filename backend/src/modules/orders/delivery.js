// Khung giờ giao hàng do server quyết định theo giờ Việt Nam (không tin đồng hồ máy khách).
// Hôm nay: chỉ các khung bắt đầu sau ít nhất 1 giờ nữa. Ngày mai: đủ các khung.
// Mã khung gửi lên: "YYYY-MM-DD HH:MM-HH:MM". Lưu vào đơn dạng dễ đọc, có ngày: "Thứ Bảy 14/11 · 9:00–11:00".
const { HttpError } = require('../../lib/http-error');

const SLOTS = [[9, 11], [12, 14], [16, 18], [18, 20]];
const VN_OFFSET = 7 * 60 * 60 * 1000;
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const pad = n => String(n).padStart(2, '0');

function slotsFor(now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET); // dùng các hàm getUTC* để đọc giờ Việt Nam
  const hour = vn.getUTCHours() + vn.getUTCMinutes() / 60;
  const out = [];
  for (const dayOffset of [0, 1]) {
    const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + dayOffset));
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const dayLabel = `${dayOffset ? 'Ngày mai' : 'Hôm nay'}, ${WEEKDAY[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
    for (const [from, to] of SLOTS) {
      if (!dayOffset && from - 1 < hour) continue;
      out.push({
        value: `${date} ${pad(from)}:00-${pad(to)}:00`,
        date, day: dayOffset ? 'tomorrow' : 'today', dayLabel, time: `${from}:00–${to}:00`,
        label: `${WEEKDAY[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} · ${from}:00–${to}:00`,
      });
    }
  }
  return out;
}

/** Khung khách chọn phải còn trong danh sách hiện tại. Không chọn thì lấy khung sớm nhất. */
function resolveSlot(value, now = new Date()) {
  const slots = slotsFor(now);
  if (value === undefined || value === '') return slots[0];
  const hit = slots.find(s => s.value === value);
  if (!hit) throw new HttpError(400, 'DELIVERY_SLOT_UNAVAILABLE', 'Khung giờ giao vừa hết hoặc không hợp lệ. Chọn khung giờ khác.');
  return hit;
}

module.exports = { slotsFor, resolveSlot, SLOTS };
