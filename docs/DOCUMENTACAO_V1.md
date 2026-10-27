# 📘 Documentação Técnica e Funcional — Versão 1.0 (V1)
## Sistema de Finanças da Família (Éveli & Vital)

---

### 1. Identificação e Controle da Versão
- **Nome do Projeto:** Finanças da Família
- **Versão:** 1.0.0 (Release V1)
- **Data de Fechamento da Versão:** 26 de Outubro de 2026
- **Ambiente de Execução Primário:** Localhost / Navegador Web Moderno (Offline-first, PWA)
- **Titulares:** Éveli e Vital

---

### 2. Propósito e Filosofia do Sistema

O **Finanças da Família V1** foi concebido para resolver os problemas crônicos enfrentados por casais e famílias ao utilizarem planilhas tradicionais ou aplicativos bancários fechados:
1. **Linguagem Descomplicada para Leigos:** Traduz números frios e termos bancários complexos (*competência*, *caixa*, *estorno*, *amortização*) para diagnósticos em bom português gerados automaticamente por uma **Educadora Financeira IA**.
2. **Separação Rigorosa de Contas:** Elimina a confusão de somar dinheiro da conta corrente com limite de cartão ou poupanças destinadas a reservas e metas.
3. **Privacidade e Soberania Total dos Dados:** Operação **100% no navegador (Localhost)**, sem dependência obrigatória de servidores externos, bancos de dados de terceiros ou assinaturas. Os dados pertencem única e exclusivamente à família.
4. **Precisão Matemática Absoluta:** Cálculos imunes a erros de arredondamento de ponto flutuante, validados por suíte de testes contábeis automatizados.

---

### 3. Metodologia Contábil e Regras de Negócio Fundamentais

#### 3.1. Aritmética Exata em Centavos Inteiros
Linguagens como JavaScript utilizam o padrão IEEE 754 de ponto flutuante duplo, onde operações simples como `0.1 + 0.2` resultam em `0.30000000000000004`. Em finanças, isso acumula discrepâncias de centavos.
- **Regra:** Todo valor financeiro manipulado internamente é convertido para centavos inteiros via `toCents(val) = Math.round(val * 100)`.
- Somatórios, subtrações e comparações ocorrem estritamente com números inteiros.
- Apenas no momento da renderização visual os valores são formatados em Real (`R$`) via `fromCents(cents)` e `formatCentsBRL(cents)`.

#### 3.2. A Regra de Ouro: Competência vs. Caixa
Um dos maiores erros em finanças domésticas é duplicar gastos ao pagar a fatura do cartão:
- **Regime de Competência (Quando o gasto ocorre):** Quando uma compra no mercado é feita no cartão de crédito em 10/10, ela pertence à despesa de alimentação de Outubro.
- **Regime de Caixa (Quando o dinheiro sai da conta):** Em 21/10, o dinheiro sai da Conta Corrente Itaú para quitar a fatura.
- **Tratamento no Sistema:** Quando o pagamento da fatura (`kind === 'invoice_payment'`) entra no extrato da conta bancária, ele deduz o saldo da Conta Itaú, mas **não é somado novamente** nas categorias de alimentação ou lazer, preservando a exatidão do orçamento familiar.

#### 3.3. Transporte Automático de Saldo Anterior (Fluxo Consecutivo)
O saldo da Conta Conjunta Itaú flui matematicamente entre os meses:
$$\text{Saldo Final Mês Atual} = \text{Saldo Anterior} + \text{Entradas} - \text{Saídas da Conta}$$
- O saldo final de Setembro/2026 passa a ser, por transporte automático, o **Saldo Anterior de Outubro/2026**.
- Se o usuário precisar fazer um ajuste pontual de conciliação bancária, o sistema permite ajustar o saldo anterior manual com registro de auditoria.

#### 3.4. Isolamento Estrito de Cartões por Ciclo de Fatura
Compras realizadas no cartão são atribuídas rigorosamente ao ciclo de faturamento correspondente ao dia de fechamento:
- **Cartão Itaú MC Gold (Éveli):** Fecha no dia 14 e vence no dia 21. Compras feitas até 14/10 integram a fatura de Outubro/26; compras a partir de 15/10 são alocadas automaticamente na fatura de Novembro/26.
- **Cartão Vital:** Fecha no dia 10 e vence no dia 17, com limite dedicado de R$ 6.000,00 preservado.

#### 3.5. Isolamento dos Pilares de Poupança & Investimentos
A **Poupança Caixa Econômica**, a **Poupança Itaú** e o **Tesouro Direto** são 100% isolados da Conta Corrente. O dinheiro guardado não é misturado ao saldo disponível do dia a dia, aparecendo separadamente na seção de **Patrimônio Guardado**.

#### 3.6. Regra dos Meses Futuros Sem Lançamentos
Meses projetados que ainda não possuem movimentações cadastradas (Novembro/2026 em diante) mantêm suas colunas de saldo anterior, saldo final e cartão rigorosamente zeradas (`R$ 0,00`), evitando falsas impressões de saldo inflado.

---

### 4. Arquitetura de Software

O sistema foi estruturado no padrão **Single Page Application (SPA)** modular em Vanilla JavaScript (ES6+), dispensando transpiladores ou etapas complexas de compilação:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        index.html / PWA UI                             │
│       (Estrutura semântica, Modais, Tailwind CSS compilado local)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌───────────────┐           ┌───────────────┐               ┌───────────────┐
│ auth-guard.js │           │ ui-render.js  │               │  actions.js   │
│  Login Seguro │           │ Renderização  │               │ Eventos de UI │
│   SHA-256     │           │ e Formatação  │               │ e Modais      │
└───────┬───────┘           └───────┬───────┘               └───────┬───────┘
        │                           │                               │
        └───────────────────────────┼───────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌───────────────────┐       ┌───────────────┐               ┌───────────────┐
│ finance-engine.js │       │ financial-ai  │               │ importer-     │
│  Motor Contábil   │       │  Educadora    │               │  backup.js    │
│  Puro e Centavos  │       │  Financeira   │               │ OFX / PDF     │
└─────────┬─────────┘       └───────┬───────┘               └───────┬───────┘
          │                         │                               │
          └─────────────────────────┼───────────────────────────────┘
                                    │
                            ┌───────┴───────┐
                            ▼               ▼
                    ┌───────────────┐ ┌───────────────┐
                    │   state.js    │ │ data-seed.js  │
                    │ localStorage  │ │ Base Oficial  │
                    │ Sanitização   │ │ Set/26 em Dt  │
                    └───────────────┘ └───────────────┘
```

#### Responsabilidade de Cada Módulo:
- `js/utils.js`: Operações monetárias em centavos inteiros (`toCents`, `fromCents`), formatação monetária padrão BRL, escape de HTML contra XSS.
- `js/data-seed.js`: Estrutura de dados padrão inicial com o histórico contábil oficial verificado a partir de Setembro/2026.
- `js/state.js`: Gerenciador central do estado (`state`), validação de integridade dos dados, sanitização contra adulterações e persistência em `localStorage`.
- `js/finance-engine.js`: Motor contábil puro, desprovido de dependências de DOM. Executa cálculos de saldo, evolução mensal e radar de parcelamentos.
- `js/financial-ai.js`: Traduz o resumo numérico em conselhos, alertas de gastos frequentes (formiga) e respostas a perguntas didáticas da família.
- `js/importer-backup.js`: Parser de arquivos bancários OFX, leitor avançado de faturas PDF em 2 colunas com Mozilla PDF.js e rotinas de backup JSON/CSV.
- `js/auth-guard.js`: Gerencia a tela de login local, criptografia SHA-256 + Salt via Web Crypto API, sessões temporárias/permanentes e auto-bloqueio por inatividade.
- `js/actions.js`: Funções de manipulação disparadas pelo usuário (criar/editar transações, criar/editar metas, cadastrar novas categorias, gerenciar arquivos).
- `js/ui-render.js`: Atualização declarativa de todas as abas, cards de resumo, barras de limite e tabelas consolidadas.
- `js/supabase-sync.js`: Conector opcional para sincronização em nuvem e histórico de auditoria do casal.

---

### 5. Detalhamento dos Módulos e Funcionalidades

#### 5.1. Tela de Login e Segurança de Acesso Local
- **Bloqueio Total Inicial:** O conteúdo do sistema permanece oculto por uma camada escura fosca (*frosted glass*) até o desbloqueio.
- **Seletor de Perfil Familiar:** Botões rápidos com avatar para identificar se quem está entrando é **Éveli** ou **Vital**.
- **Criptografia SHA-256 + Salt:** A senha nunca é salva em texto puro. O hash é calculado no navegador via `window.crypto.subtle`.
- **Proteção Anti-Força Bruta:** Após 5 tentativas incorretas consecutivas, o sistema bloqueia novos envios por 30 segundos, exibindo temporizador na tela.
- **Auto-Lock por Inatividade:** Tranca a aplicação automaticamente após 15 minutos sem interação (movimento de mouse, digitação ou toque).
- **Opção de Lembrar Sessão:** Permite salvar a sessão localmente (30 dias) ou mantê-la apenas na memória volátil da aba (`sessionStorage`).
- **Botão de Bloqueio Rápido:** No cabeçalho superior, ao lado de *"Backup & Dados"*, o botão `🔒 Bloquear` permite trancar a tela imediatamente ao se afastar do aparelho.

#### 5.2. Visão Geral (Dashboard Didático)
1. **Diagnóstico Descomplicado da IA:** Resumo textual que explica com clareza o que aconteceu no mês selecionado (entradas, saídas, pagamento de fatura anterior e saldo restante).
2. **Dicas & Alertas Proativos da IA:** Cartões visuais coloridos sinalizando pontos de atenção (excesso de faturas, alerta de saldo de segurança) ou comemorações (parcelas que encerram no mês).
3. **4 Números-Chave do Fluxo Mensal:**
   - `1. Saldo Anterior` (que veio do mês anterior)
   - `2. Entradas (+)` (salários, depósitos, transferências de Vital)
   - `3. Saídas da Conta (-)` (contas pagas pelo banco)
   - `4. Fatura dos Cartões (-)` (faturas de Éveli e Vital com badge de conciliação)
4. **Pilares do Patrimônio:** Saldos em tempo real da Conta Itaú, Poupanças & Investimentos e Cartões de Crédito.
5. **Metas & FAQ Educativo:** Progresso dos sonhos da família e perguntas frequentes explicadas em linguagem leiga (*"O que é saldo anterior?"*, *"Como saber se sobrou dinheiro real?"*).
6. **Quadro de Resumo Anual:** Tabela consolidada mês a mês (Set/26 em diante) com separação transparente entre Conta e Cartões.

#### 5.3. Conta Bancária Itaú (Extrato Exclusivo)
- Exibe estritamente os lançamentos da Conta Corrente Conjunta.
- Permite acompanhar saldo inicial recebido, receitas e débitos diários.
- Filtros por tipo (Receitas, Despesas, Quitações) e busca textual instantânea.

#### 5.4. Cartões de Crédito
- Acompanhamento do **Cartão MC Gold 5544 (Éveli)** e **Cartão Vital**.
- Visualização de limite total, limite comprometido com parcelas futuras e limite disponível real.
- **Radar de Parcelamentos:** Projeção automática das parcelas em aberto mês a mês e destaque para alívios financeiros futuros.

#### 5.5. Controle Pessoal / Lançamentos Diários
- Registro rápido de gastos do dia a dia (lanches, padaria, transporte, farmácia).
- Suporte a anexo de **foto de comprovante / nota fiscal** em Base64 com visualizador em tela cheia.
- **Conciliação Inteligente:** Permite marcar se o gasto diário já foi encontrado no extrato bancário oficial ou na fatura do cartão.

#### 5.6. Poupanças & Investimentos
- Painel dedicado aos 3 ativos do casal:
  - **Tesouro Direto:** Renda fixa pública com rendimentos mensais exatos.
  - **Poupança Itaú:** Caderneta tradicional.
  - **Poupança Caixa Econômica:** Reserva familiar independente.
- Rendimentos mensais discriminados sem mistura com a conta corrente.

#### 5.7. Metas da Família & Orçamentos (Tetos de Gastos)
- **Criação de Metas:** Cadastro com Nome, Valor Alvo, Prazo e campo opcional de *Valor Já Guardado*.
- **Edição Completa de Metas:** Botão `✏️ Editar` em cada cartão de meta para ajustar prazos e quantias acumuladas.
- **Teto por Categoria:** Barras de progresso com limites mensais personalizáveis por clique.
- **Novas Categorias Dinâmicas:** Botão `➕ Nova Categoria` no Controle Diário e no Teto por Categoria, permitindo criar categorias personalizadas (*Pet*, *Cursos*, *Presentes*) que são salvas no estado e sincronizadas em todos os formulários do sistema.

#### 5.8. Importação Inteligente de Arquivos
- **Extratos OFX:** Importação automática de extratos bancários Itaú com detecção inteligente de quitações de fatura.
- **Faturas PDF:** Motor avançado baseado no Mozilla PDF.js com suporte a layout de 2 colunas, captura de datas, descrições e valores com 100% de conciliação.
- **Deduplicação Proativa:** Impede que um mesmo arquivo importado duas vezes gere compras duplicadas na base.

#### 5.9. Central de Conciliação e Gerenciamento de Arquivos
- **Central de Arquivos:** Histórico de todos os extratos OFX, faturas PDF e fotos de notas anexadas.
- **Exclusão em Cascata:** Ao excluir um arquivo na central, o sistema remove automaticamente todos os lançamentos gerados por aquele arquivo, mantendo a integridade da contabilidade.

#### 5.10. Backup, Restauração e Exportação CSV
- **Backup JSON:** Exportação instantânea de todo o estado financeiro para arquivo local criptografável.
- **Restauração Segura:** Validação e sanitização completa de backups antes de sobregravar os dados.
- **Exportação CSV:** Planilha formatada com proteção ativa contra ataques de injeção de fórmulas no Microsoft Excel (prefixos `=`, `+`, `-`, `@` neutralizados).

---

### 6. Especificação do Modelo de Dados (`state`)

O objeto de estado principal mantido no `localStorage` sob a chave `financas_casal_state_v4` possui a seguinte estrutura de dados:

```json
{
  "selectedPeriod": "2026-10",
  "selectedOwner": "ALL",
  "selectedScope": "ALL",
  "includeCurrentCardBill": false,
  "cardsConfig": {
    "card_eveli_5544": {
      "name": "Cartão Itaú MC Gold (Final 5544)",
      "holder": "Éveli",
      "limit": 7740.00,
      "closingDay": 14,
      "dueDay": 21
    },
    "card_marido": {
      "name": "Cartão Vital",
      "holder": "Vital",
      "limit": 6000.00,
      "closingDay": 10,
      "dueDay": 17
    }
  },
  "periodStartingBalances": {
    "2026-09": { "amount": 786.79, "label": "Saldo Inicial (Setembro/2026)" },
    "2026-10": { "amount": 0.00, "label": "Saldo Inicial (Outubro/2026)" }
  },
  "budgets": {
    "Lanches & Restaurantes": 500,
    "Mercado & Hortifruti": 750,
    "Uber & Transporte": 220,
    "Parcelamentos Cartão": 850,
    "Saúde, Farmácia & Academia": 300,
    "Auto Escola & Detran": 450,
    "Casa, Serviços & Outros": 400
  },
  "customCategories": [],
  "futureGoals": [
    {
      "id": "g1",
      "name": "Guardar Alívio das 4 Parcelas que Acabam em Outubro",
      "totalAmount": 1647.52,
      "savedAmount": 0.00,
      "remainingMonths": 4
    }
  ],
  "savingsAccounts": {
    "tesouro_direto": { "id": "tesouro_direto", "name": "Tesouro Direto", "balance": 8260.70 },
    "poupanca_itau": { "id": "poupanca_itau", "name": "Poupança Itaú", "balance": 13.45 },
    "poupanca_caixa": { "id": "poupanca_caixa", "name": "Poupança Caixa Econômica", "balance": 2696.57 }
  },
  "dailyExpenses": [],
  "uploadedFiles": [],
  "transactions": []
}
```

---

### 7. Suíte de Testes Automatizados (23 Testes)

O sistema possui uma suíte de testes de regressão executável via Node.js (`tests/finance-tests.js`). Todos os 23 testes operam como garantia contínua de qualidade:

| # | Teste | Objetivo |
|---|-------|----------|
| 1 | Precisão monetária em centavos inteiros | Garante que `toCents` e `fromCents` anulem imprecisões do padrão IEEE 754. |
| 2 | Isolamento estrito de cartões | Valida que a fatura oficial de Setembro (R$ 3.375,50) não vaze para Outubro. |
| 3 | Saldo final da Conta Conjunta em Outubro | Comprova o saldo bancário exato de -R$ 4,49 até a data base. |
| 4 | Pagamento de fatura sem duplicação | Confirma que quitar a fatura debita a conta sem inflar categorias de orçamento. |
| 5 | Projeção de parcelas futuras | Confirma a matemática automática das parcelas de Novembro e Dezembro/2026. |
| 6 | Radar de parcelas liberadas | Valida o alívio financeiro de R$ 411,88/mês após o término de parcelas em Outubro. |
| 7 | Uso de limite do cartão | Comprova o cálculo de limite comprometido com compras à vista e parceladas. |
| 8 | Conciliação inteligente de importação | Testa a deduplicação de extratos e identificação automática de pagamentos Itaú. |
| 9 | Segurança e sanitização de dados | Assegura que ataques XSS e valores negativos inválidos sejam neutralizados. |
| 10 | Segurança na exportação CSV | Comprova que fórmulas maliciosas de planilhas sejam desarmadas com aspas simples. |
| 11 | Transporte automático de saldo | Garante que o saldo final de um mês seja o saldo inicial do mês seguinte. |
| 12 | Suporte ao titular Vital | Valida que lançamentos e limites do Cartão Vital sejam atribuídos corretamente. |
| 13 | Isolamento estrito no consolidado anual | Testa a tabela anual com separação de colunas de conta e cartão de crédito. |
| 14 | Poupança Caixa isolada no Patrimônio | Confirma que os R$ 2.696,57 da Caixa não se misturem ao saldo corrente Itaú. |
| 15 | Importação dedicada OFX vs. PDF | Garante que arquivos OFX vão para a conta e faturas PDF vão para os cartões. |
| 16 | Rendimentos exatos de investimentos | Valida os rendimentos do Tesouro Direto (+R$ 62,59) e Poupança Itaú (+R$ 0,09). |
| 17 | Controle Pessoal e notas fiscais | Testa anotações diárias, upload de comprovantes e conciliação bancária. |
| 18 | Regras estritas de cartão por ciclo | Garante que compras pós-fechamento pertençam à fatura subsequente. |
| 19 | Central de arquivos e exclusão em cascata | Testa a remoção limpa de lotes importados sem deixar lançamentos órfãos. |
| 20 | Alocação de ciclo completo de PDF | Confirma que 94 transações de fatura fiquem no mês de vencimento (21/09). |
| 21 | Leitura de PDF de 2 colunas | Valida o parser com texto bruto de duas colunas somando exatamente R$ 3.375,50. |
| 22 | Regra de zeramento em meses futuros | Garante que meses a partir de Nov/26 permaneçam com R$ 0,00 até terem lançamentos. |
| 23 | Criptografia da Tela de Login | Valida o determinismo e a segurança do algoritmo SHA-256 com salt exclusivo. |

---

### 8. Guia de Operação e Boas Práticas da Família

1. **Acesso Diário:** Ao abrir o sistema, selecione seu nome (Éveli ou Vital), digite a senha e marque *"Manter conectado"* se estiver no seu próprio dispositivo.
2. **Ao Realizar Compras do Dia a Dia:** Abra a aba **Controle Diário** no celular, anote o valor e fotografe o comprovante ou nota fiscal.
3. **Ao Chegar a Fatura do Cartão:** Vá na aba **Importar Arquivos**, selecione o PDF da fatura do cartão Itaú. O sistema aloca as compras automaticamente no mês correto.
4. **Ao Virar o Mês no Banco:** Baixe o extrato OFX da Conta Corrente Itaú pelo aplicativo do banco e importe no sistema para conciliação automática.
5. **Backup Regular:** A cada virada de mês, acesse o menu *"Backup & Dados"* e baixe uma cópia do arquivo JSON de segurança.

---

*Documento homologado para a Versão 1.0 (V1) do Finanças da Família.*
