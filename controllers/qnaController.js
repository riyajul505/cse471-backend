import { QnaMessage } from '../models/qnaModels.js';
import User from '../models/userModels.js';

/**
 * Get messages by level with pagination
 * GET /api/qna/level/:level
 */
export const getLevelMessages = async (req, res) => {
  try {
    const { level } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get main messages (not replies) for this level
    const mainMessages = await QnaMessage.find({
      level: parseInt(level),
      replyToId: null
    })
    .populate('studentId', 'profile.firstName profile.lastName')
    .populate('teacherId', 'profile.firstName profile.lastName')
    .sort({ timestamp: 1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

    // Get total count for pagination
    const totalItems = await QnaMessage.countDocuments({
      level: parseInt(level),
      replyToId: null
    });

    // Get replies for each main message
    const messagesWithReplies = await Promise.all(
      mainMessages.map(async (message) => {
        const replies = await QnaMessage.find({
          threadId: message._id
        })
        .populate('teacherId', 'profile.firstName profile.lastName')
        .populate('studentId', 'profile.firstName profile.lastName')
        .sort({ timestamp: 1 })
        .lean();

        const formattedReplies = replies.map(reply => ({
          id: reply._id.toString(),
          teacherId: reply.teacherId?._id?.toString() || null,
          teacherName: reply.teacherId ? 
            `${reply.teacherId.profile?.firstName || ''} ${reply.teacherId.profile?.lastName || ''}`.trim() : null,
          teacherAvatar: reply.teacherId ? "👨‍🏫" : null,
          content: reply.content,
          timestamp: reply.timestamp,
          isTeacher: reply.isTeacher,
          replyToId: reply.replyToId?.toString() || null,
          threadId: reply.threadId?.toString() || null,
          isGeneralMessage: reply.isGeneralMessage || false
        }));

        return {
          id: message._id.toString(),
          studentId: message.studentId?._id?.toString() || null,
          studentName: message.studentId ? 
            `${message.studentId.profile?.firstName || ''} ${message.studentId.profile?.lastName || ''}`.trim() : null,
          studentAvatar: message.studentId ? "👩‍🎓" : null,
          teacherId: message.teacherId?._id?.toString() || null,
          teacherName: message.teacherId ? 
            `${message.teacherId.profile?.firstName || ''} ${message.teacherId.profile?.lastName || ''}`.trim() : null,
          teacherAvatar: message.teacherId ? "👨‍🏫" : null,
          content: message.content,
          timestamp: message.timestamp,
          isTeacher: message.isTeacher,
          level: message.level,
          replyToId: message.replyToId?.toString() || null,
          threadId: message.threadId?.toString() || message._id.toString(),
          isGeneralMessage: message.isGeneralMessage || false,
          replies: formattedReplies
        };
      })
    );

    const totalPages = Math.ceil(totalItems / limitNum);

    res.status(200).json({
      success: true,
      data: {
        messages: messagesWithReplies,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error getting level messages:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LEVEL_MESSAGES_FETCH_FAILED',
        message: 'Failed to fetch level messages',
        details: error.message
      }
    });
  }
};

/**
 * Send student message
 * POST /api/qna/send
 */
export const sendStudentMessage = async (req, res) => {
  try {
    const { studentId, content, level, replyToId } = req.body;

    // Validation
    if (!studentId || !content || !level) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: studentId, content, level'
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

    // Validate replyToId if provided
    let threadId = null;
    if (replyToId) {
      const parentMessage = await QnaMessage.findById(replyToId);
      if (!parentMessage) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PARENT_MESSAGE_NOT_FOUND',
            message: 'Parent message not found'
          }
        });
      }
      threadId = parentMessage.threadId || parentMessage._id;
    }

    // Create message
    const message = new QnaMessage({
      studentId,
      content,
      level: parseInt(level),
      replyToId: replyToId || null,
      threadId: threadId || null
    });

    const savedMessage = await message.save();

    // Populate student info for response
    await savedMessage.populate('studentId', 'profile.firstName profile.lastName');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: {
          id: savedMessage._id.toString(),
          studentId: savedMessage.studentId._id.toString(),
          studentName: `${savedMessage.studentId.profile?.firstName || ''} ${savedMessage.studentId.profile?.lastName || ''}`.trim(),
          content: savedMessage.content,
          timestamp: savedMessage.timestamp,
          isTeacher: false,
          level: savedMessage.level,
          replyToId: savedMessage.replyToId?.toString() || null,
          threadId: savedMessage.threadId?.toString() || savedMessage._id.toString(),
          replies: []
        }
      }
    });

  } catch (error) {
    console.error('Error sending student message:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MESSAGE_SEND_FAILED',
        message: 'Failed to send message',
        details: error.message
      }
    });
  }
};

/**
 * Send teacher message
 * POST /api/qna/send-teacher
 */
export const sendTeacherMessage = async (req, res) => {
  try {
    const { teacherId, content, level, replyToId, isGeneralMessage = false } = req.body;

    // Validation
    if (!teacherId || !content || !level) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: teacherId, content, level'
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

    // Validate level range (1-10)
    const levelNum = parseInt(level);
    if (levelNum < 1 || levelNum > 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LEVEL',
          message: 'Level must be between 1 and 10'
        }
      });
    }

    // Validate replyToId if provided
    let threadId = null;
    if (replyToId) {
      const parentMessage = await QnaMessage.findById(replyToId);
      if (!parentMessage) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PARENT_MESSAGE_NOT_FOUND',
            message: 'Parent message not found'
          }
        });
      }
      threadId = parentMessage.threadId || parentMessage._id;
    }

    // Create message
    const message = new QnaMessage({
      teacherId,
      content,
      level: levelNum,
      replyToId: replyToId || null,
      threadId: threadId || null,
      isGeneralMessage: isGeneralMessage
    });

    const savedMessage = await message.save();

    // Populate teacher info for response
    await savedMessage.populate('teacherId', 'profile.firstName profile.lastName');

    res.status(201).json({
      success: true,
      message: 'Teacher message sent successfully',
      data: {
        message: {
          id: savedMessage._id.toString(),
          teacherId: savedMessage.teacherId._id.toString(),
          teacherName: `${savedMessage.teacherId.profile?.firstName || ''} ${savedMessage.teacherId.profile?.lastName || ''}`.trim(),
          content: savedMessage.content,
          timestamp: savedMessage.timestamp,
          isTeacher: true,
          level: savedMessage.level,
          replyToId: savedMessage.replyToId?.toString() || null,
          threadId: savedMessage.threadId?.toString() || savedMessage._id.toString(),
          isGeneralMessage: savedMessage.isGeneralMessage,
          replies: []
        }
      }
    });

  } catch (error) {
    console.error('Error sending teacher message:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEACHER_MESSAGE_SEND_FAILED',
        message: 'Failed to send teacher message',
        details: error.message
      }
    });
  }
};

/**
 * Delete student message
 * DELETE /api/qna/messages/:messageId
 */
export const deleteStudentMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'Missing userId in request body'
        }
      });
    }

    // Find message
    const message = await QnaMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'Message not found'
        }
      });
    }

    // Check if user owns the message
    if (message.studentId?.toString() !== userId && message.teacherId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You can only delete your own messages'
        }
      });
    }

    // Delete the message and all its replies
    await QnaMessage.deleteMany({
      $or: [
        { _id: messageId },
        { threadId: messageId }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MESSAGE_DELETE_FAILED',
        message: 'Failed to delete message',
        details: error.message
      }
    });
  }
};
