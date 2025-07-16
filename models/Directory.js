const mongoose = require('mongoose');

const DirectorySchema = new mongoose.Schema({
  company: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  website: { type: String },
  socialType: { type: String }, // new
  socialLink: { type: String }, // new
  industry: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String }, // Only for premium
  package: { type: String }, // pro, premium, or undefined for free
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Directory', DirectorySchema); 