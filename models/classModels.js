import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  level: { type: Number, min: 1, max: 5, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  timing: {
    days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
    startTime: String, // Format: "09:00"
    endTime: String,   // Format: "10:30"
    timezone: { type: String, default: 'UTC' }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Class = mongoose.model('Class', classSchema);
export default Class; 