const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { validatePassword, hashPassword, comparePassword } = require('../utils/validators');
const { generateToken } = require('../middlewares/auth');

async function userExists(email) {
  const client = db.getClient();
  const result = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  return result.rows.length > 0;
}

async function signup(req, res) {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        status: 'failed',
        message: '欄位未填寫正確',
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        status: 'failed',
        message: '密碼不符合規則，需要包含英文數字與大小寫，8-16字',
      });
    }

    if (await userExists(email)) {
      return res.status(400).json({
        status: 'failed',
        message: 'Email 已被使用',
      });
    }

    const userId = uuidv4();
    const hashedPassword = hashPassword(password);
    const userRole = (role || 'USER').toUpperCase();

    const client = db.getClient();
    await client.query(
      'INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, hashedPassword, name, userRole]
    );

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: userId,
          name,
          email,
          role: userRole,
        }
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'failed',
        message: '欄位未填寫正確',
      });
    }

    const client = db.getClient();
    const result = await client.query(
      'SELECT id, email, password, name, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0 || !comparePassword(password, result.rows[0].password)) {
      return res.status(400).json({
        status: 'failed',
        message: '密碼不正確',
      });
    }

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        }
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const client = db.getClient();
    const result = await client.query('SELECT email, name FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '使用者不存在',
      });
    }

    res.json({
      status: 'success',
      data: {
        user: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 'failed',
        message: '名稱不能為空',
      });
    }

    const client = db.getClient();
    await client.query('UPDATE users SET name = $1 WHERE id = $2', [name, userId]);

    res.json({
      status: 'success',
      data: {
        user: {
          name,
        },
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function updatePassword(req, res) {
  try {
    const userId = req.user.id;
    const { password, new_password, confirm_new_password } = req.body;

    if (!password || !new_password || !confirm_new_password) {
      return res.status(400).json({
        status: 'failed',
        message: '請填寫所有欄位',
      });
    }

    if (new_password !== confirm_new_password) {
      return res.status(400).json({
        status: 'failed',
        message: '新密碼與確認密碼不不吻合',
      });
    }

    if (!validatePassword(new_password)) {
      return res.status(400).json({
        status: 'failed',
        message: '新密碼不符合規則，需要包含英文數字與大小寫，8-16字',
      });
    }

    const client = db.getClient();
    const userResult = await client.query('SELECT password FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0 || !comparePassword(password, userResult.rows[0].password)) {
      return res.status(400).json({
        status: 'failed',
        message: '舊密碼不正確',
      });
    }

    const hashedNewPassword = hashPassword(new_password);
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);

    res.json({
      status: 'success',
      message: '密碼修改成功',
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  updatePassword,
};
