const mongoose = require('mongoose');

// Schema untuk model Param
const paramSchema = new mongoose.Schema({
  _id: { 
    type: mongoose.Schema.Types.ObjectId, 
    auto: true
  },
  nama: { 
    type: String, 
    required: true 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
}, {
  // Opsi untuk otomatis mengupdate `updated_at` setiap kali dokumen diperbarui
  timestamps: true
});

// Model Param
const Param = mongoose.models.params || mongoose.model('params', paramSchema);

module.exports = Param;
