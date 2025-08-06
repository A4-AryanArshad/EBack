const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Instructor = require('../models/Instructor');

const router = express.Router();

// JWT Secret from environment variables
const JWT_SECRET = 'this_is_a_secure_jwt_secret_123456';

// Signup Route
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully.' });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET, // ✅ using hardcoded key
      { expiresIn: '2d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // More compatible with iPhone
      maxAge: 2 * 24 * 60 * 60 * 1000 // 2 days
    });

    res.status(200).json({ message: 'Login successful', package: user.package, userId: user._id, token: token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Instructor Login
router.post('/instructor-login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const instructor = await Instructor.findOne({ email });
    if (!instructor) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await require('bcryptjs').compare(password, instructor.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    // Set JWT cookie for instructor
    const token = jwt.sign(
      { instructorId: instructor._id },
      JWT_SECRET,
      { expiresIn: '2d' }
    );
    res.cookie('instructor_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', // More compatible with iPhone
      maxAge: 2 * 24 * 60 * 60 * 1000 // 2 days
    });












    res.status(200).json({ message: 'Instructor login successful', isInstructor: true, instructorId: instructor._id, token: token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  // Check for token in cookies first, then Authorization header (for iPhone Safari fallback)
  let token = req.cookies.token;
  
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '');
  }
  
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      email: user.email,
      package: user.package,
      courses: user.courses || [],
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role || 'user',
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
