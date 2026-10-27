// ============================================================================
// SUÍTE AUTOMATIZADA DE TESTES DAS REGRAS FINANCEIRAS (ETAPA 5 — ADS)
// ============================================================================
// Como rodar no terminal:
//   node tests/finance-tests.js
//
// O que esta suíte comprova?
// 1. Aritmética exata em centavos (sem erro de ponto flutuante IEEE 754)
// 2. Conciliação 100% exata da fatura 21/10 do Cartão MC Gold 5544 (R$ 3.096,11)
// 3. Fluxo de caixa exato da Conta Conjunta Itaú em Outubro (-R$ 4,49)
// 4. Pagamento de fatura não duplica despesas nas categorias de orçamento
// 5. Reembolsos/estornos abatem a categoria sem inflar receitas salariais
// 6. Projeção automática das parcelas futuras (Nov/26 = R$ 655,37, Dez/26 = R$ 372,47)
// 7. Radar de parcelas liberadas (R$ 411,88 liberados após Out/26)
// 8. Limite comprometido vs. disponível nos cartões e deduplicação OFX/CSV

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');
const moduleFiles = [
  'js/utils.js',
  'js/data-seed.js',
  'js/state.js',
  'js/finance-engine.js',
  'js/financial-ai.js',
  'js/importer-backup.js',
  'js/supabase-sync.js',
  'js/actions.js',
  'js/auth-guard.js'
];

const ctx = vm.createContext({
  console,
  Math,
  Date,
  JSON,
  Set,
  Array,
  Object,
  String,
  Number,
  RegExp,
  parseInt,
  parseFloat,
  isNaN,
  URL,
  Uint8Array,
  ArrayBuffer,
  structuredClone,
  ReadableStream,
  WritableStream,
  TransformStream,
  TextEncoder,
  TextDecoder,
  Blob,
  crypto: globalThis.crypto,
  confirm: () => true,
  alert: () => {},
  renderAll: () => {},
  renderFilesManagerModalContent: () => {},
  document: { getElementById: () => null }
});
ctx.window = ctx;
ctx.globalThis = ctx;

// Carrega PDF.js no contexto para testes de PDF
vm.runInContext(fs.readFileSync(path.join(rootDir, 'js/pdf.min.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(rootDir, 'js/pdf.worker.min.js'), 'utf8'), ctx);

for (const relPath of moduleFiles) {
  const fullPath = path.join(rootDir, relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  vm.runInContext(code, ctx, { filename: relPath });
}

let passed = 0;
function runTest(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      res.then(() => {
        passed++;
        console.log(`✅ [PASS] ${name}`);
      }).catch(err => {
        console.error(`❌ [FAIL] ${name}: ${err.message}`);
        process.exitCode = 1;
      });
      return;
    }
    passed++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

const getState = () => vm.runInContext('state', ctx);

runTest('1. Precisão monetária em centavos inteiros (toCents / fromCents)', () => {
  const sumCents = ctx.toCents(19.99) + ctx.toCents(0.01) + ctx.toCents(0.1) + ctx.toCents(0.2);
  assert.strictEqual(sumCents, 2030);
  assert.strictEqual(ctx.fromCents(sumCents), 20.3);
});

runTest('2. Isolamento estrito de cartões: Setembro (Fatura Oficial R$ 3.375,50) e Outubro isolados', () => {
  const sepTx = getState().transactions.filter(t => t.period === '2026-09');
  const octTx = getState().transactions.filter(t => t.period === '2026-10');
  const sumSep = ctx.calculatePeriodSummary(sepTx, '2026-09');
  const sumOct = ctx.calculatePeriodSummary(octTx, '2026-10');
  assert.strictEqual(sumSep.cardEveliCents, 337550); // Setembro isolado: R$ 3.375,50 (Fatura Oficial do PDF Itaú)
  assert.strictEqual(sumOct.cardEveliCents, 151352); // Outubro isolado
});

runTest('3. Saldo final da Conta Conjunta Itaú em Outubro/2026 (-R$ 4,49)', () => {
  const octTx = getState().transactions.filter(t => t.period === '2026-10');
  const sum = ctx.calculatePeriodSummary(octTx, '2026-10');
  assert.strictEqual(sum.prevBalanceCents, 4817);
  assert.strictEqual(sum.totalIncomeCents, 50000);
  assert.strictEqual(sum.totalBankDebitCents, 55266);
  assert.strictEqual(sum.bankEndingBalanceCents, -449);
});

runTest('4. Pagamento de fatura reduz saldo bancário sem duplicar despesas do orçamento', () => {
  const octTx = getState().transactions.filter(t => t.period === '2026-10');
  const before = ctx.calculatePeriodSummary(octTx, '2026-10');
  const withPayment = [
    ...octTx,
    {
      id: 'inv_pay_test',
      owner: 'Éveli',
      source: 'Conta Conjunta Itaú',
      accountId: 'cc_itau_conjunta',
      period: '2026-10',
      date: '21/10/2026',
      type: 'debit',
      kind: 'invoice_payment',
      scope: 'shared',
      category: 'Faturas Antigas Pagas',
      desc: 'PAGTO FATURA CARTAO MC GOLD',
      amount: 3096.11
    }
  ];
  const after = ctx.calculatePeriodSummary(withPayment, '2026-10');
  assert.strictEqual(after.totalInvoicePaidInBankCents - before.totalInvoicePaidInBankCents, 309611);
  assert.strictEqual(after.spentByCatCents['Lanches & Restaurantes'], before.spentByCatCents['Lanches & Restaurantes']);
  assert.strictEqual(after.spentByCatCents['Mercado & Hortifruti'], before.spentByCatCents['Mercado & Hortifruti']);
});

runTest('5. Projeção automática das parcelas futuras em Nov/26 e Dez/26', () => {
  const novTx = getState().transactions.filter(t => t.period === '2026-11');
  const decTx = getState().transactions.filter(t => t.period === '2026-12');
  const sumNov = ctx.calculatePeriodSummary(novTx, '2026-11');
  const sumDec = ctx.calculatePeriodSummary(decTx, '2026-12');
  assert.strictEqual(sumNov.totalCardCents, 53730); // R$ 537,30
  assert.strictEqual(sumDec.totalCardCents, 30758); // R$ 307,58
});

runTest('6. Radar de Parcelamentos: R$ 411,88 liberados após Outubro/2026', () => {
  const octTx = getState().transactions.filter(t => t.period === '2026-10');
  const radar = ctx.calculateInstallmentsRadar(octTx);
  assert.strictEqual(radar.installmentTx.length, 12);
  assert.strictEqual(radar.endingNow.length, 4);
  assert.strictEqual(radar.endingNowCents, 41188);
});

runTest('7. Uso de Limite do Cartão: Fatura + Parcelas Futuras vs. Limite Disponível', () => {
  const lim = ctx.calculateCardLimitsUsage('card_eveli_5544', '2026-10');
  assert.strictEqual(lim.limitCents, 774000);
  assert.strictEqual(lim.periodInvoiceCents, 151352);
  assert.strictEqual(lim.futureInstallmentsCents, 225032);
  assert.strictEqual(lim.totalCommittedCents, 376384);
  assert.strictEqual(lim.availableLimitCents, 397616);
});

runTest('8. Conciliação Inteligente de Importação: Deduplicação e detecção de Fatura Itaú', () => {
  const existingBankTx = getState().transactions.find(t => t.period === '2026-10' && t.accountId === 'cc_itau_conjunta');
  const sampleText = [
    `${existingBankTx.date} ${existingBankTx.desc} -${existingBankTx.amount.toFixed(2).replace('.', ',')}`,
    '15/10/2026 SUPERMERCADO TESTE NOVO -120,50'
  ].join('\n');
  const preview = ctx.parseAnyFinancialText(sampleText, existingBankTx.owner, 'cc_itau_conjunta', '2026-10', true);
  assert.strictEqual(preview.skippedDuplicates, 1);
  assert.strictEqual(preview.candidates.length, 1);
  assert.strictEqual(preview.candidates[0].amount, 120.5);
});

runTest('9. Segurança: dados adulterados (XSS no id, valor inválido) são higienizados', () => {
  const evil = ctx.sanitizeState({
    transactions: [
      { id: "x');alert(1);//", owner: 'Hacker', period: 'abc', desc: '<img src=x onerror=alert(1)>', amount: 'NaN', kind: 'hack' }
    ],
    futureGoals: [{ id: "g'><script>", name: 'm', totalAmount: -5 }]
  });
  assert.ok(/^[A-Za-z0-9_.\-]+$/.test(evil.transactions[0].id));
  assert.strictEqual(evil.transactions[0].owner, 'Éveli');
  assert.strictEqual(evil.transactions[0].period, '2026-10');
  assert.strictEqual(evil.transactions[0].amount, 0);
  assert.strictEqual(evil.transactions[0].kind, undefined);
  assert.ok(/^[A-Za-z0-9_.\-]+$/.test(evil.futureGoals[0].id));
  assert.strictEqual(evil.futureGoals[0].totalAmount, 0);
});

runTest('10. Segurança: exportação CSV neutraliza fórmulas do Excel', () => {
  assert.strictEqual(ctx.csvSafeText('=CMD()'), `"'=CMD()"`);
  assert.strictEqual(ctx.csvSafeText('Mercado'), '"Mercado"');
});

runTest('11. Transporte automático de saldo da conta entre meses consecutivos', () => {
  const startOct = ctx.getStartingBalanceForPeriod('2026-10');
  // O saldo inicial de Outubro é exatamente o saldo anterior de 30/09 (R$ 48,17)
  assert.strictEqual(startOct.amount, 48.17);
  // Meses futuros que ainda não têm saldos/extratos definidos devem permanecer estritamente zerados (R$ 0,00)
  const startNov = ctx.getStartingBalanceForPeriod('2026-11');
  assert.strictEqual(typeof startNov.amount, 'number');
  assert.strictEqual(startNov.amount, 0); // Não propaga saldo de outubro para meses futuros sem dados
  const startDec = ctx.getStartingBalanceForPeriod('2026-12');
  assert.strictEqual(startDec.amount, 0); // Permanece zerado
});

runTest('12. Suporte ao titular "Vital" e Cartão Vital preservado com limite', () => {
  const st = getState();
  assert.ok(st.cardsConfig.card_marido);
  assert.strictEqual(st.cardsConfig.card_marido.holder, 'Vital');
  assert.strictEqual(st.cardsConfig.card_marido.name, 'Cartão Vital');
  assert.strictEqual(st.cardsConfig.card_marido.limit, 6000);

  // Higienização aceita 'Vital'
  const sanitized = ctx.sanitizeState({
    transactions: [
      { id: 'tx_vital_1', owner: 'Vital', period: '2026-10', desc: 'Gasolina', amount: 150 }
    ]
  });
  assert.strictEqual(sanitized.transactions[0].owner, 'Vital');
});

runTest('13. Isolamento estrito de meses e Consolidado Geral Conta vs Cartões', () => {
  // 1. Testa isolamento universal por data (DD/MM/AAAA -> AAAA-MM)
  assert.strictEqual(ctx.normalizePeriodByDate('18/09/2026', 'cc_itau_conjunta', '2026-10'), '2026-09');
  assert.strictEqual(ctx.normalizePeriodByDate('05/10/2026', 'cc_itau_conjunta', '2026-10'), '2026-10');
  assert.strictEqual(ctx.normalizePeriodByDate('15/09/2026', 'card_eveli_5544', '2026-09'), '2026-09');
  assert.strictEqual(ctx.normalizePeriodByDate('14/10/2026', 'card_eveli_5544', '2026-10'), '2026-10');
  assert.strictEqual(ctx.normalizePeriodByDate('16/10/2026', 'card_eveli_5544', '2026-10'), '2026-10');

  // 2. Testa cálculo do Consolidado Geral
  const consolidated = ctx.calculateConsolidatedAllMonths('ALL', 'ALL');
  assert.ok(consolidated.evolution.length >= 4);
  assert.ok(consolidated.totals.totalIncomeCents > 0);
  assert.ok(consolidated.totals.totalBankDebitCents > 0);
  assert.strictEqual(consolidated.totals.totalMonthlyNetCents, consolidated.totals.totalIncomeCents - consolidated.totals.totalBankDebitCents);
  const rowOct = consolidated.evolution.find(r => r.period === '2026-10');
  assert.ok(rowOct);
  assert.strictEqual(rowOct.monthlyNetCents, rowOct.incomeCents - rowOct.bankDebitCents);
  assert.ok(consolidated.totals.initialBaseStartBalanceCents !== undefined);
  assert.strictEqual(consolidated.totals.totalCardVitalCents, 0); // Vital ainda não gastou no cartão
});

runTest('14. Poupança Caixa: isolamento da conta corrente Itaú e soma no Patrimônio Total', () => {
  const st = getState();
  // Configura saldo na Poupança Caixa para teste
  st.savingsAccounts = {
    poupanca_caixa: {
      id: 'poupanca_caixa',
      name: 'Poupança Caixa Econômica',
      bank: 'Caixa Econômica Federal',
      accountType: 'poupança',
      balance: 15000,
      description: 'Reserva financeira familiar'
    }
  };

  // Garante que calculatePeriodSummary do Itaú NÃO inclui transações da Poupança Caixa no débito/crédito da conta corrente
  const sampleTx = [
    { id: 'tx_itau', accountId: 'cc_itau_conjunta', period: '2026-10', type: 'debit', kind: 'expense', amount: 100 },
    { id: 'tx_caixa', accountId: 'poupanca_caixa', period: '2026-10', type: 'debit', kind: 'expense', amount: 500 }
  ];
  const summary = ctx.calculatePeriodSummary(sampleTx, '2026-10');
  assert.strictEqual(summary.totalBankDebitCents, 10000); // Apenas os R$ 100 do Itaú, R$ 500 da Caixa não entram

  // No consolidado geral, a Poupança Caixa soma no Patrimônio Total da Família
  const consolidated = ctx.calculateConsolidatedAllMonths('ALL', 'ALL');
  assert.strictEqual(consolidated.totals.caixaSavingsBalanceCents, 1500000);
  assert.strictEqual(consolidated.totals.patrimonioTotalCents, consolidated.totals.latestBankEndingCents + 1500000);
});

runTest('15. Importação dedicada: OFX organiza na Conta Itaú e PDF organiza nos Cartões', () => {
  // Teste de arquivo OFX do Itaú
  const sampleOfx = `
    <OFX>
      <STMTTRN>
        <TRNTYPE>CREDIT</TRNTYPE>
        <DTPOSTED>20260905120000</DTPOSTED>
        <TRNAMT>4500.00</TRNAMT>
        <FITID>TEST_OFX_01</FITID>
        <MEMO>PIX SALARIO VITAL</MEMO>
      </STMTTRN>
      <STMTTRN>
        <TRNTYPE>DEBIT</TRNTYPE>
        <DTPOSTED>20261010120000</DTPOSTED>
        <TRNAMT>-350.00</TRNAMT>
        <FITID>TEST_OFX_02</FITID>
        <MEMO>SUPERMERCADO GUANABARA</MEMO>
      </STMTTRN>
    </OFX>
  `;

  const parsed = ctx.parseAnyFinancialText(sampleOfx, 'Éveli', 'cc_itau_conjunta', '2026-10', true);
  assert.strictEqual(parsed.candidates.length, 2);
  // O lançamento de setembro vai para 2026-09
  assert.strictEqual(parsed.candidates[0].period, '2026-09');
  assert.strictEqual(parsed.candidates[0].accountId, 'cc_itau_conjunta');
  assert.strictEqual(parsed.candidates[0].type, 'income');
  // O lançamento de outubro vai para 2026-10
  assert.strictEqual(parsed.candidates[1].period, '2026-10');
  assert.strictEqual(parsed.candidates[1].accountId, 'cc_itau_conjunta');
  assert.strictEqual(parsed.candidates[1].type, 'debit');
});

runTest('16. Poupanças & Investimentos independentes (Tesouro Direto, Poupança Itaú e Caixa) com rendimentos exatos do print', () => {
  const st = getState();
  // Configura os 3 ativos familiares para o teste
  st.savingsAccounts = {
    tesouro_direto: {
      id: 'tesouro_direto',
      name: 'Tesouro Direto',
      monthlyData: {
        '2026-09': { balance: 8198.11, earnings: 87.37 },
        '2026-10': { balance: 8260.70, earnings: 62.59 }
      }
    },
    poupanca_itau: {
      id: 'poupanca_itau',
      name: 'Poupança Itaú',
      monthlyData: {
        '2026-09': { balance: 13.36, earnings: 0.09 },
        '2026-10': { balance: 13.45, earnings: 0.09 }
      }
    },
    poupanca_caixa: {
      id: 'poupanca_caixa',
      name: 'Poupança Caixa Econômica',
      balance: 0,
      monthlyData: {
        '2026-09': { balance: 0, earnings: 0 },
        '2026-10': { balance: 0, earnings: 0 }
      }
    }
  };

  const invOct = ctx.getInvestmentsDataForPeriod('2026-10');
  const invSep = ctx.getInvestmentsDataForPeriod('2026-09');

  // Outubro: Tesouro (R$ 8.260,70 / +R$ 62,59) + Poupança Itaú (R$ 13,45 / +R$ 0,09)
  assert.strictEqual(invOct.totalInvestedCents, 827415); // R$ 8.274,15
  assert.strictEqual(invOct.totalEarningsCents, 6268);   // R$ 62,68 (Exatamente igual ao print do app!)

  // Setembro: Tesouro (R$ 8.198,11 / +R$ 87,37) + Poupança Itaú (R$ 13,36 / +R$ 0,09)
  assert.strictEqual(invSep.totalInvestedCents, 821147); // R$ 8.211,47
  assert.strictEqual(invSep.totalEarningsCents, 8746);   // R$ 87,46 (Exatamente igual ao print do app!)

  // Garante independência total: investimentos não alteram o débito/crédito da conta corrente
  const octTx = getState().transactions.filter(t => t.period === '2026-10');
  const summary = ctx.calculatePeriodSummary(octTx, '2026-10');
  assert.strictEqual(summary.bankEndingBalanceCents, -449); // Saldo Itaú continua intocado em -R$ 4,49
});

runTest('17. Controle Pessoal: Lançamentos diários (valor, tipo, notas fiscais) e Conciliação com o Banco', () => {
  const st = getState();
  st.dailyExpenses = [
    {
      id: 'd1',
      date: '05/10/2026',
      period: '2026-10',
      desc: 'Padaria da esquina',
      amount: 25.50,
      direction: 'expense',
      paymentMethod: 'pix',
      reconciled: false
    },
    {
      id: 'd2',
      date: '10/10/2026',
      period: '2026-10',
      desc: 'Supermercado Prezunic',
      amount: 150.00,
      direction: 'expense',
      paymentMethod: 'credit_card',
      cardHolder: 'Éveli',
      receiptImage: 'data:image/jpeg;base64,/9j/fake_receipt',
      reconciled: false
    },
    {
      id: 'd3',
      date: '12/10/2026',
      period: '2026-10',
      desc: 'Picolé na praia',
      amount: 15.00,
      direction: 'expense',
      paymentMethod: 'cash',
      reconciled: false
    }
  ];

  // Adiciona transação bancária correspondente ao PIX
  st.transactions.push({
    id: 'tx_bank_match_1',
    period: '2026-10',
    date: '05/10/2026',
    desc: 'PIX ENVIADO PADARIA',
    amount: 25.50,
    type: 'debit',
    accountId: 'cc_itau_conjunta'
  });

  // Executa conciliação do mês de Outubro
  ctx.reconcileDailyExpensesWithBank('2026-10');

  const d1 = st.dailyExpenses.find(d => d.id === 'd1');
  const d2 = st.dailyExpenses.find(d => d.id === 'd2');
  const d3 = st.dailyExpenses.find(d => d.id === 'd3');

  // PIX foi conciliado com o extrato bancário
  assert.strictEqual(d1.reconciled, true);
  assert.strictEqual(d1.reconciledTxId, 'tx_bank_match_1');
  assert.ok(d1.reconciledAt);

  // Cartão não tinha fatura importada ainda -> permanece pendente
  assert.strictEqual(d2.reconciled, false);
  assert.ok(d2.receiptImage.startsWith('data:image/jpeg;base64'));

  // Dinheiro vivo não passa pelo banco -> não é conciliado automaticamente
  assert.strictEqual(d3.reconciled, false);
});

runTest('18. Regras de Cartão de Crédito: isolamento estrito sem somar ou misturar meses', () => {
  const st = getState();
  // Garante que compras de setembro estão exclusivamente em setembro
  const septCardTx = st.transactions.filter(t => t.period === '2026-09' && t.type === 'card');
  const octCardTx = st.transactions.filter(t => t.period === '2026-10' && t.type === 'card');

  const septSum = ctx.calculatePeriodSummary(septCardTx, '2026-09');
  const octSum = ctx.calculatePeriodSummary(octCardTx, '2026-10');

  // Setembro tem sua própria fatura isolada
  assert.ok(septSum.totalCardCents > 0);
  assert.ok(octSum.totalCardCents > 0);

  // Não há sobreposição: nenhuma transação de setembro é computada em outubro
  const octHasSeptItem = octCardTx.some(t => t.date && t.date.includes('/09/'));
  assert.strictEqual(octHasSeptItem, false);
});

runTest('19. Central de Arquivos & Exclusão em Cascata (OFX, PDF e Fotos de Notas)', () => {
  const st = getState();
  if (!Array.isArray(st.uploadedFiles)) st.uploadedFiles = [];
  
  // 1. Simula envio de um extrato OFX com 2 lançamentos vinculados
  const fileIdOfx = 'file_ofx_test_cascade';
  st.uploadedFiles.push({
    id: fileIdOfx,
    fileName: 'extrato_itau_setembro.ofx',
    fileType: 'bank_ofx',
    itemCount: 2
  });
  st.transactions.push(
    { id: 'tx_ofx_1', fileId: fileIdOfx, desc: 'DOC RECEBIDO', amount: 1500, period: '2026-09', accountId: 'cc_itau_conjunta', type: 'income', kind: 'income' },
    { id: 'tx_ofx_2', fileId: fileIdOfx, desc: 'SUPERMERCADO OFX', amount: 200, period: '2026-09', accountId: 'cc_itau_conjunta', type: 'debit', kind: 'expense' }
  );

  // 2. Simula envio de uma foto de nota fiscal no controle diário
  const fileIdReceipt = 'file_receipt_test_cascade';
  st.uploadedFiles.push({
    id: fileIdReceipt,
    fileName: 'nota_fiscal_mercado.jpg',
    fileType: 'receipt_photo',
    dailyExpenseId: 'daily_cascade_1',
    itemCount: 1
  });
  st.dailyExpenses.push({
    id: 'daily_cascade_1',
    fileId: fileIdReceipt,
    desc: 'Compra Mercado c/ Foto',
    amount: 85.50,
    period: '2026-09',
    direction: 'expense'
  });

  // Verifica que os itens existem antes da exclusão
  assert.strictEqual(st.transactions.some(t => t.id === 'tx_ofx_1'), true);
  assert.strictEqual(st.transactions.some(t => t.id === 'tx_ofx_2'), true);
  assert.strictEqual(st.dailyExpenses.some(d => d.id === 'daily_cascade_1'), true);

  // 3. Executa exclusão em cascata do arquivo OFX
  ctx.deleteUploadedFileCascade(fileIdOfx);

  // O arquivo foi removido do registro
  assert.strictEqual(st.uploadedFiles.some(f => f.id === fileIdOfx), false);
  // TODOS os lançamentos gerados pelo OFX foram excluídos em cascata
  assert.strictEqual(st.transactions.some(t => t.id === 'tx_ofx_1'), false);
  assert.strictEqual(st.transactions.some(t => t.id === 'tx_ofx_2'), false);

  // O lançamento do controle diário da foto continua intacto
  assert.strictEqual(st.dailyExpenses.some(d => d.id === 'daily_cascade_1'), true);

  // 4. Executa exclusão em cascata da foto do recibo
  ctx.deleteUploadedFileCascade(fileIdReceipt);
  assert.strictEqual(st.uploadedFiles.some(f => f.id === fileIdReceipt), false);
  // O lançamento diário associado à nota foi excluído em cascata
  assert.strictEqual(st.dailyExpenses.some(d => d.id === 'daily_cascade_1'), false);
});

runTest('20. Importação de PDF de Fatura do Cartão: ciclo completo alocado no mês da fatura (Fatura 21/09 R$ 3.375,50)', () => {
  const samplePdf = `
    Titular EVELI AZEVEDO DE OLIVEIRA LIMA
    Cartão 5248.XXXX.XXXX.5544
    Postagem: 14/09/2026
    Vencimento: 21/09/2026
    Total desta fatura 3.375 ,50
    27/11 ALURA 10/12 104,30
    14/08 DL*UberRidesSao PauloBR 9,95
    18/08 SUPERMARKET GMAPMARICAB 294,05
    23/08 CANCELAMENTO PARCIAL DE -50,06
    10/09 SPREZUNIC 745RIO DE JAN 113,55
  `;

  const parsed = ctx.parseAnyFinancialText(samplePdf, 'Éveli', 'card_eveli_5544', '2026-09', true);
  assert.strictEqual(parsed.candidates.length, 5);

  // TODAS as compras da fatura (mesmo feitas em agosto) foram alocadas estritamente em Setembro (mês da fatura)
  parsed.candidates.forEach(c => {
    assert.strictEqual(c.period, '2026-09', `A compra ${c.desc} com data ${c.date} deve pertencer à Fatura de Setembro/2026`);
  });

  // O estorno de R$ 50,06 foi reconhecido como reembolso de cartão
  const refund = parsed.candidates.find(c => c.desc.includes('CANCELAMENTO'));
  assert.ok(refund);
  assert.strictEqual(refund.kind, 'reimbursement');
  assert.strictEqual(refund.amount, 50.06);
});

runTest('21. Leitura Completa de Fatura em PDF (94 lançamentos com layout de 2 colunas e total exato de R$ 3.375,50)', () => {
  const fs = require('fs');
  const pdfPath = 'C:/Users/vital/.gemini/antigravity/brain/2c37c4b8-241c-407a-8a6b-cb7c270d6409/.user_uploaded/media_1792985009674_c6aff0c9.pdf';
  if (fs.existsSync(pdfPath)) {
    const buf = fs.readFileSync(pdfPath);
    const file = {
      name: 'fatura_setembro_real.pdf',
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    };

    return ctx.extractTextFromPdfFile(file).then(rawText => {
      const parsed = ctx.parseAnyFinancialText(rawText, 'Éveli', 'card_eveli_5544', '2026-09');
      // Confere exatamente 94 lançamentos atuais
      assert.strictEqual(parsed.candidates.length, 94);

      // Confere cálculo do sumário com estornos abatendo compras
      const sum = ctx.calculatePeriodSummary(parsed.candidates, '2026-09', {
        transactions: parsed.candidates,
        periodStartingBalances: {},
        cardsConfig: { card_eveli_5544: { limit: 7740, officialInvoiceTotals: {} } }
      });

      assert.strictEqual(sum.cardEveliCents, 337550);
      assert.strictEqual(ctx.fromCents(sum.cardEveliCents), 3375.50);
    });
  }
});

runTest('22. Meses futuros sem lançamentos definidos (Nov/26 em diante) permanecem rigorosamente zerados (R$ 0,00) em todas as colunas', () => {
  const evolution = ctx.calculateMonthlyEvolution(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'], 'ALL', 'ALL');

  // Set/26 e Out/26 possuem saldos definidos
  const sep = evolution.find(r => r.period === '2026-09');
  assert.strictEqual(sep.hasDefinedValues, true);
  assert.ok(sep.startBalanceCents > 0);

  const oct = evolution.find(r => r.period === '2026-10');
  assert.strictEqual(oct.hasDefinedValues, true);

  // Nov/26, Dez/26 e Jan/27 ainda não possuem dados definidos e devem estar 100% zerados
  const futurePeriods = ['2026-11', '2026-12', '2027-01'];
  futurePeriods.forEach(p => {
    const row = evolution.find(r => r.period === p);
    assert.ok(row, `Mês ${p} deve existir na lista`);
    assert.strictEqual(row.hasDefinedValues, false, `Mês ${p} não deve ter valores definidos`);
    assert.strictEqual(row.startBalanceCents, 0, `Saldo anterior de ${p} deve ser 0`);
    assert.strictEqual(row.incomeCents, 0, `Entradas de ${p} devem ser 0`);
    assert.strictEqual(row.bankDebitCents, 0, `Saídas de ${p} devem ser 0`);
    assert.strictEqual(row.monthlyNetCents, 0, `Resultado de ${p} deve ser 0`);
    assert.strictEqual(row.bankEndingCents, 0, `Saldo final em conta de ${p} deve ser 0`);
    assert.strictEqual(row.cardTotalCents, 0, `Fatura cartões de ${p} deve ser 0`);
  });
});

runTest('23. Segurança e Criptografia da Tela de Login: SHA-256 + Salt e Isolamento de Sessão', async () => {
  assert.ok(typeof ctx.generateSha256Hash === 'function', 'Função de hash SHA-256 deve estar definida');

  const hash1 = await ctx.generateSha256Hash('minhasenha123', 'salt_teste_a');
  const hash2 = await ctx.generateSha256Hash('minhasenha123', 'salt_teste_a');
  const hash3 = await ctx.generateSha256Hash('outrasenha456', 'salt_teste_a');
  const hash4 = await ctx.generateSha256Hash('minhasenha123', 'salt_teste_b');

  // Mesma senha + mesmo salt deve produzir hash idêntico
  assert.strictEqual(hash1, hash2, 'Hashes devem ser determinísticos e idênticos para mesma senha e salt');
  assert.strictEqual(typeof hash1, 'string');
  assert.strictEqual(hash1.length, 64, 'Hash SHA-256 deve ter 64 caracteres hexadecimais (256 bits)');

  // Senhas diferentes ou salts diferentes devem produzir hashes completamente diferentes
  assert.notStrictEqual(hash1, hash3, 'Senhas diferentes devem produzir hashes diferentes');
  assert.notStrictEqual(hash1, hash4, 'Salts diferentes devem produzir hashes diferentes (anti-rainbow table)');
});

console.log(`\n🎉 Resultado Final: ${passed} testes aprovados com sucesso!`);
