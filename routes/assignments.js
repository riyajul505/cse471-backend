import express from 'express';
import { 
  createAssignment, 
  getTeacherAssignments, 
  getAssignmentWithSubmissions, 
  gradeSubmission 
} from '../controllers/assignmentController.js';
import {
  getStudentAssignments,
  getAssignmentDetailsForStudent,
  submitAssignment,
  getStudentSubmissionHistory
} from '../controllers/submissionController.js';
import { Assignment } from '../models/assignmentModels.js';

const router = express.Router();

// No middleware needed for link-based submissions

// Assignment Management Routes (Teacher)

/**
 * Create Assignment
 * POST /api/assignments/create
 */
router.post('/create', createAssignment);

/**
 * Get Teacher's Assignments
 * GET /api/assignments/teacher/:teacherId
 * Query params: status, subject, level, page, limit
 */
router.get('/teacher/:teacherId', getTeacherAssignments);

/**
 * Get Assignment Details with Submissions
 * GET /api/assignments/:assignmentId/submissions
 */
router.get('/:assignmentId/submissions', getAssignmentWithSubmissions);

/**
 * Grade Submission
 * POST /api/assignments/grade
 */
router.post('/grade', gradeSubmission);

// Student Assignment Routes

/**
 * Get Available Assignments for Student
 * GET /api/assignments/student/:studentId
 * Query params: status, subject
 */
router.get('/student/:studentId', getStudentAssignments);

/**
 * Get Assignment Details for Student
 * GET /api/assignments/:assignmentId/student/:studentId
 */
router.get('/:assignmentId/student/:studentId', getAssignmentDetailsForStudent);

/**
 * Submit Assignment
 * POST /api/assignments/submit  
 * JSON-based link submission
 */
router.post('/submit', submitAssignment);

/**
 * Get Student's Submission History
 * GET /api/assignments/student/:studentId/submissions
 * Query params: assignmentId, status
 */
router.get('/student/:studentId/submissions', getStudentSubmissionHistory);

// No file upload routes needed for link-based submissions

export default router;
