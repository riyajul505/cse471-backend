import { Assignment, Submission } from '../models/assignmentModels.js';
import User from '../models/userModels.js';
import { createNotification } from './notificationController.js';

/**
 * Submission Management Controller - Link-based Submissions
 * Handles assignment submissions via links and student submission history
 */

/**
 * Get available assignments for student
 * GET /api/assignments/student/:studentId
 */
export const getStudentAssignments = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, subject, level } = req.query;

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found' }
      });
    }

    const targetLevel = level ? parseInt(level) : (student.selectedLevel || student.profile?.grade);
    if (!targetLevel) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_LEVEL_SELECTED', message: 'Student has not selected a learning level' }
      });
    }

    const filter = { level: targetLevel, isVisible: true };
    if (subject) filter.subject = subject;

    const assignments = await Assignment.find(filter)
      .populate('teacherId', 'profile.firstName profile.lastName email')
      .sort({ dueDate: 1 })
      .lean();

    const assignmentIds = assignments.map(a => a._id);
    const submissions = await Submission.find({ studentId, assignmentId: { $in: assignmentIds } }).sort({ versionNumber: -1 }).lean();
    const submissionMap = new Map();
    submissions.forEach(sub => { if (!submissionMap.has(sub.assignmentId.toString())) submissionMap.set(sub.assignmentId.toString(), sub); });

    const enrichedAssignments = assignments.map(assignment => {
      const submission = submissionMap.get(assignment._id.toString());
      const grade = submission?.grade;
      const now = new Date();
      const dueDate = new Date(assignment.dueDate);
      const isOverdue = now > dueDate;

      // Determine assignment status
      let assignmentStatus = 'available';
      if (submission) {
        // Check if submission has a grade with actual score data
        const hasGrade = grade && grade.totalScore !== undefined && grade.totalScore !== null;
        assignmentStatus = hasGrade ? 'graded' : 'submitted';
      } else if (isOverdue) {
        assignmentStatus = 'overdue';
      }

      // Filter by status - only return assignments matching the requested status
      if (status && assignmentStatus !== status) return null;

      return {
        id: assignment._id,
        title: assignment.title,
        description: assignment.description,
        subject: assignment.subject,
        level: assignment.level,
        dueDate: assignment.dueDate,
        totalPoints: assignment.totalPoints,
        status: assignmentStatus,
        timeRemaining: calculateTimeRemaining(dueDate),
        isOverdue: isOverdue,
        allowedFileTypes: assignment.allowedFileTypes || ['pdf', 'doc', 'docx'],
        maxFileSize: assignment.maxFileSize || 10485760,
        instructions: assignment.instructions || '',
        rubric: assignment.rubric || [],
        mySubmissions: submission ? [{
          id: submission._id,
          submissionLink: submission.submissionLink,
          submissionNotes: submission.submissionNotes || '',
          versionNumber: submission.versionNumber,
          submittedAt: submission.submittedAt,
          status: (grade && grade.totalScore !== undefined && grade.totalScore !== null) ? 'graded' : 'submitted',
          isLate: submission.isLate || false,
          grade: grade ? {
            totalScore: grade.totalScore,
            maxScore: grade.maxScore,
            percentage: grade.percentage,
            rubricScores: grade.rubricScores || [],
            overallFeedback: grade.overallFeedback || '',
            gradedBy: grade.gradedBy,
            gradedAt: grade.gradedAt
          } : null
        }] : [],
        teacher: { 
          id: assignment.teacherId._id,
          name: `${assignment.teacherId.profile.firstName} ${assignment.teacherId.profile.lastName}`, 
          email: assignment.teacherId.email 
        },
        createdAt: assignment.createdAt
      };
    }).filter(assignment => assignment !== null);

    res.status(200).json({
      success: true,
      assignments: enrichedAssignments,
      studentInfo: {
        id: student._id,
        name: `${student.profile?.firstName || ''} ${student.profile?.lastName || ''}`.trim(),
        level: targetLevel,
        pathSelected: student.pathSelected || false
      }
    });
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch assignments' }
    });
  }
};

function calculateTimeRemaining(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due - now;
  if (diff < 0) return 'Overdue';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''} remaining`;
  else if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}, ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))} minute${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) !== 1 ? 's' : ''} remaining`;
  else return `${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))} minute${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) !== 1 ? 's' : ''} remaining`;
}

/**
 * Get assignment details for student
 * GET /api/assignments/:assignmentId/student/:studentId
 */
export const getAssignmentDetailsForStudent = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;

    const assignment = await Assignment.findById(assignmentId)
      .populate('teacherId', 'profile.firstName profile.lastName email')
      .lean();

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' }
      });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found' }
      });
    }

    if (assignment.level !== student.selectedLevel) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Student does not have access to this assignment' }
      });
    }

    const submissions = await Submission.find({ assignmentId, studentId })
      .sort({ versionNumber: -1 })
      .lean();

    // Grade is now embedded in submissions, get the latest graded submission
    const grade = submissions.find(sub => sub.grade)?.grade || null;

    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    const isOverdue = now > dueDate;

    let status = 'available';
    if (submissions.length > 0) {
      status = (grade && grade.totalScore !== undefined && grade.totalScore !== null) ? 'graded' : 'submitted';
    } else if (isOverdue) {
      status = 'overdue';
    }

    res.status(200).json({
      success: true,
      assignment: {
        id: assignment._id,
        title: assignment.title,
        description: assignment.description,
        subject: assignment.subject,
        level: assignment.level,
        dueDate: assignment.dueDate,
        totalPoints: assignment.totalPoints,
        rubric: assignment.rubric,
        instructions: assignment.instructions,
        status,
        timeRemaining: calculateTimeRemaining(dueDate),
        isOverdue,
        teacher: {
          name: `${assignment.teacherId.profile.firstName} ${assignment.teacherId.profile.lastName}`,
          email: assignment.teacherId.email
        },
        createdAt: assignment.createdAt
      },
      submissions: submissions.map(submission => ({
        id: submission._id,
        versionNumber: submission.versionNumber,
        submittedAt: submission.submittedAt,
        submissionLink: submission.submissionLink,
        submissionNotes: submission.submissionNotes,
        status: (grade && grade.totalScore !== undefined && grade.totalScore !== null) ? 'graded' : 'submitted',
        isLate: submission.isLate
      })),
      grade: grade ? {
        totalScore: grade.totalScore,
        maxScore: grade.maxScore,
        percentage: grade.percentage,
        letterGrade: grade.letterGrade,
        feedback: grade.feedback,
        gradedAt: grade.gradedAt,
        rubricScores: grade.rubricScores
      } : null
    });
  } catch (error) {
    console.error('Error fetching assignment details:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch assignment details' }
    });
  }
};

/**
 * Submit Assignment via Link
 * POST /api/assignments/submit
 */
export const submitAssignment = async (req, res) => {
  console.log('📤 Assignment link submission received');
  console.log('📋 Request body:', req.body);
  
  try {
    const { 
      assignmentId, 
      studentId, 
      submissionLink, 
      submissionNotes, 
      isRevision, 
      previousSubmissionId 
    } = req.body;

    // Validation
    if (!assignmentId || !studentId || !submissionLink) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: assignmentId, studentId, or submissionLink'
      });
    }

    // Validate URL format
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(submissionLink)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format. Please provide a valid link.'
      });
    }

    // Check if assignment exists and is still accepting submissions
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }
    
    // Validate student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has access to this assignment
    if (assignment.level !== student.selectedLevel) {
      return res.status(403).json({
        success: false,
        message: 'Student does not have access to this assignment'
      });
    }
    
    // Check if assignment deadline has passed
    const now = new Date();
    const isLate = now > new Date(assignment.dueDate);

    // Calculate version number
    let versionNumber = 1;
    if (isRevision && previousSubmissionId) {
      const previousSubmission = await Submission.findById(previousSubmissionId);
      if (previousSubmission) {
        versionNumber = (previousSubmission.versionNumber || 1) + 1;
      }
    } else {
      // Check existing submissions for this assignment
      const existingSubmissions = await Submission.find({ 
        assignmentId, 
        studentId 
      }).sort({ versionNumber: -1 });
      
      if (existingSubmissions.length > 0) {
        versionNumber = existingSubmissions[0].versionNumber + 1;
      }
    }

    // Create submission record
    const submissionData = {
      assignmentId,
      studentId,
      submissionLink: submissionLink.trim(),
      submissionNotes: submissionNotes?.trim() || '',
      isRevision: !!isRevision,
      previousSubmissionId: isRevision ? previousSubmissionId : null,
      versionNumber,
      submittedAt: now,
      status: 'submitted',
      isLate
    };

    console.log('💾 Creating link submission:', submissionData);

    // Save to database
    const savedSubmission = await Submission.create(submissionData);
    
    console.log('✅ Link submission saved successfully');

    // Create notifications
    try {
      // Notify teacher
      await createNotification({
        userId: assignment.teacherId,
        type: 'assignment_submitted',
        message: `New submission received for "${assignment.title}" from ${student.profile?.firstName || 'Student'}`,
        data: {
          assignmentId,
          studentId,
          submissionId: savedSubmission._id,
          versionNumber,
          isLate,
          submissionLink,
          assignment: {
            title: assignment.title,
            dueDate: assignment.dueDate
          },
          student: {
            name: `${student.profile?.firstName || ''} ${student.profile?.lastName || ''}`.trim(),
            email: student.email
          }
        },
        link: `/teacher/assignments/${assignmentId}/submissions`
      });

      // Notify parent if student has parent
      if (student.parentId) {
        await createNotification({
          userId: student.parentId,
          type: 'assignment_submitted',
          message: `${student.profile?.firstName || 'Your child'} submitted "${assignment.title}"${isLate ? ' (Late)' : ''}`,
          data: {
            assignmentId,
            studentId,
            submissionId: savedSubmission._id,
            isLate,
            submissionLink,
            assignment: {
              title: assignment.title,
              dueDate: assignment.dueDate
            }
          },
          link: `/parent/child/${studentId}/assignments`
        });
      }
    } catch (notifError) {
      console.error('Error creating notifications:', notifError);
      // Don't fail submission if notification fails
    }

    res.json({
      success: true,
      message: isRevision ? 'New version submitted successfully' : 'Assignment submitted successfully',
      submission: {
        id: savedSubmission._id,
        assignmentId: savedSubmission.assignmentId,
        studentId: savedSubmission.studentId,
        submissionLink: savedSubmission.submissionLink,
        submissionNotes: savedSubmission.submissionNotes,
        versionNumber: savedSubmission.versionNumber,
        submittedAt: savedSubmission.submittedAt,
        status: savedSubmission.status,
        isLate: savedSubmission.isLate
      }
    });

  } catch (error) {
    console.error('❌ Assignment submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during submission',
      error: error.message
    });
  }
};

/**
 * Get student's submission history
 * GET /api/assignments/student/:studentId/submissions
 */
export const getStudentSubmissionHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { assignmentId, status } = req.query;

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found' }
      });
    }

    let submissionFilter = { studentId };
    if (assignmentId) submissionFilter.assignmentId = assignmentId;

    const submissions = await Submission.find(submissionFilter)
      .populate({
        path: 'assignmentId',
        select: 'title subject level dueDate totalPoints',
        populate: {
          path: 'teacherId',
          select: 'profile.firstName profile.lastName email'
        }
      })
      .sort({ submittedAt: -1 })
      .lean();

    // Format submissions (grades are now embedded)
    const formattedSubmissions = submissions.map(submission => {
      const grade = submission.grade; // Grade is embedded in submission
      
      // Filter by status if requested
      const submissionStatus = (grade && grade.totalScore !== undefined && grade.totalScore !== null) ? 'graded' : submission.status;
      if (status && status !== submissionStatus) {
        return null;
      }

      return {
        id: submission._id,
        versionNumber: submission.versionNumber,
        submissionLink: submission.submissionLink,
        submissionNotes: submission.submissionNotes,
        submittedAt: submission.submittedAt,
        status: submissionStatus,
        isLate: submission.isLate,
        assignment: {
          id: submission.assignmentId._id,
          title: submission.assignmentId.title,
          subject: submission.assignmentId.subject,
          level: submission.assignmentId.level,
          dueDate: submission.assignmentId.dueDate,
          totalPoints: submission.assignmentId.totalPoints,
          teacher: {
            name: `${submission.assignmentId.teacherId.profile.firstName} ${submission.assignmentId.teacherId.profile.lastName}`,
            email: submission.assignmentId.teacherId.email
          }
        },
        grade: grade ? {
          totalScore: grade.totalScore,
          maxScore: grade.maxScore,
          percentage: grade.percentage,
          letterGrade: grade.letterGrade,
          feedback: grade.feedback,
          gradedAt: grade.gradedAt
        } : null
      };
    }).filter(submission => submission !== null);

    res.status(200).json({
      success: true,
      submissions: formattedSubmissions,
      studentInfo: {
        id: student._id,
        name: `${student.profile?.firstName || ''} ${student.profile?.lastName || ''}`.trim(),
        level: student.selectedLevel
      }
    });
  } catch (error) {
    console.error('Error fetching submission history:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch submission history' }
    });
  }
};
