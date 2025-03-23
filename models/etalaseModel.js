const mongoose = require('mongoose');

// Schema untuk model Etalase
const etalaseSchema = new mongoose.Schema({
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
  noSurat: { 
    type: String, 
    required: true 
  },
  settinganMC: { 
    type: String, 
    required: false 
  },
  jumlahKilo: { 
    type: String, 
    required: false 
  },
  jumlahMCPLS: { 
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
  inActiveDate: { 
    type: Date, 
    required: false,
    default: null
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
const Etalase = mongoose.models.etalase || mongoose.model('etalases', etalaseSchema);

module.exports = Etalase;
