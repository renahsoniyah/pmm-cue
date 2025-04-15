require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const Etalase = require('../models/etalaseModel');
const Supplier = require('../models/supplierModel');
const Report = require('../models/reportModel');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { uploadToFilebase } = require('../utils/upload');

try {
  mongoose.connect(process.env.DB_URI, {
    dbName: process.env.DB_NAME,
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
      { $sort: { nama: 1 } }
    ]);

    if (itemsToBackup.length === 0) {
      console.log('Tidak ada barang yang perlu di-backup hari ini.');
      return;
    }

    const reportFileName = `report_${today}.pdf`;
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
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

  } catch (error) {
    console.error('❌ Error:', error);
  }
});
