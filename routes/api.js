const express = require('express');
const router = express.Router();

// middleware 
const { authMiddleware } = require('../middlewares/authMiddleware');

// controller
const userController = require('../controllers/userController');
const supplierController = require('../controllers/supplierController');
const etalaseController = require('../controllers/etalaseController');
const logEtalaseController = require('../controllers/logEtalaseController');
const reportController = require('../controllers/reportController');
const { login, logout } = require('../controllers/authController');

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

// dashboard
router.post('/getetalase', etalaseController.getEtalases);
router.post('/getEtalaseParam', etalaseController.getDistinctEtalases);
router.post('/getSummaryFish', authMiddleware, etalaseController.getFishSummaryByBentukBarang);

// eatalase
router.post('/etalase', authMiddleware, etalaseController.createEtalase);
router.post('/etalase/latest', authMiddleware, logEtalaseController.getlogEtalasesLatest);
router.get('/etalase/:id', authMiddleware, etalaseController.getEtalaseById);
router.put('/etalase/:id', authMiddleware, etalaseController.updateEtalase);
router.put('/etalase/penjualan/:id', authMiddleware, etalaseController.penjualanEtalase);
router.delete('/etalase/delete/:id', authMiddleware, etalaseController.deleteEtalase);

// Log Etalase
router.post('/getLogEtalase', authMiddleware, logEtalaseController.getlogEtalases);
router.post('/logEtalase', authMiddleware, logEtalaseController.createlogEtalase);
router.get('/logEtalase/:id', authMiddleware, logEtalaseController.getlogEtalaseById);
router.put('/logEtalase/:id', authMiddleware, logEtalaseController.updatelogEtalase);
router.delete('/logEtalase/:id', authMiddleware, logEtalaseController.deletelogEtalase);

// report
router.post('/getAllReports', authMiddleware, reportController.getAllReports);

module.exports = router;