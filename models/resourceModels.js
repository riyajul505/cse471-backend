import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['worksheet', 'video', 'simulation', 'document', 'image'], required: true },
  level: { type: Number, min: 1, max: 5, required: true },
  subject: String,
  tags: [String],
  url: { type: String, required: true },
  fileName: String,
  fileSize: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Text search index
resourceSchema.index({ title: 'text', description: 'text', tags: 'text' });

const Resource = mongoose.model('Resource', resourceSchema);
export default Resource; 