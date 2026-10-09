const express = require('express');
const router = express.Router();
const adoptionController = require('../controllers/adoptionController');
const { authMiddleware, requireOrgAccess } = require('../middlewares/auth');

router.post('/', authMiddleware, adoptionController.createAdoptionRequest);
router.get('/me', authMiddleware, adoptionController.getMyAdoptionRequests);
router.get('/org', authMiddleware, requireOrgAccess(['owner', 'admin']), adoptionController.getOrgAdoptionRequests);
router.patch('/:id/status', authMiddleware, requireOrgAccess(['owner', 'admin']), adoptionController.updateAdoptionStatus);

module.exports = router;