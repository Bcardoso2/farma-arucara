const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Sale = sequelize.define('Sale', {
  // NOVO: Número do pedido único
  orderNumber: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: true // Para compatibilidade com vendas antigas
  },
  
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
  
  // MODIFICADO: Agora pode ser null (para pedidos pendentes)
  paymentMethod: {
    type: DataTypes.ENUM('Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX'),
    allowNull: true // Null enquanto for pedido
  },
  
  // MODIFICADO: Pendente como padrão para novos pedidos
  status: {
    type: DataTypes.ENUM('Pendente', 'Concluída', 'Cancelada'),
    allowNull: false,
    defaultValue: 'Pendente' // Mudança: agora padrão é Pendente
  },
  
  // NOVOS CAMPOS PARA CAIXA
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  
  change: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  
  discount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  
  finalizedAt: {
    type: DataTypes.DATE,
    allowNull: true // Preenchido apenas quando finalizada no caixa
  },
  
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // CONTROLE DO CAIXA
  cashierId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  
  finalizedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'sales',
  timestamps: true,
  
  // Hook para gerar número do pedido automaticamente
  hooks: {
    beforeCreate: (sale) => {
      if (!sale.orderNumber) {
        sale.orderNumber = generateOrderNumber();
      }
    }
  }
});

// Função para gerar número do pedido
function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PED${year}${month}${day}${random}`;
}

module.exports = Sale;