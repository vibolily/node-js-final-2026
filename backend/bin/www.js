#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = require('../src/app');
const db = require('../src/db');

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    // 初始化資料庫
    await db.initializeDatabase();

    // 啟動服務器
    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
}

start();
