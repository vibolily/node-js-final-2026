const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { isValidUUID } = require('../utils/validators');

/**
 * GET /api/users/courses
 * 返回用戶已報名的課程，包含信用額度使用情況
 */
async function getUserCourses(req, res) {
  try {
    const userId = req.user.id;
    const client = db.getClient();

    // 1. 獲取用戶購買的總信用額度
    const creditResult = await client.query(
      `SELECT COALESCE(SUM(purchased_credits), 0) as total_credits
       FROM credit_purchases
       WHERE user_id = $1`,
      [userId]
    );

    const totalCredits = parseInt(creditResult.rows[0].total_credits) || 0;

    // 2. 獲取用戶報名課程的資訊（包含已取消的）
    const bookingsResult = await client.query(
      `SELECT 
        b.id as booking_id,
        b.course_id,
        c.name,
        c.start_at,
        c.end_at,
        c.meeting_url,
        u.name as coach_name,
        b.cancelled_at
      FROM bookings b
      LEFT JOIN courses c ON b.course_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE b.user_id = $1
      ORDER BY c.start_at ASC NULLS FIRST`,
      [userId]
    );

    // 3. 計算已使用的信用額度（所有未取消的報名）
    const creditUsageResult = await client.query(
      `SELECT COUNT(*) as active_bookings
       FROM bookings
       WHERE user_id = $1 AND cancelled_at IS NULL`,
      [userId]
    );

    const creditUsage = parseInt(creditUsageResult.rows[0].active_bookings) || 0;

    // 4. 組織回應
    const coursesBooking = bookingsResult.rows.map(row => ({
      course_id: row.course_id,
      name: row.name,
      start_at: row.start_at,
      end_at: row.end_at,
      meeting_url: row.meeting_url,
      coach_name: row.coach_name,
      cancelled_at: row.cancelled_at,
    }));

    const creditRemain = totalCredits - creditUsage;

    res.json({
      status: 'success',
      data: {
        credit_remain: creditRemain,
        credit_usage: creditUsage,
        course_booking: coursesBooking,
      },
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

/**
 * POST /api/credit-package/:creditPackageId
 * 購買信用額度方案
 */
async function buyCreditPackage(req, res) {
  try {
    if (!isValidUUID(req.params.creditPackageId)) {
      return res.status(400).json({
        status: 'failed',
        message: '無效的方案 ID',
      });
    }

    const userId = req.user.id;
    const packageId = req.params.creditPackageId;
    const client = db.getClient();

    // 檢查方案是否存在
    const packageResult = await client.query(
      'SELECT id, credit_amount, price FROM credit_packages WHERE id = $1',
      [packageId]
    );

    if (packageResult.rows.length === 0) {
      return res.status(404).json({
        status: 'failed',
        message: '方案不存在',
      });
    }

    const pkg = packageResult.rows[0];

    // 創建購買記錄
    const purchaseId = uuidv4();
    await client.query(
      `INSERT INTO credit_purchases (id, user_id, credit_package_id, purchased_credits, price_paid)
       VALUES ($1, $2, $3, $4, $5)`,
      [purchaseId, userId, packageId, pkg.credit_amount, pkg.price]
    );

    res.status(201).json({
      status: 'success',
      message: '購買成功',
      data: {
        id: purchaseId,
        credit_amount: pkg.credit_amount,
        price: pkg.price,
      },
    });
  } catch (error) {
    console.error('Purchase credit error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

/**
 * GET /api/users/credit-package
 * 查看用戶的購買紀錄
 */
async function getUserCreditPackages(req, res) {
  try {
    const userId = req.user.id;
    const client = db.getClient();

    const result = await client.query(
      `SELECT 
        cp.id,
        cp.name,
        cp.credit_amount as purchased_credits,
        cp.price as price_paid,
        cr.purchased_at
      FROM credit_purchases cr
      JOIN credit_packages cp ON cr.credit_package_id = cp.id
      WHERE cr.user_id = $1
      ORDER BY cr.purchased_at DESC`,
      [userId]
    );

    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get credit purchases error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

/**
 * POST /api/courses/:courseId
 * 報名課程
 */
async function bookCourse(req, res) {
  try {
    if (!isValidUUID(req.params.courseId)) {
      return res.status(400).json({
        status: 'failed',
        message: '課程不存在',
      });
    }

    const userId = req.user.id;
    const courseId = req.params.courseId;
    const client = db.getClient();

    // 1. 檢查課程是否存在
    const courseResult = await client.query(
      'SELECT id, start_at, end_at, max_participants FROM courses WHERE id = $1',
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '課程不存在',
      });
    }

    const course = courseResult.rows[0];

    // 2. 檢查用戶是否已報名過（包含取消與未取消）
    const existingBooking = await client.query(
      'SELECT id, cancelled_at FROM bookings WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    if (existingBooking.rows.length > 0) {
      return res.status(400).json({
        status: 'failed',
        message: '已經報名過此課程',
      });
    }

    // 3. 檢查用戶是否有足夠的信用額度
    const creditResult = await client.query(
      `SELECT COALESCE(SUM(purchased_credits), 0) as total_credits
       FROM credit_purchases
       WHERE user_id = $1`,
      [userId]
    );

    const totalCredits = parseInt(creditResult.rows[0].total_credits) || 0;

    const creditUsageResult = await client.query(
      `SELECT COUNT(*) as active_bookings
       FROM bookings
       WHERE user_id = $1 AND cancelled_at IS NULL`,
      [userId]
    );

    const creditUsage = parseInt(creditUsageResult.rows[0].active_bookings) || 0;
    const creditRemain = totalCredits - creditUsage;

    if (creditRemain < 1) {
      return res.status(400).json({
        status: 'failed',
        message: '已無可使用堂數',
      });
    }

    // 4. 檢查課程名額
    const participantCount = await client.query(
      'SELECT COUNT(*) as count FROM bookings WHERE course_id = $1 AND cancelled_at IS NULL',
      [courseId]
    );

    const count = parseInt(participantCount.rows[0].count) || 0;
    if (count >= course.max_participants) {
      return res.status(400).json({
        status: 'failed',
        message: '已達最大參加人數，無法參加',
      });
    }

    // 創建報名記錄
    const bookingId = uuidv4();
    await client.query(
      'INSERT INTO bookings (id, user_id, course_id) VALUES ($1, $2, $3)',
      [bookingId, userId, courseId]
    );

    res.status(201).json({
      status: 'success',
      message: '報名成功',
    });
  } catch (error) {
    console.error('Book course error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

/**
 * DELETE /api/courses/:courseId
 * 取消報名（軟刪除 - 標記 cancelled_at）
 */
async function cancelCourseBooking(req, res) {
  try {
    if (!isValidUUID(req.params.courseId)) {
      return res.status(400).json({
        status: 'failed',
        message: '課程不存在',
      });
    }

    const userId = req.user.id;
    const courseId = req.params.courseId;
    const client = db.getClient();

    // 檢查報名是否存在
    const booking = await client.query(
      'SELECT id, cancelled_at FROM bookings WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    if (booking.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '尚未報名此課程',
      });
    }

    if (booking.rows[0].cancelled_at !== null) {
      return res.status(400).json({
        status: 'failed',
        message: '已取消報名',
      });
    }

    // 軟刪除 - 標記取消時間
    await client.query(
      'UPDATE bookings SET cancelled_at = CURRENT_TIMESTAMP WHERE id = $1',
      [booking.rows[0].id]
    );

    res.json({
      status: 'success',
      message: '取消報名成功',
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

module.exports = {
  getUserCourses,
  buyCreditPackage,
  getUserCreditPackages,
  bookCourse,
  cancelCourseBooking,
};
