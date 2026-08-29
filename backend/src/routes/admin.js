const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');
const { authenticateToken } = require('../middlewares/auth');

// 具體路徑 (courses, revenue) 必須在 :userId / :courseId 之前
router.get('/coaches/revenue', authenticateToken, coachController.getRevenue);
router.post('/coaches/courses', authenticateToken, coachController.addCourse);
router.get('/coaches/courses', authenticateToken, coachController.getCoachCourses);
router.get('/coaches/courses/:courseId', authenticateToken, coachController.getCourseById);
router.put('/coaches/courses/:courseId', authenticateToken, coachController.updateCourseById);

router.get('/coaches', authenticateToken, coachController.getCoachProfile);
router.put('/coaches', authenticateToken, coachController.updateCoachProfile);
router.post('/coaches/:userId', coachController.promoteCoach);

module.exports = router;
