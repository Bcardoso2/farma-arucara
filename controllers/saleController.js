const { Sale, SaleItem, Product, Client, sequelize } = require('../models');

// ==================== VENDAS FINALIZADAS ====================

// Obter todas as vendas (apenas concluídas)
exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.findAll({
      where: { status: 'Concluída' }, // Apenas vendas finalizadas
      include: [SaleItem],
      order: [['date', 'DESC']]
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== PEDIDOS ====================

// Obter todos os pedidos (pendentes por padrão)
exports.getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    
    let whereClause = {};
    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = 'Pendente'; // Por padrão, apenas pendentes
    }
    
    const orders = await Sale.findAll({
      where: whereClause,
      include: [SaleItem],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Buscar pedido por número
exports.getOrderByNumber = async (req, res) => {
  try {
    const order = await Sale.findOne({
      where: { orderNumber: req.params.orderNumber },
      include: [SaleItem]
    });
    
    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== MANTER MÉTODOS EXISTENTES ====================

// Obter uma venda específica (mantido igual)
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

// ==================== CRIAR PEDIDO (MODIFICADO) ====================

// Criar uma nova venda/pedido
exports.createSale = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar se o cliente existe
    const client = await Client.findByPk(req.body.clientId);
    if (!client) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    
    // Criar o pedido (sempre como Pendente inicialmente)
    const sale = await Sale.create({
      date: req.body.date || new Date(),
      clientId: req.body.clientId,
      client: client.name,
      totalValue: req.body.totalValue,
      status: 'Pendente', // Sempre começa como pedido
      notes: req.body.notes,
      // paymentMethod será definido apenas na finalização
    }, { transaction });
    
    // Adicionar itens da venda (SEM reduzir estoque ainda)
    for (const item of req.body.items) {
      // Verificar se o produto existe
      const product = await Product.findByPk(item.productId);
      if (!product) {
        await transaction.rollback();
        return res.status(404).json({ message: `Produto com ID ${item.productId} não encontrado` });
      }
      
      // Verificar estoque disponível (mas não reduzir ainda)
      if (product.stock < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: `Estoque insuficiente para o produto ${product.name}. Disponível: ${product.stock}` 
        });
      }
      
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

// ==================== FINALIZAÇÃO NO CAIXA ====================

// Finalizar pedido (converter em venda)
exports.finalizeSale = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { 
      paymentMethod, 
      amountPaid, 
      change, 
      discount,
      cashierId,
      finalizedBy 
    } = req.body;
    
    // Buscar o pedido
    const sale = await Sale.findByPk(id, {
      include: [SaleItem]
    });
    
    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }
    
    if (sale.status !== 'Pendente') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Pedido já foi finalizado ou cancelado' });
    }
    
    // Verificar estoque novamente antes de finalizar
    for (const item of sale.SaleItems) {
      const product = await Product.findByPk(item.productId);
      if (product.stock < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: `Estoque insuficiente para ${product.name}. Disponível: ${product.stock}` 
        });
      }
    }
    
    // AGORA SIM: Reduzir estoque dos produtos
    for (const item of sale.SaleItems) {
      await Product.update(
        { stock: sequelize.literal(`stock - ${item.quantity}`) },
        { 
          where: { id: item.productId },
          transaction 
        }
      );
    }
    
    // Finalizar o pedido
    await sale.update({
      status: 'Concluída',
      paymentMethod,
      amountPaid,
      change: change || 0,
      discount: discount || 0,
      finalizedAt: new Date(),
      cashierId,
      finalizedBy
    }, { transaction });
    
    await transaction.commit();
    
    // Buscar a venda finalizada completa
    const finalizedSale = await Sale.findByPk(sale.id, {
      include: [SaleItem]
    });
    
    res.json(finalizedSale);
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: error.message });
  }
};

// Cancelar pedido
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const sale = await Sale.findByPk(id);
    
    if (!sale) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }
    
    if (sale.status !== 'Pendente') {
      return res.status(400).json({ message: 'Apenas pedidos pendentes podem ser cancelados' });
    }
    
    await sale.update({
      status: 'Cancelada',
      notes: sale.notes ? `${sale.notes}\n\nCancelado: ${reason}` : `Cancelado: ${reason}`
    });
    
    res.json({ message: 'Pedido cancelado com sucesso' });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==================== ATUALIZAR (MODIFICADO) ====================

// Atualizar uma venda/pedido
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
    
    // Não permitir edição de vendas finalizadas
    if (sale.status === 'Concluída') {
      await transaction.rollback();
      return res.status(400).json({ message: 'Vendas finalizadas não podem ser editadas' });
    }
    
    // Atualizar dados da venda
    await sale.update({
      date: req.body.date || sale.date,
      clientId: req.body.clientId || sale.clientId,
      client: req.body.client || sale.client,
      totalValue: req.body.totalValue || sale.totalValue,
      notes: req.body.notes || sale.notes
      // paymentMethod e status só podem ser alterados na finalização
    }, { transaction });
    
    // Se houver novos itens, atualizar
    if (req.body.items) {
      // Excluir itens anteriores (não precisa devolver estoque pois não foi reduzido)
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
        
        // Criar item da venda (sem reduzir estoque)
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

// ==================== EXCLUIR (MODIFICADO) ====================

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
    
    // Se for venda finalizada, devolver estoque
    if (sale.status === 'Concluída') {
      const saleItems = sale.SaleItems || [];
      for (const item of saleItems) {
        await Product.update(
          { stock: sequelize.literal(`stock + ${item.quantity}`) },
          { 
            where: { id: item.productId },
            transaction 
          }
        );
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