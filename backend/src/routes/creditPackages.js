const express = require('express');
const router = express.Router();
const creditPackageController = require('../controllers/creditPackageController');
const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middlewares/auth');

router.post('/', creditPackageController.createPackage);
router.get('/', creditPackageController.getPackages);
router.delete('/:creditPackageId', creditPackageController.deletePackage);
router.post('/:creditPackageId', authenticateToken, bookingController.buyCreditPackage);

module.exports = router;
