require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const SupplierModel = require('../models/supplierModel');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToFilebase, signedUrlTools } = require('../utils/upload');
const mime = require('mime-types');

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
  const upload = multer({ storage: multer.memoryStorage() }).single('urlFoto');

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ resCode: '99', resMessage: 'File upload failed', error: err.message });
    }

    const { nama } = req.body;
    if (!nama) {
      return res.status(400).json({ resCode: '99', resMessage: 'Nama is required' });
    }

    let urlFoto = null;

    if (req.file) {
      try {
        const fileName = `supplier/${Date.now()}-${req.file.originalname}`;
        await uploadToFilebase(req.file.buffer, fileName);
        urlFoto = fileName;
      } catch (uploadError) {
        console.error('Error uploading to Filebase:', uploadError);
        return res.status(500).json({ resCode: '99', resMessage: 'Failed to upload file to Filebase', error: uploadError.message });
      }
    }

    try {
      const newSupplier = new SupplierModel({
        nama,
        urlFoto,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await newSupplier.save();

      return res.status(201).json({
        resCode: '00',
        resMessage: 'Supplier created successfully',
        Supplier: newSupplier,
      });
    } catch (saveError) {
      console.error('Error saving supplier:', saveError);
      return res.status(500).json({ resCode: '99', resMessage: 'Failed to create Supplier', error: saveError.message });
    }
  });
};

exports.updateSupplier = async (req, res) => {
  const upload = multer({ storage: multer.memoryStorage() }).single('urlFoto');

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ resCode: '99', resMessage: 'File upload failed', error: err.message });
    }

    const { id } = req.params;
    const { nama } = req.body;

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
      }

      // Ambil data supplier lama
      const existingSupplier = await SupplierModel.findById(id);
      if (!existingSupplier) {
        return res.status(404).json({ resCode: '01', message: 'Supplier not found' });
      }

      if (!nama) {
        return res.status(400).json({ resCode: '99', message: 'Nama is required' });
      }

      let newUrlFoto = existingSupplier.urlFoto;

      if (req.file) {
        try {
          const mimeType = req.file.mimetype || 'application/octet-stream';
          const fileKey = `supplier/${Date.now()}-${req.file.originalname}`;

          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.FILEBASE_BUCKET_NAME,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: mimeType,
          }));

          newUrlFoto = fileKey;

          if (existingSupplier.urlFoto) {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: process.env.FILEBASE_BUCKET_NAME,
              Key: existingSupplier.urlFoto,
            }));
          }
        } catch (uploadError) {
          console.error('Error uploading file to Filebase:', uploadError);
          return res.status(500).json({ resCode: '99', resMessage: 'File upload to Filebase failed', error: uploadError.message });
        }
      }

      // Update data supplier
      const updatedSupplier = await SupplierModel.findByIdAndUpdate(
        id,
        {
          nama,
          urlFoto: newUrlFoto,
          updated_at: new Date(),
        },
        { new: true }
      );

      res.status(200).json({
        resCode: '00',
        resMessage: 'Supplier Berhasil diupdate',
        Supplier: updatedSupplier,
      });

    } catch (err) {
      console.error('Error updating supplier:', err);
      return res.status(500).json({ resCode: '99', resMessage: 'Failed to update Supplier', error: err.message });
    }
  });
};


// delete pengguna baru
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;

  try {
    // Validasi ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const existingSupplier = await SupplierModel.findById(id);
    if (!existingSupplier) {
      return res.status(404).json({ resCode: '01', message: 'Supplier not found' });
    }

    // Hapus file dari Filebase jika ada
    let fileDeleteStatus = 'No file to delete';
    if (existingSupplier.urlFoto) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: existingSupplier.urlFoto,
        }));
        fileDeleteStatus = `File deleted: ${existingSupplier.urlFoto}`;
        console.log(fileDeleteStatus);
      } catch (fileDeleteError) {
        console.error('Error deleting file from Filebase:', fileDeleteError);
        fileDeleteStatus = 'File deletion failed';
      }
    }

    // Hapus supplier dari database
    const deletedSupplier = await SupplierModel.findByIdAndDelete(id);

    res.status(200).json({
      resCode: '00',
      resMessage: 'Supplier Berhasil dihapus',
      Supplier: deletedSupplier,
    });

  } catch (err) {
    console.error('Error deleting supplier:', err);
    res.status(500).json({ resCode: '99', message: 'Failed to delete Supplier', error: err.message });
  }
};