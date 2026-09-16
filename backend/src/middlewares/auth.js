const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_DAY = process.env.JWT_EXPIRES_DAY || '30d';

/**
 * 生成 JWT token
 */
function generateToken(user) {
  const role = (user.role || 'USER').toUpperCase();
  return jwt.sign(
    {
      id: user.id,
      role: role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_DAY }
  );
}

/**
 * 驗證 token 中間件
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'failed',
      message: '請先登入',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const client = db.getClient();
    const result = await client.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'failed',
        message: 'Token 無效或使用者不存在',
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'failed',
        message: 'Token 已過期',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'failed',
        message: '請先登入',
      });
    }
    console.error('Authenticate token error:', error);
    return res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

module.exports = {
  generateToken,
  authenticateToken,
};
