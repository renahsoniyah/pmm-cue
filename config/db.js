require('dotenv').config();

const mongoose = require('mongoose');

// Fungsi untuk menghubungkan ke database MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI, {
      dbName: process.env.DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 60000, // Timeout lebih lama (60 detik)
      socketTimeoutMS: 60000,          // Socket timeout (60 detik)
      connectTimeoutMS: 60000,         // Koneksi timeout (60 detik)
    });
    console.log('✅ MongoDB connected successfully!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Event listeners untuk status koneksi
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to the database.');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose connection is disconnected.');
});

module.exports = connectDB;