// ATUALIZE AS IMPORTAÇÕES PARA INCLUIR Sale, SaleItem e Product
const { Client, Sale, SaleItem, Product } = require('../models');
const { Op } = require('sequelize');

// Obter todos os clientes
exports.getClients = async (req, res) => {
  try {
    const clients = await Client.findAll();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obter um cliente específico
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Criar um novo cliente
exports.createClient = async (req, res) => {
  try {
    const existingClient = await Client.findOne({ where: { cpf: req.body.cpf } });
    if (existingClient) {
      return res.status(400).json({ message: 'Já existe um cliente com este CPF' });
    }
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (error) {
    // Se for um erro de validação do Sequelize, pode ser mais específico
    if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(err => err.message);
        return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(400).json({ message: error.message });
  }
};

// Atualizar um cliente
exports.updateClient = async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    
    if (req.body.cpf) {
      const existingClient = await Client.findOne({
        where: {
          cpf: req.body.cpf,
          id: { [Op.ne]: req.params.id } // Op.ne significa "not equal" (diferente de)
        }
      });
      if (existingClient) {
        return res.status(400).json({ message: 'Já existe outro cliente com este CPF' });
      }
    }
    
    await client.update(req.body);
    res.json(client);
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(err => err.message);
        return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(400).json({ message: error.message });
  }
};

// Excluir um cliente
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    
    await client.destroy();
    res.json({ message: 'Cliente removido com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NOVA FUNÇÃO ADICIONADA
exports.getClientSalesHistory = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Opcional, mas bom: Verificar se o cliente realmente existe
    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    const salesHistory = await Sale.findAll({
      where: {
        clientId: clientId,
        status: 'Concluída' 
      },
      include: [
        {
          model: SaleItem,
          as: 'SaleItems', // Certifique-se que 'SaleItems' é o alias da sua associação Sale -> SaleItem
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'price'] // Ajuste conforme necessário
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']] // Mais recentes primeiro
    });

    if (!salesHistory || salesHistory.length === 0) {
      return res.json([]); // Retorna array vazio se não houver histórico
    }

    // Mapear os dados para um formato mais amigável para o frontend
    const formattedHistory = salesHistory.map(sale => {
      const saleDateObj = new Date(sale.createdAt);
      const date = saleDateObj.toLocaleDateString('pt-BR', { timeZone: 'America/Belem' });
      const time = saleDateObj.toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit' });

      return {
        id: sale.id,
        orderNumber: sale.orderNumber,
        date: date,
        time: time,
        totalValue: parseFloat(sale.totalValue),
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        items: sale.SaleItems.map(item => ({
          productId: item.Product ? item.Product.id : item.productId,
          productName: item.Product ? item.Product.name : (item.name || 'Produto desconhecido'),
          quantity: item.quantity,
          unitPrice: parseFloat(item.Product ? item.Product.price : (item.unitPrice || (item.total / item.quantity) || 0)),
          total: parseFloat(item.total)
        }))
      };
    });

    res.json(formattedHistory);

  } catch (error) {
    console.error('Erro ao buscar histórico de vendas do cliente:', error);
    res.status(500).json({ message: 'Erro interno ao processar a solicitação.' });
  }
};
