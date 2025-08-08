import express from 'express';
import { getUserNotifications, markNotificationAsRead, getUnreadCount } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/:userId', getUserNotifications);
router.put('/:notificationId/read', markNotificationAsRead);
router.get('/:userId/unread-count', getUnreadCount);

export default router; 