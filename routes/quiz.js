import express from 'express';
import { 
  saveQuizResult, 
  getQuizHistory, 
  getStudentAchievements,
  saveAchievement,
  getWeakQuizAttempts
} from '../controllers/quizController.js';

const router = express.Router();

// Quiz result management
router.post('/save-result', saveQuizResult);
router.get('/history/:studentId', getQuizHistory);
router.get('/achievements/:studentId', getStudentAchievements);
router.post('/save-achievement', saveAchievement); 
// Weak attempts (<30%) filtered by resourceId or resourceTitle
router.get('/weak/:studentId', getWeakQuizAttempts);

export default router; 