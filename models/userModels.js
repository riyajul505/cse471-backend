import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'parent', 'admin'], required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  profile: {
    firstName: String,
    lastName: String,
    grade: Number, // Only students
    subjects: [String], // Only teachers
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Only parents
  },
  learningStyle: { type: String, enum: ['visual', 'auditory', 'kinesthetic'] },
  lastActive: Date,
  // Learning path selection (for students)
  pathSelected: { type: Boolean, default: false },
  selectedLevel: { type: Number, min: 1, max: 5 }
});

const User = mongoose.model('User', userSchema);
export default User; 