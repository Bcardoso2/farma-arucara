const jwt = require('jsonwebtoken');
const { User } = require('../models');

const auth = async (req, res, next) => {
  try {
    // Verificar se o token está presente no header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Autenticação necessária' });
    }

    // Verificar a validade do token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar o usuário no banco de dados
    const user = await User.findOne({
      where: {
        id: decoded.id,
        ativo: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Usuário não encontrado ou inativo' });
    }

    // Adicionar o usuário ao objeto de requisição
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    res.status(401).json({ message: 'Não autorizado' });
  }
};

// Middleware para verificar se o usuário é administrador
const adminAuth = async (req, res, next) => {
  try {
    // Primeiro executa o middleware auth
    await auth(req, res, () => {
      // Verifica se o usuário é administrador
      if (req.user && req.user.cargo === 'admin') {
        next();
      } else {
        return res.status(403).json({ message: 'Acesso negado: Permissão de administrador necessária' });
      }
    });
  } catch (error) {
    console.error('Erro de autorização:', error);
    res.status(401).json({ message: 'Não autorizado' });
  }
};

module.exports = { auth, adminAuth };