import mongoose from 'mongoose';

// Lab Slot Schema
const labSlotSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  date: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Basic date format validation (YYYY-MM-DD)
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: 'Date must be in YYYY-MM-DD format'
    }
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Time format validation (HH:MM)
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Start time must be in HH:MM format'
    }
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Time format validation (HH:MM)
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'End time must be in HH:MM format'
    }
  },
  location: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  maxStudents: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  topic: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Lab Booking Schema
const labBookingSchema = new mongoose.Schema({
  slotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabSlot',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  }
}, {
  timestamps: true
});

// Indexes for performance
labSlotSchema.index({ teacherId: 1, date: 1 });
labSlotSchema.index({ level: 1, date: 1, status: 1 });
labSlotSchema.index({ date: 1, startTime: 1 });

labBookingSchema.index({ slotId: 1 });
labBookingSchema.index({ studentId: 1 });
labBookingSchema.index({ slotId: 1, status: 1 });

// Virtual for checking if slot is full
labSlotSchema.virtual('isFull').get(function() {
  return this.bookings && this.bookings.length >= this.maxStudents;
});

// Ensure virtuals are included in JSON
labSlotSchema.set('toJSON', { virtuals: true });
labSlotSchema.set('toObject', { virtuals: true });

export const LabSlot = mongoose.model('LabSlot', labSlotSchema);
export const LabBooking = mongoose.model('LabBooking', labBookingSchema);
