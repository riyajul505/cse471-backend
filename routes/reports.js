import express from 'express';
import { getStudentPerformanceReport } from '../controllers/reportController.js';

const router = express.Router();

// Parent downloads child's performance report (PDF)
// GET /api/reports/student/:studentId
router.get('/student/:studentId', getStudentPerformanceReport);

export default router;


