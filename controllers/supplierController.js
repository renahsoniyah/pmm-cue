require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const SupplierModel = require('../models/supplierModel');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToFilebase, signedUrlTools } = require('../utils/upload');
const mime = require('mime-types');

// Konfigurasi multer untuk menyimpan file ke folder `uploads`
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Folder penyimpanan
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Simpan dengan nama unik
  }
});

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.FILEBASE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,
  },
});

// Mendapatkan semua pengguna
exports.getSuppliers = async (req, res) => {
  try {
    const page = parseInt(req.body.index) || 1; // Default to page 1
    const limit = parseInt(req.body.limit) || 10; // Default limit to 10
    const skip = (page - 1) * limit;

    const temp = await SupplierModel.find().skip(skip).limit(limit);
    const totalRecords = await SupplierModel.countDocuments();

    // **Generate Pre-signed URL jika urlFoto ada**
    for (let supplier of temp) {
      if (supplier.urlFoto) {
        supplier.urlFoto = await signedUrlTools(supplier.urlFoto);
      }
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil Mendapatkan data',
      Supplier: temp,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (err) {
    return res.status(500).json({ resCode: '99', message: 'Error fetching Suppliers', error: err });
  }
};

exports.getSupplierById = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Konversi id menjadi ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const Supplier = await SupplierModel.findById(id); 
    
    if (!Supplier) {
      return res.status(404).json({ resCode: '01', message: 'Supplier not found', Supplier: {}});
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil Mendapatkan data',
      Supplier: Supplier,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', message: 'Failed to retrieve Supplier', error: err.message });
  }
};

// Membuat pengguna baru
exports.createSupplier = async (req, res) => {
  const upload = multer({ storage: storage }).single('urlFoto'); // 'foto' harus sesuai dengan field di form-data

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ resCode: '99', resMessage: 'File upload failed', error: err.message });
    }

    const { nama } = req.body;
    // **Upload ke Filebase jika ada file**
    let urlFoto = null;
    if (req.file) {
      const filePath = req.file.path; // Path lokal
      const fileName = `supplier/${Date.now()}-${req.file.filename}`; // Path di Filebase
      await uploadToFilebase(filePath, fileName); // Dapatkan URL dari Filebase
      urlFoto = fileName
    }

    try {
      // Membuat supplier baru
      const newSupplier = new SupplierModel({
        nama,
        urlFoto,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Simpan ke database
      await newSupplier.save();

      return res.status(201).json({
        resCode: '00',
        resMessage: 'Supplier created successfully',
        Supplier: newSupplier,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ resCode: '99', resMessage: 'Failed to create Supplier', error: err.message });
    }
  });
};

exports.updateSupplier = async (req, res) => {
  const upload = multer({ storage: storage }).single('urlFoto'); // 'urlFoto' sesuai dengan field di form-data

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ resCode: '99', resMessage: 'File upload failed', error: err.message });
    }

    const { id } = req.params;
    const { nama } = req.body;
    const newUrlFoto = req.file ? `/uploads/${req.file.filename}` : null; // Simpan path file jika ada

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
      }

      // **Ambil data supplier lama**
      const existingSupplier = await SupplierModel.findById(id);
      if (!existingSupplier) {
        return res.status(404).json({ resCode: '01', message: 'Supplier not found' });
      }

      // **Hapus file lama jika ada dan user mengupload file baru**
      // if (newUrlFoto && existingSupplier.urlFoto) {
      //   const oldFilePath = path.join(__dirname, '..', existingSupplier.urlFoto);
      //   if (fs.existsSync(oldFilePath)) {
      //     fs.unlinkSync(oldFilePath);
      //   }
      // }
      let newUrlFoto = existingSupplier.urlFoto;

      if (req.file) {
        const fileContent = fs.readFileSync(req.file.path);
        const fileExtension = path.extname(req.file.originalname);
        const mimeType = mime.lookup(req.file.originalname) || 'application/octet-stream';
        const fileKey = `supplier/${Date.now()}-${req.file.filename}${fileExtension}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: fileKey,
          Body: fileContent,
          ContentType: mimeType,
        }));

        newUrlFoto = fileKey;

        if (existingSupplier.urlFoto) {
          const oldKey = existingSupplier.urlFoto;
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.FILEBASE_BUCKET_NAME,
            Key: oldKey,
          }));
        }

        fs.unlinkSync(req.file.path); // Bersihkan file lokal
      }

      // **Update data supplier**
      const updatedSupplier = await SupplierModel.findByIdAndUpdate(
        id,
        { 
          nama,
          urlFoto: newUrlFoto || existingSupplier.urlFoto, // Gunakan file baru jika ada, jika tidak, tetap pakai yang lama
          updated_at: new Date(),
        },
        { new: true } // Agar data terbaru dikembalikan
      );

      res.status(200).json({
        resCode: '00',
        resMessage: 'Supplier Berhasil diupdate',
        Supplier: updatedSupplier,
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ resCode: '99', resMessage: 'Failed to update Supplier', error: err.message });
    }
  });
};

// delete pengguna baru
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Cek apakah ID valid sebelum dipakai di MongoDB
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const existingSupplier = await SupplierModel.findById(id);
    if (!existingSupplier) {
      return res.status(404).json({ resCode: '01', message: 'Supplier not found' });
    }

    // Hapus file dari Filebase jika ada
    if (existingSupplier.urlFoto) {
      const fileKey = existingSupplier.urlFoto;

      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: fileKey,
        }));
        console.log('File deleted from Filebase:', fileKey);
      } catch (fileDeleteError) {
        console.error('Error deleting file from Filebase:', fileDeleteError);
      }
    }

    const deletedSupplier = await SupplierModel.findByIdAndDelete(id);
    
    if (!deletedSupplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.status(200).json({
      resCode: '00',
      resMessage: 'Supplier Berhasil di hapus',
      Supplier: deletedSupplier,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ resCode: '01', message: 'Failed to delete Supplier', error: err.message });
  }
};