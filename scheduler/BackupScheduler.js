require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const Etalase = require('../models/etalaseModel');
const Supplier = require('../models/supplierModel');
const BackupEtalase = require('../models/backupEtalaseModel');
const Report = require('../models/reportModel');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { uploadToFilebase } = require('../utils/upload');

try {
  mongoose.connect(process.env.DB_URI, {
    dbName: process.env.DB_NAME,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 60000,
  });
  console.log('✅ MongoDB connected successfully!');
} catch (err) {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
}

cron.schedule('*/1 * * * *', async () => {
  console.log('Memulai proses backup dan pembuatan report...');

  const today = new Date().toISOString().split('T')[0];

  const now = new Date();
  const startOfToday = new Date(now.setHours(0, 0, 0, 0));
  const endOfToday = new Date(now.setHours(23, 59, 59, 999));

  let matchStage = {
    $or: [
      { inActiveDate: { $exists: false } },
      { inActiveDate: null },
      { inActiveDate: '' },
      {
        inActiveDate: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      },
    ],
  };

  try {
    const itemsToBackup = await Etalase.aggregate([
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

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', async () => {
      try {
        const reportBuffer = Buffer.concat(buffers);
        const filebaseUrl = await uploadToFilebase(reportBuffer, reportFileName);

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

    // --- HEADER PDF ---
    doc.fontSize(16).fillColor('black').text('STOK GLOBAL COLD STORAGE PSR BARU', { align: 'center' });
    doc.fontSize(12).text(`PERIODE ${today}`, { align: 'center' });
    doc.moveDown(1);

    const headers = ['NO', 'NAMA IKAN', 'SIZE', 'SUPPLIER', 'TGL MASUK', 'TOTAL (KG)', 'MC', 'KRG', 'HARGA BELI', 'HARGA JUAL', 'NO SURAT', 'KET'];

    const tableMargin = 30;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const contentWidth = pageWidth - tableMargin * 2;

    const columnWidths = [
      contentWidth * 0.05,
      contentWidth * 0.14,
      contentWidth * 0.06,
      contentWidth * 0.12,
      contentWidth * 0.08,
      contentWidth * 0.08,
      contentWidth * 0.06,
      contentWidth * 0.06,
      contentWidth * 0.09,
      contentWidth * 0.09,
      contentWidth * 0.10,
      contentWidth * 0.08,
    ];

    const startX = doc.page.margins.left + tableMargin;
    const headerHeight = 25;
    const headerY = doc.y + 5;

    // Draw Header
    doc.fillColor('white').rect(startX, headerY, contentWidth, headerHeight).fill('#4682B4');
    headers.forEach((header, i) => {
      const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5;
      doc.fillColor('white').fontSize(6).text(header, x, headerY + 8, {
        width: columnWidths[i] - 10,
        align: 'center',
      });
    });

    doc.moveDown(2); // Space after header

    const truncate = (text, length) => (text && text.length > length ? text.substring(0, length) + '...' : text);
    const formatNumber = (num) => {
      if (!num) return '0';
      let temp = Number(num);
      return temp % 1 === 0 ? temp.toString() : temp.toFixed(2);
    };

    let totalKG = 0, totalMC = 0, totalKRG = 0;

    itemsToBackup.forEach((item, index) => {
      const supplierName = item.supplierData?.nama || '-';
      const keterangan = Number(item.jumlahKilo) === 0 ? 'Habis' : 'STOK OPNAME';

      totalKG += Number(item.jumlahKilo) || 0;
      totalMC += Number(item.jumlahMCPLS) || 0;
      totalKRG += Number(item.jumlahKRG) || 0;

      const values = [
        index + 1,
        truncate(item.nama, 15),
        item.size,
        truncate(supplierName, 15),
        today,
        formatNumber(item.jumlahKilo),
        formatNumber(item.jumlahMCPLS),
        formatNumber(item.jumlahKRG),
        item.hargaBeliSupplier ? `Rp ${item.hargaBeliSupplier.toLocaleString()}` : '-',
        item.hargaJual ? `Rp ${item.hargaJual.toLocaleString()}` : '-',
        truncate(item.noSurat || '-', 30),
        keterangan,
      ];

      const rowY = doc.y;
      if (index % 2 === 0) {
        doc.fillColor('#F5F5F5').rect(startX, rowY, contentWidth, 22).fill();
      }

      values.forEach((value, i) => {
        const x = startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0) + 5;
        doc.fillColor('black').fontSize(6).text(value.toString(), x, rowY + 5, {
          width: columnWidths[i] - 10,
          align: 'center',
        });
      });

      doc.moveDown(1);
    });

    // Footer Total
    const y = doc.y;
    doc.fillColor('#B22222').rect(startX, y, contentWidth, 30).fill();
    doc.fillColor('white').fontSize(7).text('GRAND TOTAL', startX + 5, y + 8);

    doc.text(formatNumber(totalKG), startX + columnWidths.slice(0, 5).reduce((a, b) => a + b, 0), y + 8, {
      width: columnWidths[5],
      align: 'center',
    });
    doc.text(formatNumber(totalMC), startX + columnWidths.slice(0, 6).reduce((a, b) => a + b, 0), y + 8, {
      width: columnWidths[6],
      align: 'center',
    });
    doc.text(formatNumber(totalKRG), startX + columnWidths.slice(0, 7).reduce((a, b) => a + b, 0), y + 8, {
      width: columnWidths[7],
      align: 'center',
    });

    doc.end();

  } catch (error) {
    console.error('❌ Error:', error);
  }
});
