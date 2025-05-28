const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Product = sequelize.define('Product', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: 'Código do produto (pode ser da NFe ou interno)'
  },
  barcode: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: 'Código de barras EAN/UPC do produto'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  category: {
    type: DataTypes.ENUM('Medicamento', 'Cosméticos', 'Higiene', 'Suplementos', 'Outros'),
    allowNull: false
  },
  prescription: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  minStock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10
  }
}, {
  tableName: 'products',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['code']
    },
    {
      unique: true,
      fields: ['barcode']
    },
    {
      fields: ['name']
    },
    {
      fields: ['category']
    }
  ]
});

module.exports = Product;