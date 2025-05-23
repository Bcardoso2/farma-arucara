const { User } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// Gerar token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '12h' // Token expira em 12 horas
  });
};

// Registrar novo usuário (apenas admin pode criar)
exports.registerUser = async (req, res) => {
  try {
    // Verificar se todos os campos necessários estão presentes
    const { nome, login, senha, email, cargo } = req.body;
    
    if (!nome || !login || !senha) {
      return res.status(400).json({ message: 'Nome, login e senha são obrigatórios' });
    }

    // Verificar se o login já está em uso
    const existingLogin = await User.findOne({ where: { login } });
    if (existingLogin) {
      return res.status(400).json({ message: 'Este login já está em uso' });
    }
    
    // Verificar se o email já está em uso (se fornecido)
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ message: 'Este email já está em uso' });
      }
    }

    // Criar o usuário
    const user = await User.create({
      nome,
      login,
      senha,
      email: email || null, // Permitir email null se não for fornecido
      cargo: cargo || 'funcionario',
      ativo: true
    });

    // Retornar usuário sem a senha
    const userWithoutPassword = {
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: user.email,
      cargo: user.cargo,
      ativo: user.ativo
    };

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(400).json({ message: error.message });
  }
};

// Login de usuário
exports.loginUser = async (req, res) => {
  try {
    const { login, senha } = req.body;
    
    console.log('Tentativa de login:', { login, senhaFornecida: !!senha });
    
    // Verificar se login e senha foram fornecidos
    if (!login || !senha) {
      return res.status(400).json({ message: 'Login e senha são obrigatórios' });
    }

    // Verificar se o login existe
    const user = await User.findOne({ where: { login } });
    
    if (!user) {
      console.log('Usuário não encontrado:', login);
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    console.log('Usuário encontrado:', {
      id: user.id,
      login: user.login,
      ativo: user.ativo,
      senhaArmazenada: !!user.senha
    });

    // Verificar se o usuário está ativo
    if (!user.ativo) {
      console.log('Usuário inativo:', login);
      return res.status(401).json({ message: 'Usuário inativo. Contate o administrador.' });
    }

    // Verificar senha
    const isMatch = await user.checkPassword(senha);
    console.log('Resultado da verificação de senha:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Gerar token
    const token = generateToken(user.id);

    // Retornar usuário sem a senha
    const userWithoutPassword = {
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: user.email,
      cargo: user.cargo
    };

    res.json({
      message: 'Login realizado com sucesso',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: error.message });
  }
};
// Obter usuário atual
exports.getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }
    
    // req.user já está disponível graças ao middleware auth
    const userWithoutPassword = {
      id: req.user.id,
      nome: req.user.nome,
      login: req.user.login,
      email: req.user.email,
      cargo: req.user.cargo,
      ativo: req.user.ativo
    };

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error);
    res.status(500).json({ message: error.message });
  }
};

// Listar todos os usuários (apenas admin)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['senha'] }
    });
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ message: error.message });
  }
};

// Atualizar usuário
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ message: 'ID do usuário não fornecido' });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const { nome, login, email, senha, cargo, ativo } = req.body;

    // Verificar se o login já está em uso por outro usuário
    if (login && login !== user.login) {
      const existingLogin = await User.findOne({ 
        where: { 
          login,
          id: { [Op.ne]: userId }
        }
      });
      
      if (existingLogin) {
        return res.status(400).json({ message: 'Este login já está em uso' });
      }
    }
    
    // Verificar se o email já está em uso por outro usuário
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ 
        where: { 
          email,
          id: { [Op.ne]: userId }
        }
      });
      
      if (existingEmail) {
        return res.status(400).json({ message: 'Este email já está em uso' });
      }
    }

    // Atualizar dados
    const updateData = {};
    if (nome) updateData.nome = nome;
    if (login) updateData.login = login;
    if (email) updateData.email = email;
    if (senha) updateData.senha = senha;
    
    // Apenas admin pode alterar o cargo e status ativo
    if (req.user && req.user.cargo === 'admin') {
      if (cargo) updateData.cargo = cargo;
      if (ativo !== undefined) updateData.ativo = ativo;
    }

    await user.update(updateData);

    // Retornar dados atualizados sem a senha
    const userWithoutPassword = {
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: user.email,
      cargo: user.cargo,
      ativo: user.ativo
    };

    res.json({
      message: 'Usuário atualizado com sucesso',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(400).json({ message: error.message });
  }
};

// Excluir usuário (desativar)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ message: 'ID do usuário não fornecido' });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Não permitir excluir o próprio usuário
    if (req.user && user.id === req.user.id) {
      return res.status(400).json({ message: 'Não é possível excluir seu próprio usuário' });
    }

    // Marcar como inativo ao invés de excluir
    await user.update({ ativo: false });

    res.json({ message: 'Usuário desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    res.status(500).json({ message: error.message });
  }
};