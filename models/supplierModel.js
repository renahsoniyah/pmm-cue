const mongoose = require('mongoose');

// Schema untuk model Supplier
const supplierSchema = new mongoose.Schema({
  _id: { 
    type: mongoose.Schema.Types.ObjectId, 
    auto: true
  },
  nama: { 
    type: String, 
    required: true 
  },
  urlFoto: { 
    type: String, 
    required: false 
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

// Model Supplier
const Supplier = mongoose.models.suppliers || mongoose.model('suppliers', supplierSchema);

module.exports = Supplier;
