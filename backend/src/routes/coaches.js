const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');

router.post('/skill', coachController.addSkill);
router.get('/skill', coachController.getSkills);
router.delete('/skill/:skillId', coachController.deleteSkill);

router.get('/', coachController.getPublicCoaches);
router.get('/:coachId', coachController.getPublicCoachDetail);
router.get('/:coachId/courses', coachController.getPublicCoachCourses);

module.exports = router;
