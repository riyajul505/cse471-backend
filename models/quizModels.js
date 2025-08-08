import mongoose from 'mongoose';

// Quiz Results Schema
const quizResultSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  resourceId: { 
    type: String, 
    required: true, 
    index: true 
  },
  resourceTitle: { 
    type: String, 
    required: true 
  },
  score: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 100 
  },
  answers: [{ 
    type: Number, 
    required: true 
  }],
  correctAnswers: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  totalQuestions: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  quizData: {
    title: String,
    questions: [mongoose.Schema.Types.Mixed]
  },
  completedAt: { 
    type: Date, 
    required: true, 
    index: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index for efficient queries
quizResultSchema.index({ studentId: 1, completedAt: -1 });
quizResultSchema.index({ resourceId: 1, completedAt: -1 });

// Achievements Schema
const achievementSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  level: { 
    type: String, 
    enum: ['gold', 'silver', 'bronze', 'participation'], 
    required: true 
  },
  icon: String,
  image: String, // URL or base64
  score: { 
    type: Number, 
    required: true 
  },
  resourceId: { 
    type: String, 
    required: true 
  },
  resourceTitle: String,
  unlockedAt: { 
    type: Date, 
    required: true, 
    index: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index for efficient queries
achievementSchema.index({ studentId: 1, unlockedAt: -1 });
achievementSchema.index({ level: 1, unlockedAt: -1 });

const QuizResult = mongoose.model('QuizResult', quizResultSchema);
const Achievement = mongoose.model('Achievement', achievementSchema);

export { QuizResult, Achievement }; 