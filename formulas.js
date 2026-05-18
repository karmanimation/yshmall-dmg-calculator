const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'formulas.json');

function carregar() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ global: [], users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function salvar(dados) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(dados, null, 2));
}

function listarGlobal() {
  return carregar().global;
}

function listarUsuario(userId) {
  const dados = carregar();
  return dados.users[userId] || [];
}

function salvarFormula(userId, nome, formula) {
  const dados = carregar();
  if (!dados.users[userId]) dados.users[userId] = [];

  const existente = dados.users[userId].findIndex(f => f.nome.toLowerCase() === nome.toLowerCase());
  if (existente >= 0) {
    dados.users[userId][existente] = { nome, formula };
  } else {
    if (dados.users[userId].length >= 25) {
      return { erro: 'Você já tem 25 fórmulas salvas. Delete alguma antes de adicionar outra.' };
    }
    dados.users[userId].push({ nome, formula });
  }

  salvar(dados);
  return { sucesso: true };
}

function deletarFormula(userId, nome) {
  const dados = carregar();
  if (!dados.users[userId]) return { erro: 'Você não tem fórmulas salvas.' };

  const idx = dados.users[userId].findIndex(f => f.nome.toLowerCase() === nome.toLowerCase());
  if (idx < 0) return { erro: `Fórmula "${nome}" não encontrada.` };

  dados.users[userId].splice(idx, 1);
  salvar(dados);
  return { sucesso: true };
}

function salvarGlobal(nome, formula) {
  const dados = carregar();
  const existente = dados.global.findIndex(f => f.nome.toLowerCase() === nome.toLowerCase());
  if (existente >= 0) {
    dados.global[existente] = { nome, formula };
  } else {
    dados.global.push({ nome, formula });
  }
  salvar(dados);
  return { sucesso: true };
}

function deletarGlobal(nome) {
  const dados = carregar();
  const idx = dados.global.findIndex(f => f.nome.toLowerCase() === nome.toLowerCase());
  if (idx < 0) return { erro: `Fórmula global "${nome}" não encontrada.` };

  dados.global.splice(idx, 1);
  salvar(dados);
  return { sucesso: true };
}

module.exports = {
  listarGlobal,
  listarUsuario,
  salvarFormula,
  deletarFormula,
  salvarGlobal,
  deletarGlobal,
};
