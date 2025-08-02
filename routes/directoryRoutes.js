const express = require('express');
const multer = require('multer');
const { cloudinary } = require('../cloudinary');
const Directory = require('../models/Directory');
const FeaturedListing = require('../models/FeaturedListing');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST: Add a directory listing
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { company, email, phone, address, website, socialType, socialLink, industry, description, userPackage } = req.body;
    // Check if a listing already exists for this email
    const existing = await Directory.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'You have already filled the form.' });
    }
    let imageUrl = '';
    if (userPackage === 'premium' && req.file) {
      // Upload image to cloudinary
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: 'directory_logos',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });
      imageUrl = result.secure_url;
      // Also save to FeaturedListing
      await new FeaturedListing({ imageUrl }).save();
    }
    const directory = new Directory({
      company,
      email,
      phone,
      address,
      website, // keep for backward compatibility
      socialType,
      socialLink,
      industry,
      description,
      imageUrl,
      package: userPackage,
    });
    await directory.save();
    res.status(201).json(directory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: All directory listings
router.get('/', async (req, res) => {
  try {
    const listings = await Directory.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Unique categories from directory listings
router.get('/categories', async (req, res) => {
  try {
    const categories = await Directory.distinct('industry');
    res.json(categories.filter(category => category && category.trim() !== ''));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 