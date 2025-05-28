const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db'); // ⬅️ COM CHAVES

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'invoice_number'
  },
  supplier: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  invoiceDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'invoice_date'
  },
  totalValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_value'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processed', 'cancelled'),
    defaultValue: 'processed'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by'
  }
}, {
  tableName: 'invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Invoice;