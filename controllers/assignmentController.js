import { Assignment, Submission, calculateLetterGrade } from '../models/assignmentModels.js';
import User from '../models/userModels.js';
import Class from '../models/classModels.js';
import { createNotification } from './notificationController.js';

/**
 * Assignment Management Controller
 * Handles assignment creation, viewing, and management for teachers
 */

/**
 * Create a new assignment
 * POST /api/assignments/create
 */
export const createAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      instructions,
      subject,
      level,
      dueDate,
      totalPoints,
      rubric,
      allowedFileTypes,
      maxFileSize,
      isVisible,
      teacherId,
      classIds
    } = req.body;

    console.log('Creating assignment:', req.body);

    // Validation
    if (!title || !description || !subject || !level || !dueDate || !totalPoints || !teacherId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: title, description, subject, level, dueDate, totalPoints, teacherId'
        }
      });
    }

    // Validate due date
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 minute ago for lenient testing

    if (dueDateObj <= oneMinuteAgo) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DUE_DATE', message: 'Due date must be in the future' }
      });
    }

    // Validate teacher
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        error: { code: 'TEACHER_NOT_FOUND', message: 'Teacher not found' }
      });
    }

    // Validate rubric if provided
    if (rubric && rubric.length > 0) {
      const rubricTotal = rubric.reduce((sum, item) => sum + item.maxPoints, 0);
      if (rubricTotal !== totalPoints) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RUBRIC_TOTAL_MISMATCH',
            message: `Rubric total (${rubricTotal}) must equal assignment total points (${totalPoints})`
          }
        });
      }
    }

    // Create assignment
    const assignment = new Assignment({
      title,
      description,
      instructions: instructions || '',
      subject,
      level,
      dueDate: dueDateObj,
      totalPoints,
      rubric: rubric || [],
      allowedFileTypes: allowedFileTypes || ['pdf', 'doc', 'docx', 'ppt', 'pptx'],
      maxFileSize: maxFileSize || 10485760, // 10MB default
      isVisible: isVisible !== false, // Default to true
      teacherId
    });

    const savedAssignment = await assignment.save();

    // Auto-enroll students based on level if no specific classes provided
    let studentsNotified = 0;
    if (!classIds || classIds.length === 0) {
      try {
        // Find all students at this level
        const studentsAtLevel = await User.find({
          role: 'student',
          selectedLevel: level
        });

        console.log(`Found ${studentsAtLevel.length} students at level ${level} for auto-notification`);

        // Send notifications to all students at this level
        for (const student of studentsAtLevel) {
          try {
            await createNotification({
              userId: student._id,
              type: 'assignment_created',
              message: `New assignment available: "${title}" (Level ${level})`,
              data: {
                assignmentId: savedAssignment._id,
                assignmentTitle: title,
                subject,
                level,
                dueDate: dueDateObj,
                teacherName: `${teacher.profile?.firstName || ''} ${teacher.profile?.lastName || ''}`.trim()
              },
              link: `/student/assignments/${savedAssignment._id}`
            });
            studentsNotified++;
          } catch (notifError) {
            console.error(`Error notifying student ${student._id}:`, notifError);
          }
        }
      } catch (error) {
        console.error('Error with auto-enrollment notifications:', error);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      assignment: {
        id: savedAssignment._id,
        title: savedAssignment.title,
        description: savedAssignment.description,
        subject: savedAssignment.subject,
        level: savedAssignment.level,
        dueDate: savedAssignment.dueDate,
        totalPoints: savedAssignment.totalPoints,
        isVisible: savedAssignment.isVisible,
        createdAt: savedAssignment.createdAt,
        studentsNotified
      }
    });

  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSIGNMENT_CREATION_FAILED',
        message: 'Failed to create assignment',
        details: error.message
      }
    });
  }
};

/**
 * Get assignments for teacher
 * GET /api/assignments/teacher/:teacherId
 */
export const getTeacherAssignments = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status, subject, level } = req.query;

    console.log('Getting assignments for teacher:', teacherId, 'with filters:', req.query);

    // Validate teacher
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        error: { code: 'TEACHER_NOT_FOUND', message: 'Teacher not found' }
      });
    }

    // Build filter
    const filter = { teacherId };
    if (subject) filter.subject = subject;
    if (level) filter.level = parseInt(level);

    // Get assignments
    const assignments = await Assignment.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Calculate submission statistics and filter by status
    const now = new Date();
    const assignmentsWithStats = await Promise.all(
      assignments.map(async (assignment) => {
        // Calculate assignment status
        let assignmentStatus;
        if (!assignment.isVisible) {
          assignmentStatus = 'draft';
        } else if (now > assignment.dueDate) {
          assignmentStatus = 'closed';
        } else {
          assignmentStatus = 'active';
        }

        // Filter by status if provided
        if (status && assignmentStatus !== status) {
          return null;
        }

        // Get submission statistics
        const totalStudents = await User.countDocuments({
          role: 'student',
          selectedLevel: assignment.level
        });

        const submissions = await Submission.find({ assignmentId: assignment._id }).lean();
        const uniqueStudents = [...new Set(submissions.map(s => s.studentId.toString()))];
        const submitted = uniqueStudents.length;
        const pending = totalStudents - submitted;

        // Calculate grading statistics based on status
        const gradedSubmissions = submissions.filter(s => s.grade && s.grade.totalScore !== undefined && s.grade.totalScore !== null);
        const submittedSubmissions = submissions.filter(s => !s.grade || s.grade.totalScore === undefined || s.grade.totalScore === null);
        const graded = gradedSubmissions.length;
        const avgScore = graded > 0 ? 
          gradedSubmissions.reduce((sum, s) => sum + s.grade.percentage, 0) / graded : 0;

        return {
          id: assignment._id,
          title: assignment.title,
          subject: assignment.subject,
          level: assignment.level,
          dueDate: assignment.dueDate,
          totalPoints: assignment.totalPoints,
          status: assignmentStatus,
          submissionStats: {
            totalStudents,
            submitted,
            pending,
            graded,
            avgScore: Math.round(avgScore * 10) / 10
          },
          createdAt: assignment.createdAt
        };
      })
    );

    const filteredAssignments = assignmentsWithStats.filter(assignment => assignment !== null);

    res.status(200).json({
      success: true,
      assignments: filteredAssignments
    });

  } catch (error) {
    console.error('Error getting teacher assignments:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEACHER_ASSIGNMENTS_FETCH_FAILED',
        message: 'Failed to fetch teacher assignments',
        details: error.message
      }
    });
  }
};

/**
 * Get assignment with submissions
 * GET /api/assignments/:assignmentId/submissions
 */
export const getAssignmentWithSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    console.log('Getting assignment with submissions:', assignmentId);

    // Get assignment
    const assignment = await Assignment.findById(assignmentId)
      .populate('teacherId', 'profile.firstName profile.lastName email')
      .lean();

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' }
      });
    }

    // Get all submissions for this assignment
    const submissions = await Submission.find({ assignmentId })
      .populate('studentId', 'profile.firstName profile.lastName email selectedLevel')
      .sort({ submittedAt: -1 })
      .lean();

    // Calculate total versions for each student
    const versionCounts = new Map();
    submissions.forEach(submission => {
      const studentId = submission.studentId._id.toString();
      versionCounts.set(studentId, (versionCounts.get(studentId) || 0) + 1);
    });

    // Format submissions with grade information
    const formattedSubmissions = submissions.map(submission => ({
      id: submission._id,
      student: {
        id: submission.studentId._id,
        name: `${submission.studentId.profile?.firstName || ''} ${submission.studentId.profile?.lastName || ''}`.trim(),
        email: submission.studentId.email,
        level: submission.studentId.selectedLevel || assignment.level
      },
      versionNumber: submission.versionNumber,
      totalVersions: versionCounts.get(submission.studentId._id.toString()) || 1,
      submissionLink: submission.submissionLink,
      submissionNotes: submission.submissionNotes,
      submittedAt: submission.submittedAt,
      status: (submission.grade && submission.grade.totalScore !== undefined && submission.grade.totalScore !== null) ? 'graded' : 'submitted',
      isLate: submission.isLate,
      grade: submission.grade ? {
        totalScore: submission.grade.totalScore,
        maxScore: submission.grade.maxScore,
        percentage: submission.grade.percentage,
        rubricScores: submission.grade.rubricScores,
        overallFeedback: submission.grade.overallFeedback,
        gradedBy: submission.grade.gradedBy,
        gradedAt: submission.grade.gradedAt
      } : null
    }));

    // Calculate statistics based on formatted submissions status
    const totalSubmissions = formattedSubmissions.length;
    const gradedSubmissions = formattedSubmissions.filter(s => s.status === 'graded').length;
    const submittedSubmissions = formattedSubmissions.filter(s => s.status === 'submitted').length;
    const averageScore = gradedSubmissions > 0 ? 
      formattedSubmissions.filter(s => s.status === 'graded').reduce((sum, s) => sum + s.grade.percentage, 0) / gradedSubmissions : 0;

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
        teacher: {
          name: `${assignment.teacherId.profile?.firstName || ''} ${assignment.teacherId.profile?.lastName || ''}`.trim(),
          email: assignment.teacherId.email
        },
        createdAt: assignment.createdAt
      },
      submissions: formattedSubmissions,
              statistics: {
          totalSubmissions,
          gradedSubmissions,
          pendingGrades: submittedSubmissions,
          averageScore: Math.round(averageScore)
        }
    });

  } catch (error) {
    console.error('Error getting assignment with submissions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSIGNMENT_SUBMISSIONS_FETCH_FAILED',
        message: 'Failed to fetch assignment submissions',
        details: error.message
      }
    });
  }
};

/**
 * Grade a submission - NEW EMBEDDED FORMAT
 * POST /api/assignments/grade
 */
export const gradeSubmission = async (req, res) => {
  try {
    const {
      submissionId,
      assignmentId,
      studentId,
      teacherId,
      totalScore,
      maxScore,
      rubricScores,
      overallFeedback
    } = req.body;

    console.log('📊 Grade submission received:', req.body);

    // Validation
    if (!submissionId || !assignmentId || !studentId || !teacherId || totalScore === undefined || !maxScore) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: submissionId, assignmentId, studentId, teacherId, totalScore, maxScore'
      });
    }

    // Validate submission exists
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Validate assignment exists
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Validate teacher
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
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

    // Validate score range
    if (totalScore < 0 || totalScore > maxScore) {
      return res.status(400).json({
        success: false,
        message: `Total score must be between 0 and ${maxScore}`
      });
    }

    // Calculate percentage and letter grade
    const percentage = Math.round((totalScore / maxScore) * 100);
    const letterGrade = calculateLetterGrade(percentage);

    // Create grade object
    const gradeData = {
      totalScore,
      maxScore,
      percentage,
      rubricScores: rubricScores || [],
      overallFeedback: overallFeedback || '',
      gradedBy: teacherId,
      gradedAt: new Date()
    };

    console.log('💾 Updating submission with grade:', gradeData);

    // Update submission with embedded grade
    const updatedSubmission = await Submission.findByIdAndUpdate(
      submissionId,
      { 
        grade: gradeData,
        status: 'graded'
      },
      { new: true, runValidators: true }
    );

    console.log('✅ Grade submitted successfully');

    // Send notifications
    let notificationResults = { student: false, parent: false };
    
    try {
      // Notify student
      await createNotification({
        userId: student._id,
        type: 'assignment_graded',
        message: `Your assignment "${assignment.title}" has been graded. Score: ${totalScore}/${maxScore} (${percentage}%)`,
        data: {
          assignmentId: assignment._id,
          submissionId: submission._id,
          score: totalScore,
          maxScore: maxScore,
          percentage: percentage,
          letterGrade: letterGrade,
          assignment: {
            title: assignment.title,
            dueDate: assignment.dueDate
          },
          teacher: {
            name: `${teacher.profile?.firstName || ''} ${teacher.profile?.lastName || ''}`.trim(),
            email: teacher.email
          }
        },
        link: `/student/assignments/${assignmentId}`
      });
      notificationResults.student = true;

      // Notify parent if student has parent
      if (student.parentId) {
        await createNotification({
          userId: student.parentId,
          type: 'child_assignment_graded',
          message: `${student.profile?.firstName || 'Your child'} received a grade for "${assignment.title}": ${totalScore}/${maxScore} (${percentage}%)`,
          data: {
            childId: student._id,
            childName: `${student.profile?.firstName || ''} ${student.profile?.lastName || ''}`.trim(),
            assignmentTitle: assignment.title,
            score: totalScore,
            maxScore: maxScore,
            percentage: percentage,
            letterGrade: letterGrade
          },
          link: `/parent/child/${student._id}/progress`
        });
        notificationResults.parent = true;
      }

    } catch (notificationError) {
      console.error('Error sending grade notifications:', notificationError);
      // Don't fail grading if notification fails
    }

    res.json({
      success: true,
      message: 'Grade submitted successfully',
      grade: {
        id: updatedSubmission._id, // Using submission ID as grade reference
        submissionId: updatedSubmission._id,
        totalScore: gradeData.totalScore,
        maxScore: gradeData.maxScore,
        percentage: gradeData.percentage,
        rubricScores: gradeData.rubricScores,
        overallFeedback: gradeData.overallFeedback,
        gradedBy: gradeData.gradedBy,
        gradedAt: gradeData.gradedAt
      },
      notificationsSent: notificationResults
    });

  } catch (error) {
    console.error('❌ Error grading submission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during grading',
      error: error.message
    });
  }
};
