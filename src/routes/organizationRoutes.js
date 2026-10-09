// src/routes/organizationRoutes.js
const express = require('express');
const router = express.Router();
const orgController = require('../controllers/organizationController');
const donationController = require('../controllers/donationController');
const { authMiddleware, requirePlatformAdmin, requireOrgAccess } = require('../middlewares/auth');

// Rotas Públicas
router.get('/', orgController.getApprovedOrganizations);
router.get('/:id', orgController.getPublicOrganizationById);
router.get('/:id/donation-info', donationController.getDonationInfo);

// Rotas do Administrador/Responsável da ONG
router.post('/', authMiddleware, orgController.createOrganization);
router.get('/me/profile', authMiddleware, orgController.getMyOrganization);
router.patch('/me/profile', authMiddleware, requireOrgAccess(['owner', 'admin']), orgController.updateMyOrganization);

// Gerenciamento de Pix da ONG
router.put('/me/donation-info', authMiddleware, requireOrgAccess(['owner', 'admin']), donationController.upsertDonationInfo);
router.delete('/me/donation-info', authMiddleware, requireOrgAccess(['owner', 'admin']), donationController.removeDonationInfo);

// Rotas do Administrador da Plataforma (Moderação)
router.get('/admin/list', authMiddleware, requirePlatformAdmin, orgController.adminListOrganizations);
router.patch('/admin/:id/verify', authMiddleware, requirePlatformAdmin, orgController.adminVerifyOrganization);

module.exports = router;