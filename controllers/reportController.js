const Report = require('../models/reportModel');

// 1. Ambil Semua Report
const getAllReports = async (req, res) => {
  try {
    // Ambil pagination & filter dari request
    const page = parseInt(req.body.index) || 1; // Halaman default: 1
    const limit = parseInt(req.body.limit) || 10; // Batas default: 10
    const skip = (page - 1) * limit;
    const { file_name } = req.body; // Filter opsional

    // Buat kondisi filter
    let filter = {};

    // Filter berdasarkan 'file_name' jika tersedia
    if (file_name) {
      filter.file_name = { $regex: file_name, $options: 'i' }; // Case-insensitive search
    }

    // Ambil data dengan filter, sorting, dan pagination
    const reports = await Report.find(filter)
      .sort({ date: -1 }) // Urutkan berdasarkan date (desc)
      .skip(skip)
      .limit(limit);

    // Hitung total record yang sesuai dengan filter
    const totalRecords = await Report.countDocuments(filter);

    return res.status(200).json({
      resCode: '00',
      resMessage: 'Berhasil mendapatkan data laporan',
      reports,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({
      resCode: '99',
      resMessage: 'Gagal mengambil data laporan',
      error: error.message
    });
  }
};

// 2. Ambil Report Berdasarkan ID
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Laporan tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil laporan',
      error: error.message
    });
  }
};

// 3. Tambah Report Baru
const createReport = async (req, res) => {
  try {
    const { file_name, date, path } = req.body;

    // Validasi Input
    if (!file_name || !date || !path) {
      return res.status(400).json({
        success: false,
        message: 'Semua field (file_name, date, path) wajib diisi'
      });
    }

    const newReport = await Report.create({ file_name, date, path });

    res.status(201).json({
      success: true,
      message: 'Laporan berhasil ditambahkan',
      data: newReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gagal menambahkan laporan',
      error: error.message
    });
  }
};

// 4. Update Report Berdasarkan ID
const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_name, date, path } = req.body;

    const updatedReport = await Report.findByIdAndUpdate(
      id,
      { file_name, date, path },
      { new: true, runValidators: true }
    );

    if (!updatedReport) {
      return res.status(404).json({
        success: false,
        message: 'Laporan tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Laporan berhasil diperbarui',
      data: updatedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui laporan',
      error: error.message
    });
  }
};

// 5. Hapus Report Berdasarkan ID
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedReport = await Report.findByIdAndDelete(id);

    if (!deletedReport) {
      return res.status(404).json({
        success: false,
        message: 'Laporan tidak ditemukan'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Laporan berhasil dihapus',
      data: deletedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus laporan',
      error: error.message
    });
  }
};

module.exports = {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport
};
