require('../scheduler/BackupScheduler');
const dotenv = require('dotenv'); // Memuat variabel lingkungan dari file .env
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
// Import fungsi koneksi ke MongoDB
const connectDB = require('../config/db');

// Import route API
const apiRoutes = require('../routes/api');

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Middleware untuk mengizinkan akses ke folder uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// Koneksi ke MongoDB
connectDB();

// API Routes
app.use('/api', apiRoutes);

// Mulai server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});