const bcrypt = require('bcryptjs');

/**
 * 驗證密碼規則：必須含大小寫英數，8-16 字
 */
function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,16}$/;
  return regex.test(password);
}

/**
 * 雜湊密碼
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

/**
 * 比對密碼
 */
function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

/**
 * 驗證 UUID 格式
 */
function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

module.exports = {
  validatePassword,
  hashPassword,
  comparePassword,
  isValidUUID,
};
