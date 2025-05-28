const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

// ==================== ROTAS ORIGINAIS (VENDAS) ====================
router.get('/', saleController.getSales); // GET /api/sales - vendas concluídas
router.get('/:id', saleController.getSaleById); // GET /api/sales/:id
router.post('/', saleController.createSale); // POST /api/sales - criar venda/pedido
router.put('/:id', saleController.updateSale); // PUT /api/sales/:id
router.delete('/:id', saleController.deleteSale); // DELETE /api/sales/:id

// ==================== ROTAS ADICIONAIS PARA PEDIDOS ====================
router.get('/orders/pending', saleController.getOrders); // GET /api/sales/orders/pending - pedidos pendentes
router.get('/orders/number/:orderNumber', saleController.getOrderByNumber); // GET /api/sales/orders/number/:orderNumber
router.put('/:id/finalize', saleController.finalizeSale); // PUT /api/sales/:id/finalize - finalizar no caixa
router.put('/:id/cancel', saleController.cancelOrder); // PUT /api/sales/:id/cancel - cancelar pedido

module.exports = router;