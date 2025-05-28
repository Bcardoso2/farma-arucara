const axios = require('axios');
const https = require('https');

class SefazService {
  constructor() {
    this.timeout = 15000;
    
    // Agente HTTPS para aceitar certificados
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
  }

  // Extrair informações da chave de acesso
  parseAccessKey(chaveAcesso) {
    if (chaveAcesso.length !== 44) {
      throw new Error('Chave de acesso deve ter 44 dígitos');
    }

    if (!this.validarDigitoVerificador(chaveAcesso)) {
      throw new Error('Chave de acesso inválida - dígito verificador incorreto');
    }

    return {
      uf: chaveAcesso.substring(0, 2),
      aamm: chaveAcesso.substring(2, 6),
      cnpj: chaveAcesso.substring(6, 20),
      modelo: chaveAcesso.substring(20, 22),
      serie: chaveAcesso.substring(22, 25),
      numero: chaveAcesso.substring(25, 34),
      tpEmis: chaveAcesso.substring(34, 35),
      codigo: chaveAcesso.substring(35, 43),
      dv: chaveAcesso.substring(43, 44)
    };
  }

  // Validar dígito verificador
  validarDigitoVerificador(chave) {
    const digitos = chave.substring(0, 43).split('').map(Number);
    const multiplicadores = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let soma = 0;
    for (let i = 0; i < 43; i++) {
      soma += digitos[i] * multiplicadores[i];
    }
    
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    
    return dv === parseInt(chave.substring(43, 44));
  }

  // Consultar NFe REAL usando Brasil API
  async consultarNFe(chaveAcesso) {
    try {
      const keyInfo = this.parseAccessKey(chaveAcesso);
      const uf = this.getUFByCode(keyInfo.uf);
      
      if (!uf) {
        throw new Error('UF não identificada na chave de acesso');
      }

      console.log(`🔍 Consultando NFe REAL ${keyInfo.numero} no estado ${uf} via Brasil API`);

      // Consultar Brasil API
      const nfeData = await this.consultarBrasilAPI(chaveAcesso);
      console.log('✅ Dados REAIS obtidos via Brasil API');

      return {
        success: true,
        data: nfeData
      };

    } catch (error) {
      console.error('❌ Erro ao consultar NFe na Brasil API:', error.message);
      
      // Se a Brasil API falhar, informar o usuário
      if (error.message.includes('404') || error.message.includes('não encontrada')) {
        throw new Error(`NFe não encontrada na base de dados pública. Possíveis causas:
        • NFe muito recente (ainda não indexada)
        • NFe muito antiga (fora do período disponível)
        • NFe cancelada ou denegada
        • Chave de acesso incorreta
        
        Tente novamente em alguns minutos ou verifique a chave de acesso.`);
      }
      
      if (error.message.includes('timeout')) {
        throw new Error('Timeout na consulta. Serviço temporariamente lento. Tente novamente.');
      }
      
      throw new Error(`Erro na consulta da NFe: ${error.message}`);
    }
  }

  // Consultar Brasil API
  async consultarBrasilAPI(chaveAcesso) {
    try {
      const url = `https://brasilapi.com.br/api/nfe/v1/${chaveAcesso}`;
      console.log(`📡 Fazendo requisição para: ${url}`);
      
      const response = await axios.get(url, {
        timeout: this.timeout,
        httpsAgent: this.httpsAgent,
        headers: {
          'User-Agent': 'FarmaciaSystem/1.0',
          'Accept': 'application/json'
        }
      });

      console.log('📦 Resposta recebida da Brasil API');

      if (!response.data) {
        throw new Error('Resposta vazia da Brasil API');
      }

      // Verificar se houve erro na resposta
      if (response.data.message && response.data.message.includes('not found')) {
        throw new Error('NFe não encontrada na Brasil API');
      }

      return this.formatarDadosBrasilAPI(response.data);

    } catch (error) {
      if (error.response) {
        // Erro HTTP
        const status = error.response.status;
        const statusText = error.response.statusText;
        
        if (status === 404) {
          throw new Error('NFe não encontrada na base de dados da Brasil API');
        } else if (status === 429) {
          throw new Error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
        } else if (status >= 500) {
          throw new Error('Serviço da Brasil API temporariamente indisponível');
        } else {
          throw new Error(`Erro HTTP ${status}: ${statusText}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout na consulta da Brasil API');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Não foi possível conectar com a Brasil API');
      } else {
        throw error;
      }
    }
  }

  // Formatar dados da Brasil API
  formatarDadosBrasilAPI(data) {
    console.log('🔄 Formatando dados da Brasil API...');
    
    try {
      // Dados básicos da NFe
      const nfeFormatada = {
        invoiceNumber: data.numero || data.nNF || 'N/A',
        serie: data.serie || '1',
        supplier: data.emitente?.nome || data.emit?.xNome || 'Fornecedor não identificado',
        supplierFantasia: data.emitente?.fantasia || data.emit?.xFant || '',
        cnpj: data.emitente?.cnpj || data.emit?.CNPJ || '',
        date: this.formatarData(data.dataEmissao || data.dhEmi),
        valorTotal: this.formatarValor(data.valorTotal || data.total?.vNF || 0),
        
        // Processar itens
        items: this.processarItens(data.itens || data.det || [])
      };

      console.log(`✅ NFe formatada: ${nfeFormatada.invoiceNumber} - ${nfeFormatada.supplier}`);
      console.log(`💰 Valor total: R$ ${nfeFormatada.valorTotal}`);
      console.log(`📦 Itens processados: ${nfeFormatada.items.length}`);

      return nfeFormatada;

    } catch (error) {
      console.error('❌ Erro ao formatar dados da Brasil API:', error);
      throw new Error('Erro ao processar dados da NFe: ' + error.message);
    }
  }

  // Processar itens da NFe
  processarItens(itens) {
    if (!Array.isArray(itens)) {
      console.log('⚠️ Nenhum item encontrado na NFe');
      return [];
    }

    console.log(`📋 Processando ${itens.length} itens...`);

    return itens.map((item, index) => {
      try {
        // Suportar diferentes formatos de resposta
        const produto = item.prod || item.produto || item;
        
        const itemFormatado = {
          codigo: produto.cProd || produto.codigo || `ITEM_${index + 1}`,
          codigoBarras: produto.cEAN || produto.codigoBarras || produto.gtin || '',
          nome: produto.xProd || produto.nome || produto.descricao || `Produto ${index + 1}`,
          quantidade: this.formatarQuantidade(produto.qCom || produto.quantidade || 1),
          unidade: produto.uCom || produto.unidade || 'UN',
          valorUnitario: this.formatarValor(produto.vUnCom || produto.valorUnitario || 0),
          valorTotal: this.formatarValor(produto.vProd || produto.valorTotal || 0),
          ncm: produto.NCM || produto.ncm || '',
          cfop: produto.CFOP || produto.cfop || ''
        };

        // Calcular valor total se não estiver presente
        if (itemFormatado.valorTotal === 0 && itemFormatado.valorUnitario > 0) {
          itemFormatado.valorTotal = itemFormatado.quantidade * itemFormatado.valorUnitario;
        }

        console.log(`  ✓ Item ${index + 1}: ${itemFormatado.nome} - ${itemFormatado.quantidade} ${itemFormatado.unidade}`);

        return itemFormatado;

      } catch (error) {
        console.error(`❌ Erro ao processar item ${index + 1}:`, error);
        
        // Retornar item básico em caso de erro
        return {
          codigo: `ERRO_${index + 1}`,
          codigoBarras: '',
          nome: `Produto com erro ${index + 1}`,
          quantidade: 1,
          unidade: 'UN',
          valorUnitario: 0,
          valorTotal: 0,
          ncm: '',
          cfop: ''
        };
      }
    });
  }

  // Formatar data
  formatarData(data) {
    if (!data) {
      return new Date().toISOString().split('T')[0];
    }

    try {
      if (data.includes('T')) {
        return data.split('T')[0];
      }
      
      if (data.includes('/')) {
        const [dia, mes, ano] = data.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      
      return data;
    } catch (error) {
      console.log('⚠️ Erro ao formatar data, usando data atual');
      return new Date().toISOString().split('T')[0];
    }
  }

  // Formatar valor monetário
  formatarValor(valor) {
    if (!valor || isNaN(valor)) return 0;
    return parseFloat(valor);
  }

  // Formatar quantidade
  formatarQuantidade(quantidade) {
    if (!quantidade || isNaN(quantidade)) return 1;
    return parseInt(quantidade);
  }

  // Converter código UF para sigla
  getUFByCode(code) {
    const ufCodes = {
      '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
      '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
      '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
      '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
      '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
      '52': 'GO', '53': 'DF'
    };
    
    return ufCodes[code];
  }
}

module.exports = new SefazService();