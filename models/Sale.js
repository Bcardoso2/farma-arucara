 
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Sale = sequelize.define('Sale', {
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  client: {
    type: DataTypes.STRING,
    allowNull: false
  },
  totalValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  paymentMethod: {
    type: DataTypes.ENUM('Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Concluída', 'Pendente', 'Cancelada'),
    allowNull: false,
    defaultValue: 'Concluída'
  }
}, {
  tableName: 'sales',
  timestamps: true
});

module.exports = Sale;