const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('./tokenMiddleware');
require('dotenv').config();

exports.authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ resCode: '99', message: 'Akses ditolak, token tidak tersedia' });
  }

  try {
    const cleanToken = token.replace('Bearer ', '');
    
    // Cek apakah token ada di blacklist
    if (isTokenBlacklisted(cleanToken)) {
      return res.status(401).json({ resCode: '99', message: 'Token telah logout, silakan login kembali' });
    }

    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ resCode: '99', message: 'Session Expired, Silahkan Login kembali' });
  }
};
