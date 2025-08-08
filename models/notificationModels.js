import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
    type: String,
    enum: [
      "grade", 
      "achievement", 
      "session", 
      "submission", 
      "path_selection",
      "quiz_completed",
      "child_quiz_completed",
      "child_achievement_unlocked",
      "student_achievement_unlocked"
    ],
    required: true
  },
  message: { type: String, required: true },
  link: String, // Deep link to resource
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// TTL index for 30-day expiry
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification; 