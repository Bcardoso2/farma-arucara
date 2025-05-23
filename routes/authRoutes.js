const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, adminAuth } = require('../middleware/auth');

// Rotas públicas
router.post('/login', authController.loginUser);

// Rotas protegidas
router.get('/me', auth, authController.getCurrentUser);

// Rotas de administrador
router.post('/register', adminAuth, authController.registerUser);
router.get('/users', adminAuth, authController.getAllUsers);
router.put('/users/:id', adminAuth, authController.updateUser);
router.delete('/users/:id', adminAuth, authController.deleteUser);

module.exports = router;