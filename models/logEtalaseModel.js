const mongoose = require('mongoose');

// Schema untuk model Etalase
const logetalasesSchema = new mongoose.Schema({
  _id: { 
    type: mongoose.Schema.Types.ObjectId, 
    auto: true
  },
  nama: { 
    type: String, 
    required: true 
  },
  fotoBarang: { 
    type: String, 
    required: false 
  },
  size: { 
    type: String, 
    required: true 
  },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  bentukBarang: { 
    type: String, 
    required: true 
  },
  settinganMC: { 
    type: String, 
    required: false 
  },
  jumlahKiloBefore: { 
    type: String, 
    required: false 
  },
  jumlahKiloAfter: { 
    type: String, 
    required: false 
  },
  jumlahMCPLSBefore: { 
    type: String, 
    required: false 
  },
  jumlahMCPLSAfter: { 
    type: String, 
    required: false 
  },
  hargaJual: { 
    type: String, 
    required: true 
  },
  hargaBeliSupplier: { 
    type: String, 
    required: true 
  },
  jumlahPembayaran: { 
    type: String, 
    required: false 
  },
  suratJalan: { 
    type: String, 
    required: false 
  },
  status: { 
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

// Model Etalase
const logetalases = mongoose.models.logetalases || mongoose.model('logetalases', logetalasesSchema);

module.exports = logetalases;
