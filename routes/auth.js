const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Instructor = require('../models/Instructor');
const nodemailer = require('nodemailer');

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

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email, language = 'en' } = req.body;
  console.log('Forgot password request for email:', email, 'language:', language);
  
  if (!email) return res.status(400).json({ message: 'Email is required.' });
  const user = await User.findOne({ email });
  if (!user) {
    console.log('User not found for email:', email);
    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  }
  
  console.log('User found:', user.email, user.firstName);

  // Generate reset token (JWT)
  const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();
  console.log('Reset token generated and saved');

  // Email templates for different languages
  const emailTemplates = {
    en: {
      subject: 'Password Reset - CO2e Portal',
      text: `Hello ${user.firstName},\n\nYou requested a password reset for your CO2e Portal account.\n\nClick the link below to reset your password:\nhttp://localhost:3000/reset-password?token=${resetToken}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nCO2e Portal Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${user.firstName},</p>
          <p>You requested a password reset for your CO2e Portal account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="http://localhost:3000/reset-password?token=${resetToken}" 
             style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Best regards,<br>CO2e Portal Team</p>
        </div>
      `
    },
    es: {
      subject: 'Restablecimiento de Contraseña - CO2e Portal',
      text: `Hola ${user.firstName},\n\nSolicitaste un restablecimiento de contraseña para tu cuenta de CO2e Portal.\n\nHaz clic en el enlace de abajo para restablecer tu contraseña:\nhttp://localhost:3000/reset-password?token=${resetToken}\n\nEste enlace expirará en 1 hora.\n\nSi no solicitaste esto, por favor ignora este correo electrónico.\n\nSaludos cordiales,\nEquipo de CO2e Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Solicitud de Restablecimiento de Contraseña</h2>
          <p>Hola ${user.firstName},</p>
          <p>Solicitaste un restablecimiento de contraseña para tu cuenta de CO2e Portal.</p>
          <p>Haz clic en el botón de abajo para restablecer tu contraseña:</p>
          <a href="http://localhost:3000/reset-password?token=${resetToken}" 
             style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Restablecer Contraseña
          </a>
          <p style="color: #666; font-size: 14px;">Este enlace expirará en 1 hora.</p>
          <p style="color: #666; font-size: 14px;">Si no solicitaste esto, por favor ignora este correo electrónico.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Saludos cordiales,<br>Equipo de CO2e Portal</p>
        </div>
      `
    },
    fr: {
      subject: 'Réinitialisation de mot de passe - CO2e Portal',
      text: `Bonjour ${user.firstName},\n\nVous avez demandé une réinitialisation de mot de passe pour votre compte CO2e Portal.\n\nCliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :\nhttp://localhost:3000/reset-password?token=${resetToken}\n\nCe lien expirera dans 1 heure.\n\nSi vous n'avez pas demandé cela, veuillez ignorer cet e-mail.\n\nCordialement,\nL'équipe CO2e Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Demande de réinitialisation de mot de passe</h2>
          <p>Bonjour ${user.firstName},</p>
          <p>Vous avez demandé une réinitialisation de mot de passe pour votre compte CO2e Portal.</p>
          <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
          <a href="http://localhost:3000/reset-password?token=${resetToken}" 
             style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">
            Réinitialiser le mot de passe
          </a>
          <p style="color: #666; font-size: 14px;">Ce lien expirera dans 1 heure.</p>
          <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cela, veuillez ignorer cet e-mail.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">Cordialement,<br>L'équipe CO2e Portal</p>
        </div>
      `
    }
  };

  // Get template based on language (default to English)
  const template = emailTemplates[language] || emailTemplates.en;

  // Send real email with nodemailer using existing working credentials
  try {
    console.log('Attempting to send email...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'aryanarshad5413@gmail.com',
        pass: 'gvyqmapsqsrrtwjm',
      },
    });
    
    console.log('Transporter created, sending email...');
    await transporter.sendMail({
      from: 'aryanarshad5413@gmail.com',
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html
    });
    console.log('Email sent successfully to:', user.email);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Error sending reset email:', err);
    res.status(500).json({ message: 'Error sending reset email.' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId, resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid or expired token.' });
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
