import express from 'express';
import {
  createLabSlot,
  updateLabSlot,
  deleteLabSlot,
  getAvailableLabSlots,
  createLabBooking,
  cancelLabBooking,
  getStudentBookings,
  getSlotBookings,
  getTeacherSlots
} from '../controllers/labController.js';

const router = express.Router();

// Teacher routes
router.post('/slots', createLabSlot);
router.put('/slots/:slotId', updateLabSlot);
router.delete('/slots/:slotId', deleteLabSlot);
router.get('/slots/:slotId/bookings', getSlotBookings);
router.get('/teacher/:teacherId/slots', getTeacherSlots);

// Student routes
router.get('/slots/available/:level', getAvailableLabSlots);
router.post('/bookings', createLabBooking);
router.delete('/bookings/:bookingId', cancelLabBooking);
router.get('/bookings/student/:studentId', getStudentBookings);

export default router;
