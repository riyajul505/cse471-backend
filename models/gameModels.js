import mongoose from 'mongoose';

// Game Actions Log Collection
const gameActionSchema = new mongoose.Schema({
  simulationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Simulation', 
    required: true, 
    index: true 
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  action: { 
    type: String, 
    enum: ['use_equipment', 'mix_chemicals', 'observe', 'measure', 'place_item', 'remove_item'], 
    required: true 
  },
  equipment: {
    id: String,
    name: String,
    category: String
  },
  target: { 
    type: String, 
    enum: ['beaker', 'burette', 'measuring', 'observation', 'workspace'], 
    required: true 
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  scoreGained: { 
    type: Number, 
    default: 0 
  },
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  aiProcessed: { 
    type: Boolean, 
    default: false 
  }
}, {
  timestamps: true
});

// Compound indexes for performance
gameActionSchema.index({ simulationId: 1, timestamp: -1 });
gameActionSchema.index({ studentId: 1, timestamp: -1 });
gameActionSchema.index({ action: 1, timestamp: -1 });

// Student Game Statistics Collection
const studentGameStatsSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true, 
    index: true 
  },
  totalGamesPlayed: { 
    type: Number, 
    default: 0 
  },
  totalScore: { 
    type: Number, 
    default: 0 
  },
  averageScore: { 
    type: Number, 
    default: 0 
  },
  experimentsCompleted: { 
    type: Number, 
    default: 0 
  },
  achievementsUnlocked: [{ 
    type: String 
  }],
  lastPlayedAt: { 
    type: Date, 
    index: true 
  },
  favoriteSubject: { 
    type: String, 
    enum: ['chemistry', 'physics', 'biology', 'general'], 
    default: 'general' 
  },
  skillProgression: {
    chemistry: { type: Number, default: 0, min: 0, max: 100 },
    physics: { type: Number, default: 0, min: 0, max: 100 },
    biology: { type: Number, default: 0, min: 0, max: 100 }
  },
  bestScores: {
    chemistry: { type: Number, default: 0 },
    physics: { type: Number, default: 0 },
    biology: { type: Number, default: 0 }
  },
  streaks: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Methods for game statistics
studentGameStatsSchema.methods.updateStats = async function(simulationData) {
  const { subject, finalScore, completed } = simulationData;
  
  // Update basic stats
  this.totalGamesPlayed += 1;
  this.totalScore += finalScore;
  this.averageScore = Math.round(this.totalScore / this.totalGamesPlayed);
  this.lastPlayedAt = new Date();
  
  if (completed) {
    this.experimentsCompleted += 1;
  }
  
  // Update subject-specific progression
  if (subject && this.skillProgression[subject] !== undefined) {
    const currentProgression = this.skillProgression[subject];
    const progressionGain = Math.min(5, Math.floor(finalScore / 20)); // Max 5 points gain
    this.skillProgression[subject] = Math.min(100, currentProgression + progressionGain);
    
    // Update best scores
    if (finalScore > this.bestScores[subject]) {
      this.bestScores[subject] = finalScore;
    }
    
    // Update favorite subject
    const subjects = ['chemistry', 'physics', 'biology'];
    const maxSubject = subjects.reduce((a, b) => 
      this.skillProgression[a] > this.skillProgression[b] ? a : b
    );
    this.favoriteSubject = maxSubject;
  }
  
  // Update streaks
  if (finalScore >= 70) { // Consider 70+ as success
    this.streaks.current += 1;
    if (this.streaks.current > this.streaks.longest) {
      this.streaks.longest = this.streaks.current;
    }
  } else {
    this.streaks.current = 0;
  }
  
  return this.save();
};

// Static method for leaderboard
studentGameStatsSchema.statics.getLeaderboard = async function(level, limit = 10) {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'studentId',
        foreignField: '_id',
        as: 'student'
      }
    },
    {
      $unwind: '$student'
    },
    {
      $match: {
        'student.selectedLevel': level,
        'student.role': 'student'
      }
    },
    {
      $sort: { totalScore: -1, experimentsCompleted: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        studentId: 1,
        studentName: {
          $concat: ['$student.profile.firstName', ' ', '$student.profile.lastName']
        },
        score: '$totalScore',
        experimentsCompleted: 1,
        averageScore: 1,
        streaks: 1
      }
    }
  ];
  
  const leaderboard = await this.aggregate(pipeline);
  
  // Add ranks
  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
};

const GameAction = mongoose.model('GameAction', gameActionSchema);
const StudentGameStats = mongoose.model('StudentGameStats', studentGameStatsSchema);

export { GameAction, StudentGameStats };
