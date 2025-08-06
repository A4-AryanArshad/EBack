const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cardRoutes = require('./routes/cardRoutes');

const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/newsRoutes');
const blogRoutes = require('./routes/blogRoutes');
const courseRoutes = require('./routes/courseRoutes');
const featuredListingRoutes = require('./routes/featuredListingRoutes');
const stripeRoutes = require('./routes/stripe');
const directoryRoutes = require('./routes/directoryRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const contactRoutes = require('./routes/contactRoutes');
const instructorRoutes = require('./routes/instructor');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();

// CORS middleware - must be before any routes or express.json()
app.use(cors({
   origin: ['http://localhost:3000', 'https://efrontend.vercel.app', 'https://efrontend-git-main-efrontend.vercel.app', '*'],
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
   allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
   preflightContinue: false,
   optionsSuccessStatus: 200
 }));

app.use(express.json());
app.use(cookieParser());

// Middleware to handle Authorization headers for iPhone Safari
app.use((req, res, next) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }
  
  // For iPhone Safari, if no cookie token but Authorization header exists, set it as cookie
  if (!req.cookies.token && req.headers.authorization) {
    const token = req.headers.authorization.replace('Bearer ', '');
    req.cookies.token = token;
  }
  
  next();
});

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

