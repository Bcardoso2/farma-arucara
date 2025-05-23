 
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Prescription = sequelize.define('Prescription', {
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  doctorName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  doctorCRM: {
    type: DataTypes.STRING,
    allowNull: false
  },
  patientName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  patientCPF: {
    type: DataTypes.STRING(14),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Válida', 'Utilizada', 'Expirada'),
    allowNull: false,
    defaultValue: 'Válida'
  },
  expirationDate: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'prescriptions',
  timestamps: true
});

module.exports = Prescription;