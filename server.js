const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection, sequelize } = require('./config/db');
const models = require('./models');

// Carregar variáveis de ambiente
dotenv.config();

// Inicializar Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Testar conexão com o banco de dados
testConnection();

// ✅ SINCRONIZAÇÃO SEGURA - Evita criação de índices duplicados
async function initializeDatabase() {
  try {
    if (process.env.NODE_ENV === 'production') {
      // Em produção: apenas conectar, não alterar estrutura
      await sequelize.authenticate();
      console.log('✅ Conectado ao banco de dados (produção)');
    } else {
      // Em desenvolvimento: sync mais controlado
      await sequelize.sync({ 
        alter: false, // ❌ MUDANÇA: não alterar estrutura automaticamente
        force: false  // ❌ não recriar tabelas
      });
      console.log('✅ Modelos sincronizados com o banco de dados (desenvolvimento)');
    }
  } catch (error) {
    console.error('❌ Erro na sincronização do banco:', error);
    process.exit(1);
  }
}

// Inicializar banco
initializeDatabase();

// Rotas de autenticação
app.use('/api/auth', require('./routes/authRoutes'));

// Rotas de recursos
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/invoices', require('./routes/invoice'));

// Rota padrão
app.get('/', (req, res) => {
  res.send('API da Farma Arucará está funcionando!');
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});