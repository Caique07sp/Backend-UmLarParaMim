const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middlewares/auth');

router.post('/conversations', authMiddleware, chatController.startConversation);
router.get('/conversations', authMiddleware, chatController.getConversations);
router.get('/conversations/:id/messages', authMiddleware, chatController.getMessages);
router.post('/conversations/:id/messages', authMiddleware, chatController.sendMessage);

module.exports = router;