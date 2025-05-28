const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const InvoiceItem = sequelize.define('InvoiceItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'invoice_id'
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'unit_price'
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_price'
  },
  batch: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  expirationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'expiration_date'
  }
}, {
  tableName: 'invoice_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = InvoiceItem;