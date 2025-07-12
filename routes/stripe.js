const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe('sk_test_51Rj1dnBOoulucdCvbGDz4brJYHztkuL80jGSKcnQNT46g9P58pbxY36Lg3yWyMDb6Gwgv5Rr3NDfjvB2HyaDlJP7006wnXEtp1');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Secret from environment variables
const JWT_SECRET = 'this_is_a_secure_jwt_secret_123456';

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
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
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

module.exports = router; 
