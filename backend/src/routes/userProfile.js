const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.put('/password', authenticateToken, userController.updatePassword);
router.get('/courses', authenticateToken, bookingController.getUserCourses);
router.get('/credit-package', authenticateToken, bookingController.getUserCreditPackages);

module.exports = router;
