require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const EtalaseModel = require('../models/etalaseModel');
const SupplierModel = require('../models/supplierModel');
const logEtalaseModel = require('../models/logEtalaseModel');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment'); // Pastikan moment.js terinstall
const { uploadToFilebase, signedUrlTools } = require('../utils/upload');
const mime = require('mime-types');
const Report = require('../models/reportModel');
const PDFDocument = require('pdfkit');

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.FILEBASE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,
  },
});

exports.getEtalases = async (req, res) => {
  try {
    const page = parseInt(req.body.index) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const skip = (page - 1) * limit;
    const bentukBarang = req.body.bentukBarang;
    const search = req.body.search || ''; // Keyword pencarian

    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const endOfToday = new Date(now.setHours(23, 59, 59, 999));

    let matchStage = {
      $and: [
        {
          $or: [
            { inActiveDate: { $exists: false } },
            { inActiveDate: null },
            { inActiveDate: "" },
            {
              inActiveDate: {
                $gte: startOfToday,
                $lte: endOfToday
              }
            }
          ]
        }
      ]
    };

    if (bentukBarang) {
      matchStage.$and.push({ bentukBarang: bentukBarang });
    }

    if (search) {
      matchStage.$and.push({
        $or: [
          { nama: { $regex: search, $options: 'i' } },
        ]
      });
    }

    const Etalases = await EtalaseModel.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierData'
        }
      },
      { $sort: { updated_at: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    for (let etalase of Etalases) {
      if (etalase.fotoBarang) {
        etalase.fotoBarang = await signedUrlTools(etalase.fotoBarang);
      }
    }

    const totalRecords = await EtalaseModel.countDocuments(matchStage);

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil mendapatkan data',
      Etalase: Etalases,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', message: 'Error fetching Etalases', error: err.message });
  }
};

exports.getDistinctEtalases = async (req, res) => {
  try {
    const { type, nama, size } = req.body;

    // Validasi tipe distinct yang diperbolehkan
    if (!['nama', 'size', 'supplier'].includes(type)) {
      return res.status(400).json({
        resCode: '01',
        resMessage: 'Jenis distinct tidak valid. Gunakan: nama, size, atau supplier'
      });
    }

    // Set waktu ke 00:00:00 untuk membandingkan tanggal dengan benar
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let matchStage = {
      $or: [
        { inActiveDate: { $exists: false } }, // Jika tidak ada inActiveDate
        { inActiveDate: null },              // Jika null
        { inActiveDate: "" },                // Jika kosong
      ]
    };

    // Tambahkan filter jika nama atau size diberikan
    if (nama) {
      matchStage.nama = nama;
    }
    if (size) {
      matchStage.size = size;
    }

    let distinctData;
    
    // Jika type adalah supplier, lakukan lookup dan filter
    if (type === 'supplier') {
      distinctData = await EtalaseModel.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "suppliers",
            localField: "supplier",
            foreignField: "_id",
            as: "supplierData"
          }
        },
        { $unwind: "$supplierData" },
        {
          $project: {
            _id: 1,
            supplier: "$supplierData",
            nama: 1,
            fotoBarang: 1,
            size: 1,
            bentukBarang: 1,
            settinganMC: 1,
            jumlahKilo: 1,
            jumlahMCPLS: 1,
            hargaJual: 1,
            hargaBeliSupplier: 1,
            created_at: 1,
            updated_at: 1
          }
        }
      ]);

      // **Generate Pre-signed URL jika fotoBarang ada**
      for (let etalase of distinctData) {
        if (etalase.fotoBarang) {
          etalase.fotoBarang = await signedUrlTools(etalase.fotoBarang);
        }
      }
    } else {
      // Jika type adalah 'nama' atau 'size', gunakan group untuk mendapatkan nilai distinct
      distinctData = await EtalaseModel.aggregate([
        { $match: matchStage },
        { $group: { _id: `$${type}` } },
        { $project: { _id: 1, [type]: "$_id" } }
      ]);
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: `Berhasil mendapatkan data distinct berdasarkan ${type}`,
      data: distinctData
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', resMessage: 'Error fetching distinct Etalases', error: err });
  }
};

exports.getDistinctEtalasesAll = async (req, res) => {
  try {
    const { type, nama, size } = req.body;

    // Validasi tipe distinct yang diperbolehkan
    if (!['nama', 'size', 'supplier'].includes(type)) {
      return res.status(400).json({
        resCode: '01',
        resMessage: 'Jenis distinct tidak valid. Gunakan: nama, size, atau supplier'
      });
    }

    // Set waktu ke 00:00:00 untuk membandingkan tanggal dengan benar
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let matchStage = {
    };

    // Tambahkan filter jika nama atau size diberikan
    if (nama) {
      matchStage.nama = nama;
    }
    if (size) {
      matchStage.size = size;
    }

    let distinctData;
    
    // Jika type adalah supplier, lakukan lookup dan filter
    if (type === 'supplier') {
      distinctData = await EtalaseModel.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "suppliers",
            localField: "supplier",
            foreignField: "_id",
            as: "supplierData"
          }
        },
        { $unwind: "$supplierData" },
        {
          $project: {
            _id: 1,
            supplier: "$supplierData",
            nama: 1,
            fotoBarang: 1,
            size: 1,
            bentukBarang: 1,
            settinganMC: 1,
            jumlahKilo: 1,
            jumlahMCPLS: 1,
            hargaJual: 1,
            hargaBeliSupplier: 1,
            created_at: 1,
            updated_at: 1
          }
        }
      ]);

      // **Generate Pre-signed URL jika fotoBarang ada**
      for (let etalase of distinctData) {
        if (etalase.fotoBarang) {
          etalase.fotoBarang = await signedUrlTools(etalase.fotoBarang);
        }
      }
    } else {
      // Jika type adalah 'nama' atau 'size', gunakan group untuk mendapatkan nilai distinct
      distinctData = await EtalaseModel.aggregate([
        { $match: matchStage },
        { $group: { _id: `$${type}` } },
        { $project: { _id: 1, [type]: "$_id" } }
      ]);
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: `Berhasil mendapatkan data distinct berdasarkan ${type}`,
      data: distinctData
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', resMessage: 'Error fetching distinct Etalases', error: err });
  }
};

exports.getEtalaseById = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Konversi id menjadi ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const Etalase = await EtalaseModel.findById(id); 
    
    if (!Etalase) {
      return res.status(404).json({ resCode: '01', message: 'Etalase not found', Etalase: {}});
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil Mendapatkan data',
      Etalase: Etalase,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', message: 'Failed to retrieve Etalase', error: err.message });
  }
};

// Membuat pengguna baru
exports.createEtalase = async (req, res) => {
  const upload = multer({ storage: multer.memoryStorage() }).single('fotoBarang');

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ resCode: '99', resMessage: 'File upload failed', error: err.message });
    }

    try {
      const {
        nama, size, supplier, bentukBarang, settinganMC,
        jumlahKilo, jumlahMCPLS, hargaBeliSupplier, hargaJual, noSurat
      } = req.body;

      // **Validasi supplier**: Pastikan supplier ada di database
      const supplierData = await SupplierModel.findOne({ _id: supplier });
      if (!supplierData) {
        return res.status(400).json({ resCode: '99', resMessage: 'Invalid supplier ID' });
      }

      // **Konversi data numerik**
      const parsedJumlahKilo = Number(jumlahKilo);
      const parsedJumlahMCPLS = Number(jumlahMCPLS);
      const parsedHargaBeliSupplier = Number(hargaBeliSupplier);
      const parsedHargaJual = Number(hargaJual);

      if (
        isNaN(parsedJumlahKilo) ||
        isNaN(parsedJumlahMCPLS) ||
        isNaN(parsedHargaBeliSupplier) ||
        isNaN(parsedHargaJual)
      ) {
        return res.status(400).json({ resCode: '99', resMessage: 'Invalid numeric values' });
      }

      // **Upload ke Filebase jika ada file**
      let fotoBarang = null;
      if (req.file) {
        const fileName = `etalase/${Date.now()}-${req.file.filename}`; // Path di Filebase
        await uploadToFilebase(req.file.buffer, fileName); // Dapatkan URL dari Filebase
        fotoBarang = fileName
      }

      // **Simpan Etalase ke database**
      const newEtalase = new EtalaseModel({
        nama,
        fotoBarang, // URL dari Filebase
        size,
        supplier: new mongoose.Types.ObjectId(supplier),
        bentukBarang,
        settinganMC,
        noSurat,
        jumlahKilo: parsedJumlahKilo,
        jumlahMCPLS: parsedJumlahMCPLS,
        hargaJual: parsedHargaJual,
        hargaBeliSupplier: parsedHargaBeliSupplier,
        created_at: new Date(),
        updated_at: new Date(),
      });
      await newEtalase.save();

      // **Insert log etalase**
      const newLogEtalase = new logEtalaseModel({
        nama,
        fotoBarang, // URL dari Filebase
        size,
        supplier: new mongoose.Types.ObjectId(supplier),
        bentukBarang,
        settinganMC,
        jumlahKiloBefore: 0,
        jumlahKiloAfter: parsedJumlahKilo,
        jumlahMCPLSBefore: 0,
        jumlahMCPLSAfter: parsedJumlahMCPLS,
        hargaJual: parsedHargaJual,
        hargaBeliSupplier: parsedHargaBeliSupplier,
        suratJalan: '',
        status: 'IN',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await newLogEtalase.save();

      return res.status(201).json({
        resCode: '00',
        resMessage: 'Etalase created successfully',
        etalase: newEtalase,
        logEtalase: newLogEtalase,
      });

    } catch (err) {
      console.error('❌ Error:', err);
      return res.status(500).json({ resCode: '99', resMessage: 'Failed to create Etalase', error: err.message });
    }
  });
};

exports.updateEtalase = async (req, res) => {
  const upload = multer({ storage: multer.memoryStorage() }).single('fotoBarang');

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ resCode: '99', resMessage: 'File upload failed', error: err.message });
    }

    const { id } = req.params;
    const { nama, size, supplier, bentukBarang, settinganMC, jumlahKilo, jumlahMCPLS, hargaBeliSupplier, hargaJual, noSurat } = req.body;

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
      }

      const existingBarang = await EtalaseModel.findById(id);
      if (!existingBarang) {
        return res.status(404).json({ resCode: '01', message: 'Barang not found' });
      }

      if (supplier && !mongoose.Types.ObjectId.isValid(supplier)) {
        return res.status(400).json({ resCode: '99', message: 'Invalid supplier ID format' });
      }

      let newUrlFoto = existingBarang.fotoBarang;

      if (req.file) {
        const fileExtension = req.file.originalname.split('.').pop();
        const mimeType = req.file.mimetype || 'application/octet-stream';
        const fileKey = `etalase/${Date.now()}-${req.file.originalname}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: fileKey,
          Body: req.file.buffer,
          ContentType: mimeType,
        }));

        newUrlFoto = fileKey;

        if (existingBarang.fotoBarang) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.FILEBASE_BUCKET_NAME,
            Key: existingBarang.fotoBarang,
          }));
        }
      }

      const updatedEtalase = await EtalaseModel.findByIdAndUpdate(
        id,
        {
          nama,
          size,
          supplier: supplier ? new mongoose.Types.ObjectId(supplier) : existingBarang.supplier,
          bentukBarang,
          settinganMC,
          noSurat,
          jumlahKilo: Number(jumlahKilo) || existingBarang.jumlahKilo,
          jumlahMCPLS: Number(jumlahMCPLS) || existingBarang.jumlahMCPLS,
          hargaBeliSupplier: Number(hargaBeliSupplier) || existingBarang.hargaBeliSupplier,
          hargaJual: Number(hargaJual) || existingBarang.hargaJual,
          fotoBarang: newUrlFoto,
          updated_at: new Date(),
        },
        { new: true }
      );

      await new logEtalaseModel({
        nama,
        fotoBarang: newUrlFoto,
        size,
        supplier: new mongoose.Types.ObjectId(supplier),
        bentukBarang,
        settinganMC,
        jumlahKiloBefore: existingBarang.jumlahKilo,
        jumlahKiloAfter: Number(jumlahKilo),
        jumlahMCPLSBefore: existingBarang.jumlahMCPLS,
        jumlahMCPLSAfter: Number(jumlahMCPLS),
        hargaBeliSupplier: Number(hargaBeliSupplier),
        hargaJual: Number(hargaJual),
        status: 'UPDATE BY ADMIN',
        created_at: new Date(),
        updated_at: new Date(),
      }).save();

      res.status(200).json({
        resCode: '00',
        resMessage: 'Barang berhasil diupdate',
        Etalase: updatedEtalase,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ resCode: '99', resMessage: 'Failed to update Barang', error: error.message });
    }
  });
};

exports.penjualanEtalase = async (req, res) => {
  const upload = multer({ storage: multer.memoryStorage() }).single('uploads');

  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ resCode: '99', resMessage: 'File upload failed', error: err.message });
    }

    const { id } = req.params;
    const { nama, size, supplier, bentukBarang, settinganMC, jumlahKiloBefore, jumlahKiloAfter, jumlahMCPLSBefore, jumlahMCPLSAfter, hargaBeliSupplier, hargaJual, jumlahPembayaran, suratJalan } = req.body;
    const newUrlFoto = req.file ? `/uploads/${req.file.filename}` : null; // Simpan path file jika ada

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
      }

      const existingBarang = await EtalaseModel.findById(id);
      if (!existingBarang) {
        return res.status(404).json({ resCode: '01', message: 'Barang not found' });
      }

      if (supplier && !mongoose.Types.ObjectId.isValid(supplier)) {
        return res.status(400).json({ resCode: '99', message: 'Invalid supplier ID format' });
      }

      const supplierData = await SupplierModel.findOne({ _id: supplier });
      if (supplier && !supplierData) {
        return res.status(400).json({ resCode: '99', resMessage: 'Supplier not found' });
      }

      const parsedJumlahKilo = jumlahKiloAfter ? Number(jumlahKiloAfter) : existingBarang.jumlahKilo;
      const parsedJumlahMCPLS = jumlahMCPLSAfter ? Number(jumlahMCPLSAfter) : existingBarang.jumlahMCPLS;
      const parsedHargaBeliSupplier = hargaBeliSupplier ? Number(hargaBeliSupplier) : existingBarang.hargaBeliSupplier;
      const parsedHargaJual = hargaJual ? Number(hargaJual) : existingBarang.hargaJual;
      const parsedJumlahPembayaran = jumlahPembayaran ? Number(jumlahPembayaran) : '';

      if (isNaN(parsedJumlahKilo) || isNaN(parsedJumlahMCPLS) || isNaN(parsedHargaBeliSupplier) || isNaN(parsedHargaJual) || isNaN(parsedJumlahPembayaran)) {
        return res.status(400).json({ resCode: '99', resMessage: 'Invalid numeric values' });
      }

      let updatedFotoBarang = existingBarang.fotoBarang;
      if (newUrlFoto) {
        if (existingBarang.fotoBarang) {
          const oldFilePath = path.join(__dirname, '..', existingBarang.fotoBarang);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        updatedFotoBarang = newUrlFoto;
      }

      let inActiveDate = existingBarang.inActiveDate;
      if (parsedJumlahKilo <= 0) {
        const now = new Date();
        inActiveDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23, 59, 59, 999
        );
      }

      // Update data barang
      const updatedEtalase = await EtalaseModel.findByIdAndUpdate(
        id,
        {
          nama,
          size,
          supplier: supplier ? new mongoose.Types.ObjectId(supplier) : existingBarang.supplier,
          bentukBarang,
          settinganMC,
          jumlahKilo: parsedJumlahKilo,
          jumlahMCPLS: parsedJumlahMCPLS,
          hargaBeliSupplier: parsedHargaBeliSupplier,
          hargaJual: parsedHargaJual,
          fotoBarang: updatedFotoBarang,
          inActiveDate: parsedJumlahKilo <= 0 ? inActiveDate : existingBarang.inActiveDate, // Set inActiveDate jika jumlahKilo <= 0
          updated_at: new Date(),
        },
        { new: true }
      );

      let temp = parsedJumlahPembayaran.toString();
      const newLogEtalase = new logEtalaseModel({
        nama: updatedEtalase.nama,
        fotoBarang: updatedFotoBarang,
        size: updatedEtalase.size,
        supplier: new mongoose.Types.ObjectId(updatedEtalase.supplier),
        bentukBarang: updatedEtalase.bentukBarang,
        suratJalan: suratJalan,
        settinganMC: updatedEtalase.settinganMC,
        jumlahKiloBefore: jumlahKiloBefore,
        jumlahKiloAfter: updatedEtalase.jumlahKilo,
        jumlahMCPLSBefore: jumlahMCPLSBefore,
        jumlahMCPLSAfter: updatedEtalase.jumlahMCPLS,
        hargaBeliSupplier: updatedEtalase.hargaBeliSupplier,
        hargaJual: updatedEtalase.hargaJual,
        jumlahPembayaran: temp,
        status: 'OUT',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await newLogEtalase.save();

      res.status(200).json({
        resCode: '00',
        resMessage: 'Barang berhasil diupdate dan log etalase dibuat',
        Etalase: updatedEtalase,
        logEtalase: newLogEtalase,
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ resCode: '99', resMessage: 'Failed to update Barang', error: err.message });
    }
  });
};


// delete pengguna baru
exports.deleteEtalase = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const existingBarang = await EtalaseModel.findById(id);
    if (!existingBarang) {
      return res.status(404).json({ resCode: '01', message: 'Barang not found' });
    }

    // Hapus file dari Filebase jika ada
    let fileDeleteStatus = 'No file to delete';
    if (existingBarang.fotoBarang) {
      const fileKey = existingBarang.fotoBarang;

      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: fileKey,
        }));
        fileDeleteStatus = `File deleted: ${fileKey}`;
        console.log(fileDeleteStatus);
      } catch (fileDeleteError) {
        console.error('Error deleting file from Filebase:', fileDeleteError);
        fileDeleteStatus = 'File deletion failed';
      }
    }

    // Hapus data dari database
    const deletedEtalase = await EtalaseModel.findByIdAndDelete(id);

    // Buat log setelah penghapusan
    const newLogEtalase = new logEtalaseModel({
      nama: existingBarang.nama,
      fotoBarang: existingBarang.fotoBarang || '',
      size: existingBarang.size,
      supplier: new mongoose.Types.ObjectId(existingBarang.supplier),
      bentukBarang: existingBarang.bentukBarang,
      settinganMC: existingBarang.settinganMC,
      jumlahKiloBefore: existingBarang.jumlahKilo,
      jumlahKiloAfter: 0,
      jumlahMCPLSBefore: existingBarang.jumlahMCPLS,
      jumlahMCPLSAfter: 0,
      hargaBeliSupplier: existingBarang.hargaBeliSupplier,
      hargaJual: existingBarang.hargaJual,
      status: 'DELETE BY ADMIN',
      fileDeleteStatus: fileDeleteStatus,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await newLogEtalase.save();

    res.status(200).json({
      resCode: '00',
      resMessage: 'Etalase berhasil dihapus',
      Etalase: deletedEtalase,
    });
  } catch (err) {
    console.error('Error deleting Etalase:', err);
    res.status(500).json({ resCode: '01', message: 'Failed to delete Etalase', error: err.message });
  }
};

exports.getFishSummaryByBentukBarang = async (req, res) => {
  try {
    // =========================
    // 1. Summary per Bentuk Barang
    // =========================
    const bentukBarangSummary = await EtalaseModel.aggregate([
      {
        $match: {
          bentukBarang: { $in: ["MC", "KRG", "PLS"] }
        }
      },
      {
        $group: {
          _id: "$bentukBarang",
          totalItems: { $sum: 1 }
        }
      }
    ]);

    let summaryJenisBarang = { MC: 0, KRG: 0, PLS: 0 };
    let totalIkan = 0;

    bentukBarangSummary.forEach(({ _id, totalItems }) => {
      summaryJenisBarang[_id] = totalItems;
      totalIkan += totalItems;
    });

    // =========================
    // 2. Summary Pemasukan 7 Hari Terakhir
    // =========================
    const today = moment().endOf("day");
    const startDate = moment().subtract(6, "days").startOf("day");

    const pemasukanSummary = await logEtalaseModel.aggregate([
      {
        $match: {
          status: "IN",
          created_at: { $gte: startDate.toDate(), $lte: today.toDate() }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          pemasukan: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    let pemasukanHarian = [];
    for (let i = 6; i >= 0; i--) {
      pemasukanHarian.push({
        tanggal: moment().subtract(i, "days").format("YYYY-MM-DD"),
        pemasukan: 0
      });
    }

    pemasukanSummary.forEach(({ _id, pemasukan }) => {
      const index = pemasukanHarian.findIndex((item) => item.tanggal === _id);
      if (index !== -1) {
        pemasukanHarian[index].pemasukan = pemasukan;
      }
    });

    // =========================
    // 3. Summary Penjualan 30 Hari Terakhir
    // =========================
    const start30Days = moment().subtract(29, "days").startOf("day");

    const penjualanSummary = await logEtalaseModel.aggregate([
      {
        $match: {
          status: "OUT",
          created_at: { $gte: start30Days.toDate(), $lte: today.toDate() }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          jumlahPenjualan: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    let laporanPenjualan = [];
    for (let i = 29; i >= 0; i--) {
      laporanPenjualan.push({
        tanggal: moment().subtract(i, "days").format("YYYY-MM-DD"),
        jumlahPenjualan: 0
      });
    }

    penjualanSummary.forEach(({ _id, jumlahPenjualan }) => {
      const index = laporanPenjualan.findIndex((item) => item.tanggal === _id);
      if (index !== -1) {
        laporanPenjualan[index].jumlahPenjualan = jumlahPenjualan;
      }
    });

    // =========================
    // 4. Tambahan: Jumlah Vendor
    // =========================
    const jumlahVendor = await SupplierModel.countDocuments();

    // =========================
    // 5. Tambahan: Jumlah Ikan Masuk Hari Ini
    // =========================
    const jumlahIkanMasuk = await logEtalaseModel.countDocuments({
      status: "IN",
      created_at: { $gte: moment().startOf("day").toDate(), $lte: today.toDate() }
    });

    // =========================
    // 6. Tambahan: Jumlah Ikan Terjual Hari Ini
    // =========================
    const jumlahIkanTerjual = await logEtalaseModel.countDocuments({
      status: "OUT",
      created_at: { $gte: moment().startOf("day").toDate(), $lte: today.toDate() }
    });

    // =========================
    // Response API
    // =========================
    return res.status(200).json({
      resCode: "00",
      resMessage: "Berhasil Mendapatkan data",
      summaryJenisBarang,
      totalIkan,
      pemasukanHarian,
      laporanPenjualan,
      jumlahVendor,
      jumlahIkanMasuk,
      jumlahIkanTerjual
    });
  } catch (error) {
    console.error("Error fetching fish summary:", error);
    return res.status(500).json({
      resCode: "99",
      resMessage: "Gagal mendapatkan data",
      error: error.message
    });
  }
};

exports.report = async (req, res) => {
  console.log('Memulai proses backup dan pembuatan report...');

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const endOfToday = new Date(now.setHours(23, 59, 59, 999));

  let matchStage = {
    $or: [
      { inActiveDate: { $exists: false } },
      { inActiveDate: null },
      { inActiveDate: "" },
      {
        inActiveDate: {
          $gte: startOfToday,
          $lte: endOfToday
        }
      }
    ]
  };

  try {
    const itemsToBackup = await EtalaseModel.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierData',
        },
      },
      { $unwind: { path: '$supplierData', preserveNullAndEmptyArrays: true } },
      { $sort: { nama: 1 } }
    ]);

    if (itemsToBackup.length === 0) {
      console.log('Tidak ada barang yang perlu di-backup hari ini.');
      return;
    }

    const backupData = itemsToBackup.map((item) => {
      const { _id, ...rest } = item;
      return {
        ...rest,
        backup_date: new Date(),
        hargaBeli: item.hargaBeliSupplier || 0,
        hargaJual: item.hargaJual || 0,
      };
    });

    await mongoose.connection.collection('backupetalases').insertMany(backupData);
    console.log(`${backupData.length} barang berhasil di-backup.`);

    const reportFileName = `report_${today}.pdf`;
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const buffers = [];
    let filebaseUrl = ""

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', async () => {
      try {
        const reportBuffer = Buffer.concat(buffers);
        filebaseUrl = await uploadToFilebase(reportBuffer, reportFileName);

        await Report.findOneAndUpdate(
          { date: today },
          { file_name: reportFileName, path: reportFileName },
          { upsert: true }
        );

        console.log(`✅ File dapat diakses di: ${filebaseUrl}`);
      } catch (error) {
        console.error('❌ Gagal mengunggah ke Filebase:', error);
      }
    });

    const headers = ['NO', 'NAMA IKAN', 'SIZE', 'SUPPLIER', 'TGL MASUK', 'NO SURAT', 'TOTAL (KG)', 'MC', 'KRG', 'KET'];

    const tableMarginX = 0;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const columnWidths = [
      contentWidth * 0.05,  // NO
      contentWidth * 0.15,  // NAMA IKAN
      contentWidth * 0.06,  // SIZE
      contentWidth * 0.12,  // SUPPLIER
      contentWidth * 0.10,  // TGL MASUK
      contentWidth * 0.12,  // NO SURAT
      contentWidth * 0.10,  // TOTAL (KG)
      contentWidth * 0.10,  // MC
      contentWidth * 0.10,  // KRG
      contentWidth * 0.10,  // KET
    ];

    const startX = doc.page.margins.left;
    let cursorY = doc.y;

    const truncate = (text, length) => (text && text.length > length ? text.substring(0, length) + '...' : text);
    const formatNumber = (num) => {
      if (!num) return '0';
      let temp = Number(num);
      return temp % 1 === 0 ? temp.toString() : temp.toFixed(2);
    };

    const drawTableHeader = () => {
      doc.fillColor('white').rect(startX, cursorY, contentWidth, 25).fill('#4682B4');
      headers.forEach((header, i) => {
        const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fillColor('white').fontSize(9).text(header, x + 3, cursorY + 8, {
          width: columnWidths[i] - 6,
          align: 'center',
        });
        doc.rect(x, cursorY, columnWidths[i], 25).stroke();
      });
      cursorY += 25;
    };

    const drawPDFHeader = () => {
      doc.fontSize(16).fillColor('black').text('STOK GLOBAL COLD STORAGE PSR BARU', { align: 'center' });
      doc.fontSize(12).text(`PERIODE ${today}`, { align: 'center' });
      doc.moveDown(1);
      cursorY = doc.y;
    };

    drawPDFHeader();
    drawTableHeader();

    let totalKG = 0, totalMC = 0, totalKRG = 0;

    for (let index = 0; index < itemsToBackup.length; index++) {
      const item = itemsToBackup[index];
      const supplierName = item.supplierData?.nama || '-';
      const keterangan = Number(item.jumlahKilo) === 0 ? 'Habis' : '';

      totalKG += Number(item.jumlahKilo) || 0;
      totalMC += Number(item.jumlahMCPLS) || 0;
      totalKRG += Number(item.jumlahKRG) || 0;

      const date = new Date(item.created_at);
      const formattedDate = `${String(date.getDate()).padStart(2, '0')} ${String(date.getMonth() + 1).padStart(2, '0')} ${date.getFullYear()}`;

      const values = [
        index + 1,
        truncate(item.nama, 15),
        item.size,
        truncate(supplierName, 15),
        formattedDate,
        truncate(item.noSurat || '-', 30),
        formatNumber(item.jumlahKilo),
        formatNumber(item.jumlahMCPLS),
        formatNumber(item.jumlahKRG),
        keterangan,
      ];

      if (cursorY + 30 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawPDFHeader();
        drawTableHeader();
      }

      values.forEach((value, i) => {
        const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fillColor('black').fontSize(9).text(value.toString(), x + 3, cursorY + 5, {
          width: columnWidths[i] - 6,
          align: 'center',
        });
        doc.rect(x, cursorY, columnWidths[i], 22).stroke();
      });

      cursorY += 22;
    }

    if (cursorY + 30 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawPDFHeader();
      drawTableHeader();
    }

    // Grand Total row
    doc.fillColor('#B22222').rect(startX, cursorY, contentWidth, 25).fill();
    doc.fillColor('white').fontSize(8).text('GRAND TOTAL', startX + 5, cursorY + 8);

    const totalCols = [6, 7, 8]; // index dari kolom TOTAL (KG), MC, KRG
    [totalKG, totalMC, totalKRG].forEach((total, idx) => {
      const colIndex = totalCols[idx];
      const x = startX + columnWidths.slice(0, colIndex).reduce((a, b) => a + b, 0);
      doc.text(formatNumber(total), x, cursorY + 8, {
        width: columnWidths[colIndex],
        align: 'center',
      });
    });

    doc.end();

    return res.status(200).json({
      resCode: '00',
      file : 'berhasil'
    });
  } catch (err) {
    console.error('❌ Error:', err);
    return res.status(500).json({ resCode: '99', message: 'Error fetching Etalases', error: err.message });

  }
}