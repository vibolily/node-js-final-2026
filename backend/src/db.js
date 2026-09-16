const { Client } = require('pg');

let client;

async function initializeDatabase() {
  client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'fitness_db',
  });

  try {
    await client.connect();
    console.log('✓ 資料庫連接成功');

    // 創建必要的表
    await createTables();
    console.log('✓ 資料表初始化完成');
  } catch (error) {
    console.error('✗ 資料庫連接失敗:', error.message);
    throw error;
  }
}

async function createTables() {
  const queries = [
    // 用戶表
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // 教練表
    `CREATE TABLE IF NOT EXISTS coaches (
      id UUID PRIMARY KEY,
      user_id UUID UNIQUE NOT NULL,
      intro TEXT,
      experience_years INT,
      hourly_rate DECIMAL(10,2),
      profile_image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500);`,

    // 技能表
    `CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // 教練技能關聯表
    `CREATE TABLE IF NOT EXISTS coach_skills (
      coach_id UUID NOT NULL,
      skill_id UUID NOT NULL,
      PRIMARY KEY (coach_id, skill_id),
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )`,

    // 課程表
    `CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      skill_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      start_at TIMESTAMP NOT NULL,
      end_at TIMESTAMP NOT NULL,
      meeting_url VARCHAR(500),
      max_participants INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (skill_id) REFERENCES skills(id)
    )`,

    // 信用額度方案表
    `CREATE TABLE IF NOT EXISTS credit_packages (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      credit_amount INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // 信用額度購買記錄表
    `CREATE TABLE IF NOT EXISTS credit_purchases (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      credit_package_id UUID NOT NULL,
      purchased_credits INT NOT NULL,
      price_paid DECIMAL(10,2) NOT NULL,
      purchased_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (credit_package_id) REFERENCES credit_packages(id)
    )`,

    // 課程預約表
    `CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      course_id UUID NOT NULL,
      cancelled_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE(user_id, course_id)
    )`
  ];

  for (const query of queries) {
    await client.query(query);
  }
}

function getClient() {
  if (!client) {
    throw new Error('資料庫未初始化');
  }
  return client;
}

async function closeDatabase() {
  if (client) {
    await client.end();
  }
}

module.exports = {
  initializeDatabase,
  getClient,
  closeDatabase,
};
