const bcrypt = require('bcrypt');

async function generateHash() {
  const senha = 'senha1234'; // Substitua pela senha desejada
  try {
    const hash = await bcrypt.hash(senha, 10); // Gera o hash com 10 salt rounds
    console.log('Hash gerado:', hash);
  } catch (error) {
    console.error('Erro ao gerar hash:', error.message);
  }
}

generateHash();