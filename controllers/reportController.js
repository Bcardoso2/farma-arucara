const { Product, Sale, SaleItem, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Relatório de Vendas Detalhado por Período
 * Retorna cada venda individualmente com data, hora e itens vendidos.
 */
exports.getSalesByPeriod = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Datas de início e fim são obrigatórias' });
    }

    const sales = await Sale.findAll({
      where: {
        // MUDANÇA: Especificando o modelo 'Sale' na coluna para remover a ambiguidade.
        // Agora o SQL gerado será algo como WHERE DATE("Sale"."createdAt") >= ...
        [Op.and]: [
          sequelize.where(fn('DATE', col('Sale.createdAt')), '>=', startDate),
          sequelize.where(fn('DATE', col('Sale.createdAt')), '<=', endDate)
        ],
        status: 'Concluída'
      },
      include: [{
        model: SaleItem,
        as: 'SaleItems',
        include: [Product]
      }],
      // MUDANÇA: Também especificamos a coluna na ordenação para garantir.
      order: [[col('Sale.createdAt'), 'ASC']]
    });

    // --- O resto da função permanece exatamente o mesmo ---

    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.totalValue), 0);

    const revenueByPaymentMethod = sales.reduce((acc, sale) => {
      const method = sale.paymentMethod || 'Não especificado';
      const value = parseFloat(sale.totalValue);
      if (!acc[method]) { acc[method] = 0; }
      acc[method] += value;
      return acc;
    }, {});

    const detailedReport = sales.map(sale => {
      const saleDateObj = new Date(sale.createdAt); 
      const date = saleDateObj.toLocaleDateString('pt-BR', { timeZone: 'America/Belem' });
      const time = saleDateObj.toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit' });

      const saleItems = sale.SaleItems.map(item => {
        const total = parseFloat(item.total);
        const quantity = item.quantity;
        const unitPrice = parseFloat(item.unitPrice) || (total / quantity);
        return {
          productName: item.Product ? item.Product.name : 'Produto não encontrado',
          quantity: quantity, unitPrice: unitPrice, total: total
        };
      });

      return {
        id: sale.id, date, time,
        totalValue: parseFloat(sale.totalValue),
        paymentMethod: sale.paymentMethod,
        items: saleItems
      };
    });
    
    const periodStart = new Date(startDate + 'T00:00:00');
    const periodEnd = new Date(endDate + 'T00:00:00');

    res.json({
      title: 'Fechamento de Caixa por Período',
      period: `${periodStart.toLocaleDateString('pt-BR')} até ${periodEnd.toLocaleDateString('pt-BR')}`,
      totalSales, totalRevenue, revenueByPaymentMethod,
      sales: detailedReport
    });

  } catch (error) {
    console.error('Erro ao gerar fechamento de caixa:', error);
    res.status(500).json({ message: error.message });
  }
};
/**
 * Relatório de Estoque
 * Lista todos os produtos, seu estoque atual e status (Normal ou Baixo).
 */
exports.getStockReport = async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['name', 'ASC']]
    });

    const items = products.map(product => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      minStock: product.minStock,
      status: product.stock < product.minStock ? 'Baixo' : 'Normal'
    }));

    const lowStockItems = items.filter(item => item.status === 'Baixo').length;

    res.json({
      title: 'Relatório de Estoque',
      date: new Date().toLocaleDateString('pt-BR'),
      totalItems: products.length,
      lowStockItems,
      items
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Relatório de Produtos Mais Vendidos
 * Retorna um ranking dos produtos mais vendidos em um determinado período.
 */
exports.getTopProducts = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Datas de início e fim são obrigatórias' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sales = await Sale.findAll({
      where: {
        date: { [Op.between]: [start, end] },
        status: 'Concluída'
      },
      include: [SaleItem]
    });

    const productSales = {};

    sales.forEach(sale => {
      // Sequelize usa 'SaleItems' como padrão se 'as' não for especificado na associação
      sale.SaleItems.forEach(item => { 
        const id = item.productId.toString();
        if (!productSales[id]) {
          productSales[id] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[id].quantity += item.quantity;
        productSales[id].revenue += parseFloat(item.total);
      });
    });

    let items = Object.values(productSales);
    items.sort((a, b) => b.quantity - a.quantity);

    items = items.map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    items = items.slice(0, 10);

    res.json({
      title: 'Produtos Mais Vendidos',
      period: `${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`,
      items
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
