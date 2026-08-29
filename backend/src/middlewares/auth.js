const jwt = require('jsonwebtoken');

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
function authenticateToken(req, res, next) {
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
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'failed',
        message: 'Token 已過期',
      });
    }
    return res.status(401).json({
      status: 'failed',
      message: '請先登入',
    });
  }
}

module.exports = {
  generateToken,
  authenticateToken,
};
