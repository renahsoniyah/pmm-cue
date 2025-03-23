const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Schema untuk model User
const userSchema = new mongoose.Schema({
  _id: { 
    type: mongoose.Schema.Types.ObjectId, 
    auto: true
  },
  email: { 
    type: String, 
    required: true,
    unique: true
  },
  nama: { 
    type: String, 
    required: true 
  },
  level: { 
    type: String, 
    enum: ['admin', 'karyawan'], 
    required: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  status: { 
    type: Boolean, 
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
  timestamps: true // Otomatis set `created_at` & `updated_at`
});

// **Middleware sebelum menyimpan (`save`)**
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Model User
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
