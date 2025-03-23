require('dotenv').config();

const mongoose = require('mongoose');

// Fungsi untuk menghubungkan ke database MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.DB_URI}/${process.env.DB_NAME}`);
    console.log('MongoDB connected successfully!');
  } catch (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1);  // Hentikan aplikasi jika koneksi gagal
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