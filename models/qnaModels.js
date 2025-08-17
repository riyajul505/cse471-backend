import mongoose from 'mongoose';

const qnaMessageSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return !this.teacherId; } // Required if not a teacher message
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return !this.studentId; } // Required if not a student message
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  replyToId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QnaMessage',
    default: null
  },
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QnaMessage',
    default: function() { return this.replyToId || this._id; }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
qnaMessageSchema.index({ level: 1, timestamp: -1 });
qnaMessageSchema.index({ threadId: 1, timestamp: 1 });
qnaMessageSchema.index({ replyToId: 1 });

// Virtual for isTeacher
qnaMessageSchema.virtual('isTeacher').get(function() {
  return !!this.teacherId;
});

// Ensure virtuals are included in JSON
qnaMessageSchema.set('toJSON', { virtuals: true });
qnaMessageSchema.set('toObject', { virtuals: true });

export const QnaMessage = mongoose.model('QnaMessage', qnaMessageSchema);
