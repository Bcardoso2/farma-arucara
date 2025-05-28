const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Product = require('../models/Product');
const sefazService = require('../services/sefazService');

const invoiceController = {
  // Processar código de barras da NFe
  processBarcodeData: async (req, res) => {
    try {
      const { barcode } = req.body;
      
      // Validações iniciais
      if (!barcode) {
        return res.status(400).json({ 
          message: 'Código de barras é obrigatório' 
        });
      }

      // Limpar código de barras (remover espaços, caracteres especiais)
      const chaveAcesso = barcode.replace(/\D/g, '');
      
      if (chaveAcesso.length !== 44) {
        return res.status(400).json({ 
          message: 'Chave de acesso deve ter exatamente 44 dígitos' 
        });
      }

      console.log(`🔍 Consultando NFe: ${chaveAcesso}`);
      
      // Consultar NFe na Sefaz
      const nfeResult = await sefazService.consultarNFe(chaveAcesso);
      
      if (!nfeResult.success) {
        return res.status(404).json({
          message: 'NFe não encontrada ou não autorizada'
        });
      }

      const nfeData = nfeResult.data;
      console.log(`✅ NFe encontrada: ${nfeData.invoiceNumber} - ${nfeData.supplier}`);

      // Verificar se a NFe já foi processada
      const existingInvoice = await Invoice.findOne({
        where: {
          invoiceNumber: nfeData.invoiceNumber,
          supplier: nfeData.supplier
        }
      });

      if (existingInvoice) {
        return res.status(409).json({
          message: `NFe ${nfeData.invoiceNumber} já foi processada anteriormente`,
          processedAt: existingInvoice.created_at
        });
      }

      // Mapear itens da NFe para produtos do sistema
      const mappedItems = [];
      const unmappedItems = [];

      for (const item of nfeData.items) {
        // Tentar encontrar produto no sistema
        let product = null;

        // Buscar por código de barras primeiro
        if (item.codigoBarras) {
          try {
            product = await Product.findOne({
              where: { barcode: item.codigoBarras }
            });
          } catch (error) {
            console.log('Erro ao buscar por código de barras:', error.message);
          }
        }

        // Se não encontrou, buscar por código do produto
        if (!product && item.codigo) {
          try {
            product = await Product.findOne({
              where: { code: item.codigo }
            });
          } catch (error) {
            console.log('Erro ao buscar por código:', error.message);
          }
        }

        // Se não encontrou, buscar por nome similar
        if (!product) {
          try {
            product = await Product.findOne({
              where: {
                name: { [Op.like]: `%${item.nome.substring(0, 15)}%` }
              }
            });
          } catch (error) {
            console.log('Erro ao buscar por nome:', error.message);
          }
        }

        const mappedItem = {
          nfeSequencia: mappedItems.length + unmappedItems.length + 1,
          codigoNFe: item.codigo,
          codigoBarras: item.codigoBarras,
          nomeNFe: item.nome,
          quantidade: item.quantidade,
          unidade: item.unidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          ncm: item.ncm,
          cfop: item.cfop,
          // Dados para o sistema
          productId: product ? product.id : null,
          productName: product ? product.name : item.nome,
          unitPrice: item.valorUnitario,
          total: item.valorTotal,
          batch: '', // Será preenchido manualmente
          expirationDate: '' // Será preenchido manualmente
        };

        if (product) {
          mappedItems.push(mappedItem);
        } else {
          unmappedItems.push(mappedItem);
        }
      }

      // Estatísticas do mapeamento
      const stats = {
        totalItens: nfeData.items.length,
        itensMapeados: mappedItems.length,
        itensNaoMapeados: unmappedItems.length,
        percentualMapeamento: Math.round((mappedItems.length / nfeData.items.length) * 100)
      };

      console.log(`📊 Mapeamento: ${stats.itensMapeados}/${stats.totalItens} itens (${stats.percentualMapeamento}%)`);

      // Preparar resposta
      const responseData = {
        // Dados da NFe
        chaveAcesso: chaveAcesso,
        invoiceNumber: nfeData.invoiceNumber,
        serie: nfeData.serie,
        supplier: nfeData.supplier,
        supplierFantasia: nfeData.supplierFantasia,
        cnpj: nfeData.cnpj,
        date: nfeData.date,
        valorTotal: nfeData.valorTotal,
        
        // Itens mapeados (prontos para entrada)
        items: mappedItems,
        
        // Itens não encontrados no sistema
        unmappedItems: unmappedItems,
        
        // Estatísticas
        stats: stats,
        
        // Dados completos da NFe para referência
        nfeCompleta: nfeData
      };

      // Mensagem de retorno
      let message = `✅ NFe ${nfeData.invoiceNumber} consultada com sucesso!`;
      if (unmappedItems.length > 0) {
        message += `\n⚠️ ${unmappedItems.length} itens não foram encontrados no sistema e precisarão ser adicionados manualmente.`;
      }

      res.json({
        success: true,
        message: message,
        data: responseData
      });
      
    } catch (error) {
      console.error('❌ Erro ao processar código de barras:', error);
      
      // Tratar diferentes tipos de erro
      if (error.message.includes('44 dígitos')) {
        return res.status(400).json({ 
          message: 'Chave de acesso inválida: deve ter 44 dígitos' 
        });
      }
      
      if (error.message.includes('dígito verificador')) {
        return res.status(400).json({ 
          message: 'Chave de acesso inválida: dígito verificador não confere' 
        });
      }
      
      if (error.message.includes('UF não identificada')) {
        return res.status(400).json({ 
          message: 'Chave de acesso inválida: UF não identificada' 
        });
      }

      if (error.message.includes('Não foi possível consultar')) {
        return res.status(503).json({ 
          message: 'Serviços da Sefaz indisponíveis no momento. Tente novamente em alguns minutos.' 
        });
      }
      
      res.status(500).json({ 
        message: 'Erro ao consultar NFe: ' + error.message 
      });
    }
  },

  // Processar entrada por nota fiscal
  processEntry: async (req, res) => {
    const { invoiceNumber, supplier, date, items, chaveAcesso } = req.body;
    
    const transaction = await sequelize.transaction();
    
    try {
      // Validações
      if (!invoiceNumber || !supplier || !items || items.length === 0) {
        return res.status(400).json({ 
          message: 'Dados obrigatórios: número da nota, fornecedor e itens' 
        });
      }

      // Verificar se a nota já foi processada
      const existingInvoice = await Invoice.findOne({
        where: {
          invoiceNumber,
          supplier
        }
      }, { transaction });

      if (existingInvoice) {
        return res.status(409).json({
          message: `Nota fiscal ${invoiceNumber} já foi processada anteriormente`
        });
      }

      // Calcular total da nota
      const totalValue = items.reduce((sum, item) => 
        sum + (item.quantity * item.unitPrice), 0
      );
      
      // Criar nota fiscal
      const invoice = await Invoice.create({
        invoiceNumber,
        supplier,
        invoiceDate: date,
        totalValue,
        createdBy: req.user.id,
        // Salvar dados adicionais da NFe se disponível
        ...(chaveAcesso && { 
          metadata: JSON.stringify({ 
            chaveAcesso,
            consultadoSefaz: true,
            dataConsulta: new Date()
          })
        })
      }, { transaction });
      
      // Processar cada item
      const processedItems = [];
      const errors = [];

      for (const item of items) {
        try {
          // Validar se produto existe
          const product = await Product.findByPk(item.productId, { transaction });
          if (!product) {
            errors.push(`Produto com ID ${item.productId} não encontrado`);
            continue;
          }

          // Salvar item da nota
          const invoiceItem = await InvoiceItem.create({
            invoiceId: invoice.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            batch: item.batch,
            expirationDate: item.expirationDate,
            // Salvar dados adicionais da NFe
            ...(item.codigoNFe && {
              metadata: JSON.stringify({
                codigoNFe: item.codigoNFe,
                codigoBarras: item.codigoBarras,
                nomeNFe: item.nomeNFe,
                ncm: item.ncm,
                cfop: item.cfop
              })
            })
          }, { transaction });
          
          // Atualizar estoque do produto
          const oldStock = product.stock;
          product.stock += item.quantity;
          
          // Atualizar preço se fornecido
          if (item.unitPrice && item.unitPrice > 0) {
            product.price = item.unitPrice;
          }
          
          await product.save({ transaction });

          processedItems.push({
            product: product.name,
            quantidadeAnterior: oldStock,
            quantidadeAdicionada: item.quantity,
            novoEstoque: product.stock,
            valorUnitario: item.unitPrice
          });

          console.log(`✅ Produto atualizado: ${product.name} - Estoque: ${oldStock} → ${product.stock}`);
          
        } catch (itemError) {
          console.error(`❌ Erro ao processar item:`, itemError);
          errors.push(`Erro no item ${item.productName}: ${itemError.message}`);
        }
      }
      
      await transaction.commit();
      
      console.log(`✅ Entrada processada: NFe ${invoiceNumber} - ${processedItems.length} itens`);

      // Resposta com detalhes do processamento
      const response = {
        message: 'Entrada processada com sucesso',
        data: {
          invoiceId: invoice.id,
          invoiceNumber,
          supplier,
          totalItems: processedItems.length,
          totalValue: totalValue.toFixed(2),
          processedItems: processedItems
        }
      };

      // Adicionar erros se houver
      if (errors.length > 0) {
        response.warnings = errors;
        response.message += ` (${errors.length} item(ns) com problema)`;
      }

      res.status(201).json(response);
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erro ao processar entrada:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ 
          message: 'Nota fiscal já existe para este fornecedor' 
        });
      }
      
      res.status(500).json({ 
        message: 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Listar todas as notas fiscais
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 10, supplier, startDate, endDate } = req.query;
      
      const where = {};
      
      if (supplier) {
        where.supplier = { [Op.like]: `%${supplier}%` };
      }
      
      if (startDate && endDate) {
        where.invoiceDate = {
          [Op.between]: [startDate, endDate]
        };
      }

      const invoices = await Invoice.findAndCountAll({
        where,
        include: [{
          model: InvoiceItem,
          as: 'items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'category']
          }]
        }],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });
      
      res.json({
        data: invoices.rows,
        pagination: {
          total: invoices.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(invoices.count / parseInt(limit))
        }
      });
      
    } catch (error) {
      console.error('Erro ao buscar notas fiscais:', error);
      res.status(500).json({ message: 'Erro ao buscar notas fiscais' });
    }
  },

  // Buscar nota fiscal por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const invoice = await Invoice.findByPk(id, {
        include: [{
          model: InvoiceItem,
          as: 'items',
          include: [{
            model: Product,
            as: 'product'
          }]
        }]
      });
      
      if (!invoice) {
        return res.status(404).json({ message: 'Nota fiscal não encontrada' });
      }
      
      res.json({ data: invoice });
      
    } catch (error) {
      console.error('Erro ao buscar nota fiscal:', error);
      res.status(500).json({ message: 'Erro ao buscar nota fiscal' });
    }
  },

  // Cancelar nota fiscal
  cancel: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      const invoice = await Invoice.findByPk(id, {
        include: [{ model: InvoiceItem, as: 'items' }]
      }, { transaction });
      
      if (!invoice) {
        return res.status(404).json({ message: 'Nota fiscal não encontrada' });
      }
      
      if (invoice.status === 'cancelled') {
        return res.status(400).json({ message: 'Nota já está cancelada' });
      }
      
      // Reverter estoque
      const revertedItems = [];
      for (const item of invoice.items) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (product) {
          const oldStock = product.stock;
          product.stock -= item.quantity;
          await product.save({ transaction });
          
          revertedItems.push({
            product: product.name,
            quantidadeRevertida: item.quantity,
            estoqueAnterior: oldStock,
            novoEstoque: product.stock
          });
        }
      }
      
      // Marcar como cancelada
      invoice.status = 'cancelled';
      await invoice.save({ transaction });
      
      await transaction.commit();
      
      res.json({ 
        message: 'Nota fiscal cancelada com sucesso',
        revertedItems: revertedItems
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao cancelar nota fiscal:', error);
      res.status(500).json({ message: 'Erro ao cancelar nota fiscal' });
    }
  },

  // Relatório de notas fiscais
  getReport: async (req, res) => {
    try {
      const { startDate, endDate, supplier } = req.query;
      
      const where = {};
      
      if (startDate && endDate) {
        where.invoiceDate = {
          [Op.between]: [startDate, endDate]
        };
      }
      
      if (supplier) {
        where.supplier = { [Op.like]: `%${supplier}%` };
      }

      const invoices = await Invoice.findAll({
        where,
        include: [{
          model: InvoiceItem,
          as: 'items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['name', 'category']
          }]
        }],
        order: [['invoiceDate', 'DESC']]
      });

      // Calcular estatísticas
      const stats = {
        totalNotas: invoices.length,
        valorTotal: invoices.reduce((sum, inv) => sum + parseFloat(inv.totalValue), 0),
        totalItens: invoices.reduce((sum, inv) => sum + inv.items.length, 0),
        fornecedoresUnicos: [...new Set(invoices.map(inv => inv.supplier))].length,
        
        // Agrupamento por fornecedor
        porFornecedor: {},
        
        // Agrupamento por mês
        porMes: {}
      };

      // Calcular dados por fornecedor
      invoices.forEach(invoice => {
        if (!stats.porFornecedor[invoice.supplier]) {
          stats.porFornecedor[invoice.supplier] = {
            quantidadeNotas: 0,
            valorTotal: 0,
            itens: 0
          };
        }
        
        stats.porFornecedor[invoice.supplier].quantidadeNotas++;
        stats.porFornecedor[invoice.supplier].valorTotal += parseFloat(invoice.totalValue);
        stats.porFornecedor[invoice.supplier].itens += invoice.items.length;
      });

      // Calcular dados por mês
      invoices.forEach(invoice => {
        const mes = invoice.invoiceDate.toISOString().substring(0, 7); // YYYY-MM
        
        if (!stats.porMes[mes]) {
          stats.porMes[mes] = {
            quantidadeNotas: 0,
            valorTotal: 0,
            itens: 0
          };
        }
        
        stats.porMes[mes].quantidadeNotas++;
        stats.porMes[mes].valorTotal += parseFloat(invoice.totalValue);
        stats.porMes[mes].itens += invoice.items.length;
      });

      res.json({
        periodo: { startDate, endDate },
        estatisticas: stats,
        notas: invoices
      });
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório' });
    }
  }
};

module.exports = invoiceController;