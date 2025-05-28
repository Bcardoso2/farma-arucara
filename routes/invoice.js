const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const invoiceController = require('../controllers/invoiceController');

// POST /api/invoices/scan-barcode - Processar código de barras da NFe
router.post('/scan-barcode', auth, invoiceController.processBarcodeData);

// POST /api/invoices/entry - Processar entrada por nota
router.post('/entry', auth, invoiceController.processEntry);

// GET /api/invoices - Listar notas fiscais
router.get('/', auth, invoiceController.getAll);

// GET /api/invoices/report - Relatório de notas fiscais
router.get('/report', auth, invoiceController.getReport);

// GET /api/invoices/:id - Buscar nota específica
router.get('/:id', auth, invoiceController.getById);

// PUT /api/invoices/:id/cancel - Cancelar nota
router.put('/:id/cancel', auth, invoiceController.cancel);

module.exports = router;