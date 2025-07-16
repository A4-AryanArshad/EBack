const express = require('express');
const bcrypt = require('bcryptjs');
const Instructor = require('../models/Instructor');

const router = express.Router();

// Add Instructor
router.post('/add', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const existing = await Instructor.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newInstructor = new Instructor({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });
    await newInstructor.save();
    res.status(201).json({ message: 'Instructor added successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Get all instructors
router.get('/', async (req, res) => {
  try {
    const { city, location } = req.query;
    let filter = {};
    if (city) filter.city = { $regex: `^${city}$`, $options: 'i' };
    if (location) filter.location = { $regex: `^${location}$`, $options: 'i' };
    const instructors = await Instructor.find(filter);
    res.json(instructors);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete instructor by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const instructor = await Instructor.findByIdAndDelete(id);
    if (!instructor) {
      return res.status(404).json({ message: 'Instructor not found' });
    }
    res.status(200).json({ message: 'Instructor deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get instructor profile by email
router.get('/profile/:email', async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.params.email });
    if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update instructor profile (regions, subjects, city, location)
router.put('/profile/:email', async (req, res) => {
  try {
    const { regions, subjects, city, location } = req.body;
    const updateFields = {};
    if (regions) updateFields.regions = regions;
    if (subjects) updateFields.subjects = subjects; // now array of {name, durationWeeks}
    if (city) updateFields.city = city;
    if (location) updateFields.location = location;
    const instructor = await Instructor.findOneAndUpdate(
      { email: req.params.email },
      { $set: updateFields },
      { new: true }
    );
    if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Set availability
router.put('/availability/:email', async (req, res) => {
  try {
    const { availability } = req.body;
    const instructor = await Instructor.findOneAndUpdate(
      { email: req.params.email },
      { $set: { availability } },
      { new: true }
    );
    if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a specific availability slot for a day
router.put('/availability/:email/:day/:slotIdx', async (req, res) => {
  try {
    const { email, day, slotIdx } = req.params;
    const { start, end } = req.body;
    console.log('Edit slot request:', { email, day, slotIdx, start, end });
    const instructor = await Instructor.findOne({ email });
    if (!instructor) {
      console.log('Instructor not found:', email);
      return res.status(404).json({ message: 'Instructor not found' });
    }
    let daySlots = instructor.availability.get(day) || [];
    if (!daySlots[slotIdx]) {
      console.log('Slot not found:', { day, slotIdx, daySlots });
      return res.status(404).json({ message: 'Slot not found' });
    }
    daySlots[slotIdx] = { start, end };
    instructor.availability.set(day, daySlots);
    await instructor.save();
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a specific availability slot for a day
router.delete('/availability/:email/:day/:slotIdx', async (req, res) => {
  try {
    const { email, day, slotIdx } = req.params;
    const instructor = await Instructor.findOne({ email });
    if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
    let daySlots = instructor.availability.get(day) || [];
    if (!daySlots[slotIdx]) return res.status(404).json({ message: 'Slot not found' });
    daySlots.splice(slotIdx, 1);
    instructor.availability.set(day, daySlots);
    await instructor.save();
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a booking or multiple bookings
router.post('/booking/:email', async (req, res) => {
  try {
    const { bookings } = req.body;
    if (Array.isArray(bookings)) {
      // Add multiple bookings
      const instructor = await Instructor.findOneAndUpdate(
        { email: req.params.email },
        { $push: { bookings: { $each: bookings } } },
        { new: true }
      );
      if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
      res.json(instructor);
    } else {
      // Single booking (backward compatibility)
      const { date, start, end, subject, location, studentCount } = req.body;
      const instructor = await Instructor.findOneAndUpdate(
        { email: req.params.email },
        { $push: { bookings: { date, start, end, subject, location, studentCount } } },
        { new: true }
      );
      if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
      res.json(instructor);
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bookings
router.get('/bookings/:email', async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.params.email });
    if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
    res.json(instructor.bookings || []);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a booking by index
router.delete('/booking/:email/:bookingIdx', async (req, res) => {
  try {
    const { email, bookingIdx } = req.params;
    const instructor = await Instructor.findOne({ email });
    if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
    if (!instructor.bookings[bookingIdx]) return res.status(404).json({ message: 'Booking not found' });
    instructor.bookings.splice(bookingIdx, 1);
    await instructor.save();
    res.json({ success: true, bookings: instructor.bookings });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 