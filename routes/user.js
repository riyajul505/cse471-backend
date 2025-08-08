import express from 'express';
import { addChildToParent, getParentChildren, selectPath, getPathStatus } from '../controllers/userController.js';

const router = express.Router();

router.post('/add-child', addChildToParent);
router.get('/parent/:parentId/children', getParentChildren);
router.post('/select-path', selectPath);
router.get('/path-status/:studentId', getPathStatus);

export default router; 