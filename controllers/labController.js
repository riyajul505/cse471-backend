import { LabSlot, LabBooking } from '../models/labModels.js';
import User from '../models/userModels.js';

/**
 * Create Lab Slot (Teacher)
 * POST /api/lab-slots
 */
export const createLabSlot = async (req, res) => {
  try {
    const { teacherId, level, date, startTime, endTime, location, maxStudents, topic, description } = req.body;

    // Validation
    if (!teacherId || !level || !date || !startTime || !endTime || !location || !maxStudents || !topic) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields'
        }
      });
    }

    // Validate teacher exists
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEACHER_NOT_FOUND',
          message: 'Teacher not found'
        }
      });
    }

    // Validate date is not in the past
    const slotDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (slotDate < today) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATE',
          message: 'Cannot create slots for past dates'
        }
      });
    }

    // Create lab slot
    const labSlot = new LabSlot({
      teacherId,
      level: parseInt(level),
      date,
      startTime,
      endTime,
      location,
      maxStudents: parseInt(maxStudents),
      topic,
      description: description || ''
    });

    const savedSlot = await labSlot.save();

    // Populate teacher info
    await savedSlot.populate('teacherId', 'profile.firstName profile.lastName');

    res.status(201).json({
      success: true,
      message: 'Lab slot created successfully',
      data: {
        slot: {
          id: savedSlot._id.toString(),
          teacherId: savedSlot.teacherId._id.toString(),
          teacherName: `${savedSlot.teacherId.profile?.firstName || ''} ${savedSlot.teacherId.profile?.lastName || ''}`.trim(),
          level: savedSlot.level,
          date: savedSlot.date,
          startTime: savedSlot.startTime,
          endTime: savedSlot.endTime,
          location: savedSlot.location,
          maxStudents: savedSlot.maxStudents,
          topic: savedSlot.topic,
          description: savedSlot.description,
          status: savedSlot.status,
          createdAt: savedSlot.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error creating lab slot:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAB_SLOT_CREATION_FAILED',
        message: 'Failed to create lab slot',
        details: error.message
      }
    });
  }
};

/**
 * Update Lab Slot (Teacher)
 * PUT /api/lab-slots/:slotId
 */
export const updateLabSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const updateData = req.body;

    // Find the slot
    const slot = await LabSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SLOT_NOT_FOUND',
          message: 'Lab slot not found'
        }
      });
    }

    // Check if slot has bookings
    const bookings = await LabBooking.find({ slotId, status: 'confirmed' });
    if (bookings.length > 0) {
      // If updating maxStudents, ensure it's not less than current bookings
      if (updateData.maxStudents && updateData.maxStudents < bookings.length) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MAX_STUDENTS',
            message: `Cannot reduce max students below ${bookings.length} (current bookings)`
          }
        });
      }
    }

    // Update the slot
    const updatedSlot = await LabSlot.findByIdAndUpdate(
      slotId,
      updateData,
      { new: true, runValidators: true }
    ).populate('teacherId', 'profile.firstName profile.lastName');

    res.status(200).json({
      success: true,
      message: 'Lab slot updated successfully',
      data: {
        slot: {
          id: updatedSlot._id.toString(),
          teacherId: updatedSlot.teacherId._id.toString(),
          teacherName: `${updatedSlot.teacherId.profile?.firstName || ''} ${updatedSlot.teacherId.profile?.lastName || ''}`.trim(),
          level: updatedSlot.level,
          date: updatedSlot.date,
          startTime: updatedSlot.startTime,
          endTime: updatedSlot.endTime,
          location: updatedSlot.location,
          maxStudents: updatedSlot.maxStudents,
          topic: updatedSlot.topic,
          description: updatedSlot.description,
          status: updatedSlot.status,
          updatedAt: updatedSlot.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating lab slot:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAB_SLOT_UPDATE_FAILED',
        message: 'Failed to update lab slot',
        details: error.message
      }
    });
  }
};

/**
 * Delete Lab Slot (Teacher)
 * DELETE /api/lab-slots/:slotId
 */
export const deleteLabSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    

    // Find the slot
    const slot = await LabSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SLOT_NOT_FOUND',
          message: 'Lab slot not found'
        }
      });
    }

    // Check if slot has confirmed bookings
    const bookings = await LabBooking.find({ slotId, status: 'confirmed' });
    if (bookings.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SLOT_HAS_BOOKINGS',
          message: 'Cannot delete slot with confirmed bookings'
        }
      });
    }

    // Delete the slot and all its bookings
    await LabSlot.findByIdAndDelete(slotId);
    await LabBooking.deleteMany({ slotId });

    res.status(200).json({
      success: true,
      message: 'Lab slot deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting lab slot:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAB_SLOT_DELETION_FAILED',
        message: 'Failed to delete lab slot',
        details: error.message
      }
    });
  }
};

/**
 * Get Available Lab Slots
 * GET /api/lab-slots/available/:level
 */
export const getAvailableLabSlots = async (req, res) => {
  try {
    const { level } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get active slots for the level
    const slots = await LabSlot.find({
      level: parseInt(level),
      status: 'active',
      date: { $gte: new Date().toISOString().split('T')[0] } // Only future dates
    })
    .populate('teacherId', 'profile.firstName profile.lastName')
    .sort({ date: 1, startTime: 1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

    // Get total count
    const totalItems = await LabSlot.countDocuments({
      level: parseInt(level),
      status: 'active',
      date: { $gte: new Date().toISOString().split('T')[0] }
    });

    // Get booking counts for each slot
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        const bookingCount = await LabBooking.countDocuments({
          slotId: slot._id,
          status: 'confirmed'
        });

        return {
          id: slot._id.toString(),
          teacherId: slot.teacherId._id.toString(),
          teacherName: `${slot.teacherId.profile?.firstName || ''} ${slot.teacherId.profile?.lastName || ''}`.trim(),
          level: slot.level,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          location: slot.location,
          maxStudents: slot.maxStudents,
          currentBookings: bookingCount,
          availableSpots: slot.maxStudents - bookingCount,
          topic: slot.topic,
          description: slot.description,
          status: slot.status,
          createdAt: slot.createdAt
        };
      })
    );

    const totalPages = Math.ceil(totalItems / limitNum);

    res.status(200).json({
      success: true,
      data: {
        slots: slotsWithBookings,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error getting available lab slots:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAB_SLOTS_FETCH_FAILED',
        message: 'Failed to fetch lab slots',
        details: error.message
      }
    });
  }
};

/**
 * Create Lab Booking (Student)
 * POST /api/lab-bookings
 */
export const createLabBooking = async (req, res) => {
  try {
    const { slotId, studentId, bookingNotes } = req.body;

    // Validation
    if (!slotId || !studentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: slotId, studentId'
        }
      });
    }

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STUDENT_NOT_FOUND',
          message: 'Student not found'
        }
      });
    }

    // Validate slot exists and is active
    const slot = await LabSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SLOT_NOT_FOUND',
          message: 'Lab slot not found'
        }
      });
    }

    if (slot.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SLOT_NOT_ACTIVE',
          message: 'Lab slot is not active'
        }
      });
    }

    // Check if slot is full
    const currentBookings = await LabBooking.countDocuments({
      slotId,
      status: 'confirmed'
    });

    if (currentBookings >= slot.maxStudents) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SLOT_FULL',
          message: 'Lab slot is full'
        }
      });
    }

    // Check if student already has a booking for this slot
    const existingBooking = await LabBooking.findOne({
      slotId,
      studentId,
      status: { $in: ['confirmed', 'completed'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_BOOKED',
          message: 'Student already has a booking for this slot'
        }
      });
    }

    // Create booking
    const booking = new LabBooking({
      slotId,
      studentId,
      bookingNotes: bookingNotes || ''
    });

    const savedBooking = await booking.save();

    // Populate student and slot info
    await savedBooking.populate('studentId', 'profile.firstName profile.lastName');
    await savedBooking.populate('slotId');

    res.status(201).json({
      success: true,
      message: 'Lab booking created successfully',
      data: {
        booking: {
          id: savedBooking._id.toString(),
          slotId: savedBooking.slotId._id.toString(),
          studentId: savedBooking.studentId._id.toString(),
          studentName: `${savedBooking.studentId.profile?.firstName || ''} ${savedBooking.studentId.profile?.lastName || ''}`.trim(),
          bookingNotes: savedBooking.bookingNotes,
          status: savedBooking.status,
          createdAt: savedBooking.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error creating lab booking:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAB_BOOKING_CREATION_FAILED',
        message: 'Failed to create lab booking',
        details: error.message
      }
    });
  }
};

/**
 * Cancel Lab Booking (Student)
 * DELETE /api/lab-bookings/:bookingId
 */
export const cancelLabBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { studentId } = req.body;
    

    // Validation
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_STUDENT_ID',
          message: 'Missing studentId in request body'
        }
      });
    }

    // Find the booking
    const booking = await LabBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Lab booking not found'
        }
      });
    }

    // Check if student owns the booking
    if (booking.studentId.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You can only cancel your own bookings'
        }
      });
    }

    // Check if booking can be cancelled
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BOOKING_NOT_CANCELLABLE',
          message: 'Booking cannot be cancelled'
        }
      });
    }

    // Cancel the booking
    booking.status = 'cancelled';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Lab booking cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling lab booking:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAB_BOOKING_CANCELLATION_FAILED',
        message: 'Failed to cancel lab booking',
        details: error.message
      }
    });
  }
};

/**
 * Get Student's Bookings
 * GET /api/lab-bookings/student/:studentId
 */
export const getStudentBookings = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get bookings for the student
    const bookings = await LabBooking.find({ studentId })
    .populate('slotId')
    .populate('studentId', 'profile.firstName profile.lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

    // Get total count
    const totalItems = await LabBooking.countDocuments({ studentId });

    // Format bookings
    const formattedBookings = bookings.map(booking => ({
      id: booking._id.toString(),
      slotId: booking.slotId._id.toString(),
      studentId: booking.studentId._id.toString(),
      studentName: `${booking.studentId.profile?.firstName || ''} ${booking.studentId.profile?.lastName || ''}`.trim(),
      bookingNotes: booking.bookingNotes,
      status: booking.status,
      createdAt: booking.createdAt,
      slot: {
        id: booking.slotId._id.toString(),
        level: booking.slotId.level,
        date: booking.slotId.date,
        startTime: booking.slotId.startTime,
        endTime: booking.slotId.endTime,
        location: booking.slotId.location,
        topic: booking.slotId.topic,
        description: booking.slotId.description
      }
    }));

    const totalPages = Math.ceil(totalItems / limitNum);

    res.status(200).json({
      success: true,
      data: {
        bookings: formattedBookings,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error getting student bookings:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STUDENT_BOOKINGS_FETCH_FAILED',
        message: 'Failed to fetch student bookings',
        details: error.message
      }
    });
  }
};

/**
 * Get Slot Bookings (Teacher)
 * GET /api/lab-slots/:slotId/bookings
 */
export const getSlotBookings = async (req, res) => {
  try {
    const { slotId } = req.params;

    // Validate slot exists
    const slot = await LabSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SLOT_NOT_FOUND',
          message: 'Lab slot not found'
        }
      });
    }

    // Get all bookings for the slot
    const bookings = await LabBooking.find({ slotId })
    .populate('studentId', 'profile.firstName profile.lastName')
    .sort({ createdAt: 1 })
    .lean();

    // Format bookings
    const formattedBookings = bookings.map(booking => ({
      id: booking._id.toString(),
      studentId: booking.studentId._id.toString(),
      studentName: `${booking.studentId.profile?.firstName || ''} ${booking.studentId.profile?.lastName || ''}`.trim(),
      bookingNotes: booking.bookingNotes,
      status: booking.status,
      createdAt: booking.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        bookings: formattedBookings
      }
    });

  } catch (error) {
    console.error('Error getting slot bookings:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SLOT_BOOKINGS_FETCH_FAILED',
        message: 'Failed to fetch slot bookings',
        details: error.message
      }
    });
  }
};

/**
 * Get Teacher's Lab Slots
 * GET /api/lab/teacher/:teacherId/slots
 */
export const getTeacherSlots = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = { teacherId };
    if (status) {
      query.status = status;
    }

    // Get teacher's slots
    const slots = await LabSlot.find(query)
    .populate('teacherId', 'profile.firstName profile.lastName')
    .sort({ date: 1, startTime: 1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

    // Get total count
    const totalItems = await LabSlot.countDocuments(query);

    // Get booking counts for each slot
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        const bookingCount = await LabBooking.countDocuments({
          slotId: slot._id,
          status: 'confirmed'
        });

        return {
          id: slot._id.toString(),
          teacherId: slot.teacherId._id.toString(),
          teacherName: `${slot.teacherId.profile?.firstName || ''} ${slot.teacherId.profile?.lastName || ''}`.trim(),
          level: slot.level,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          location: slot.location,
          maxStudents: slot.maxStudents,
          currentBookings: bookingCount,
          availableSpots: slot.maxStudents - bookingCount,
          topic: slot.topic,
          description: slot.description,
          status: slot.status,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt
        };
      })
    );

    const totalPages = Math.ceil(totalItems / limitNum);

    res.status(200).json({
      success: true,
      data: {
        slots: slotsWithBookings,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error getting teacher slots:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEACHER_SLOTS_FETCH_FAILED',
        message: 'Failed to fetch teacher slots',
        details: error.message
      }
    });
  }
};
