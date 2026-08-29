const { v4: uuidv4 } = require('uuid');
const db = require('../db');

async function createPackage(req, res) {
  try {
    const { name, credit_amount, price } = req.body;
    if (!name || credit_amount === undefined || price === undefined) {
      return res.status(400).json({
        status: 'failed',
        message: '欄位未填寫正確',
      });
    }

    const client = db.getClient();
    const existing = await client.query('SELECT id FROM credit_packages WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        status: 'failed',
        message: '資料重複',
      });
    }

    const packageId = uuidv4();
    await client.query(
      'INSERT INTO credit_packages (id, name, credit_amount, price) VALUES ($1, $2, $3, $4)',
      [packageId, name, credit_amount, price]
    );

    res.status(201).json({
      status: 'success',
      data: {
        id: packageId,
        name,
        credit_amount,
        price,
      },
    });
  } catch (error) {
    console.error('Add credit package error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getPackages(req, res) {
  try {
    const client = db.getClient();
    const result = await client.query(
      'SELECT id, name, credit_amount, price FROM credit_packages ORDER BY created_at DESC'
    );
    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get credit packages error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function deletePackage(req, res) {
  try {
    const { creditPackageId } = req.params;
    const client = db.getClient();
    const result = await client.query('DELETE FROM credit_packages WHERE id = $1', [creditPackageId]);

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: 'failed',
        message: 'ID錯誤',
      });
    }

    res.json({
      status: 'success',
      message: '方案刪除成功',
    });
  } catch (error) {
    console.error('Delete credit package error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function createAdminPackage(req, res) {
  try {
    const { name, credit_amount, price } = req.body;
    if (!name || credit_amount === undefined || price === undefined) {
      return res.status(400).json({
        status: 'failed',
        message: '缺少必要欄位',
      });
    }

    const packageId = uuidv4();
    const client = db.getClient();

    await client.query(
      'INSERT INTO credit_packages (id, name, credit_amount, price) VALUES ($1, $2, $3, $4)',
      [packageId, name, credit_amount, price]
    );

    res.status(201).json({
      status: 'success',
      message: '方案新增成功',
      data: {
        id: packageId,
        name,
        credit_amount,
        price,
      },
    });
  } catch (error) {
    console.error('Add credit package error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

module.exports = {
  createPackage,
  getPackages,
  deletePackage,
  createAdminPackage,
};
