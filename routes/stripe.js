const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe('sk_test_51Rj1dnBOoulucdCvbGDz4brJYHztkuL80jGSKcnQNT46g9P58pbxY36Lg3yWyMDb6Gwgv5Rr3NDfjvB2HyaDlJP7006wnXEtp1');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Instructor = require('../models/Instructor');
const nodemailer = require('nodemailer');

// JWT Secret from environment variables
const JWT_SECRET = 'this_is_a_secure_jwt_secret_123456';

// Configure nodemailer (reuse from contactRoutes.js)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aryanarshad5413@gmail.com',
    pass: 'gvyqmapsqsrrtwjm',
  },
});

// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  const { cart } = req.body;
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty or invalid.' });
  }

  try {
    const line_items = cart.map(item => ({
      price_data: {
        currency: 'cad',
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), // Stripe expects cents
      },
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      //success_url: 'http://localhost:3000/success'
      success_url: 'https://e-frontend-wf3o.vercel.app/success',
      cancel_url: 'https://e-frontend-wf3o.vercel.app/cancel',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Failed to create Stripe session.' });
  }
});

// POST /api/stripe-success
router.post('/stripe-success', async (req, res) => {
  console.log('stripe-success called', req.cookies, req.body);
  const token = req.cookies.token;
  const { packageName } = req.body;
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  if (!packageName) {
    console.log('No package provided');
    return res.status(400).json({ error: 'No package provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded);
    const userId = decoded.userId;
    let user;
    if (packageName.startsWith('course:')) {
      // Extract course name after 'course:'
      const courseName = packageName.replace('course:', '').trim();
      user = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { courses: courseName } }, // add course if not already present
        { new: true }
      );
    } else {
      // Membership package purchase
      user = await User.findByIdAndUpdate(userId, { package: packageName }, { new: true });
    }
    if (!user) {
      console.log('User not found for ID:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('User updated:', user);
    res.json({ message: 'Package updated', user });
  } catch (err) {
    console.error('Stripe success error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Confirm booking and send emails
router.post('/booking/confirm', async (req, res) => {
  try {
    const { instructorEmail, clientEmail, clientName, bookings, courseName, durationWeeks } = req.body;
    // Add clientEmail and clientName to each booking
    const bookingsWithClient = (bookings || []).map(b => ({ ...b, clientEmail, clientName }));
    // Add bookings to instructor
    const instructor = await Instructor.findOneAndUpdate(
      { email: instructorEmail },
      { $push: { bookings: { $each: bookingsWithClient } } },
      { new: true }
    );
    if (!instructor) return res.status(404).json({ message: 'Instructor not found' });

    // Validation for emails
    if (!clientEmail || !instructor.email) {
      return res.status(400).json({ message: 'Missing client or instructor email' });
    }

    // Email content
    const bookingDates = bookings.map(b => `${b.date} (${b.start} - ${b.end})`).join('\n');
    const clientMsg = `Dear ${clientName},\n\nYour booking for the course "${courseName}" (${durationWeeks} weeks) is confirmed!\n\nDates:\n${bookingDates}\n\nInstructor: ${instructor.firstName} ${instructor.lastName}\nEmail: ${instructor.email}\n\nThank you!`;
    const instructorMsg = `Dear ${instructor.firstName},\n\nYou have a new booking for the course "${courseName}" (${durationWeeks} weeks).\n\nDates:\n${bookingDates}\n\nClient: ${clientName}\nEmail: ${clientEmail}\n\nPlease prepare accordingly.`;

    // Send emails
    await transporter.sendMail({
      from: 'aryanarshad5413@gmail.com',
      to: clientEmail,
      subject: `Booking Confirmed: ${courseName}`,
      text: clientMsg,
    });
    await transporter.sendMail({
      from: 'aryanarshad5413@gmail.com',
      to: instructor.email,
      subject: `New Course Booking: ${courseName}`,
      text: instructorMsg,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Booking confirmation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 
