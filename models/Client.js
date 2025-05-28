const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Client = sequelize.define('Client', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cpf: {
    type: DataTypes.STRING(14),
    allowNull: false
    // ❌ REMOVER: unique: true (isso estava causando os índices duplicados)
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'clients',
  timestamps: true,
  
  // ✅ DEFINIR ÍNDICE ÚNICO DE FORMA CONTROLADA
  indexes: [
    {
      unique: true,
      fields: ['cpf'],
      name: 'clients_cpf_unique' // Nome fixo para evitar duplicações
    }
  ]
});

module.exports = Client;