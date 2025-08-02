const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cardRoutes = require('../routes/cardRoutes');

const authRoutes = require('../routes/auth');
const newsRoutes = require('../routes/newsRoutes');
const blogRoutes = require('../routes/blogRoutes');
const courseRoutes = require('../routes/courseRoutes');
const featuredListingRoutes = require('../routes/featuredListingRoutes');
const stripeRoutes = require('../routes/stripe');
const directoryRoutes = require('../routes/directoryRoutes');
const newsletterRoutes = require('../routes/newsletterRoutes');
const contactRoutes = require('../routes/contactRoutes');
const instructorRoutes = require('../routes/instructor');
const bookingRoutes = require('../routes/bookingRoutes');

const app = express();

// CORS middleware - must be before any routes or express.json()
app.use(cors({
   origin: 'http://localhost:3000',
   //origin: '*',
   credentials: true
 }));

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api', authRoutes);
app.use('/api', stripeRoutes);
app.use('/card', cardRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/featured-listings', featuredListingRoutes);
app.use('/api/directory', directoryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/bookings', bookingRoutes);

// MongoDB Connection
mongoose.connect('mongodb+srv://aryan:2021cs613@cluster0.o8bu9nt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
.then(() => {
  console.log('Connected to MongoDB');
  const PORT = 5001;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
})
.catch((err) => console.error('MongoDB connection failed:', err));

