import mongoose from 'mongoose';

// Enhanced Simulation Schema based on API requirements
const simulationSchema = new mongoose.Schema({
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
  prompt: { 
    type: String, 
    required: true, 
    maxlength: 500 
  },
  subject: { 
    type: String, 
    enum: ['chemistry', 'physics', 'biology', 'general'], 
    default: 'general' 
  },
  level: { 
    type: Number, 
    min: 1, 
    max: 5, 
    required: true 
  },
  experimentType: { 
    type: String, 
    required: true 
  },
  virtualLab: {
    equipment: {
      type: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        icon: { type: String, default: '🔬' },
        category: { type: String, enum: ['glassware', 'tools', 'chemicals', 'instruments'], default: 'tools' }
      }],
      required: true,
      validate: {
        validator: function(arr) {
          return arr && arr.length > 0;
        },
        message: 'Equipment array must contain at least one item'
      }
    },
    chemicals: {
      type: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        concentration: { type: String, default: '' },
        hazard: { type: String, enum: ['safe', 'caution', 'dangerous'], default: 'safe' },
        color: { type: String, default: 'colorless' },
        icon: { type: String, default: '🧪' }
      }],
      default: []
    },
    procedure: {
      type: [{ type: String, required: true }],
      required: true,
      validate: {
        validator: function(arr) {
          return arr && arr.length > 0;
        },
        message: 'Procedure array must contain at least one step'
      }
    },
    safetyNotes: {
      type: [{ type: String, required: true }],
      required: true,
      validate: {
        validator: function(arr) {
          return arr && arr.length > 0;
        },
        message: 'Safety notes array must contain at least one note'
      }
    }
  },
  objectives: [{ type: String }],
  expectedOutcome: { 
    type: String 
  },
  estimatedDuration: { 
    type: Number, // minutes
    default: 30 
  },
  difficulty: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    default: 'intermediate' 
  },
  gameConfig: {
    objectives: [{ type: String }],
    scoringCriteria: {
      correctAction: { type: Number, default: 10 },
      observation: { type: Number, default: 5 },
      completion: { type: Number, default: 50 }
    },
    maxScore: { type: Number, default: 100 },
    timeLimit: { type: Number } // optional, in minutes
  },
  state: {
    status: { 
      type: String, 
      enum: ['not_started', 'in_progress', 'paused', 'completed'], 
      default: 'not_started' 
    },
    currentStep: { 
      type: Number, 
      default: 0 
    },
    progress: { 
      type: Number, 
      min: 0, 
      max: 100, 
      default: 0 
    },
    userInputs: { 
      type: mongoose.Schema.Types.Mixed, 
      default: {} 
    },
    observations: [{
      step: { type: Number, required: true },
      timestamp: { type: Date, required: true },
      observation: { type: String, required: true }
    }],
    results: { 
      type: mongoose.Schema.Types.Mixed, 
      default: {} 
    },
    startedAt: { type: Date },
    lastActiveAt: { type: Date },
    completedAt: { type: Date },
    gameState: {
      currentAction: { type: String, default: '' },
      selectedEquipment: [{
        id: String,
        name: String,
        usedAt: Date,
        location: { type: String, enum: ['beaker', 'burette', 'measuring', 'observation'], default: 'observation' }
      }],
      mixedSolutions: [{
        id: mongoose.Schema.Types.Mixed,
        components: [String],
        result: mongoose.Schema.Types.Mixed,
        visualEffect: String,
        timestamp: Date
      }],
      observations: [{
        timestamp: Date,
        action: String,
        result: String,
        scientificExplanation: String,
        visualEffect: String
      }],
      score: { type: Number, default: 0 },
      hints: [{
        id: mongoose.Schema.Types.Mixed,
        text: String,
        type: { type: String, enum: ['tip', 'encouragement', 'direction', 'safety'], default: 'tip' },
        timestamp: Date
      }],
      achievements: [{
        id: String,
        title: String,
        unlockedAt: Date
      }],
      workspaceContents: {
        beaker: { type: [mongoose.Schema.Types.Mixed], default: [] },
        burette: { type: [mongoose.Schema.Types.Mixed], default: [] },
        measuring: { type: [mongoose.Schema.Types.Mixed], default: [] },
        observation: { type: [mongoose.Schema.Types.Mixed], default: [] }
      }
    }
  },
  // AI generation metadata
  aiGenerationData: {
    model: { type: String, default: 'gemini' },
    generatedAt: { type: Date, default: Date.now },
    processingTime: { type: Number }, // milliseconds
    apiVersion: { type: String }
  }
}, {
  timestamps: true
});

// Indexes for performance
simulationSchema.index({ studentId: 1, createdAt: -1 });
simulationSchema.index({ studentId: 1, 'state.status': 1 });
simulationSchema.index({ subject: 1, level: 1 });
simulationSchema.index({ 'state.lastActiveAt': -1 });
simulationSchema.index({ experimentType: 1 });

// Text search index
simulationSchema.index({ 
  title: 'text', 
  description: 'text', 
  prompt: 'text' 
});

// Virtual for total steps
simulationSchema.virtual('totalSteps').get(function() {
  return this.virtualLab.procedure ? this.virtualLab.procedure.length : 0;
});

// Method to update simulation state
simulationSchema.methods.updateState = function(newState) {
  this.state = { ...this.state, ...newState };
  this.state.lastActiveAt = new Date();
  return this.save();
};

// Method to add observation
simulationSchema.methods.addObservation = function(step, observation) {
  this.state.observations.push({
    step: step,
    timestamp: new Date(),
    observation: observation
  });
  this.state.lastActiveAt = new Date();
  return this.save();
};

// Pre-save hook to ensure virtualLab data integrity - CRITICAL FIX
simulationSchema.pre('save', function(next) {
  // Ensure virtualLab exists
  if (!this.virtualLab) {
    const error = new Error('CRITICAL: virtualLab object is required');
    return next(error);
  }

  // Ensure required arrays have content
  if (!this.virtualLab.equipment || this.virtualLab.equipment.length === 0) {
    console.error('🚨 PRE-SAVE: Missing equipment, adding defaults');
    this.virtualLab.equipment = ['Basic laboratory equipment', 'Safety goggles', 'Lab notebook'];
  }

  if (!this.virtualLab.procedure || this.virtualLab.procedure.length === 0) {
    console.error('🚨 PRE-SAVE: Missing procedure, adding defaults');
    this.virtualLab.procedure = ['Set up equipment', 'Follow procedure', 'Record observations'];
  }

  if (!this.virtualLab.safetyNotes || this.virtualLab.safetyNotes.length === 0) {
    console.error('🚨 PRE-SAVE: Missing safety notes, adding defaults');
    this.virtualLab.safetyNotes = ['Follow safety protocols', 'Wear protective equipment'];
  }

  // Ensure chemicals array exists (chemistry needs content, others can be empty)
  if (!this.virtualLab.chemicals) {
    this.virtualLab.chemicals = this.subject === 'chemistry' ? ['Water', 'Standard solutions'] : [];
  }

  console.log('✅ PRE-SAVE virtualLab validation passed for:', this.title);
  next();
});

// Static method to get simulations with pagination
simulationSchema.statics.getPaginatedSimulations = function(studentId, options = {}) {
  const {
    page = 1,
    limit = 10,
    status,
    subject
  } = options;

  const query = { studentId };
  
  if (status) {
    query['state.status'] = status;
  }
  
  if (subject) {
    query.subject = subject;
  }

  const skip = (page - 1) * limit;

  return Promise.all([
    this.find(query)
      .sort({ 'state.lastActiveAt': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
    this.aggregate([
      { $match: { studentId } },
      { $group: {
        _id: '$state.status',
        count: { $sum: 1 }
      }}
    ])
  ]).then(([simulations, totalCount, statusCounts]) => {
    const stats = {
      total: totalCount,
      notStarted: 0,
      inProgress: 0,
      paused: 0,
      completed: 0
    };

    statusCounts.forEach(item => {
      switch(item._id) {
        case 'not_started':
          stats.notStarted = item.count;
          break;
        case 'in_progress':
          stats.inProgress = item.count;
          break;
        case 'paused':
          stats.paused = item.count;
          break;
        case 'completed':
          stats.completed = item.count;
          break;
      }
    });

    return {
      simulations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      stats
    };
  });
};

const Simulation = mongoose.model('Simulation', simulationSchema);

export default Simulation;
