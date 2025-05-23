// No modelo User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  nome: {
    type: DataTypes.STRING,
    allowNull: false
  },
  login: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  senha: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cargo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true
  }
}, {
  tableName: 'users',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    // Hash da senha antes de salvar
    beforeCreate: async (user) => {
      if (user.senha) {
        const salt = await bcrypt.genSalt(10);
        user.senha = await bcrypt.hash(user.senha, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('senha')) {
        const salt = await bcrypt.genSalt(10);
        user.senha = await bcrypt.hash(user.senha, salt);
      }
    }
  }
});

// Método para verificar senha
User.prototype.checkPassword = async function(password) {
  try {
    console.log('---------- DEBUG VERIFICAÇÃO DE SENHA ----------');
    console.log('Senha fornecida:', password);
    console.log('Tipo da senha fornecida:', typeof password);
    console.log('Comprimento da senha fornecida:', password ? password.length : 0);
    
    console.log('Hash armazenado no banco:', this.senha);
    console.log('Tipo do hash armazenado:', typeof this.senha);
    console.log('Comprimento do hash armazenado:', this.senha ? this.senha.length : 0);
    console.log('O hash parece válido:', this.senha && this.senha.startsWith('$2') ? 'Sim' : 'Não');
    
    // Tente a comparação
    let result;
    try {
      result = await bcrypt.compare(password, this.senha);
      console.log('Resultado do bcrypt.compare:', result);
    } catch (comparisonError) {
      console.error('Erro específico na comparação bcrypt:', comparisonError);
      result = false;
    }
    
    console.log('Retornando resultado final:', result);
    console.log('---------- FIM DEBUG VERIFICAÇÃO DE SENHA ----------');
    return result;
  } catch (error) {
    console.error('---------- ERRO NA VERIFICAÇÃO DE SENHA ----------');
    console.error('Erro geral:', error);
    console.error('Mensagem de erro:', error.message);
    console.error('Stack trace:', error.stack);
    console.error('---------- FIM ERRO NA VERIFICAÇÃO DE SENHA ----------');
    return false;
  }
};

module.exports = User;