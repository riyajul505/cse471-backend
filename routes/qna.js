import express from 'express';
import { getLevelMessages, sendStudentMessage, sendTeacherMessage, deleteStudentMessage } from '../controllers/qnaController.js';

const router = express.Router();

// Get messages by level with pagination
router.get('/level/:level', getLevelMessages);

// Send student message
router.post('/send', sendStudentMessage);

// Send teacher message
router.post('/send-teacher', sendTeacherMessage);

// Delete message (works for both student and teacher messages)
router.delete('/messages/:messageId', deleteStudentMessage);

export default router;
