# Y'shmall DMG Calculator

Bot de Discord para cálculo de dano do RPG de Y'shmall.

## Comandos

### `/dano`
Calcula o dano de uma habilidade.

| Opção | Obrigatório | Descrição |
|---|---|---|
| `a1` | ✅ | Atributo 1 base (ex: Força) |
| `a2` | ✅ | Atributo 2 base (ex: Magia) |
| `formula` | ❌ | Fórmula personalizada digitada na hora |
| `bf1` | ❌ | Buff do Atributo 1 em % |
| `df1` | ❌ | Debuff do Atributo 1 em % |
| `bf2` | ❌ | Buff do Atributo 2 em % |
| `df2` | ❌ | Debuff do Atributo 2 em % |
| `efeito` | ❌ | Efeito ativo (VTN, CMP, JLG, MRC, SSG, RSS) |
| `valor_efeito` | ❌ | Valor do atributo usado pelo efeito |

### `/formula salvar`
Salva uma fórmula pessoal.

### `/formula listar`
Lista suas fórmulas e as fórmulas globais.

### `/formula deletar`
Deleta uma fórmula pessoal.

### `/formula global_salvar` *(apenas STAFF)*
Salva uma fórmula global visível para todos.

### `/formula global_deletar` *(apenas STAFF)*
Deleta uma fórmula global.

---

## Variáveis disponíveis nas fórmulas

| Variável | Descrição |
|---|---|
| `A1` | Atributo 1 atual (após BF/DF) |
| `A2` | Atributo 2 atual (após BF/DF) |
| `MaiorA` | Maior entre A1 e A2 |
| `MenorA` | Menor entre A1 e A2 |
| `DH` | Dano Híbrido padrão: `(MaiorA / 2) + MenorA` |

**Exemplo de fórmula:**
```
MaiorA * 0.25 + MenorA * 0.50 + MaiorA * 0.35 + MenorA * 0.55
```

---

## Deploy no Railway

1. Suba este repositório no GitHub
2. Acesse [railway.app](https://railway.app) e crie um novo projeto a partir do repositório
3. Adicione a variável de ambiente:
   - `TOKEN` → token do bot (obtido no Discord Developer Portal)
4. O Railway fará o deploy automaticamente
