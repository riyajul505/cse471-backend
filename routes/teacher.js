import express from 'express';
import {
  createClass,
  getTeacherClasses,
  getStudentsByLevel,
  uploadResource,
  getResourcesByLevel,
  getTeacherResources,
  getAllStudentsForTeacher
} from '../controllers/teacherController.js';

const router = express.Router();

// Class management
router.post('/create-class', createClass);
router.get('/:teacherId/classes', getTeacherClasses);
router.get('/students/level/:level', getStudentsByLevel);

// Resource management
router.post('/upload-resource', uploadResource);
router.get('/resources/level/:level', getResourcesByLevel);
router.get('/:teacherId/resources', getTeacherResources);

// Student progress monitoring
router.get('/students/all', getAllStudentsForTeacher);

export default router; 