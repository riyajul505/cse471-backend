import { QuizResult, Achievement } from '../models/quizModels.js';
import User from '../models/userModels.js';
import { createNotification } from './notificationController.js';

// Achievement level calculation
const calculateAchievementLevel = (score) => {
  if (score >= 90) return 'gold';
  if (score >= 80) return 'silver';
  if (score >= 70) return 'bronze';
  return 'participation';
};

// Achievement titles and descriptions
const getAchievementData = (level, score) => {
  const achievements = {
    gold: {
      title: 'Quiz Master',
      description: `Outstanding performance! You scored ${score}% and mastered this topic.`,
      icon: '🏆'
    },
    silver: {
      title: 'Knowledge Star',
      description: `Great work! You scored ${score}% and showed excellent understanding.`,
      icon: '⭐'
    },
    bronze: {
      title: 'Learning Champion',
      description: `Well done! You scored ${score}% and demonstrated good progress.`,
      icon: '🥉'
    },
    participation: {
      title: 'Keep Learning',
      description: `You scored ${score}%. Keep practicing to improve your understanding!`,
      icon: '📚'
    }
  };
  return achievements[level];
};

// Save quiz result
export const saveQuizResult = async (req, res) => {
  try {
    const { 
      studentId, 
      resourceId, 
      score, 
      answers, 
      correctAnswers, 
      totalQuestions, 
      quizData, 
      completedAt 
    } = req.body;

    // Validate required fields
    if (!studentId || !resourceId || score === undefined || !answers || 
        correctAnswers === undefined || !totalQuestions || !completedAt) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
        required: ['studentId', 'resourceId', 'score', 'answers', 'correctAnswers', 'totalQuestions', 'completedAt']
      });
    }

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Validate score range
    if (score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: 'Score must be between 0 and 100'
      });
    }

    // Validate answers array length
    if (answers.length !== totalQuestions) {
      return res.status(400).json({
        success: false,
        message: 'Answers array length must match total questions'
      });
    }

    // Validate correctAnswers
    if (correctAnswers < 0 || correctAnswers > totalQuestions) {
      return res.status(400).json({
        success: false,
        message: 'Correct answers must be between 0 and total questions'
      });
    }

    console.log(`Quiz result submission for student: ${studentId}, score: ${score}%`);

    // Create quiz result
    const quizResult = new QuizResult({
      studentId,
      resourceId,
      resourceTitle: quizData?.title || 'Quiz',
      score,
      answers,
      correctAnswers,
      totalQuestions,
      quizData,
      completedAt: new Date(completedAt)
    });

    await quizResult.save();

    // Calculate achievement level
    const achievementLevel = calculateAchievementLevel(score);
    let achievementUnlocked = false;
    let achievement = null;

    // Create achievement if score >= 70%
    if (score >= 70) {
      const achievementData = getAchievementData(achievementLevel, score);
      
      achievement = new Achievement({
        studentId,
        title: achievementData.title,
        description: achievementData.description,
        level: achievementLevel,
        icon: achievementData.icon,
        score,
        resourceId,
        resourceTitle: quizData?.title || 'Quiz',
        unlockedAt: new Date()
      });

      await achievement.save();
      achievementUnlocked = true;

      console.log(`Achievement unlocked: ${achievement.title} for student ${studentId}`);
    }

    // Create notifications
    await createQuizNotifications(student, score, quizData?.title || 'Quiz', achievementUnlocked, achievement);

    res.status(201).json({
      success: true,
      data: {
        quizResultId: quizResult._id,
        achievementUnlocked,
        achievement: achievementUnlocked ? {
          id: achievement._id,
          title: achievement.title,
          description: achievement.description,
          level: achievement.level
        } : null
      }
    });

  } catch (err) {
    console.error('Save quiz result error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

// Create quiz-related notifications
const createQuizNotifications = async (student, score, quizTitle, achievementUnlocked, achievement) => {
  try {
    // 1. Notify student of quiz completion
    const studentMessage = `Great job! You scored ${score}% on the ${quizTitle} quiz.`;
    await createNotification(
      student._id,
      'quiz_completed',
      studentMessage,
      '/take-quiz'
    );

    // 2. Find and notify parent(s)
    const parents = await User.find({
      role: 'parent',
      'profile.children': student._id
    });

    for (const parent of parents) {
      const parentMessage = `${student.profile.firstName} ${student.profile.lastName} completed a quiz and scored ${score}% on ${quizTitle}.`;
      await createNotification(
        parent._id,
        'child_quiz_completed',
        parentMessage,
        '/performance-reports'
      );

      // 3. Notify parent of achievement unlock
      if (achievementUnlocked) {
        const achievementMessage = `🏆 ${student.profile.firstName} ${student.profile.lastName} unlocked a new achievement: ${achievement.title}!`;
        await createNotification(
          parent._id,
          'child_achievement_unlocked',
          achievementMessage,
          '/performance-reports'
        );
      }
    }

    // 4. Notify teachers if achievement unlocked
    if (achievementUnlocked) {
      // Find teachers who have classes with this student's level
      const teachers = await User.find({
        role: 'teacher'
      });

      for (const teacher of teachers) {
        const teacherMessage = `🌟 ${student.profile.firstName} ${student.profile.lastName} (Level ${student.selectedLevel}) unlocked the '${achievement.title}' achievement!`;
        await createNotification(
          teacher._id,
          'student_achievement_unlocked',
          teacherMessage,
          '/student-progress'
        );
      }
    }

    console.log(`Notifications sent for quiz completion - Student: 1, Parents: ${parents.length}, Achievement notifications: ${achievementUnlocked ? parents.length + 1 : 0}`);

  } catch (err) {
    console.error('Error creating quiz notifications:', err);
  }
};

// Get quiz history for a student
export const getQuizHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get quiz history
    const history = await QuizResult.find({ studentId })
      .select('resourceId resourceTitle score correctAnswers totalQuestions completedAt')
      .sort({ completedAt: -1 });

    const formattedHistory = history.map(result => ({
      id: result._id,
      resourceId: result.resourceId,
      resourceTitle: result.resourceTitle,
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      completedAt: result.completedAt
    }));
    
    res.json({
      success: true,
      data: {
        history: formattedHistory
      }
    });

  } catch (err) {
    console.error('Get quiz history error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

// Get achievements for a student
export const getStudentAchievements = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get achievements
    const achievements = await Achievement.find({ studentId })
      .sort({ unlockedAt: -1 });

    const formattedAchievements = achievements.map(achievement => ({
      id: achievement._id,
      studentId: achievement.studentId,
      title: achievement.title,
      description: achievement.description,
      level: achievement.level,
      icon: achievement.icon,
      score: achievement.score,
      resourceId: achievement.resourceId,
      resourceTitle: achievement.resourceTitle,
      image: achievement.image,
      unlockedAt: achievement.unlockedAt,
      createdAt: achievement.createdAt
    }));

    res.json({
      success: true,
      data: {
        achievements: formattedAchievements
      }
    });

  } catch (err) {
    console.error('Get achievements error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

// Get weak quiz attempts (<30%) for a student filtered by resourceId or resourceTitle
export const getWeakQuizAttempts = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { resourceId, resourceTitle } = req.query;

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (!resourceId && !resourceTitle) {
      return res.status(400).json({
        success: false,
        message: 'Provide either resourceId or resourceTitle as a query parameter'
      });
    }

    // Build filter
    const filter = { studentId };
    if (resourceId) filter.resourceId = resourceId;
    if (resourceTitle) filter.resourceTitle = resourceTitle;

    // Fetch last 3 recent attempts with score < 50
    const results = await QuizResult.find({ ...filter, score: { $lt: 50 } }).sort({ completedAt: -1 }).limit(3);

    const formatted = results.map((r) => {
      // Build per-question details including selected options
      const questions = Array.isArray(r.quizData?.questions) ? r.quizData.questions : [];
      const selectedAnswers = Array.isArray(r.answers) ? r.answers : [];

      const questionDetails = questions.map((q, idx) => {
        const selectedIndex = selectedAnswers[idx];
        const selectedOption = (Array.isArray(q.options) && selectedIndex != null) ? q.options[selectedIndex] : undefined;
        const isCorrect = (typeof q.correctAnswer === 'number' && selectedIndex != null) ? (selectedIndex === q.correctAnswer) : undefined;
        return {
          id: q.id ?? idx + 1,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          selectedIndex,
          selectedOption,
          isCorrect
        };
      });

      return {
        id: r._id,
        studentId: r.studentId,
        resourceId: r.resourceId,
        resourceTitle: r.resourceTitle,
        score: r.score,
        correctAnswers: r.correctAnswers,
        totalQuestions: r.totalQuestions,
        completedAt: r.completedAt,
        questions: questionDetails
      };
    });

    res.json({
      success: true,
      data: {
        totalAttempts: formatted.length,
        attempts: formatted
      }
    });
  } catch (err) {
    console.error('Get weak quiz attempts error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

// Save achievement endpoint
export const saveAchievement = async (req, res) => {
  try {
    const {
      studentId,
      resourceId,
      resourceTitle,
      title,
      description,
      level,
      icon,
      score,
      image,
      unlockedAt
    } = req.body;

    // Validate required fields
    if (!studentId || !resourceId || !title || !description || !level || !score || !unlockedAt) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
        required: ['studentId', 'resourceId', 'title', 'description', 'level', 'score', 'unlockedAt']
      });
    }

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Validate level
    const validLevels = ['gold', 'silver', 'bronze', 'participation'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid achievement level',
        validLevels: validLevels,
        received: level
      });
    }

    // Validate score range
    if (score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: 'Score must be between 0 and 100'
      });
    }

    console.log(`Saving achievement for student: ${studentId}, level: ${level}, score: ${score}%`);

    // Create achievement
    const achievement = new Achievement({
      studentId,
      title,
      description,
      level,
      icon,
      score,
      resourceId,
      resourceTitle: resourceTitle || 'Achievement',
      image: image || null,
      unlockedAt: new Date(unlockedAt)
    });

    await achievement.save();

    console.log(`Achievement saved: ${achievement.title} for student ${studentId}`);

    // Create notifications for achievement unlock
    await createQuizNotifications(student, score, resourceTitle || 'Achievement', true, achievement);

    res.status(201).json({
      success: true,
      achievement: {
        id: achievement._id,
        studentId: achievement.studentId,
        title: achievement.title,
        description: achievement.description,
        level: achievement.level,
        icon: achievement.icon,
        score: achievement.score,
        resourceId: achievement.resourceId,
        resourceTitle: achievement.resourceTitle,
        image: achievement.image,
        unlockedAt: achievement.unlockedAt,
        createdAt: achievement.createdAt
      }
    });

  } catch (err) {
    console.error('Save achievement error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
  }
};

// Get quiz statistics for a student (helper function)
export const getStudentQuizStats = async (studentId) => {
  try {
    const quizResults = await QuizResult.find({ studentId });
    
    if (quizResults.length === 0) {
      return {
        totalQuizzes: 0,
        averageScore: 0,
        lastQuizDate: null,
        recentAchievements: []
      };
    }

    // Calculate average score
    const totalScore = quizResults.reduce((sum, result) => sum + result.score, 0);
    const averageScore = Math.round(totalScore / quizResults.length);

    // Get last quiz date
    const lastQuizDate = quizResults.reduce((latest, result) => {
      return result.completedAt > latest ? result.completedAt : latest;
    }, new Date(0));

    // Get recent achievements (last 3)
    const recentAchievements = await Achievement.find({ studentId })
      .sort({ unlockedAt: -1 })
      .limit(3)
      .select('title level icon unlockedAt');

    return {
      totalQuizzes: quizResults.length,
      averageScore,
      lastQuizDate,
      recentAchievements: recentAchievements.map(ach => ({
        title: ach.title,
        level: ach.level,
        icon: ach.icon,
        unlockedAt: ach.unlockedAt
      }))
    };

  } catch (err) {
    console.error('Error getting quiz stats:', err);
    return {
      totalQuizzes: 0,
      averageScore: 0,
      lastQuizDate: null,
      recentAchievements: []
    };
  }
}; 