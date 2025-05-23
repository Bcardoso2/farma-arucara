 
const { Client } = require('../models');
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
    // Verificar se já existe um cliente com o mesmo CPF
    const existingClient = await Client.findOne({ where: { cpf: req.body.cpf } });
    if (existingClient) {
      return res.status(400).json({ message: 'Já existe um cliente com este CPF' });
    }

    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (error) {
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
    
    // Verificar se o CPF atualizado já existe em outro cliente
    if (req.body.cpf) {
      const existingClient = await Client.findOne({
        where: {
          cpf: req.body.cpf,
          id: { [Op.ne]: req.params.id }
        }
      });
      
      if (existingClient) {
        return res.status(400).json({ message: 'Já existe outro cliente com este CPF' });
      }
    }
    
    await client.update(req.body);
    res.json(client);
  } catch (error) {
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