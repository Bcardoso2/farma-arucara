const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Rotas existentes
router.get('/', clientController.getClients); // Supondo que esta seja a getAllClients
router.get('/:id', clientController.getClientById);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

// NOVA ROTA ADICIONADA
router.get('/:clientId/sales', clientController.getClientSalesHistory);

module.exports = router;
