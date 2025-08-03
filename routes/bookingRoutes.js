const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Instructor = require('../models/Instructor');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Configure nodemailer (reuse from contactRoutes.js)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aryanarshad5413@gmail.com',
    pass: 'gvyqmapsqsrrtwjm',
  },
});

// GET /api/bookings?notifiedInstructorId=...&status=on-hold
router.get('/', async (req, res) => {
  try {
    const { notifiedInstructorId, status } = req.query;
    if (!notifiedInstructorId || !status) {
      return res.status(400).json({ message: 'Missing parameters.' });
    }
    const bookings = await Booking.find({
      notifiedInstructors: notifiedInstructorId,
      status
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/bookings - Create a new booking in 'on-hold' status and notify instructors
router.post('/', async (req, res) => {
  try {
    const { userId, date, city, area, courseName, durationWeeks, start, end } = req.body;
    if (!userId || !date || !city || !area || !courseName || !durationWeeks) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    // First, try to find instructors matching both city and area
    let instructors = await Instructor.find({
      city: { $regex: new RegExp(`^${city}$`, 'i') },
      location: { $regex: new RegExp(`^${area}$`, 'i') },
    });
    if (!instructors.length) {
      // If none, find instructors matching city only
      instructors = await Instructor.find({
        city: { $regex: new RegExp(`^${city}$`, 'i') }
      });
    }
    if (!instructors.length) {
      return res.status(404).json({ message: 'No instructors available for the selected date and location.' });
    }
    // Filter instructors who offer the selected course
    const courseInstructors = instructors.filter(inst => {
      return (inst.subjects || []).some(subject => 
        subject.name.toLowerCase().trim() === courseName.toLowerCase().trim() && 
        String(subject.durationWeeks) === String(durationWeeks)
      );
    });
    
    if (!courseInstructors.length) {
      return res.status(404).json({ message: 'No instructors found who offer this course in the selected location.' });
    }
    
    // Filter by availability on the selected day and time
    const requestedDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    console.log('RequestedDay:', requestedDay, 'Start:', start, 'End:', end);
    
    const availableInstructors = courseInstructors.filter(inst => {
      let daySlots = [];
      if (inst.availability) {
        // Handle both Map and plain object
        if (typeof inst.availability.get === 'function') {
          daySlots = inst.availability.get(requestedDay) || [];
        } else {
          daySlots = inst.availability[requestedDay] || [];
        }
      }
      console.log('Comparing with slot:', daySlots);
      // Check if any slot fully covers the requested time window
      return daySlots.some(slot => {
        return slot.start <= start && slot.end >= end;
      });
    });
    
    console.log('Course instructors:', courseInstructors.map(i => i.email));
    console.log('Available instructors:', availableInstructors.map(i => i.email));
    
    // Send emails ONLY to available instructors
    for (const inst of availableInstructors) {
      await transporter.sendMail({
        from: 'aryanarshad5413@gmail.com',
        to: inst.email,
        subject: `New Course Booking Request: ${courseName}`,
        text: `A user has requested a course booking for ${courseName} (${durationWeeks} weeks) on ${date} in ${city}, ${area} during ${start} - ${end}.\n\nYou are available at this time. Please log in to your dashboard to accept this booking.\n\nFirst instructor to accept will be assigned.`,
      });
    }
    
    if (!availableInstructors.length) {
      return res.status(404).json({ message: 'No instructor found. Please change the time or date.' });
    }
    // Create booking in 'on-hold' status
    const booking = new Booking({
      user: userId,
      date,
      city,
      area,
      status: 'on-hold',
      instructor: null,
      notifiedInstructors: availableInstructors.map(i => i._id), // Only notify available instructors
      courseName,
      durationWeeks,
      start,
      end,
    });
    await booking.save();
    res.status(201).json({ message: 'Booking created and instructors notified.', bookingId: booking._id });
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const Booking = require('../models/Booking');
    const result = await Booking.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});
// Instructor accepts a booking (first-come, first-served)
router.post('/:id/accept', async (req, res) => {
  try {
    const { instructorId } = req.body;
    if (!instructorId) return res.status(400).json({ message: 'Missing instructorId.' });
    // Atomically assign instructor if still on-hold
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, status: 'on-hold', instructor: null },
      { status: 'confirmed', instructor: instructorId },
      { new: true }
    ).populate('user').populate('notifiedInstructors');
    if (!booking) {
      return res.status(409).json({ message: 'Booking already taken or not found.' });
    }
    // Notify user and all instructors
    const winner = await Instructor.findById(instructorId);
    // Notify user
    if (booking.user && booking.user.email) {
      await transporter.sendMail({
        from: 'aryanarshad5413@gmail.com',
        to: booking.user.email,
        subject: `Your booking is confirmed!`,
        text: `Your booking for ${booking.courseName} on ${booking.date} in ${booking.city}, ${booking.area} has been confirmed with instructor ${winner.firstName} ${winner.lastName} (${winner.email}).`,
      });
    }
    // Notify winning instructor
    await transporter.sendMail({
      from: 'aryanarshad5413@gmail.com',
      to: winner.email,
      subject: `You have been assigned a booking!`,
      text: `You have been assigned to the booking for ${booking.courseName} on ${booking.date} in ${booking.city}, ${booking.area}.`,
    });
    // Notify user to pay
    if (booking.user && booking.user.email) {
      await transporter.sendMail({
        from: 'aryanarshad5413@gmail.com',
        to: booking.user.email,
        subject: 'Instructor Found! Please Complete Your Payment',
        text: `We have found an instructor for your booking (${booking.courseName} on ${booking.date} in ${booking.city}, ${booking.area}). Please log in to your dashboard and complete the payment to confirm your registration.`,
      });
    }
    // Notify other instructors
    for (const inst of booking.notifiedInstructors) {
      if (inst._id.toString() !== instructorId) {
        await transporter.sendMail({
          from: 'aryanarshad5413@gmail.com',
          to: inst.email,
          subject: `Booking already taken`,
          text: `The booking for ${booking.courseName} on ${booking.date} in ${booking.city}, ${booking.area} has already been taken by another instructor.`,
        });
      }
    }
    res.json({ message: 'Booking confirmed and assigned to you.' });
  } catch (err) {
    console.error('Booking accept error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get booking status
router.get('/:id/status', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('instructor');
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    res.json({ status: booking.status, instructor: booking.instructor });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/bookings/assigned/:instructorId
router.get('/assigned/:instructorId', async (req, res) => {
  try {
    const bookings = await Booking.find({
      instructor: req.params.instructorId,
      status: 'confirmed'
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/bookings/user/:userId - Get all bookings for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.params.userId }).populate('instructor');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 