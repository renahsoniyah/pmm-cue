require('dotenv').config();
const express = require('express');
const router = express.Router();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

// middleware 
const { authMiddleware } = require('../middlewares/authMiddleware');

// controller
const userController = require('../controllers/userController');
const supplierController = require('../controllers/supplierController');
const paramController = require('../controllers/paramController');
const etalaseController = require('../controllers/etalaseController');
const logEtalaseController = require('../controllers/logEtalaseController');
const reportController = require('../controllers/reportController');
const { login, logout } = require('../controllers/authController');


// s3
const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: process.env.FILEBASE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,
  },
});

// auth 
router.post('/login', login);
router.post('/logout', authMiddleware, logout);

// User
router.post('/getUsers', authMiddleware, userController.getUsers);
router.post('/users', userController.createUser);
router.get('/users/:id', authMiddleware, userController.getUserById);
router.put('/users/:id', authMiddleware, userController.updateUser);
router.delete('/users/:id', authMiddleware, userController.deleteUser);

// Supplier
router.post('/getsupplier', authMiddleware, supplierController.getSuppliers);
router.post('/supplier', authMiddleware, supplierController.createSupplier);
router.get('/supplier/:id', authMiddleware, supplierController.getSupplierById);
router.put('/supplier/:id', authMiddleware, supplierController.updateSupplier);
router.delete('/supplier/:id', authMiddleware, supplierController.deleteSupplier);

// Param
router.post('/getparam', authMiddleware, paramController.getAllParams);
router.post('/param', authMiddleware, paramController.createParam);
router.put('/param/:id', authMiddleware, paramController.updateParam);
router.delete('/param/:id', authMiddleware, paramController.deleteParam);

// dashboard
router.post('/getetalase', etalaseController.getEtalases);
router.post('/report', etalaseController.report);
router.post('/getEtalaseParam', etalaseController.getDistinctEtalases);
router.post('/getEtalaseParamAll', etalaseController.getDistinctEtalasesAll);
router.post('/getSummaryFish', authMiddleware, etalaseController.getFishSummaryByBentukBarang);

// eatalase
router.post('/etalase', authMiddleware, etalaseController.createEtalase);
router.post('/etalase/latest', authMiddleware, logEtalaseController.getlogEtalasesLatest);
router.get('/etalase/:id', authMiddleware, etalaseController.getEtalaseById);
router.put('/etalase/:id', authMiddleware, etalaseController.updateEtalase);
router.put('/etalase/penjualan/:id', authMiddleware, etalaseController.penjualanEtalase);
router.delete('/etalase/delete/:id', authMiddleware, etalaseController.deleteEtalase);
router.put('/hargaetalase/:id', authMiddleware, etalaseController.updateHargaEtalase);


// Log Etalase
router.post('/getLogEtalase', authMiddleware, logEtalaseController.getlogEtalases);
router.post('/logEtalase', authMiddleware, logEtalaseController.createlogEtalase);
router.get('/logEtalase/:id', authMiddleware, logEtalaseController.getlogEtalaseById);
router.put('/logEtalase/:id', authMiddleware, logEtalaseController.updatelogEtalase);
router.delete('/logEtalase/:id', authMiddleware, logEtalaseController.deletelogEtalase);

// report
router.post('/getAllReports', authMiddleware, reportController.getAllReports);

router.get('/download/:fileKey', async (req, res) => {
  try {
    const { fileKey } = req.params;

    const command = new GetObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: fileKey,
    });

    const { Body } = await s3Client.send(command);

    res.setHeader('Content-Disposition', `attachment; filename="${fileKey}"`);
    Body.pipe(res);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).send('Gagal mengambil file.');
  }
});

module.exports = router;