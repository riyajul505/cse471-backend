import express from 'express';
import { register, login, debugUser } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/debug/:email', debugUser); // For development debugging

export default router; 