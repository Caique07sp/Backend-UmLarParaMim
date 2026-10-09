// src/routes/petRoutes.js
const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const { authMiddleware } = require('../middlewares/auth');

// Rotas públicas
router.get('/', petController.getAllPets);

// Rotas privadas
router.get('/my-pets', authMiddleware, petController.getMyPets);
router.post('/', authMiddleware, petController.createPet);
router.put('/:id', authMiddleware, petController.updatePet);
router.delete('/:id', authMiddleware, petController.deletePet);

module.exports = router;