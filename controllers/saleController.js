 
const { Sale, SaleItem, Product, Client, sequelize } = require('../models');

// Obter todas as vendas
exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.findAll({
      include: [SaleItem],
      order: [['date', 'DESC']]
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obter uma venda específica
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findByPk(req.params.id, {
      include: [SaleItem]
    });
    
    if (!sale) {
      return res.status(404).json({ message: 'Venda não encontrada' });
    }
    
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Criar uma nova venda
exports.createSale = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar se o cliente existe
    const client = await Client.findByPk(req.body.clientId);
    if (!client) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    
    // Criar a venda
    const sale = await Sale.create({
      date: req.body.date || new Date(),
      clientId: req.body.clientId,
      client: client.name,
      totalValue: req.body.totalValue,
      paymentMethod: req.body.paymentMethod,
      status: req.body.status || 'Concluída'
    }, { transaction });
    
    // Adicionar itens da venda
    for (const item of req.body.items) {
      // Verificar se o produto existe
      const product = await Product.findByPk(item.productId);
      if (!product) {
        await transaction.rollback();
        return res.status(404).json({ message: `Produto com ID ${item.productId} não encontrado` });
      }
      
      // Verificar estoque
      if (product.stock < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: `Estoque insuficiente para o produto ${product.name}. Disponível: ${product.stock}` 
        });
      }
      
      // Reduzir estoque
      await product.update({ 
        stock: product.stock - item.quantity 
      }, { transaction });
      
      // Criar item da venda
      await SaleItem.create({
        saleId: sale.id,
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      }, { transaction });
    }
    
    await transaction.commit();
    
    // Buscar a venda com seus itens
    const newSale = await Sale.findByPk(sale.id, {
      include: [SaleItem]
    });
    
    res.status(201).json(newSale);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: error.message });
  }
};

// Atualizar uma venda
exports.updateSale = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar se a venda existe
    const sale = await Sale.findByPk(req.params.id, {
      include: [SaleItem]
    });
    
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Venda não encontrada' });
    }
    
    // Atualizar dados da venda
    await sale.update({
      date: req.body.date || sale.date,
      clientId: req.body.clientId || sale.clientId,
      client: req.body.client || sale.client,
      totalValue: req.body.totalValue || sale.totalValue,
      paymentMethod: req.body.paymentMethod || sale.paymentMethod,
      status: req.body.status || sale.status
    }, { transaction });
    
    // Se houver novos itens, atualizar
    if (req.body.items) {
      // Obter itens existentes
      const existingItems = sale.SaleItems || [];
      
      // Devolver estoque dos itens anteriores
      for (const item of existingItems) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          await product.update({ 
            stock: product.stock + item.quantity 
          }, { transaction });
        }
      }
      
      // Excluir itens anteriores
      await SaleItem.destroy({
        where: { saleId: sale.id },
        transaction
      });
      
      // Adicionar novos itens
      for (const item of req.body.items) {
        // Verificar se o produto existe
        const product = await Product.findByPk(item.productId);
        if (!product) {
          await transaction.rollback();
          return res.status(404).json({ message: `Produto com ID ${item.productId} não encontrado` });
        }
        
        // Verificar estoque
        if (product.stock < item.quantity) {
          await transaction.rollback();
          return res.status(400).json({ 
            message: `Estoque insuficiente para o produto ${product.name}. Disponível: ${product.stock}` 
          });
        }
        
        // Reduzir estoque
        await product.update({ 
          stock: product.stock - item.quantity 
        }, { transaction });
        
        // Criar item da venda
        await SaleItem.create({
          saleId: sale.id,
          productId: item.productId,
          name: product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Buscar a venda atualizada com seus itens
    const updatedSale = await Sale.findByPk(sale.id, {
      include: [SaleItem]
    });
    
    res.json(updatedSale);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: error.message });
  }
};

// Excluir uma venda
exports.deleteSale = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar se a venda existe
    const sale = await Sale.findByPk(req.params.id, {
      include: [SaleItem]
    });
    
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Venda não encontrada' });
    }
    
    // Devolver estoque dos itens
    const saleItems = sale.SaleItems || [];
    for (const item of saleItems) {
      const product = await Product.findByPk(item.productId);
      if (product) {
        await product.update({ 
          stock: product.stock + item.quantity 
        }, { transaction });
      }
    }
    
    // Excluir itens da venda
    await SaleItem.destroy({
      where: { saleId: sale.id },
      transaction
    });
    
    // Excluir a venda
    await sale.destroy({ transaction });
    
    await transaction.commit();
    
    res.json({ message: 'Venda removida com sucesso' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: error.message });
  }
};