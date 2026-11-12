const { getDatabase } = require('../../config/database');
const safeProjection = { _id: 0, id: 1, fullName: 1, email: 1, phone: 1, address: 1, role: 1, isActive: 1, createdAt: 1, updatedAt: 1 };
const users = () => getDatabase().collection('users');
function publicUser(user) {
  return Object.fromEntries(Object.keys(safeProjection).filter(key => key !== '_id' && user[key] !== undefined).map(key => [key, user[key]]));
}
const findById = id => users().findOne({ id });
const findByEmail = email => users().findOne({ email });
const findByPhone = phone => users().findOne({ phone });
const insert = user => users().insertOne(user);
async function update(id, patch) {
  const user = await users().findOneAndUpdate({ id }, { $set: { ...patch, updatedAt: new Date().toISOString() } }, { returnDocument: 'after' });
  return user && publicUser(user);
}
module.exports = { users, safeProjection, publicUser, findById, findByEmail, findByPhone, insert, update };
