const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { isValidUUID } = require('../utils/validators');

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// ============================================================================
// 技能 CRUD（Public / Admin）
// ============================================================================

async function addSkill(req, res) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        status: 'failed',
        message: '缺少技能名稱',
      });
    }

    const client = db.getClient();
    const existing = await client.query('SELECT id FROM skills WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        status: 'failed',
        message: '技能名稱已存在',
      });
    }

    const skillId = uuidv4();
    await client.query('INSERT INTO skills (id, name) VALUES ($1, $2)', [skillId, name]);

    res.status(201).json({
      status: 'success',
      data: {
        id: skillId,
        name,
      },
    });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getSkills(req, res) {
  try {
    const client = db.getClient();
    const result = await client.query('SELECT id, name FROM skills ORDER BY created_at DESC');
    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function deleteSkill(req, res) {
  try {
    const { skillId } = req.params;
    if (!isValidUUID(skillId)) {
      return res.status(400).json({
        status: 'failed',
        message: '無效的技能 ID',
      });
    }

    const client = db.getClient();
    const result = await client.query('DELETE FROM skills WHERE id = $1', [skillId]);

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '技能不存在',
      });
    }

    res.json({
      status: 'success',
      message: '技能刪除成功',
    });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

// ============================================================================
// 教練後台與升級（Admin / Coach）
// ============================================================================

async function promoteCoach(req, res) {
  try {
    const { userId } = req.params;
    if (!isValidUUID(userId)) {
      return res.status(400).json({
        status: 'failed',
        message: '無效的用戶 ID',
      });
    }

    const client = db.getClient();
    
    const userRes = await client.query('SELECT id, name, role FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '使用者不存在',
      });
    }

    const user = userRes.rows[0];
    if (user.role === 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '已經是教練了',
      });
    }

    const coachRes = await client.query('SELECT id FROM coaches WHERE user_id = $1', [userId]);
    if (coachRes.rows.length > 0) {
      return res.status(400).json({
        status: 'failed',
        message: '已經是教練了',
      });
    }

    await client.query("UPDATE users SET role = 'COACH' WHERE id = $1", [userId]);

    const { experience_years, description } = req.body;
    const coachId = uuidv4();

    await client.query(
      'INSERT INTO coaches (id, user_id, experience_years, intro) VALUES ($1, $2, $3, $4)',
      [coachId, userId, experience_years, description]
    );

    res.status(201).json({
      status: 'success',
      data: {
        coach: {
          id: coachId,
          user_id: userId,
          user: {
            name: user.name,
          },
        },
      },
    });
  } catch (error) {
    console.error('Promote to coach error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getCoachProfile(req, res) {
  try {
    if (req.user.role !== 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '不是教練身分',
      });
    }

    const userId = req.user.id;
    const client = db.getClient();
    const coachRes = await client.query(
      'SELECT id, user_id, experience_years, intro as description, profile_image_url FROM coaches WHERE user_id = $1',
      [userId]
    );

    if (coachRes.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '教練資料不存在',
      });
    }

    const coach = coachRes.rows[0];
    const skillsRes = await client.query('SELECT skill_id FROM coach_skills WHERE coach_id = $1', [coach.id]);
    const skill_ids = skillsRes.rows.map(row => row.skill_id);

    res.json({
      status: 'success',
      data: {
        id: coach.id,
        user_id: coach.user_id,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skill_ids,
      },
    });
  } catch (error) {
    console.error('Get coach profile error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function updateCoachProfile(req, res) {
  try {
    if (req.user.role !== 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '不是教練身分',
      });
    }

    const userId = req.user.id;
    const { experience_years, description, profile_image_url, skill_ids } = req.body;

    if (profile_image_url && !profile_image_url.startsWith('https://')) {
      return res.status(400).json({
        status: 'failed',
        message: 'profile_image_url 必須是 https 開頭',
      });
    }

    const client = db.getClient();
    const coachRes = await client.query('SELECT id FROM coaches WHERE user_id = $1', [userId]);

    if (coachRes.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '教練資料不存在',
      });
    }

    const coachId = coachRes.rows[0].id;

    await client.query(
      'UPDATE coaches SET experience_years = $1, intro = $2, profile_image_url = $3 WHERE id = $4',
      [experience_years, description, profile_image_url, coachId]
    );

    await client.query('DELETE FROM coach_skills WHERE coach_id = $1', [coachId]);

    if (Array.isArray(skill_ids)) {
      for (const skillId of skill_ids) {
        await client.query('INSERT INTO coach_skills (coach_id, skill_id) VALUES ($1, $2)', [coachId, skillId]);
      }
    }

    res.json({
      status: 'success',
      data: {
        id: coachId,
        user_id: userId,
        experience_years,
        description,
        profile_image_url,
        skill_ids: skill_ids || [],
      },
    });
  } catch (error) {
    console.error('Update coach profile error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function addCourse(req, res) {
  try {
    if (req.user.role !== 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '不是教練身分',
      });
    }

    const userId = req.user.id;
    const { skill_id, name, description, start_at, end_at, max_participants, meeting_url } = req.body;

    if (!skill_id || !name || !description || !start_at || !end_at || max_participants === undefined || !meeting_url) {
      return res.status(400).json({
        status: 'failed',
        message: '缺少必要欄位',
      });
    }

    if (!meeting_url.startsWith('https://')) {
      return res.status(400).json({
        status: 'failed',
        message: 'meeting_url 必須是 https 開頭',
      });
    }

    const courseId = uuidv4();
    const client = db.getClient();

    await client.query(
      `INSERT INTO courses (id, user_id, skill_id, name, description, start_at, end_at, max_participants, meeting_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [courseId, userId, skill_id, name, description, start_at, end_at, max_participants, meeting_url]
    );

    res.status(201).json({
      status: 'success',
      data: {
        course: {
          id: courseId,
          skill_id,
          name,
          description,
          start_at,
          end_at,
          max_participants,
          meeting_url,
        },
      },
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getCoachCourses(req, res) {
  try {
    if (req.user.role !== 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '不是教練身分',
      });
    }

    const userId = req.user.id;
    const client = db.getClient();

    const coursesRes = await client.query(
      `SELECT id, name, skill_id, start_at, end_at, max_participants
       FROM courses
       WHERE user_id = $1
       ORDER BY start_at ASC`,
      [userId]
    );

    const now = new Date();
    const result = [];

    for (const course of coursesRes.rows) {
      const startAt = new Date(course.start_at);
      const endAt = new Date(course.end_at);

      let status = '尚未開始';
      if (now >= endAt) {
        status = '已結束';
      } else if (now >= startAt && now < endAt) {
        status = '進行中';
      }

      const countRes = await client.query(
        'SELECT COUNT(*) as count FROM bookings WHERE course_id = $1 AND cancelled_at IS NULL',
        [course.id]
      );
      const participants = parseInt(countRes.rows[0].count) || 0;

      result.push({
        id: course.id,
        name: course.name,
        skill_id: course.skill_id,
        start_at: course.start_at,
        end_at: course.end_at,
        max_participants: course.max_participants,
        status,
        participants,
      });
    }

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Get coach courses error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getCourseById(req, res) {
  try {
    if (req.user.role !== 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '不是教練身分',
      });
    }

    const { courseId } = req.params;
    if (!isValidUUID(courseId)) {
      return res.status(400).json({
        status: 'failed',
        message: '無效的課程 ID',
      });
    }

    const client = db.getClient();
    const courseRes = await client.query('SELECT * FROM courses WHERE id = $1', [courseId]);

    if (courseRes.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '課程不存在',
      });
    }

    const course = courseRes.rows[0];
    if (course.user_id !== req.user.id) {
      return res.status(400).json({
        status: 'failed',
        message: '權限不足',
      });
    }

    res.json({
      status: 'success',
      data: {
        id: course.id,
        skill_id: course.skill_id,
        name: course.name,
        description: course.description,
        start_at: course.start_at,
        end_at: course.end_at,
        max_participants: course.max_participants,
        meeting_url: course.meeting_url,
      },
    });
  } catch (error) {
    console.error('Get course by id error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function updateCourseById(req, res) {
  try {
    if (req.user.role !== 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '不是教練身分',
      });
    }

    const { courseId } = req.params;
    if (!isValidUUID(courseId)) {
      return res.status(400).json({
        status: 'failed',
        message: '無效的課程 ID',
      });
    }

    const client = db.getClient();
    const courseRes = await client.query('SELECT * FROM courses WHERE id = $1', [courseId]);

    if (courseRes.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '課程不存在',
      });
    }

    const course = courseRes.rows[0];
    if (course.user_id !== req.user.id) {
      return res.status(400).json({
        status: 'failed',
        message: '權限不足',
      });
    }

    const { skill_id, name, description, start_at, end_at, max_participants, meeting_url } = req.body;

    if (meeting_url && !meeting_url.startsWith('https://')) {
      return res.status(400).json({
        status: 'failed',
        message: 'meeting_url 必須是 https 開頭',
      });
    }

    await client.query(
      `UPDATE courses SET
        skill_id = $1,
        name = $2,
        description = $3,
        start_at = $4,
        end_at = $5,
        max_participants = $6,
        meeting_url = $7
       WHERE id = $8`,
      [skill_id, name, description, start_at, end_at, max_participants, meeting_url, courseId]
    );

    res.json({
      status: 'success',
      data: {
        id: courseId,
        skill_id,
        name,
        description,
        start_at,
        end_at,
        max_participants,
        meeting_url,
      },
    });
  } catch (error) {
    console.error('Update course by id error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getRevenue(req, res) {
  try {
    if (req.user.role !== 'COACH') {
      return res.status(400).json({
        status: 'failed',
        message: '不是教練身分',
      });
    }

    const { month } = req.query;
    const monthIndex = MONTH_NAMES.indexOf((month || '').toLowerCase());

    if (monthIndex === -1) {
      return res.status(400).json({
        status: 'failed',
        message: '月份無效',
      });
    }

    const currentYear = new Date().getFullYear();
    const userId = req.user.id;
    const client = db.getClient();

    // 查該月該教練課程未取消的報名筆數
    const bookingsRes = await client.query(
      `SELECT b.id
       FROM bookings b
       JOIN courses c ON b.course_id = c.id
       WHERE c.user_id = $1
         AND b.cancelled_at IS NULL
         AND EXTRACT(MONTH FROM b.created_at) = $2
         AND EXTRACT(YEAR FROM b.created_at) = $3`,
      [userId, monthIndex + 1, currentYear]
    );

    const bookingCount = bookingsRes.rows.length;

    // 計算平均單堂價格 (Σprice / Σcredit_amount)
    const pkgRes = await client.query(
      'SELECT COALESCE(SUM(price), 0) as total_price, COALESCE(SUM(credit_amount), 0) as total_credits FROM credit_packages'
    );

    const totalPrice = parseFloat(pkgRes.rows[0].total_price) || 0;
    const totalCredits = parseInt(pkgRes.rows[0].total_credits) || 0;

    const perCreditPrice = totalCredits > 0 ? totalPrice / totalCredits : 0;
    const revenue = Math.floor(bookingCount * perCreditPrice);

    res.json({
      status: 'success',
      data: {
        total: {
          revenue,
          participants: bookingCount,
          course_count: bookingCount,
        },
      },
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

// ============================================================================
// 公開瀏覽 API（M4）
// ============================================================================

async function getPublicCoaches(req, res) {
  try {
    const { per, page } = req.query;
    if (!per || !page || isNaN(Number(per)) || isNaN(Number(page))) {
      return res.status(400).json({
        status: 'failed',
        message: 'per 與 page 為必填參數',
      });
    }

    const limit = parseInt(per);
    const offset = (parseInt(page) - 1) * limit;

    const client = db.getClient();
    const coachesRes = await client.query(
      `SELECT 
        c.id,
        c.user_id,
        u.name,
        c.experience_years,
        c.intro,
        c.profile_image_url
       FROM coaches c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const data = [];
    for (const coach of coachesRes.rows) {
      const skillsRes = await client.query(
        `SELECT s.id, s.name
         FROM coach_skills cs
         JOIN skills s ON cs.skill_id = s.id
         WHERE cs.coach_id = $1`,
        [coach.id]
      );

      data.push({
        id: coach.id,
        user_id: coach.user_id,
        name: coach.name,
        experience_years: coach.experience_years,
        intro: coach.intro,
        profile_image_url: coach.profile_image_url,
        skills: skillsRes.rows,
      });
    }

    res.json({
      status: 'success',
      data,
    });
  } catch (error) {
    console.error('Get public coaches error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getPublicCoachDetail(req, res) {
  try {
    const { coachId } = req.params;
    if (!isValidUUID(coachId)) {
      return res.status(400).json({
        status: 'failed',
        message: '無效的教練 ID',
      });
    }

    const client = db.getClient();
    const coachRes = await client.query(
      `SELECT 
        c.id,
        c.user_id,
        u.name,
        c.experience_years,
        c.intro,
        c.profile_image_url
       FROM coaches c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [coachId]
    );

    if (coachRes.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '教練不存在',
      });
    }

    const coach = coachRes.rows[0];
    const skillsRes = await client.query(
      `SELECT s.id, s.name
       FROM coach_skills cs
       JOIN skills s ON cs.skill_id = s.id
       WHERE cs.coach_id = $1`,
      [coach.id]
    );

    res.json({
      status: 'success',
      data: {
        user: {
          name: coach.name,
        },
        coach: {
          id: coach.id,
          user_id: coach.user_id,
          experience_years: coach.experience_years,
          intro: coach.intro,
          profile_image_url: coach.profile_image_url,
          skills: skillsRes.rows,
        },
      },
    });
  } catch (error) {
    console.error('Get public coach detail error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getPublicCoachCourses(req, res) {
  try {
    const { coachId } = req.params;
    if (!isValidUUID(coachId)) {
      return res.status(400).json({
        status: 'failed',
        message: '無效的教練 ID',
      });
    }

    const client = db.getClient();
    const coachRes = await client.query('SELECT user_id FROM coaches WHERE id = $1', [coachId]);
    if (coachRes.rows.length === 0) {
      return res.status(400).json({
        status: 'failed',
        message: '教練不存在',
      });
    }

    const userId = coachRes.rows[0].user_id;
    const coursesRes = await client.query(
      `SELECT 
        c.id,
        c.skill_id,
        s.name as skill_name,
        u.name as coach_name,
        c.name,
        c.description,
        c.start_at,
        c.end_at,
        c.max_participants,
        c.meeting_url
       FROM courses c
       JOIN skills s ON c.skill_id = s.id
       JOIN users u ON c.user_id = u.id
       WHERE c.user_id = $1 AND c.end_at > NOW()
       ORDER BY c.start_at ASC`,
      [userId]
    );

    res.json({
      status: 'success',
      data: coursesRes.rows,
    });
  } catch (error) {
    console.error('Get public coach courses error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

async function getPublicOngoingCourses(req, res) {
  try {
    const client = db.getClient();
    const coursesRes = await client.query(
      `SELECT 
        c.id,
        c.skill_id,
        s.name as skill_name,
        u.name as coach_name,
        c.name,
        c.description,
        c.start_at,
        c.end_at,
        c.max_participants,
        c.meeting_url
       FROM courses c
       JOIN skills s ON c.skill_id = s.id
       JOIN users u ON c.user_id = u.id
       WHERE c.start_at <= NOW() AND c.end_at > NOW()
       ORDER BY c.start_at ASC`
    );

    res.json({
      status: 'success',
      data: coursesRes.rows,
    });
  } catch (error) {
    console.error('Get public ongoing courses error:', error);
    res.status(500).json({
      status: 'failed',
      message: '伺服器錯誤',
    });
  }
}

module.exports = {
  addSkill,
  getSkills,
  deleteSkill,
  promoteCoach,
  getCoachProfile,
  updateCoachProfile,
  addCourse,
  getCoachCourses,
  getCourseById,
  updateCourseById,
  getRevenue,
  getPublicCoaches,
  getPublicCoachDetail,
  getPublicCoachCourses,
  getPublicOngoingCourses,
};