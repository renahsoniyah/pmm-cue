const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  file_name: { type: String, required: true },
  date: { type: String, required: true },
  path: { type: String, required: true }
});

const Report = mongoose.model('reports', reportSchema);
module.exports = Report;