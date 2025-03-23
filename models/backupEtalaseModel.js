const mongoose = require('mongoose');

// Schema untuk model Backup Etalase
const backupEtalaseSchema = new mongoose.Schema({
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
    type: String, 
    required: false 
  },
  backup_date: {
    type: Date,
    default: Date.now,
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
  timestamps: true
});

// Model Backup Etalase
const BackupEtalase = mongoose.models.backupEtalase || mongoose.model('backupEtalases', backupEtalaseSchema);

module.exports = BackupEtalase;
