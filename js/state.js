// ============================================================================
// MÓDULO 3: ESTADO DA APLICAÇÃO, PERSISTÊNCIA E PROJEÇÃO DE PARCELAS
// ============================================================================
// Por que este módulo existe?
// Responsável por carregar/salvar os dados no navegador (localStorage) e por
// enriquecer os lançamentos com metadados estruturados (como projetar
// automaticamente as parcelas futuras das compras parceladas).

function enrichTransactionsAndProjectInstallments(rawTransactions) {
  const enriched = rawTransactions.map(t => {
    const inst = (t.installmentCurrent && t.installmentTotal)
      ? { current: Number(t.installmentCurrent), total: Number(t.installmentTotal) }
      : (t.type === 'card' ? extractInstallmentFromDesc(t.desc) : null);

    let accountId = t.accountId;
    if (!accountId) {
      if (String(t.source).includes('Caixa') || String(t.desc).includes('Poupança Caixa')) {
        accountId = 'poupanca_caixa';
      } else if (t.type === 'card' || String(t.source).includes('Cartão')) {
        accountId = (t.owner === 'Vital' || t.owner === 'Marido') ? 'card_marido' : 'card_eveli_5544';
      } else {
        accountId = 'cc_itau_conjunta';
      }
    }

    let kind = t.kind;
    if (!kind) {
      if (t.category === 'Faturas Antigas Pagas' || String(t.desc).toUpperCase().includes('FATURA ITAU')) {
        kind = 'invoice_payment';
      } else if (t.source === 'Reserva p/ Meta' || t.category === 'Reserva p/ Meta') {
        kind = 'transfer';
      } else if (t.type === 'income') {
        if (['set_7', 'set_8', 'set_9'].includes(t.id)) {
          kind = 'reimbursement';
        } else {
          kind = 'income';
        }
      } else {
        kind = 'expense';
      }
    }

    return {
      ...t,
      accountId,
      kind,
      scope: t.scope || 'shared',
      installmentCurrent: inst ? inst.current : null,
      installmentTotal: inst ? inst.total : null,
      amount: fromCents(toCents(t.amount))
    };
  });

  // Projeta automaticamente as próximas parcelas das compras de cartão (a partir de 2026-10) para os meses seguintes
  const existingIds = new Set(enriched.map(t => t.id));
  const projected = [];

  enriched.forEach(t => {
    if (
      t.period >= '2026-10' &&
      t.type === 'card' &&
      t.installmentCurrent &&
      t.installmentTotal &&
      t.installmentCurrent < t.installmentTotal &&
      !t.isAutoProjected
    ) {
      const remaining = t.installmentTotal - t.installmentCurrent;
      for (let step = 1; step <= remaining; step++) {
        const nextCur = t.installmentCurrent + step;
        const nextPeriod = addMonthsToPeriod(t.period, step);
        const projId = `${t.id}_proj_${nextPeriod}`;

        // Evita duplicar se a fatura real do mês seguinte já tiver sido importada/lançada com esta parcela
        const alreadyHasRealInstallment = enriched.some(other =>
          !other.isAutoProjected &&
          other.period === nextPeriod &&
          other.accountId === t.accountId &&
          other.installmentCurrent === nextCur &&
          other.installmentTotal === t.installmentTotal &&
          toCents(other.amount) === toCents(t.amount)
        );

        if (!existingIds.has(projId) && !alreadyHasRealInstallment) {
          const cleanBaseDesc = t.desc
            .replace(/\b\d{1,2}\/\d{1,2}\b/, `${String(nextCur).padStart(2, '0')}/${String(t.installmentTotal).padStart(2, '0')}`)
            .replace(/\(Acaba em Nov\)/gi, nextCur === t.installmentTotal ? '(🎉 Última Parcela!)' : '');
          projected.push({
            ...t,
            id: projId,
            parentInstallmentId: t.id,
            period: nextPeriod,
            installmentCurrent: nextCur,
            installmentTotal: t.installmentTotal,
            desc: cleanBaseDesc,
            isAutoProjected: true
          });
          existingIds.add(projId);
        }
      }
    }
  });

  return [...enriched, ...projected];
}

// ----------------------------------------------------------------------------
// SEGURANÇA: higieniza qualquer dado vindo de fora (backup .JSON, nuvem ou
// localStorage). Um arquivo adulterado poderia trazer textos maliciosos nos
// identificadores (id), que são usados dentro de botões da tela (onclick).
// Aqui deixamos só caracteres seguros e garantimos tipos corretos.
// ----------------------------------------------------------------------------
const ALLOWED_KINDS = ['expense', 'income', 'invoice_payment', 'transfer', 'reimbursement'];
const ALLOWED_OWNERS = ['Éveli', 'Vital', 'Marido'];

function sanitizeId(v) {
  return String(v ?? '').replace(/[^A-Za-z0-9_.\-]/g, '_').slice(0, 80);
}

function getActiveHouseholdCode() {
  if (typeof cloudConfig !== 'undefined' && cloudConfig && cloudConfig.householdCode) {
    return cloudConfig.householdCode;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const rawCfg = localStorage.getItem('financas_familia_cloud_config_v1');
      if (rawCfg) {
        const parsedCfg = JSON.parse(rawCfg);
        if (parsedCfg && parsedCfg.householdCode) return parsedCfg.householdCode;
      }
    } catch (e) {}
  }
  return typeof COUPLE_HOUSEHOLD_CODE !== 'undefined' ? COUPLE_HOUSEHOLD_CODE : 'casal_eveli_vital';
}

function isCoupleHousehold(code = getActiveHouseholdCode()) {
  const target = typeof COUPLE_HOUSEHOLD_CODE !== 'undefined' ? COUPLE_HOUSEHOLD_CODE : 'casal_eveli_vital';
  return !code || code === target;
}

function getActiveStorageKey(code = getActiveHouseholdCode()) {
  if (isCoupleHousehold(code)) return STORAGE_KEY;
  return `${STORAGE_KEY}_${sanitizeId(code)}`;
}

function getBaseDataForHousehold(code = getActiveHouseholdCode(), ownerName = 'Titular') {
  if (isCoupleHousehold(code)) {
    return getInitialFamilyData();
  }
  return typeof getEmptyInitialData === 'function' ? getEmptyInitialData(ownerName) : getInitialFamilyData();
}

function sanitizeState(raw, householdOverride) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Formato de dados inválido.');
  }
  const coupleMode = isCoupleHousehold(householdOverride);
  const clean = { ...raw };

  clean.transactions = (Array.isArray(raw.transactions) ? raw.transactions : [])
    .filter(t => t && typeof t === 'object')
    .map(t => {
      const amount = Number(t.amount);
      const rawOwner = t.owner === 'Marido' ? 'Vital' : t.owner;
      const out = {
        ...t,
        id: sanitizeId(t.id) || 'tx_' + Math.random().toString(36).slice(2, 10),
        owner: ALLOWED_OWNERS.includes(rawOwner) ? rawOwner : (coupleMode ? 'Éveli' : String(rawOwner || 'Titular').slice(0, 40)),
        period: /^\d{4}-\d{2}$/.test(String(t.period)) ? String(t.period) : '2026-10',
        desc: String(t.desc ?? '').slice(0, 200),
        category: String(t.category ?? 'Casa, Serviços & Outros').slice(0, 80),
        source: String(t.source ?? '').slice(0, 80),
        date: String(t.date ?? '').slice(0, 20),
        amount: Number.isFinite(amount) ? Math.abs(amount) : 0
      };
      if (t.kind !== undefined && !ALLOWED_KINDS.includes(t.kind)) delete out.kind;
      if (t.scope !== undefined && t.scope !== 'shared' && t.scope !== 'individual') out.scope = 'shared';
      if (t.goalId) out.goalId = sanitizeId(t.goalId);
      if (t.parentInstallmentId) out.parentInstallmentId = sanitizeId(t.parentInstallmentId);
      if (t.paidCardId) out.paidCardId = sanitizeId(t.paidCardId);
      if (t.fileId) out.fileId = sanitizeId(t.fileId);
      if (t.fileName) out.fileName = String(t.fileName).slice(0, 150);
      return out;
    });

  clean.futureGoals = (Array.isArray(raw.futureGoals) ? raw.futureGoals : [])
    .filter(g => g && typeof g === 'object')
    .map(g => ({
      ...g,
      id: sanitizeId(g.id),
      name: String(g.name ?? '').slice(0, 80),
      totalAmount: Math.max(0, Number(g.totalAmount) || 0),
      savedAmount: Math.max(0, Number(g.savedAmount) || 0),
      remainingMonths: Math.max(0, parseInt(g.remainingMonths, 10) || 0)
    }));

  clean.customCategories = Array.from(new Set(
    (Array.isArray(raw.customCategories) ? raw.customCategories : [])
      .map(c => String(c ?? '').trim())
      .filter(c => c.length > 0 && c.length <= 80)
  ));

  // Lançamentos Diários / Controle Pessoal (com foto de nota fiscal e conciliação)
  clean.dailyExpenses = (Array.isArray(raw.dailyExpenses) ? raw.dailyExpenses : [])
    .filter(d => d && typeof d === 'object')
    .map(d => ({
      id: sanitizeId(d.id) || 'daily_' + Math.random().toString(36).slice(2, 10),
      date: String(d.date || '').slice(0, 20),
      period: /^\d{4}-\d{2}$/.test(String(d.period)) ? String(d.period) : '2026-10',
      desc: String(d.desc ?? '').slice(0, 200),
      amount: Math.abs(Number(d.amount) || 0),
      direction: d.direction === 'income' ? 'income' : 'expense',
      paymentMethod: ['credit_card', 'debit_card', 'cash', 'pix', 'other'].includes(d.paymentMethod) ? d.paymentMethod : 'other',
      cardHolder: d.cardHolder === 'Vital' ? 'Vital' : 'Éveli',
      category: String(d.category ?? 'Outros').slice(0, 80),
      receiptImage: typeof d.receiptImage === 'string' && d.receiptImage.length < 5000000 ? d.receiptImage : null,
      fileId: d.fileId ? sanitizeId(d.fileId) : null,
      reconciled: !!d.reconciled,
      reconciledAt: d.reconciledAt ? String(d.reconciledAt).slice(0, 30) : null,
      reconciledTxId: d.reconciledTxId ? sanitizeId(d.reconciledTxId) : null
    }));

  // Poupanças & Investimentos da Família (Tesouro Direto, Poupança Itaú e Poupança Caixa)
  const rawCaixa = raw.savingsAccounts?.poupanca_caixa;
  const rawTesouro = raw.savingsAccounts?.tesouro_direto;
  const rawPoupItau = raw.savingsAccounts?.poupanca_itau;

  const defaultTesouroMonthly = coupleMode
    ? {
        '2026-09': { balance: 8198.11, earnings: 87.37, updatedAt: '30/09/2026' },
        '2026-10': { balance: 8260.70, earnings: 62.59, updatedAt: '22/10/2026' }
      }
    : {
        '2026-09': { balance: 0, earnings: 0, updatedAt: '-' },
        '2026-10': { balance: 0, earnings: 0, updatedAt: '-' }
      };

  const defaultPoupItauMonthly = coupleMode
    ? {
        '2026-09': { balance: 13.36, earnings: 0.09, updatedAt: '30/09/2026' },
        '2026-10': { balance: 13.45, earnings: 0.09, updatedAt: '22/10/2026' }
      }
    : {
        '2026-09': { balance: 0, earnings: 0, updatedAt: '-' },
        '2026-10': { balance: 0, earnings: 0, updatedAt: '-' }
      };

  clean.savingsAccounts = {
    tesouro_direto: {
      id: 'tesouro_direto',
      name: 'Tesouro Direto',
      bank: 'Tesouro Nacional / Itaú Corretora',
      type: 'investment',
      holder: 'Casal',
      notes: 'Investimento em Renda Fixa Pública',
      monthlyData: rawTesouro?.monthlyData || defaultTesouroMonthly
    },
    poupanca_itau: {
      id: 'poupanca_itau',
      name: 'Poupança Itaú',
      bank: 'Banco Itaú',
      type: 'savings',
      holder: 'Casal',
      notes: 'Caderneta de Poupança Itaú',
      monthlyData: rawPoupItau?.monthlyData || defaultPoupItauMonthly
    },
    poupanca_caixa: {
      id: 'poupanca_caixa',
      name: 'Poupança Caixa Econômica',
      bank: 'Caixa Econômica Federal',
      type: 'savings',
      holder: 'Casal',
      balance: Math.max(0, Number(rawCaixa?.balance) || 0),
      notes: 'Economias e Reserva da Família (Separada da Conta Corrente Itaú)',
      monthlyData: rawCaixa?.monthlyData || {
        '2026-09': { balance: Math.max(0, Number(rawCaixa?.balance) || 0), earnings: 0, updatedAt: '30/09/2026' },
        '2026-10': { balance: Math.max(0, Number(rawCaixa?.balance) || 0), earnings: 0, updatedAt: '22/10/2026' }
      }
    }
  };

  // Histórico e registros mensais fechados
  clean.monthlySnapshots = (raw.monthlySnapshots && typeof raw.monthlySnapshots === 'object') ? raw.monthlySnapshots : {};

  // Gerenciador de Arquivos & Uploads (Extratos OFX, Faturas PDF e Fotos de Comprovantes)
  clean.uploadedFiles = (Array.isArray(raw.uploadedFiles) ? raw.uploadedFiles : [])
    .filter(f => f && typeof f === 'object')
    .map(f => {
      const cleanFileId = sanitizeId(f.id) || 'file_' + Math.random().toString(36).slice(2, 10);
      const cleanDailyId = f.dailyExpenseId ? sanitizeId(f.dailyExpenseId) : null;
      const rawImg = typeof f.receiptImage === 'string' && f.receiptImage.length < 5000000 ? f.receiptImage : null;

      // Evita duplicar a mesma foto Base64 em uploadedFiles e dailyExpenses (economiza 50% do localStorage)
      const linkedDaily = clean.dailyExpenses.find(d => (cleanDailyId && d.id === cleanDailyId) || d.fileId === cleanFileId);
      if (linkedDaily && rawImg && !linkedDaily.receiptImage) {
        linkedDaily.receiptImage = rawImg;
      }

      return {
        id: cleanFileId,
        fileName: String(f.fileName || 'Arquivo').slice(0, 150),
        fileType: ['bank_ofx', 'card_pdf', 'receipt_photo', 'other'].includes(f.fileType) ? f.fileType : 'other',
        fileSize: Math.max(0, parseInt(f.fileSize, 10) || 0),
        uploadedAt: String(f.uploadedAt || '').slice(0, 40),
        period: String(f.period || '2026-10').slice(0, 10),
        targetAccount: sanitizeId(f.targetAccount || ''),
        accountLabel: String(f.accountLabel || '').slice(0, 80),
        itemCount: Math.max(0, parseInt(f.itemCount, 10) || 0),
        totalAmount: Math.max(0, Number(f.totalAmount) || 0),
        receiptImage: linkedDaily ? null : rawImg,
        dailyExpenseId: cleanDailyId,
        desc: String(f.desc || '').slice(0, 200)
      };
    });

  // Vida financeira começa a partir de Setembro/2026 (meses anteriores desconsiderados)
  clean.transactions = clean.transactions.filter(t => String(t.period) >= '2026-09');
  if (clean.periodStartingBalances) {
    delete clean.periodStartingBalances['2026-08'];
    // Garante que apenas Setembro/2026 (2026-09) possa ter override manual; outros meses são 100% automáticos
    Object.keys(clean.periodStartingBalances).forEach(k => {
      if (k !== '2026-09' && clean.periodStartingBalances[k] && typeof clean.periodStartingBalances[k] === 'object') {
        delete clean.periodStartingBalances[k].isManualOverride;
      }
    });
  }

  // Se o usuário zerou a conta (0 transações), garante que saldos anteriores (exceto se Set/26 foi ajustado manualmente) e faturas antigas fiquem zerados
  if (clean.transactions.length === 0) {
    if (clean.periodStartingBalances) {
      Object.keys(clean.periodStartingBalances).forEach(k => {
        if (k === '2026-09' && clean.periodStartingBalances[k]?.isManualOverride) return;
        clean.periodStartingBalances[k] = { amount: 0, label: clean.periodStartingBalances[k]?.label || '' };
      });
    }
    if (clean.cardsConfig?.card_eveli_5544) {
      clean.cardsConfig.card_eveli_5544.officialInvoiceTotals = {};
    }
    if (clean.cardsConfig?.card_marido) {
      clean.cardsConfig.card_marido.officialInvoiceTotals = {};
    }
    clean.uploadedFiles = [];
  }

  return clean;
}

function loadState(householdOverride, ownerName = 'Titular') {
  const code = householdOverride || getActiveHouseholdCode();
  const storageKey = getActiveStorageKey(code);

  if (typeof localStorage !== 'undefined') {
    const savedV5 = localStorage.getItem(storageKey);
    if (savedV5) {
      try {
        const parsed = sanitizeState(JSON.parse(savedV5), code);
        parsed.transactions = enrichTransactionsAndProjectInstallments(parsed.transactions || []);
        return parsed;
      } catch (e) {}
    }

    // Migração transparente da v4 apenas para a conta oficial do casal
    if (isCoupleHousehold(code)) {
      const savedV4 = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (savedV4) {
        try {
          const old = JSON.parse(savedV4);
          const fresh = getInitialFamilyData();
          const migratedTx = (old.transactions || []).map(t => {
            if (t.id === 'fc_u27' && (Number(t.amount) === 19.86 || Number(t.amount) === 10.06)) {
              return { ...t, desc: 'DL *UberRides Sao Paulo BR', amount: 9.96 };
            }
            return t;
          });
          fresh.selectedPeriod = old.selectedPeriod || '2026-10';
          fresh.selectedOwner = old.selectedOwner || 'ALL';
          fresh.includeCurrentCardBill = old.includeCurrentCardBill !== undefined ? old.includeCurrentCardBill : false;
          fresh.budgets = { ...fresh.budgets, ...(old.budgets || {}) };
          fresh.futureGoals = old.futureGoals || fresh.futureGoals;
          fresh.customCategories = Array.isArray(old.customCategories) ? old.customCategories : (fresh.customCategories || []);
          fresh.dailyExpenses = old.dailyExpenses || fresh.dailyExpenses || [];
          fresh.monthlySnapshots = old.monthlySnapshots || fresh.monthlySnapshots || {};
          fresh.periodStartingBalances = old.periodStartingBalances || fresh.periodStartingBalances;
          fresh.transactions = enrichTransactionsAndProjectInstallments(migratedTx);
          localStorage.setItem(storageKey, JSON.stringify(fresh));
          return fresh;
        } catch (e) {}
      }
    }
  }

  const initial = getBaseDataForHousehold(code, ownerName);
  initial.transactions = enrichTransactionsAndProjectInstallments(initial.transactions || []);
  return initial;
}

function saveState() {
  const storageKey = getActiveStorageKey();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (err) {
      // Proteção contra estouro de memória (QuotaExceededError de 5MB do navegador):
      // Remove primeiro eventuais imagens duplicadas ou as fotos mais antigas já conciliadas para nunca perder lançamentos financeiros
      try {
        if (Array.isArray(state.uploadedFiles)) {
          state.uploadedFiles.forEach(f => {
            if (f.dailyExpenseId && f.receiptImage) f.receiptImage = null;
          });
        }
        if (Array.isArray(state.dailyExpenses)) {
          for (let i = state.dailyExpenses.length - 1; i >= 0; i--) {
            if (state.dailyExpenses[i].receiptImage) {
              state.dailyExpenses[i].receiptImage = null;
              break;
            }
          }
        }
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (retryErr) {
        console.warn('Limite de armazenamento local atingido:', retryErr);
      }
    }
  }
  if (typeof scheduleCloudAutoSync === 'function') {
    scheduleCloudAutoSync();
  }
}

function switchActiveHouseholdState(householdCode, ownerName = 'Titular') {
  state = loadState(householdCode, ownerName);
  if (typeof renderAll === 'function') {
    renderAll();
  }
}

let state = loadState();
