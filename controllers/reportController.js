const { Product, Sale, SaleItem, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Relatório de Vendas (Fechamento de Caixa) por Período e Horário Manual
 */
exports.getSalesByPeriod = async (req, res) => {
  try {
    // MUDANÇA: Lendo startTime e endTime em vez de shift
    const { startDate, endDate, startTime, endTime } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Datas de início e fim são obrigatórias' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    let periodLabel = `${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`;

    // Define as horas com base nos parâmetros recebidos ou usa o dia inteiro como padrão
    const startHours = startTime ? parseInt(startTime.split(':')[0]) : 0;
    const startMinutes = startTime ? parseInt(startTime.split(':')[1]) : 0;

    const endHours = endTime ? parseInt(endTime.split(':')[0]) : 23;
    const endMinutes = endTime ? parseInt(endTime.split(':')[1]) : 59;
    
    start.setHours(startHours, startMinutes, 0, 0);
    end.setHours(endHours, endMinutes, 59, 999);

    // Ajusta o rótulo do período se um horário específico for usado
    if (startTime && endTime) {
      if (startDate === endDate) {
        periodLabel = `${start.toLocaleDateString('pt-BR')} (de ${startTime} até ${endTime})`;
      } else {
        periodLabel += ` (de ${startTime} até ${endTime})`;
      }
    }
    
    const sales = await Sale.findAll({
      where: {
        // Esta cláusula já está correta e funcionará com os novos horários
        '$Sale.createdAt$': {
          [Op.between]: [start, end]
        },
        status: 'Concluída'
      },
      include: [{
        model: SaleItem,
        as: 'SaleItems',
        include: [Product]
      }],
      order: [['createdAt', 'ASC']]
    });

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
    
    res.json({
      title: 'Fechamento de Caixa',
      period: periodLabel,
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
 * (Função inalterada)
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
 * (Função inalterada)
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
        createdAt: { [Op.between]: [start, end] },
        status: 'Concluída'
      },
      include: [{model: SaleItem, as: 'SaleItems'}]
    });

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
