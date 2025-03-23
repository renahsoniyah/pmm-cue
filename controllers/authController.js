const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { addToBlacklist } = require('../middlewares/tokenMiddleware');

require('dotenv').config();

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ id: user._id, level: user.level }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};

// Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Cek user berdasarkan email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ resCode: '99', message: 'Email atau password salah' });
    }

    // Cek password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ resCode: '01', message: 'Email atau password salah' });
    }

    // Buat token
    const token = generateToken(user);

    res.status(200).json({ resCode: '00', resMessage: 'Login berhasil', token, userid: user.id, name: user.nama, email: user.email, level: user.level, status: user.status });
  } catch (err) {
    res.status(500).json({ resCode: '99', message: 'Terjadi kesalahan', error: err.message });
  }
};

exports.logout = (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(400).json({ resCode: '01', message: 'Token tidak ditemukan' });
  }

  addToBlacklist(token);
  res.status(200).json({ resCode: '00', resMessage: 'Logout berhasil' });
};