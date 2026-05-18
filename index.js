const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { calcularDano, EFEITOS } = require('./calculos');
const db = require('./formulas');

const TOKEN = process.env.TOKEN;
const STAFF_ROLE = 'STAFF';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const efeitoChoices = [
  { name: 'Ventania (VTN) — 1/8 da Velocidade base em Magia', value: 'VTN' },
  { name: 'Compressão (CMP) — 1/8 da Resistência base em Força', value: 'CMP' },
  { name: 'Julgamento (JLG) — 1/10 da Resistência do alvo no dano', value: 'JLG' },
  { name: 'Marcação (MRC) — 1/8 da Magia base no dano', value: 'MRC' },
  { name: 'Sanguessuga (SSG) — 1/3 da Força ou Magia', value: 'SSG' },
  { name: 'Ressentimento (RSS) — 1/10 do dano físico recebido', value: 'RSS' },
];

// Verifica quais variáveis a fórmula usa
function analisarFormula(formula) {
  return {
    usaA1: /\bA1\b/.test(formula),
    usaA2: /\bA2\b/.test(formula),
    usaMaiorMenor: /\bMaiorA\b|\bMenorA\b|\bDH\b/.test(formula),
  };
}

const commands = [
  new SlashCommandBuilder()
    .setName('dano')
    .setDescription('Calcula o dano de uma habilidade.')
    .addNumberOption(o => o.setName('a1').setDescription('Atributo 1 base (ex: Força)').setRequired(false))
    .addNumberOption(o => o.setName('a2').setDescription('Atributo 2 base (ex: Magia)').setRequired(false))
    .addStringOption(o => o.setName('formula').setDescription('Fórmula personalizada (deixe vazio para escolher uma salva)').setRequired(false))
    .addNumberOption(o => o.setName('bf1').setDescription('Buff do Atributo 1 em % (ex: 10 = +10%)').setRequired(false))
    .addNumberOption(o => o.setName('df1').setDescription('Debuff do Atributo 1 em % (ex: 5 = -5%)').setRequired(false))
    .addNumberOption(o => o.setName('bf2').setDescription('Buff do Atributo 2 em % (ex: 10 = +10%)').setRequired(false))
    .addNumberOption(o => o.setName('df2').setDescription('Debuff do Atributo 2 em % (ex: 5 = -5%)').setRequired(false))
    .addStringOption(o =>
      o.setName('efeito')
        .setDescription('Efeito ativo que afeta o dano')
        .setRequired(false)
        .addChoices(...efeitoChoices)
    )
    .addNumberOption(o => o.setName('valor_efeito').setDescription('Valor do atributo usado pelo efeito (ex: velocidade para VTN)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('formula')
    .setDescription('Gerencia fórmulas de dano.')
    .addSubcommand(s =>
      s.setName('salvar')
        .setDescription('Salva uma fórmula pessoal.')
        .addStringOption(o => o.setName('nome').setDescription('Nome da fórmula').setRequired(true))
        .addStringOption(o => o.setName('formula').setDescription('Fórmula (use A1, A2, MaiorA, MenorA, DH)').setRequired(true))
    )
    .addSubcommand(s =>
      s.setName('listar')
        .setDescription('Lista suas fórmulas e as fórmulas globais.')
    )
    .addSubcommand(s =>
      s.setName('deletar')
        .setDescription('Deleta uma fórmula pessoal.')
        .addStringOption(o => o.setName('nome').setDescription('Nome da fórmula a deletar').setRequired(true))
    )
    .addSubcommand(s =>
      s.setName('global_salvar')
        .setDescription('[STAFF] Salva uma fórmula global visível para todos.')
        .addStringOption(o => o.setName('nome').setDescription('Nome da fórmula').setRequired(true))
        .addStringOption(o => o.setName('formula').setDescription('Fórmula (use A1, A2, MaiorA, MenorA, DH)').setRequired(true))
    )
    .addSubcommand(s =>
      s.setName('global_deletar')
        .setDescription('[STAFF] Deleta uma fórmula global.')
        .addStringOption(o => o.setName('nome').setDescription('Nome da fórmula global a deletar').setRequired(true))
    ),
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function embedResultado({ nomeFormula, formulaTexto, resultado, efeito, valorEfeito }) {
  const { atual1, atual2, maiorA, menorA, DH, DT, bonusEfeito, descricaoEfeito, erroFormula } = resultado;

  if (erroFormula) {
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Erro na fórmula')
      .setDescription(erroFormula)
      .addFields({ name: 'Dica', value: 'Variáveis: `A1`, `A2`, `MaiorA`, `MenorA`, `DH`\nOperadores: `+` `-` `*` `/` `()`' });
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`⚔️ ${nomeFormula || 'Cálculo de Dano'}`);

  if (atual1 !== null && atual2 !== null) {
    embed.addFields(
      {
        name: '📊 Atributos atuais',
        value: `A1: **${atual1.toLocaleString('pt-BR')}** | A2: **${atual2.toLocaleString('pt-BR')}**\nMaiorA: **${maiorA.toLocaleString('pt-BR')}** | MenorA: **${menorA.toLocaleString('pt-BR')}**`,
        inline: false,
      },
      {
        name: '🔢 DH (Dano Híbrido padrão)',
        value: `\`${DH.toLocaleString('pt-BR')}\``,
        inline: true,
      },
    );
  } else if (atual1 !== null) {
    embed.addFields({
      name: '📊 Atributo atual',
      value: `A1: **${atual1.toLocaleString('pt-BR')}**`,
      inline: false,
    });
  }

  embed.addFields({ name: '📝 Fórmula usada', value: `\`${formulaTexto}\``, inline: false });

  if (efeito && bonusEfeito > 0) {
    embed.addFields({
      name: '✨ Efeito ativo',
      value: `${descricaoEfeito}\nValor informado: **${Number(valorEfeito).toLocaleString('pt-BR')}**`,
      inline: false,
    });
  }

  embed.addFields({ name: '💥 Dano Total (DT)', value: `# ${DT.toLocaleString('pt-BR')}`, inline: false });
  embed.setFooter({ text: "Y'shmall DMG Calculator" });

  return embed;
}

function embedEfeitoIsolado({ efeito, valor, resultado }) {
  const ef = EFEITOS[efeito];
  return new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle(`✨ ${ef.nome}`)
    .setDescription(ef.descricao)
    .addFields(
      { name: ef.label, value: `**${Number(valor).toLocaleString('pt-BR')}**`, inline: true },
      { name: '💥 Valor do efeito', value: `# ${resultado.toLocaleString('pt-BR')}`, inline: false },
    )
    .setFooter({ text: "Y'shmall DMG Calculator" });
}

function embedVariaveis() {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📖 Variáveis disponíveis nas fórmulas')
    .setDescription(
      '`A1` — Atributo 1 atual (após BF/DF)\n' +
      '`A2` — Atributo 2 atual (após BF/DF)\n' +
      '`MaiorA` — Maior entre A1 e A2\n' +
      '`MenorA` — Menor entre A1 e A2\n' +
      '`DH` — Dano Híbrido: `(MaiorA / 2) + MenorA`\n\n' +
      '**Operadores:** `+` `-` `*` `/` `( )`'
    );
}

// Valida se os atributos necessários foram informados para a fórmula
function validarAtributos(formulaTexto, a1, a2) {
  const { usaA1, usaA2, usaMaiorMenor } = analisarFormula(formulaTexto);

  if (usaMaiorMenor && (a1 === null || a2 === null)) {
    return '❌ Essa fórmula usa `MaiorA`, `MenorA` ou `DH`. Informe **A1 e A2**.';
  }
  if (usaA1 && a1 === null) {
    return '❌ Essa fórmula usa `A1`. Informe o campo **a1**.';
  }
  if (usaA2 && a2 === null) {
    return '❌ Essa fórmula usa `A2`. Informe o campo **a2**.';
  }
  return null;
}

async function processarDano({ interaction, a1, a2, bf1, df1, bf2, df2, efeito, valorEfeito, formulaTexto, nomeFormula }) {
  // Se só tem efeito sem fórmula e sem atributos
  if (!formulaTexto && efeito && valorEfeito && a1 === null && a2 === null) {
    const ef = EFEITOS[efeito];
    const resultado = ef.calcular(valorEfeito);
    const embed = embedEfeitoIsolado({ efeito, valor: valorEfeito, resultado });
    await interaction.reply({ embeds: [embed] });
    return;
  }

  // Valida atributos necessários para a fórmula
  const erroValidacao = validarAtributos(formulaTexto, a1, a2);
  if (erroValidacao) {
    await interaction.reply({ content: erroValidacao, ephemeral: true });
    return;
  }

  const resultado = calcularDano({ a1, a2, bf1, df1, bf2, df2, efeito, valorEfeito, formulaTexto });
  const embed = embedResultado({ nomeFormula, formulaTexto, resultado, efeito, valorEfeito });
  await interaction.reply({ embeds: [embed] });
}

// ─── EVENTOS ────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`✅ Bot online como ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    const guilds = client.guilds.cache.map(g => g.id);
    for (const guildId of guilds) {
      await rest.put(Routes.applicationGuildCommands(client.application.id, guildId), {
        body: commands.map(c => c.toJSON()),
      });
    }
    console.log('✅ Slash commands registrados.');
  } catch (err) {
    console.error('Erro ao registrar comandos:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

  // ── SELECT MENU ──────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('escolher_formula:')) {
    const partes = interaction.customId.split(':');
    const a1 = partes[1] !== 'null' ? parseFloat(partes[1]) : null;
    const a2 = partes[2] !== 'null' ? parseFloat(partes[2]) : null;
    const bf1 = parseFloat(partes[3]) || 0;
    const df1 = parseFloat(partes[4]) || 0;
    const bf2 = parseFloat(partes[5]) || 0;
    const df2 = parseFloat(partes[6]) || 0;
    const efeito = partes[7] !== 'null' ? partes[7] : null;
    const valorEfeito = parseFloat(partes[8]) || 0;

    const [nomeFormula, formulaTexto] = interaction.values[0].split('||');

    const erroValidacao = validarAtributos(formulaTexto, a1, a2);
    if (erroValidacao) {
      await interaction.update({ content: erroValidacao, components: [], embeds: [] });
      return;
    }

    const resultado = calcularDano({ a1, a2, bf1, df1, bf2, df2, efeito, valorEfeito, formulaTexto });
    const embed = embedResultado({ nomeFormula, formulaTexto, resultado, efeito, valorEfeito });
    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ── /dano ────────────────────────────────────────────────────────────────
  if (commandName === 'dano') {
    const a1 = interaction.options.getNumber('a1');
    const a2 = interaction.options.getNumber('a2');
    const formulaDigitada = interaction.options.getString('formula');
    const bf1 = interaction.options.getNumber('bf1') || 0;
    const df1 = interaction.options.getNumber('df1') || 0;
    const bf2 = interaction.options.getNumber('bf2') || 0;
    const df2 = interaction.options.getNumber('df2') || 0;
    const efeito = interaction.options.getString('efeito');
    const valorEfeito = interaction.options.getNumber('valor_efeito') || 0;

    // Nada informado
    if (a1 === null && a2 === null && !formulaDigitada && !efeito) {
      await interaction.reply({
        content: '❌ Informe pelo menos **a1** e **a2** para calcular com fórmula, ou **efeito** + **valor_efeito** para calcular um efeito isolado.',
        ephemeral: true,
      });
      return;
    }

    // Só efeito sem atributos — calcula efeito isolado
    if (a1 === null && a2 === null && efeito && valorEfeito) {
      const ef = EFEITOS[efeito];
      const resultado = ef.calcular(valorEfeito);
      await interaction.reply({ embeds: [embedEfeitoIsolado({ efeito, valor: valorEfeito, resultado })] });
      return;
    }

    // Fórmula digitada diretamente
    if (formulaDigitada) {
      const erroValidacao = validarAtributos(formulaDigitada, a1, a2);
      if (erroValidacao) {
        await interaction.reply({ content: erroValidacao, ephemeral: true });
        return;
      }

      const resultado = calcularDano({ a1, a2, bf1, df1, bf2, df2, efeito, valorEfeito, formulaTexto: formulaDigitada });
      const embed = embedResultado({ nomeFormula: 'Fórmula personalizada', formulaTexto: formulaDigitada, resultado, efeito, valorEfeito });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Escolher fórmula salva
    const pessoais = db.listarUsuario(interaction.user.id);
    const globais = db.listarGlobal();
    const todas = [
      ...globais.map(f => ({ ...f, tipo: '🌐 Global' })),
      ...pessoais.map(f => ({ ...f, tipo: '👤 Pessoal' })),
    ];

    if (todas.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle('📭 Nenhuma fórmula salva')
            .setDescription('Use `/dano formula:<sua fórmula>` para calcular diretamente, ou `/formula salvar` para guardar uma.'),
          embedVariaveis(),
        ],
        ephemeral: true,
      });
      return;
    }

    const opcoes = todas.slice(0, 25).map(f => ({
      label: `${f.tipo} — ${f.nome}`,
      description: f.formula.length > 80 ? f.formula.slice(0, 77) + '...' : f.formula,
      value: `${f.nome}||${f.formula}`,
    }));

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`escolher_formula:${a1}:${a2}:${bf1}:${df1}:${bf2}:${df2}:${efeito}:${valorEfeito}`)
        .setPlaceholder('Escolha uma fórmula...')
        .addOptions(opcoes)
    );

    await interaction.reply({
      content: '📋 Escolha a fórmula:',
      components: [menu],
      ephemeral: true,
    });
    return;
  }

  // ── /formula ─────────────────────────────────────────────────────────────
  if (commandName === 'formula') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'salvar') {
      const nome = interaction.options.getString('nome');
      const formula = interaction.options.getString('formula');
      const resultado = db.salvarFormula(interaction.user.id, nome, formula);

      if (resultado.erro) {
        await interaction.reply({ content: `❌ ${resultado.erro}`, ephemeral: true });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Fórmula salva!')
            .addFields(
              { name: 'Nome', value: nome, inline: true },
              { name: 'Fórmula', value: `\`${formula}\``, inline: false },
            )
            .setFooter({ text: "Y'shmall DMG Calculator" }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'listar') {
      const pessoais = db.listarUsuario(interaction.user.id);
      const globais = db.listarGlobal();

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('📋 Fórmulas disponíveis')
        .setFooter({ text: "Y'shmall DMG Calculator" });

      embed.addFields({
        name: '🌐 Fórmulas globais',
        value: globais.length > 0 ? globais.map(f => `**${f.nome}**\n\`${f.formula}\``).join('\n\n') : 'Nenhuma cadastrada.',
        inline: false,
      });

      embed.addFields({
        name: '👤 Suas fórmulas',
        value: pessoais.length > 0 ? pessoais.map(f => `**${f.nome}**\n\`${f.formula}\``).join('\n\n') : 'Nenhuma salva ainda.',
        inline: false,
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === 'deletar') {
      const nome = interaction.options.getString('nome');
      const resultado = db.deletarFormula(interaction.user.id, nome);

      if (resultado.erro) {
        await interaction.reply({ content: `❌ ${resultado.erro}`, ephemeral: true });
        return;
      }

      await interaction.reply({ content: `✅ Fórmula **${nome}** deletada.`, ephemeral: true });
      return;
    }

    if (sub === 'global_salvar') {
      const membro = await interaction.guild.members.fetch(interaction.user.id);
      const temStaff = membro.roles.cache.some(r => r.name === STAFF_ROLE);

      if (!temStaff) {
        await interaction.reply({ content: '❌ Apenas membros com o cargo **STAFF** podem usar este comando.', ephemeral: true });
        return;
      }

      const nome = interaction.options.getString('nome');
      const formula = interaction.options.getString('formula');
      db.salvarGlobal(nome, formula);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Fórmula global salva!')
            .addFields(
              { name: 'Nome', value: nome, inline: true },
              { name: 'Fórmula', value: `\`${formula}\``, inline: false },
            )
            .setFooter({ text: "Y'shmall DMG Calculator • STAFF" }),
        ],
      });
      return;
    }

    if (sub === 'global_deletar') {
      const membro = await interaction.guild.members.fetch(interaction.user.id);
      const temStaff = membro.roles.cache.some(r => r.name === STAFF_ROLE);

      if (!temStaff) {
        await interaction.reply({ content: '❌ Apenas membros com o cargo **STAFF** podem usar este comando.', ephemeral: true });
        return;
      }

      const nome = interaction.options.getString('nome');
      const resultado = db.deletarGlobal(nome);

      if (resultado.erro) {
        await interaction.reply({ content: `❌ ${resultado.erro}`, ephemeral: true });
        return;
      }

      await interaction.reply({ content: `✅ Fórmula global **${nome}** deletada.` });
      return;
    }
  }
});

client.login(TOKEN);

const http = require('http');
http.createServer((req, res) => res.end('ok')).listen(process.env.PORT || 3000);
