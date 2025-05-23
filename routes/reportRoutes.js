 
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/sales-by-period', reportController.getSalesByPeriod);
router.get('/stock', reportController.getStockReport);
router.get('/top-products', reportController.getTopProducts);

module.exports = router;