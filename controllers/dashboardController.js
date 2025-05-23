 
const { Product, Sale, SaleItem, Prescription, Client, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// Obter dados para o dashboard
exports.getDashboardData = async (req, res) => {
  try {
    // Contagem total de produtos
    const totalProducts = await Product.count();
    
    // Produtos com estoque baixo
    const lowStock = await Product.count({
      where: sequelize.literal('stock < minStock')
    });
    
    // Vendas de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySales = await Sale.sum('totalValue', {
      where: {
        date: { [Op.gte]: today, [Op.lt]: tomorrow },
        status: 'Concluída'
      }
    });
    
    // Receitas pendentes
    const pendingPrescriptions = await Prescription.count({
      where: {
        status: 'Válida'
      }
    });
    
    // Atividades recentes (vendas)
    const recentSales = await Sale.findAll({
      order: [['createdAt', 'DESC']],
      limit: 3,
      attributes: ['createdAt', 'client', 'totalValue']
    });
    
    // Atividades recentes (produtos)
    const recentProducts = await Product.findAll({
      order: [['createdAt', 'DESC']],
      limit: 2,
      attributes: ['createdAt', 'name']
    });
    
    // Combinar e ordenar atividades recentes
    let recentActivities = [
      ...recentSales.map(sale => ({
        time: sale.createdAt,
        user: 'Sistema',
        activity: `Venda realizada para ${sale.client} - R$ ${parseFloat(sale.totalValue).toFixed(2)}`
      })),
      ...recentProducts.map(product => ({
        time: product.createdAt,
        user: 'Sistema',
        activity: `Produto adicionado: ${product.name}`
      }))
    ];
    
    recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
    recentActivities = recentActivities.slice(0, 5).map(activity => ({
      ...activity,
      time: new Date(activity.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
    
    res.json({
      totalProducts,
      lowStock,
      todaySales: todaySales || 0,
      pendingPrescriptions,
      recentActivities
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};