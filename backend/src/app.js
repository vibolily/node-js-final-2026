/**
 * 健身房後端 API 主程式
 */

const express = require('express');

const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const coachRoutes = require('./routes/coaches');
const creditPackageRoutes = require('./routes/creditPackages');
const courseRoutes = require('./routes/courses');
const userProfileRoutes = require('./routes/userProfile');

const app = express();
app.use(express.json());

// ============================================================================
// M0 - 健康檢查
// ============================================================================

app.get('/healthcheck', (req, res) => {
  res.json('ok');
});

// ============================================================================
// 路由掛載
// ============================================================================

app.use('/api/users', userRoutes);
app.use('/api/users', userProfileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/credit-package', creditPackageRoutes);
app.use('/api/courses', courseRoutes);

// ============================================================================
// 404 與全域錯誤處理
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    status: 'failed',
    message: '找不到此路由',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'failed',
    message: '伺服器錯誤',
  });
});

module.exports = app;
