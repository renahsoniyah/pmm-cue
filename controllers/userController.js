const UserModel = require('../models/userModel');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Mendapatkan semua pengguna
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.body.index) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const skip = (page - 1) * limit;

    const User = await UserModel.aggregate([
      { $sort: { updated_at: -1 } }, // Urutkan dari yang terbaru ke yang lama
      { $skip: skip },
      { $limit: limit }
    ]);

    const totalRecords = await UserModel.countDocuments();

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil Mendapatkan data',
      user: User,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (err) {
    return res.status(500).json({ resCode: '99', message: 'Error fetching Account', error: err });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Konversi id menjadi ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format', });
    }

    const user = await UserModel.findById(id); 
    
    if (!user) {
      return res.status(404).json({ resCode: '01', message: 'User not found', user: [], });
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil Mendapatkan data',
      user: user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', message: 'Failed to retrieve user', error: err.message });
  }
};

// Membuat pengguna baru
exports.createUser = async (req, res) => {
  const { email, nama, level, password } = req.body;
  
  try {
    // Membuat pengguna baru
    const newUser = new User({
      email,
      nama,
      level: 'karyawan',
      password,
      status: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Simpan pengguna ke database
    await newUser.save();
    
    return res.status(201).json({
      resCode: '00',
      resMessage: 'User created successfully',
      user: newUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', resMessage: 'Failed to create user', error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { email, nama, level, password, status } = req.body;

  try {
    // Cek apakah ID valid sebelum dipakai di MongoDB
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    let updateData = { 
      email, 
      nama, 
      level, 
      status, 
      updated_at: new Date() 
    };
    
    // Hash password hanya jika ada di request
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      id, updateData, { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ resCode: '01', message: 'User not found' });
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: 'User berhasil diupdate',
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', message: 'Failed to update user', error: err.message });
  }
};

// delete pengguna baru
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Cek apakah ID valid sebelum dipakai di MongoDB
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const deletedUser = await UserModel.findOneAndDelete(id);
    
    if (!deletedUser) {
      return res.status(404).json({ resCode: '01', message: 'User not found' });
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: 'User Berhasil di hapus',
      user: deletedUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', message: 'Failed to delete user', error: err.message });
  }
};