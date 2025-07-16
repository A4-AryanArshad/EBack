const mongoose = require('mongoose');

const instructorSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  city: { type: String },
  location: { type: String },
  regions: [{ type: String }], // Assigned teaching regions
  subjects: [{ name: String, durationWeeks: Number }], // Subjects/courses with duration
  availability: {
    type: Map,
    of: [{ start: String, end: String }], // e.g., { Monday: [{start, end}], ... }
    default: {}
  },
  bookings: [{
    date: String, // YYYY-MM-DD
    start: String, // e.g., '09:00'
    end: String,   // e.g., '12:00'
    subject: String,
    location: String,
    studentCount: Number,
    clientEmail: String,
    clientName: String
  }]
});

module.exports = mongoose.model('Instructor', instructorSchema); 