const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/auth');

router.get('/feed', authMiddleware, postController.getFeed);
router.post('/', authMiddleware, postController.createPost);
router.post('/:postId/like', authMiddleware, postController.toggleLike);
router.post('/:postId/comments', authMiddleware, postController.addComment);

module.exports = router;