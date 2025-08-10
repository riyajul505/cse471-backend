import mongoose from 'mongoose';

// Assignment Schema
const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  instructions: {
    type: String,
    required: true,
    maxlength: 3000
  },
  subject: {
    type: String,
    required: true,
    enum: ['Math', 'Science', 'English', 'History', 'Geography', 'Art', 'Music', 'Physical Education', 'Computer Science']
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  dueDate: {
    type: Date,
    required: true
  },
  totalPoints: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  allowedFileTypes: {
    type: [String],
    required: true,
    default: ['pdf', 'doc', 'docx', 'ppt', 'pptx']
  },
  maxFileSize: {
    type: Number,
    required: true,
    default: 10485760 // 10MB in bytes
  },
  rubric: [{
    criteria: {
      type: String,
      required: true,
      trim: true
    },
    maxPoints: {
      type: Number,
      required: true,
      min: 1
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    }
  }],
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  isVisible: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update updatedAt
assignmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for assignment status
assignmentSchema.virtual('status').get(function() {
  const now = new Date();
  if (!this.isVisible) return 'draft';
  if (now > this.dueDate) return 'past_due';
  return 'active';
});

// Submission Schema
const submissionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  versionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  submissionLink: {
    type: String,
    required: true,
    trim: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  submissionNotes: {
    type: String,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'late'],
    default: 'submitted'
  },
  isLate: {
    type: Boolean,
    default: false
  },
  previousSubmissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission'
  },
  // Embedded grade information (set when teacher grades)
  grade: {
    totalScore: {
      type: Number,
      min: 0
    },
    maxScore: {
      type: Number,
      min: 0
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    rubricScores: [{
      criteria: {
        type: String,
        required: true
      },
      score: {
        type: Number,
        required: true,
        min: 0
      },
      maxPoints: {
        type: Number,
        required: true,
        min: 0
      },
      feedback: {
        type: String,
        maxlength: 500
      }
    }],
    overallFeedback: {
      type: String,
      maxlength: 2000
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: {
      type: Date
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Helper function to calculate letter grade from percentage
export function calculateLetterGrade(percentage) {
  if (percentage >= 97) return 'A+';
  else if (percentage >= 93) return 'A';
  else if (percentage >= 90) return 'A-';
  else if (percentage >= 87) return 'B+';
  else if (percentage >= 83) return 'B';
  else if (percentage >= 80) return 'B-';
  else if (percentage >= 77) return 'C+';
  else if (percentage >= 73) return 'C';
  else if (percentage >= 70) return 'C-';
  else if (percentage >= 67) return 'D+';
  else if (percentage >= 65) return 'D';
  else if (percentage >= 60) return 'D-';
  else return 'F';
}

// Indexes for performance
assignmentSchema.index({ teacherId: 1, createdAt: -1 });
assignmentSchema.index({ level: 1, subject: 1 });
assignmentSchema.index({ dueDate: 1, isVisible: 1 });

submissionSchema.index({ assignmentId: 1, studentId: 1 });
submissionSchema.index({ studentId: 1, submittedAt: -1 });
submissionSchema.index({ assignmentId: 1, versionNumber: -1 });
submissionSchema.index({ studentId: 1, 'grade.gradedAt': -1 }); // For grade queries

export const Assignment = mongoose.model('Assignment', assignmentSchema);
export const Submission = mongoose.model('Submission', submissionSchema);
