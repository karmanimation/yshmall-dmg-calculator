const { evaluate } = require('mathjs');

// Efeitos que afetam o cálculo de dano
const EFEITOS = {
  VTN: {
    nome: 'Ventania (VTN)',
    descricao: 'Converte 1/8 da Velocidade base em buff de Magia (bônus no dano).',
    parametro: 'velocidade',
    label: 'Velocidade base',
    calcular: (valor) => Math.floor(valor / 8),
    aplicaEm: 'bonus',
  },
  CMP: {
    nome: 'Compressão (CMP)',
    descricao: 'Converte 1/8 da Resistência base em buff de Força (bônus no dano).',
    parametro: 'resistencia',
    label: 'Resistência base',
    calcular: (valor) => Math.floor(valor / 8),
    aplicaEm: 'bonus',
  },
  JLG: {
    nome: 'Julgamento (JLG)',
    descricao: 'Converte 1/10 da Resistência base do alvo em buff no dano.',
    parametro: 'resistencia_alvo',
    label: 'Resistência base do alvo',
    calcular: (valor) => Math.floor(valor / 10),
    aplicaEm: 'bonus', // bônus direto no dano final
  },
  MRC: {
    nome: 'Marcação (MRC)',
    descricao: 'Converte 1/8 da Magia base do aplicador em buff no dano.',
    parametro: 'magia_base',
    label: 'Magia base do aplicador',
    calcular: (valor) => Math.floor(valor / 8),
    aplicaEm: 'bonus',
  },
  SSG: {
    nome: 'Sanguessuga (SSG)',
    descricao: 'Dano do efeito = 1/3 da Força (físico) ou Magia (mágico).',
    parametro: 'atributo_ssg',
    label: 'Força ou Magia (para o efeito)',
    calcular: (valor) => Math.floor(valor / 3),
    aplicaEm: 'bonus',
  },
  RSS: {
    nome: 'Ressentimento (RSS)',
    descricao: 'Devolve 1/10 do dano físico recebido.',
    parametro: 'dano_recebido',
    label: 'Dano físico recebido',
    calcular: (valor) => Math.floor(valor / 10),
    aplicaEm: 'bonus',
  },
};

function calcularDano({ a1, a2, bf1 = 0, df1 = 0, bf2 = 0, df2 = 0, efeito = null, valorEfeito = 0, formulaTexto }) {
  // Calcular atributos atuais aplicando BF e DF
  const atual1 = a1 * (1 + (bf1 - df1) / 100);
  const atual2 = a2 * (1 + (bf2 - df2) / 100);

  const maiorA = Math.max(atual1, atual2);
  const menorA = Math.min(atual1, atual2);

  // Bônus de efeito direto no dano
  let bonusEfeito = 0;
  let descricaoEfeito = '';

  if (efeito && EFEITOS[efeito]) {
    const ef = EFEITOS[efeito];
    const valorCalculado = ef.calcular(valorEfeito);

    if (ef.aplicaEm === 'bonus') {
      bonusEfeito = valorCalculado;
      descricaoEfeito = `${ef.nome}: +${valorCalculado.toLocaleString('pt-BR')}`;
    }
  }

  // Calcular DH (Dano Híbrido padrão)
  const DH = (maiorA / 2) + menorA;

  // Avaliar a fórmula personalizada
  let DT = 0;
  let erroFormula = null;

  try {
    const scope = {
      A1: atual1,
      A2: atual2,
      MaiorA: maiorA,
      MenorA: menorA,
      DH: DH,
    };

    DT = evaluate(formulaTexto, scope);

    if (typeof DT !== 'number' || isNaN(DT) || !isFinite(DT)) {
      throw new Error('Resultado inválido');
    }

    DT = Math.round(DT) + bonusEfeito;
  } catch (e) {
    erroFormula = 'Fórmula inválida. Verifique a sintaxe e as variáveis usadas.';
  }

  return {
    erroFormula,
    atual1: Math.round(atual1),
    atual2: Math.round(atual2),
    maiorA: Math.round(maiorA),
    menorA: Math.round(menorA),
    DH: Math.round(DH),
    DT,
    bonusEfeito,
    descricaoEfeito,
  };
}

module.exports = { calcularDano, EFEITOS };
