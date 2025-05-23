 
const { sequelize } = require('../config/db');
const Product = require('./Product');
const Client = require('./Client');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Prescription = require('./Prescription');
const PrescriptionItem = require('./PrescriptionItem');
const User = require('./User');


// Definir relacionamentos
// Um cliente pode ter várias vendas
Client.hasMany(Sale, { foreignKey: 'clientId' });
Sale.belongsTo(Client, { foreignKey: 'clientId' });

// Uma venda pode ter vários itens
Sale.hasMany(SaleItem, { foreignKey: 'saleId' });
SaleItem.belongsTo(Sale, { foreignKey: 'saleId' });

// Um produto pode estar em vários itens de venda
Product.hasMany(SaleItem, { foreignKey: 'productId' });
SaleItem.belongsTo(Product, { foreignKey: 'productId' });

// Uma prescrição pode ter vários itens
Prescription.hasMany(PrescriptionItem, { foreignKey: 'prescriptionId' });
PrescriptionItem.belongsTo(Prescription, { foreignKey: 'prescriptionId' });

module.exports = {
  sequelize,
  Product,
  Client,
  Sale,
  SaleItem,
  Prescription,
  PrescriptionItem,
  User 

};