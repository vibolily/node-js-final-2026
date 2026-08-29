const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');
const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', coachController.getPublicOngoingCourses);
router.post('/:courseId', authenticateToken, bookingController.bookCourse);
router.delete('/:courseId', authenticateToken, bookingController.cancelCourseBooking);

module.exports = router;
