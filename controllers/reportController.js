 
const { Product, Sale, SaleItem, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// Relatório de vendas por período
exports.getSalesByPeriod = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Datas de início e fim são obrigatórias' });
    }
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Obter vendas no período
    const sales = await Sale.findAll({
      where: {
        date: { [Op.between]: [start, end] },
        status: 'Concluída'
      },
      order: [['date', 'ASC']]
    });
    
    // Calcular total de vendas e receita
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.totalValue), 0);
    
    // Agrupar vendas por data
    const salesByDate = {};
    
    sales.forEach(sale => {
      const dateStr = new Date(sale.date).toLocaleDateString();
      if (!salesByDate[dateStr]) {
        salesByDate[dateStr] = {
          date: dateStr,
          count: 0,
          total: 0
        };
      }
      salesByDate[dateStr].count += 1;
      salesByDate[dateStr].total += parseFloat(sale.totalValue);
    });
    
    // Converter para array
    const items = Object.values(salesByDate);
    
    res.json({
      title: 'Relatório de Vendas por Período',
      period: `${start.toLocaleDateString()} até ${end.toLocaleDateString()}`,
      totalSales,
      totalRevenue,
      items
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Relatório de estoque
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
      date: new Date().toLocaleDateString(),
      totalItems: products.length,
      lowStockItems,
      items
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Relatório de produtos mais vendidos
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
    
    // Buscar todas as vendas no período
    const sales = await Sale.findAll({
      where: {
        date: { [Op.between]: [start, end] },
        status: 'Concluída'
      },
      include: [SaleItem]
    });
    
    // Agregar produtos vendidos
    const productSales = {};
    
    sales.forEach(sale => {
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
    
    // Converter para array e ordenar por quantidade
    let items = Object.values(productSales);
    items.sort((a, b) => b.quantity - a.quantity);
    
    // Adicionar rank
    items = items.map((item, index) => ({
      rank: index + 1,
      ...item
    }));
    
    // Limitar a 10 produtos
    items = items.slice(0, 10);
    
    res.json({
      title: 'Produtos Mais Vendidos',
      period: `${start.toLocaleDateString()} até ${end.toLocaleDateString()}`,
      items
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};