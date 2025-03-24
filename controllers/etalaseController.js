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

exports.getEtalases = async (req, res) => {
  try {
    const page = parseInt(req.body.index) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const skip = (page - 1) * limit;
    const bentukBarang = req.body.bentukBarang;

    // Format hari ini sebagai string (YYYY-MM-DD)
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const endOfToday = new Date(now.setHours(23, 59, 59, 999));

    // Kondisi filter awal
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

    // Jika bentukBarang diberikan, tambahkan filter
    if (bentukBarang) {
      matchStage.bentukBarang = bentukBarang;
    }

    // Query dengan filter dan pagination
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

    // **Generate Pre-signed URL jika fotoBarang ada**
    for (let etalase of Etalases) {
      if (etalase.fotoBarang) {
        etalase.fotoBarang = await signedUrlTools(etalase.fotoBarang);
      }
    }

    // Hitung total data setelah filter
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
  const upload = multer({ storage }).single('fotoBarang'); // Pastikan field sesuai dengan form-data

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
        const filePath = req.file.path; // Path lokal
        const fileName = `etalase/${Date.now()}-${req.file.filename}`; // Path di Filebase
        await uploadToFilebase(filePath, fileName); // Dapatkan URL dari Filebase
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
  const upload = multer({ dest: 'uploads/' });
  upload.single('fotoBarang')(req, res, async (err) => {
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
        const fileContent = fs.readFileSync(req.file.path);
        const fileExtension = path.extname(req.file.originalname);
        const mimeType = mime.lookup(req.file.originalname) || 'application/octet-stream';
        const fileKey = `etalase/${Date.now()}-${req.file.filename}${fileExtension}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: fileKey,
          Body: fileContent,
          ContentType: mimeType,
        }));

        newUrlFoto = fileKey;

        if (existingBarang.fotoBarang) {
          const oldKey = existingBarang.fotoBarang;
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.FILEBASE_BUCKET_NAME,
            Key: oldKey,
          }));
        }

        fs.unlinkSync(req.file.path); // Bersihkan file lokal
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
  const upload = multer({ storage }).single('fotoBarang'); // 'fotoBarang' sesuai dengan field di form-data

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

      // **Logic untuk mengatur inActiveDate jika jumlahKiloAfter <= 0**
      let inActiveDate = existingBarang.inActiveDate;
      if (parsedJumlahKilo <= 0) {
         now = new Date(); // Simpan waktu lengkap (termasuk jam, menit, detik)
         inActiveDate = new Date(now.getTime() + (7 * 60 * 60 * 1000))
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
    if (existingBarang.fotoBarang) {
      const fileKey = existingBarang.fotoBarang;

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

    const deletedEtalase = await EtalaseModel.findByIdAndDelete(id);

    // Buat log setelah penghapusan
    const newLogEtalase = new logEtalaseModel({
      nama: existingBarang.nama,
      fotoBarang: existingBarang.fotoBarang,
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