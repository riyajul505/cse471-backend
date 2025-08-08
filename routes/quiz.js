import express from 'express';
import { 
  saveQuizResult, 
  getQuizHistory, 
  getStudentAchievements,
  saveAchievement
} from '../controllers/quizController.js';

const router = express.Router();

// Quiz result management
router.post('/save-result', saveQuizResult);
router.get('/history/:studentId', getQuizHistory);
router.get('/achievements/:studentId', getStudentAchievements);
router.post('/save-achievement', saveAchievement); 

export default router; 