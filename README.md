# 💎 Finanças da Família (Éveli & Vital) — Versão 1.0 (V1)

Sistema completo de **Gestão Financeira Familiar e Economia Doméstica**, desenvolvido para operar **100% no navegador (Localhost / Offline)** com segurança de padrão bancário, precisão contábil em centavos inteiros e didática para leigos.

---

## 🚀 Destaques da Versão 1.0 (V1)

- 🔒 **Segurança Local Robusta**: Tela de login com criptografia nativa SHA-256 + Salt, proteção anti-força bruta (rate limit) e bloqueio automático por inatividade (15 min).
- 👩‍💼👨‍💼 **Perfis do Casal (Éveli & Vital)**: Acesso rápido e rastreabilidade nos históricos de auditoria.
- 🏦 **Regra de Ouro Contábil (Competência vs. Caixa)**: As compras do cartão não duplicam na conta corrente quando a fatura é paga, e o saldo bancário anterior acumula automaticamente mês a mês.
- 🏛️ **Pilares do Patrimônio Isolados**:
  - Conta Corrente Conjunta Itaú
  - Poupança Caixa Econômica (100% isolada da conta corrente)
  - Tesouro Direto & Poupança Itaú
  - Cartão Itaú MC Gold (Éveli) & Cartão Vital
- 🤖 **Educadora Financeira IA & Visão Geral Descomplicada**: Diagnósticos em português claro, alertas de faturas vs. renda, radar de parcelas que terminam e FAQ interativo para leigos.
- 📄 **Importação Inteligente de Arquivos**:
  - Leitura de extratos **OFX** bancários.
  - Leitor avançado de faturas **PDF** (layout de 2 colunas com 94+ lançamentos e deduplicação automática).
  - Fotos de notas fiscais e comprovantes no Controle Diário com exclusão em cascata.
- 🎯 **Metas da Família & Tetos de Gastos**: Criação e edição completa de metas, além de tetos por categoria com suporte a novas categorias personalizadas.
- 🧪 **Qualidade Garantida**: 23 testes automatizados cobrindo todas as regras financeiras e matemáticas (`node tests/finance-tests.js`).

---

## 📂 Estrutura do Projeto

```
financas_familiar/
│
├── index.html                  # Aplicação web principal (SPA)
├── financas_familia.html       # Arquivo de distribuição autônomo sincronizado
├── manifest.json               # Configuração PWA para instalação no celular/desktop
├── sw.js                       # Service Worker para funcionamento 100% offline
├── README.md                   # Este arquivo de apresentação
│
├── css/
│   └── styles.css              # Estilos modulares, utilitários e tema visual
│
├── js/
│   ├── utils.js                # Utilitários monetários (centavos inteiros) e sanitização
│   ├── data-seed.js            # Base histórica oficial de dados (Set/2026 em diante)
│   ├── state.js                # Gerenciamento de estado, validação e persistência local
│   ├── finance-engine.js       # Motor contábil puro (cálculos de saldo, radar, evolução)
│   ├── financial-ai.js         # Inteligência financeira educativa e FAQs do casal
│   ├── importer-backup.js      # Parser OFX, leitor PDF de faturas e backup JSON/CSV
│   ├── supabase-sync.js        # Módulo opcional de nuvem e histórico de auditoria
│   ├── actions.js              # Ações de interface, modais, metas e categorias
│   ├── auth-guard.js           # Tela de login, SHA-256 + Salt, sessões e auto-lock
│   ├── ui-render.js            # Renderização de todas as abas, cards e tabelas
│   ├── pdf.min.js              # Biblioteca PDF.js (Mozilla)
│   └── pdf.worker.min.js       # Worker dedicado para processamento em background
│
├── docs/
│   └── DOCUMENTACAO_V1.md      # Manual técnico e funcional detalhado da V1
│
├── sql/
│   └── schema.sql              # Estrutura SQL opcional para nuvem
│
└── tests/
    └── finance-tests.js        # Suíte de 23 testes unitários e de integração
```

---

## 🛠️ Como Executar

O projeto foi construído sem dependências pesadas de backend (Node/NPM não são obrigatórios para uso diário). Você pode executá-lo de duas formas:

### Opção 1: Abrir Diretamente no Navegador
Basta dar um duplo clique em `index.html` ou `financas_familia.html` em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).

### Opção 2: Servidor Local (Recomendado)
Para aproveitar todos os recursos de Service Worker e PWA:
```bash
# Com Python 3:
python -m http.server 8080

# Ou com Node.js (npx):
npx serve .
```
Acesse em: `http://localhost:8080`

---

## 🔑 Credenciais e Primeiro Acesso

- **Usuários disponíveis na tela de login:** 👩‍💼 **Éveli** ou 👨‍💼 **Vital**
- **Senha padrão inicial:** `123456`
- **Alteração de Senha:** Clique em *"⚙️ Alterar Senha de Acesso"* na própria tela de login ou pelo menu superior para definir uma senha pessoal do casal.

---

## 🧪 Suíte de Testes Automatizados

Para rodar os testes de integridade contábil e de segurança:
```bash
node tests/finance-tests.js
```

### Cobertura dos 23 Testes:
1. Precisão monetária em centavos inteiros (`toCents` / `fromCents`)
2. Isolamento estrito de cartões (Set/26 oficial R$ 3.375,50 e Out/26 isolados)
3. Saldo final da Conta Conjunta Itaú em Outubro (-R$ 4,49)
4. Pagamento de fatura reduz saldo bancário sem duplicar orçamento
5. Projeção automática de parcelas futuras (Nov/26 e Dez/26)
6. Radar de parcelas liberadas (R$ 411,88 livres após Out/26)
7. Uso de limite do cartão (Fatura + Parcelas vs. Limite Disponível)
8. Conciliação inteligente de importação e deduplicação
9. Sanitização de dados contra injeção e adulteração
10. Exportação CSV com proteção contra CSV Injection
11. Transporte automático de saldo da conta entre meses consecutivos
12. Suporte aos titulares Éveli e Vital com limites preservados
13. Isolamento estrito de meses e Consolidado Geral Conta vs. Cartões
14. Poupança Caixa 100% isolada da conta corrente no Patrimônio Total
15. Importação dedicada: OFX na Conta Itaú e PDF nos Cartões
16. Rendimentos exatos de Poupanças & Investimentos (Tesouro, Itaú, Caixa)
17. Controle Pessoal diário com fotos de comprovantes e conciliação
18. Regras estritas de fatura de cartão de crédito por ciclo
19. Central de Arquivos com exclusão em cascata
20. Alocação de ciclo completo de PDF no mês de vencimento da fatura
21. Parser completo de fatura PDF com layout de 2 colunas e 94 lançamentos
22. Meses futuros sem dados permanecem rigorosamente zerados (R$ 0,00)
23. Criptografia SHA-256 + Salt e segurança da tela de login

---

## 📖 Documentação Completa

Para a documentação técnica aprofundada, regras contábeis detalhadas e fluxo de arquitetura, consulte:
👉 **[docs/DOCUMENTACAO_V1.md](docs/DOCUMENTACAO_V1.md)**

---

*Desenvolvido com carinho para o planejamento e tranquilidade financeira da família Éveli & Vital.*
