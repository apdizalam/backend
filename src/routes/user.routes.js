const express = require('express');
const router = express.Router();
const { getManagers, deleteUser, updateProfile } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// GET /api/users/managers
router.get('/managers', getManagers);

// PUT /api/users/profile - Update user profile
router.put('/profile', protect, upload.single('image'), updateProfile);

// DELETE /api/users/:id
router.delete('/:id', protect, deleteUser);

module.exports = router;
