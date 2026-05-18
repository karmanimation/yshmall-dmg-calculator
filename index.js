const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { calcularDano, EFEITOS } = require('./calculos');
const db = require('./formulas');

const TOKEN = process.env.TOKEN;
const STAFF_ROLE = 'STAFF';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ─── REGISTRO DE COMANDOS ───────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('dano')
    .setDescription('Calcula o dano de uma habilidade.')
    .addNumberOption(o => o.setName('a1').setDescription('Atributo 1 base (ex: Força)').setRequired(true))
    .addNumberOption(o => o.setName('a2').setDescription('Atributo 2 base (ex: Magia)').setRequired(true))
    .addStringOption(o => o.setName('formula').setDescription('Fórmula personalizada (deixe vazio para escolher uma salva)').setRequired(false))
    .addNumberOption(o => o.setName('bf1').setDescription('Buff do Atributo 1 em % (ex: 10 = +10%)').setRequired(false))
    .addNumberOption(o => o.setName('df1').setDescription('Debuff do Atributo 1 em % (ex: 5 = -5%)').setRequired(false))
    .addNumberOption(o => o.setName('bf2').setDescription('Buff do Atributo 2 em % (ex: 10 = +10%)').setRequired(false))
    .addNumberOption(o => o.setName('df2').setDescription('Debuff do Atributo 2 em % (ex: 5 = -5%)').setRequired(false))
    .addStringOption(o =>
      o.setName('efeito')
        .setDescription('Efeito ativo que afeta o dano')
        .setRequired(false)
        .addChoices(
          { name: 'Ventania (VTN) — 1/8 da Velocidade base em Magia', value: 'VTN' },
          { name: 'Compressão (CMP) — 1/8 da Resistência base em Força', value: 'CMP' },
          { name: 'Julgamento (JLG) — 1/10 da Resistência do alvo no dano', value: 'JLG' },
          { name: 'Marcação (MRC) — 1/8 da Magia base no dano', value: 'MRC' },
          { name: 'Sanguessuga (SSG) — 1/3 da Força ou Magia', value: 'SSG' },
          { name: 'Ressentimento (RSS) — 1/10 do dano físico recebido', value: 'RSS' },
        )
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

// ─── HELPER: EMBED DE RESULTADO ─────────────────────────────────────────────

function embedResultado({ nomeFormula, formulaTexto, resultado, efeito, valorEfeito }) {
  const { atual1, atual2, maiorA, menorA, DH, DT, bonusEfeito, descricaoEfeito, erroFormula } = resultado;

  if (erroFormula) {
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Erro na fórmula')
      .setDescription(erroFormula)
      .addFields({ name: 'Dica', value: 'Variáveis disponíveis: `A1`, `A2`, `MaiorA`, `MenorA`, `DH`\nOperadores: `+`, `-`, `*`, `/`, `()`\nExemplo: `MaiorA * 0.25 + MenorA * 0.50`' });
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`⚔️ ${nomeFormula || 'Cálculo de Dano'}`)
    .addFields(
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
      {
        name: '📝 Fórmula usada',
        value: `\`${formulaTexto}\``,
        inline: false,
      },
    );

  if (efeito && bonusEfeito > 0) {
    embed.addFields({
      name: '✨ Efeito ativo',
      value: `${descricaoEfeito}\nValor informado: **${Number(valorEfeito).toLocaleString('pt-BR')}**`,
      inline: false,
    });
  }

  embed.addFields({
    name: '💥 Dano Total (DT)',
    value: `# ${DT.toLocaleString('pt-BR')}`,
    inline: false,
  });

  embed.setFooter({ text: "Y'shmall DMG Calculator" });

  return embed;
}

// ─── HELPER: EMBED DE VARIÁVEIS ─────────────────────────────────────────────

function embedVariaveis() {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📖 Variáveis disponíveis nas fórmulas')
    .setDescription(
      '`A1` — Atributo 1 atual (após BF/DF)\n' +
      '`A2` — Atributo 2 atual (após BF/DF)\n' +
      '`MaiorA` — Maior entre A1 e A2 atuais\n' +
      '`MenorA` — Menor entre A1 e A2 atuais\n' +
      '`DH` — Dano Híbrido padrão: `(MaiorA / 2) + MenorA`\n\n' +
      '**Operadores:** `+` `-` `*` `/` `( )`\n' +
      '**Exemplo:** `MaiorA * 0.25 + MenorA * 0.50 + MaiorA * 0.35 + MenorA * 0.55`'
    );
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

  // ── SELECT MENU: escolha de fórmula salva ──────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('escolher_formula:')) {
    const partes = interaction.customId.split(':');
    const a1 = parseFloat(partes[1]);
    const a2 = parseFloat(partes[2]);
    const bf1 = parseFloat(partes[3]) || 0;
    const df1 = parseFloat(partes[4]) || 0;
    const bf2 = parseFloat(partes[5]) || 0;
    const df2 = parseFloat(partes[6]) || 0;
    const efeito = partes[7] !== 'null' ? partes[7] : null;
    const valorEfeito = parseFloat(partes[8]) || 0;

    const [nomeFormula, formulaTexto] = interaction.values[0].split('||');

    const resultado = calcularDano({ a1, a2, bf1, df1, bf2, df2, efeito, valorEfeito, formulaTexto });
    const embed = embedResultado({ nomeFormula, formulaTexto, resultado, efeito, valorEfeito });

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ── COMANDO: /dano ──────────────────────────────────────────────────────
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

    // Se digitou fórmula diretamente, calcula já
    if (formulaDigitada) {
      const resultado = calcularDano({ a1, a2, bf1, df1, bf2, df2, efeito, valorEfeito, formulaTexto: formulaDigitada });
      const embed = embedResultado({ nomeFormula: 'Fórmula personalizada', formulaTexto: formulaDigitada, resultado, efeito, valorEfeito });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Senão, monta menu de seleção com fórmulas disponíveis
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
            .setDescription('Você ainda não tem fórmulas salvas e não há fórmulas globais.\n\nUse `/dano formula:<sua fórmula>` para calcular diretamente, ou `/formula salvar` para guardar uma.')
            .addFields(embedVariaveis().data.fields || [])
            ,
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
      content: '📋 Escolha a fórmula que deseja usar:',
      components: [menu],
      ephemeral: true,
    });
    return;
  }

  // ── COMANDO: /formula ───────────────────────────────────────────────────
  if (commandName === 'formula') {
    const sub = interaction.options.getSubcommand();

    // Salvar pessoal
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

    // Listar
    if (sub === 'listar') {
      const pessoais = db.listarUsuario(interaction.user.id);
      const globais = db.listarGlobal();

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('📋 Fórmulas disponíveis')
        .setFooter({ text: "Y'shmall DMG Calculator" });

      if (globais.length > 0) {
        embed.addFields({
          name: '🌐 Fórmulas globais',
          value: globais.map(f => `**${f.nome}**\n\`${f.formula}\``).join('\n\n'),
          inline: false,
        });
      } else {
        embed.addFields({ name: '🌐 Fórmulas globais', value: 'Nenhuma cadastrada.', inline: false });
      }

      if (pessoais.length > 0) {
        embed.addFields({
          name: '👤 Suas fórmulas',
          value: pessoais.map(f => `**${f.nome}**\n\`${f.formula}\``).join('\n\n'),
          inline: false,
        });
      } else {
        embed.addFields({ name: '👤 Suas fórmulas', value: 'Nenhuma salva ainda.', inline: false });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Deletar pessoal
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

    // Salvar global (STAFF)
    if (sub === 'global_salvar') {
      const membro = await interaction.guild.members.fetch(interaction.user.id);
      const temStaff = membro.roles.cache.some(r => r.name === STAFF_ROLE);

      if (!temStaff) {
        await interaction.reply({ content: '❌ Você não tem permissão. Apenas membros com o cargo **STAFF** podem usar este comando.', ephemeral: true });
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

    // Deletar global (STAFF)
    if (sub === 'global_deletar') {
      const membro = await interaction.guild.members.fetch(interaction.user.id);
      const temStaff = membro.roles.cache.some(r => r.name === STAFF_ROLE);

      if (!temStaff) {
        await interaction.reply({ content: '❌ Você não tem permissão. Apenas membros com o cargo **STAFF** podem usar este comando.', ephemeral: true });
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
