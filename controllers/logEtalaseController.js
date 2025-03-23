const logEtalaseModel = require('../models/logEtalaseModel');
const EtalaseModel = require('../models/etalaseModel');
const mongoose = require('mongoose');

exports.getlogEtalases = async (req, res) => {
  try {
    const page = parseInt(req.body.index) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const skip = (page - 1) * limit;

    const { nama, size, supplier } = req.body;

    // Kondisi filter
    let matchStage = {};

    if (nama) {
      matchStage.nama = { $regex: nama, $options: "i" }; // Case-insensitive search
    }

    if (size) {
      matchStage.size = size;
    }

    if (supplier) {
      try {
        matchStage.supplier = new mongoose.Types.ObjectId(supplier);
      } catch (error) {
        return res.status(400).json({
          resCode: "01",
          resMessage: "Invalid supplier ID format",
        });
      }
    }

    const pipeline = [{ $match: matchStage }];

    // Selalu tambahkan lookup untuk supplier
    pipeline.push({
      $lookup: {
        from: "suppliers",
        localField: "supplier",
        foreignField: "_id",
        as: "supplierData",
      },
    });

    // Tentukan urutan berdasarkan kondisi filter
    const sortOrder = nama || size || supplier ? 1 : -1;
    pipeline.push(
      { $sort: { updated_at: sortOrder } },
      { $skip: skip },
      { $limit: limit }
    );

    const logEtalases = await logEtalaseModel.aggregate(pipeline);

    const totalRecords = await logEtalaseModel.countDocuments(matchStage);

    return res.status(200).json({
      resCode: "00",
      resMessage: "Berhasil Mendapatkan data",
      logEtalase: logEtalases,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      resCode: "99",
      message: "Error fetching logEtalases",
      error: err,
    });
  }
};

exports.getlogEtalaseById = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Konversi id menjadi ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const logEtalase = await logEtalaseModel.findById(id); 
    
    if (!logEtalase) {
      return res.status(404).json({ resCode: '01', message: 'logEtalase not found', logEtalase: {}});
    }

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil Mendapatkan data',
      logEtalase: logEtalase,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ resCode: '99', message: 'Failed to retrieve logEtalase', error: err.message });
  }
};

// Membuat pengguna baru
exports.createlogEtalase = async (req, res) => {
  const { nama, fotoBarang, size, supplier, bentukBarang, settinganMC, jumlahKiloBefore, jumlahKiloAfter, jumlahMCPLSBefore, jumlahMCPLSAfter, hargaBeliSupplier, hargaJual, pembayaran, status, suratJalan } = req.body;
  
  try {
  // **Validasi ID**
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
  }

  // **Ambil data barang lama**
  const existingBarang = await EtalaseModel.findById(id);
  if (!existingBarang) {
    return res.status(404).json({ resCode: '01', message: 'Barang not found' });
  }

  // **Validasi supplier ID**
  if (supplier && !mongoose.Types.ObjectId.isValid(supplier)) {
    return res.status(400).json({ resCode: '99', message: 'Invalid supplier ID format' });
  }

  const supplierData = await SupplierModel.findOne({ _id: supplier });
  if (supplier && !supplierData) {
    return res.status(400).json({ resCode: '99', resMessage: 'Supplier not found' });
  }

  // **Konversi data yang harus berupa angka**
  const parsedJumlahKilo = jumlahKilo ? Number(jumlahKiloAfter) : existingBarang.jumlahKilo;
  const parsedJumlahMCPLS = jumlahMCPLS ? Number(jumlahMCPLSAfter) : existingBarang.jumlahMCPLS;
  const parsedHargaBeliSupplier = hargaBeliSupplier ? Number(hargaBeliSupplier) : existingBarang.hargaBeliSupplier;
  const parsedHargaPembayaran = pembayaran ? Number(pembayaran) : '';
  
  const parsedHargaJual = hargaJual ? Number(hargaJual) : existingBarang.hargaJual;

  if (isNaN(parsedJumlahKilo) || isNaN(parsedJumlahMCPLS) || isNaN(parsedHargaBeliSupplier) || isNaN(parsedHargaJual) || isNaN(parsedHargaPembayaran)) {
    return res.status(400).json({ resCode: '99', resMessage: 'Invalid numeric values' });
  }

  // **Hapus file lama jika user mengupload foto baru**
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

  // **Update data barang**
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
      updated_at: new Date(),
    },
    { new: true } // Agar data terbaru dikembalikan
  );

  // **Insert log etalase**
  const newLogEtalase = new logEtalaseModel({
    nama: updatedEtalase.nama,
    fotoBarang: updatedEtalase.fotoBarang,
    size: updatedEtalase.size,
    supplier: updatedEtalase.supplier,
    bentukBarang: updatedEtalase.bentukBarang,
    settinganMC: updatedEtalase.settinganMC,
    jumlahKiloBefore: existingBarang.jumlahKilo,
    jumlahKiloAfter: updatedEtalase.jumlahKilo,
    jumlahMCPLSBefore: existingBarang.jumlahMCPLS,
    jumlahMCPLSAfter: updatedEtalase.jumlahMCPLS,
    hargaBeliSupplier: updatedEtalase.hargaBeliSupplier,
    hargaJual: updatedEtalase.hargaJual,
    pembayaran: parsedHargaPembayaran,
    suratJalan: suratJalan,
    status: 'UPDATED', // Bisa disesuaikan dengan kebutuhan
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
};

exports.updatelogEtalase = async (req, res) => {
  const { id } = req.params;
  const { nama, fotoBarang, size, supplier, bentukBarang, settinganMC, jumlahKiloBefore, jumlahKiloAfter, jumlahMCPLSBefore, jumlahMCPLSAfter, hargaBeliSupplier, status, suratJalan } = req.body;
  
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const updatedlogEtalase = await logEtalaseModel.findByIdAndUpdate(
      id,
      { 
        nama,
        fotoBarang,
        size,
        supplier,
        bentukBarang,
        settinganMC,
        jumlahKiloBefore,
        jumlahKiloAfter,
        jumlahMCPLSBefore,
        jumlahMCPLSAfter,
        hargaBeliSupplier,
        hargaJual,
        status,
        suratJalan,
        updated_at: new Date(),
      },
      { new: true } // Untuk mengembalikan logEtalase yang telah diperbarui
    );

    if (!updatedlogEtalase) {
      return res.status(404).json({ resCode: '01', message: 'logEtalase not found' });
    }

    res.status(200).json({
      resCode: '00',
      resMessage: 'logEtalase Berhasil diupdate',
      logEtalase: updatedlogEtalase,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ resCode: '01', message: 'Failed to update logEtalase', error: err.message });
  }
};

// delete pengguna baru
exports.deletelogEtalase = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Cek apakah ID valid sebelum dipakai di MongoDB
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ resCode: '99', message: 'Invalid ID format' });
    }

    const deletedlogEtalase = await logEtalaseModel.findOneAndDelete(id);
    
    if (!deletedlogEtalase) {
      return res.status(404).json({ message: 'logEtalase not found' });
    }

    res.status(200).json({
      resCode: '00',
      resMessage: 'logEtalase Berhasil di hapus',
      logEtalase: deletedlogEtalase,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ resCode: '01', message: 'Failed to delete logEtalase', error: err.message });
  }
};

exports.getlogEtalasesLatest = async (req, res) => {
  try {
    const page = parseInt(req.body.index) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const skip = (page - 1) * limit;

    // Atur rentang waktu hari ini
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Data log etalase dengan status "IN"
    const logEtalases = await logEtalaseModel.aggregate([
      { $match: { status: "IN" } },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierData'
        }
      },
      { $sort: { created_at: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // Menghitung total data dengan status "IN"
    const totalRecords = await logEtalaseModel.countDocuments({ status: "IN" });

    // Menghitung total ikan yang masuk hari ini (hanya total count)
    const todayTotalFish = await logEtalaseModel.countDocuments({
      status: "IN",
      created_at: { $gte: todayStart, $lte: todayEnd }
    });

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil Mendapatkan data',
      logEtalase: logEtalases,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      todayTotalFish // Total count ikan masuk hari ini
    });
  } catch (err) {
    return res.status(500).json({ resCode: '99', message: 'Error fetching logEtalases', error: err });
  }
};
