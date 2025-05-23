 
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PrescriptionItem = sequelize.define('PrescriptionItem', {
  prescriptionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'prescriptions',
      key: 'id'
    }
  },
  medicationName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dosage: {
    type: DataTypes.STRING,
    allowNull: false
  },
  duration: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'prescription_items',
  timestamps: true
});

module.exports = PrescriptionItem;