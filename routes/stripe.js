const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

// Health check endpoint to test Stripe connection
router.get('/health', async (req, res) => {
  try {
    // Test Stripe connection by getting account info
    const account = await stripe.accounts.retrieve();
    res.json({ 
      status: 'Stripe is working', 
      account: account.id,
      stripeKey: process.env.STRIPE_SECRET_KEY ? 'Using env var' : 'Using fallback key'
    });
  } catch (error) {
    console.error('Stripe health check failed:', error);
    res.status(500).json({ 
      status: 'Stripe connection failed', 
      error: error.message,
      stripeKey: process.env.STRIPE_SECRET_KEY ? 'Using env var' : 'Using fallback key'
    });
  }
});

// Stripe configuration with environment variable support
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_51Rj1dnBOoulucdCvbGDz4brJYHztkuL80jGSKcnQNT46g9P58pbxY36Lg3yWyMDb6Gwgv5Rr3NDfjvB2HyaDlJP7006wnXEtp1';
console.log('Using Stripe key:', stripeKey.substring(0, 20) + '...');

// Check if the key is properly formatted
if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
  console.error('❌ Invalid Stripe key format. Key must start with sk_test_ or sk_live_');
  console.error('Please get your Stripe key from: https://dashboard.stripe.com/apikeys');
}

const stripe = Stripe(stripeKey);

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
  console.log('Creating checkout session with cart:', req.body);
  
  const { cart } = req.body;
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    console.log('Invalid cart data:', cart);
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

    // Use the actual website domain for success/cancel URLs
    const successUrl = 'https://co2e.vercel.app/success';
    const cancelUrl = 'https://co2e.vercel.app/cancel';
    console.log('Creating Stripe session with success URL:', successUrl);
    console.log('Creating Stripe session with cancel URL:', cancelUrl);
    console.log('Line items:', line_items);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    
    console.log('Stripe session created successfully:', session.id);

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    console.error('Stripe error details:', {
      message: err.message,
      type: err.type,
      code: err.code,
      statusCode: err.statusCode
    });
    
    // Provide more specific error messages
    if (err.type === 'StripeCardError') {
      res.status(400).json({ error: 'Card error: ' + err.message });
    } else if (err.type === 'StripeInvalidRequestError') {
      res.status(400).json({ error: 'Invalid request: ' + err.message });
    } else if (err.type === 'StripeAPIError') {
      res.status(500).json({ error: 'Stripe API error: ' + err.message });
    } else {
      res.status(500).json({ error: 'Failed to create Stripe session: ' + err.message });
    }
  }
});

// POST /api/stripe-success
router.post('/stripe-success', async (req, res) => {
  console.log('stripe-success called', req.cookies, req.body);
  const token = req.cookies.token;
  const { packageName, bookingId } = req.body;
  console.log('Received bookingId:', bookingId);
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
    // If bookingId is provided, send registration confirmation email
    if (bookingId) {
      const Booking = require('../models/Booking');
      const Instructor = require('../models/Instructor');
      // Set booking as paid
      await Booking.findByIdAndUpdate(bookingId, { paid: true });
      const booking = await Booking.findById(bookingId).populate('instructor');
      if (booking && booking.instructor) {
        console.log('Sending confirmation email to:', user.email);
        await transporter.sendMail({
          from: 'aryanarshad5413@gmail.com',
          to: user.email,
          subject: 'Registration Confirmed!',
          text: `Your registration is confirmed! Your instructor is ${booking.instructor.firstName} ${booking.instructor.lastName} (${booking.instructor.email}). Thank you for your payment!`,
        });
        // Send email to instructor as well
        await transporter.sendMail({
          from: 'aryanarshad5413@gmail.com',
          to: booking.instructor.email,
          subject: 'Client Payment Received - You Can Start the Course',
          text: `Dear ${booking.instructor.firstName},\n\nYour client (${user.firstName} ${user.lastName}, ${user.email}) has successfully completed the payment for the course: ${booking.courseName} on ${booking.date} in ${booking.city}, ${booking.area}.\n\nYou can now start the course as scheduled.\n\nThank you!`,
        });
      } else {
        console.log('Booking or instructor not found for bookingId:', bookingId);
      }
    } else {
      console.log('No bookingId provided, not sending email.');
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
