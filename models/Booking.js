const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  city: { type: String, required: true },
  area: { type: String, required: true },
  status: { type: String, enum: ['on-hold', 'confirmed', 'cancelled'], default: 'on-hold' },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor', default: null },
  notifiedInstructors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Instructor' }],
  courseName: { type: String, required: true },
  durationWeeks: { type: Number, required: true },
  paid: { type: Boolean, default: false },
  start: { type: String }, // e.g., '09:00'
  end: { type: String },   // e.g., '12:00'
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema); 