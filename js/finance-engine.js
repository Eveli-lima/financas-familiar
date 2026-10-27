// ============================================================================
// MÓDULO 4: MOTOR DE REGRAS E CÁLCULOS FINANCEIROS (PURO EM CENTAVOS)
// ============================================================================
// Por que este módulo existe?
// Separa os cálculos financeiros (Fluxo de Caixa da Conta Conjunta,
// Competência dos Cartões, Reembolsos, Reservas de Metas e Projeção de
// Parcelamentos) da interface HTML. Isso permite testar toda a matemática
// do sistema de forma isolada e confiável.

function getStartingBalanceForPeriod(period, stateRef) {
  const targetState = stateRef || state;
  if (!targetState.periodStartingBalances) targetState.periodStartingBalances = {};

  // Se houver ajuste manual expressamente marcado pelo usuário para o período:
  if (targetState.periodStartingBalances[period] && targetState.periodStartingBalances[period].isManualOverride) {
    return targetState.periodStartingBalances[period];
  }

  // Meses futuros que ainda não têm saldos/extratos bancários definidos (Nov/2026 em diante sem lançamentos próprios): mantêm saldo zerado
  if (period && period !== 'ALL' && /^\d{4}-\d{2}$/.test(period)) {
    const hasOwnBankTx = (targetState.transactions || []).some(t => t.period === period && t.type !== 'card' && !t.isProjected);
    const hasManual = targetState.periodStartingBalances[period]?.isManualOverride;

    if (period > '2026-10' && !hasOwnBankTx && !hasManual) {
      return { amount: 0, label: `Saldo zerado (aguardando extrato de ${formatPeriodLabel(period)})` };
    }

    if (period === '2026-10') {
      const prevP = '2026-09';
      const prevStart = getStartingBalanceForPeriod(prevP, targetState);
      const prevTx = (targetState.transactions || []).filter(t => t.period === prevP && t.type !== 'card');
      let runningCents = toCents(prevStart.amount);
      prevTx.forEach(t => {
        const c = toCents(t.amount);
        if (t.type === 'income' || t.kind === 'income' || t.kind === 'reimbursement') {
          runningCents += c;
        } else {
          runningCents -= c;
        }
      });
      return {
        amount: fromCents(runningCents),
        label: `Saldo vindo automaticamente de ${formatPeriodLabel(prevP)} (${formatCentsBRL(runningCents)})`
      };
    }
  }

  if (targetState.periodStartingBalances[period]) {
    return targetState.periodStartingBalances[period];
  }

  return { amount: 0, label: `Saldo inicial (${formatPeriodLabel(period)})` };
}

// Calcula todos os indicadores financeiros de um conjunto de lançamentos (em centavos)
function calculatePeriodSummary(periodTx, period, stateRef) {
  const targetState = stateRef || state;
  const startInfo = getStartingBalanceForPeriod(period, targetState);
  const prevBalanceCents = toCents(startInfo.amount);

  let totalIncomeCents = 0;
  let totalReimbursementBankCents = 0;
  let totalBankDebitCents = 0;
  let totalInvoicePaidInBankCents = 0;
  let totalGoalReserveCents = 0;

  let cardEveliCents = 0;
  let cardMaridoCents = 0;

  let sharedExpensesCents = 0;
  let individualEveliCents = 0;
  let individualMaridoCents = 0;

  const spentByCatCents = {
    'Lanches & Restaurantes': 0,
    'Mercado & Hortifruti': 0,
    'Uber & Transporte': 0,
    'Parcelamentos Cartão': 0,
    'Saúde, Farmácia & Academia': 0,
    'Auto Escola & Detran': 0,
    'Casa, Serviços & Outros': 0
  };

  let lanchesCount = 0;
  let cheirinCount = 0;
  let cheirinCents = 0;
  let uberCount = 0;

  let caixaInflowCents = 0;
  let caixaOutflowCents = 0;

  periodTx.forEach(t => {
    const c = toCents(t.amount);

    // Movimentações da Poupança Caixa (Reserva separada do dia a dia)
    if (t.accountId === 'poupanca_caixa') {
      if (t.kind === 'income' || t.type === 'income' || t.kind === 'transfer') {
        caixaInflowCents += c;
      } else {
        caixaOutflowCents += c;
      }
      return;
    }

    const isCard = t.type === 'card' || t.accountId === 'card_eveli_5544' || t.accountId === 'card_marido';

    if (!isCard) {
      // Movimentações da Conta Corrente Conjunta Itaú
      if (t.kind === 'income' || (t.type === 'income' && t.kind !== 'reimbursement')) {
        totalIncomeCents += c;
      } else if (t.kind === 'reimbursement') {
        totalReimbursementBankCents += c;
        if (spentByCatCents[t.category] !== undefined) {
          spentByCatCents[t.category] -= c;
        }
      } else if (t.kind === 'invoice_payment') {
        totalBankDebitCents += c;
        totalInvoicePaidInBankCents += c;
      } else if (t.kind === 'transfer') {
        totalBankDebitCents += c;
        totalGoalReserveCents += c;
      } else {
        totalBankDebitCents += c;
        if (spentByCatCents[t.category] !== undefined) {
          spentByCatCents[t.category] += c;
        } else {
          spentByCatCents['Casa, Serviços & Outros'] += c;
        }
        if (t.scope === 'individual') {
          if (t.owner === 'Vital' || t.owner === 'Marido') individualMaridoCents += c;
          else individualEveliCents += c;
        } else {
          sharedExpensesCents += c;
        }
      }
    } else {
      // Movimentações dos 2 Cartões de Crédito
      const signedCardCents = t.kind === 'reimbursement' ? -c : c;
      if (t.accountId === 'card_marido' || t.owner === 'Vital' || t.owner === 'Marido') {
        cardMaridoCents += signedCardCents;
      } else {
        cardEveliCents += signedCardCents;
      }

      if (spentByCatCents[t.category] !== undefined) {
        spentByCatCents[t.category] += signedCardCents;
      } else {
        spentByCatCents['Casa, Serviços & Outros'] += signedCardCents;
      }

      if (t.scope === 'individual') {
        if (t.owner === 'Vital' || t.owner === 'Marido') individualMaridoCents += signedCardCents;
        else individualEveliCents += signedCardCents;
      } else {
        sharedExpensesCents += signedCardCents;
      }

      if (t.category === 'Lanches & Restaurantes' && signedCardCents > 0) {
        lanchesCount++;
        if (String(t.desc).toUpperCase().includes('CHEIRIN')) {
          cheirinCount++;
          cheirinCents += signedCardCents;
        }
      }
      if (t.category === 'Uber & Transporte' && signedCardCents > 0) {
        uberCount++;
      }
    }
  });

  const totalCardCents = cardEveliCents + cardMaridoCents;
  const bankEndingBalanceCents = prevBalanceCents + totalIncomeCents + totalReimbursementBankCents - totalBankDebitCents;
  const projectedBalanceCents = state.includeCurrentCardBill
    ? (bankEndingBalanceCents - totalCardCents)
    : bankEndingBalanceCents;

  const invData = typeof getInvestmentsDataForPeriod === 'function' ? getInvestmentsDataForPeriod(period) : { totalInvestedCents: 0, totalEarningsCents: 0, items: [] };

  return {
    startInfo,
    prevBalanceCents,
    totalIncomeCents,
    totalReimbursementBankCents,
    totalBankDebitCents,
    totalInvoicePaidInBankCents,
    totalGoalReserveCents,
    cardEveliCents,
    cardMaridoCents,
    totalCardCents,
    bankEndingBalanceCents,
    projectedBalanceCents,
    caixaInflowCents,
    caixaOutflowCents,
    caixaBalanceCents: toCents(state.savingsAccounts?.poupanca_caixa?.balance || 0) + caixaInflowCents - caixaOutflowCents,
    investmentsData: invData,
    totalInvestedCents: invData.totalInvestedCents,
    totalInvestmentEarningsCents: invData.totalEarningsCents,
    sharedExpensesCents,
    individualEveliCents,
    individualMaridoCents,
    spentByCatCents,
    lanchesCount,
    cheirinCount,
    cheirinCents,
    uberCount
  };
}

// Calcula a projeção de parcelamentos ativos no período
function calculateInstallmentsRadar(periodTx) {
  const installmentTx = periodTx.filter(t => t.installmentTotal && t.installmentTotal >= 2);
  const endingNow = installmentTx.filter(t => t.installmentCurrent === t.installmentTotal);
  const endingNext = installmentTx.filter(t => t.installmentCurrent === t.installmentTotal - 1);
  const continuingAfter = installmentTx.filter(t => (t.installmentTotal - t.installmentCurrent) >= 2);

  const endingNowCents = endingNow.reduce((acc, t) => acc + toCents(t.amount), 0);
  const endingNextCents = endingNext.reduce((acc, t) => acc + toCents(t.amount), 0);
  const continuingAfterCents = continuingAfter.reduce((acc, t) => acc + toCents(t.amount), 0);
  const committedNextMonthCents = endingNextCents + continuingAfterCents;

  let totalFutureRemainingCents = 0;
  installmentTx.forEach(t => {
    const remMonths = Math.max(0, t.installmentTotal - t.installmentCurrent);
    totalFutureRemainingCents += remMonths * toCents(t.amount);
  });

  return {
    installmentTx,
    endingNow,
    endingNext,
    continuingAfter,
    endingNowCents,
    endingNextCents,
    continuingAfterCents,
    committedNextMonthCents,
    totalFutureRemainingCents
  };
}

// Calcula o uso do limite de crédito de um cartão específico (fatura do mês + parcelas futuras)
function calculateCardLimitsUsage(cardId, currentPeriod) {
  const refPeriod = currentPeriod === 'ALL' ? '2026-10' : currentPeriod;
  const cardCfg = (state.cardsConfig && state.cardsConfig[cardId]) || {
    limit: cardId === 'card_eveli_5544' ? 7740 : 6000
  };
  const limitCents = toCents(cardCfg.limit || 0);

  let periodInvoiceCents = 0;
  let futureInstallmentsCents = 0;

  (state.transactions || []).forEach(t => {
    const belongsToCard =
      t.accountId === cardId ||
      (t.type === 'card' && ((cardId === 'card_marido' && (t.owner === 'Vital' || t.owner === 'Marido')) || (cardId === 'card_eveli_5544' && t.owner !== 'Vital' && t.owner !== 'Marido')));

    if (!belongsToCard || t.type !== 'card') return;

    const c = toCents(t.amount);
    const signedC = t.kind === 'reimbursement' ? -c : c;

    if (t.period === refPeriod) {
      periodInvoiceCents += signedC;
      if (t.installmentTotal && t.installmentCurrent && t.installmentCurrent < t.installmentTotal) {
        const remMonths = t.installmentTotal - t.installmentCurrent;
        futureInstallmentsCents += remMonths * c;
      }
    }
  });

  // Verifica se a fatura deste mês já foi paga pela conta conjunta
  const holderName = (cardCfg.holder || (cardId === 'card_marido' ? 'Vital' : 'Éveli')).toUpperCase();
  const isPaidThisPeriod = (state.transactions || []).some(
    t => t.period === refPeriod && t.kind === 'invoice_payment' && (t.paidCardId === cardId || String(t.desc).toUpperCase().includes(holderName))
  );

  const activeInvoiceCents = isPaidThisPeriod ? 0 : Math.max(0, periodInvoiceCents);
  const totalCommittedCents = activeInvoiceCents + futureInstallmentsCents;
  const availableLimitCents = Math.max(0, limitCents - totalCommittedCents);
  const usagePct = limitCents > 0 ? Math.min(100, Math.round((totalCommittedCents / limitCents) * 100)) : 0;

  return {
    limitCents,
    periodInvoiceCents,
    futureInstallmentsCents,
    totalCommittedCents,
    availableLimitCents,
    usagePct,
    isPaidThisPeriod
  };
}

// Determina com precisão a qual mês um lançamento pertence (Isolamento Estrito de Meses)
function normalizePeriodByDate(dateStr, accountId, defaultPeriod) {
  // Para cartões de crédito: o período financeiro é o período da fatura (ciclo de vencimento)
  if (accountId && accountId !== 'cc_itau_conjunta' && defaultPeriod && defaultPeriod !== 'ALL') {
    return defaultPeriod;
  }
  if (!dateStr) return defaultPeriod || '2026-10';
  const m = String(dateStr).match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return defaultPeriod || '2026-10';

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (isNaN(month) || month < 1 || month > 12) return defaultPeriod || '2026-10';

  const year = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : '2026';
  const monthStr = String(month).padStart(2, '0');

  // Conta corrente: cada lançamento pertence estritamente ao mês de sua data (DD/MM/AAAA -> AAAA-MM)
  return `${year}-${monthStr}`;
}

// Reorganiza a base para garantir que nenhum mês invada o outro e remove duplicatas
function reorganizeAndIsolateMonths(showNotification) {
  if (typeof state === 'undefined' || !state || !Array.isArray(state.transactions)) {
    return { movedCount: 0, removedDuplicates: 0 };
  }

  const seenSignatures = new Set();
  const cleanedList = [];
  let movedCount = 0;
  let removedDuplicates = 0;

  state.transactions.forEach(t => {
    let correctPeriod = t.period;
    // Transações de cartão de crédito pertencem ao ciclo da fatura e não devem ser deslocadas pelo dia da compra
    if (t.accountId === 'cc_itau_conjunta' && !t.isAutoProjected && !t.parentInstallmentId) {
      const derived = normalizePeriodByDate(t.date, t.accountId, t.period);
      if (derived && derived !== t.period) {
        correctPeriod = derived;
        movedCount++;
      }
    }

    const cleanDesc = String(t.desc || '').toUpperCase().trim().replace(/\s+/g, ' ');
    const sig = `${t.accountId || 'cc'}|${correctPeriod}|${t.date}|${cleanDesc}|${toCents(t.amount)}`;
    if (seenSignatures.has(sig)) {
      removedDuplicates++;
      return; // Descarta cópia idêntica
    }
    seenSignatures.add(sig);

    cleanedList.push({
      ...t,
      period: correctPeriod
    });
  });

  state.transactions = cleanedList;
  if (typeof saveState === 'function') saveState();
  if (typeof renderAll === 'function') renderAll();

  if (showNotification && typeof alert === 'function') {
    alert(`🧹 Organização Concluída!\n\n• ${movedCount} lançamento(s) foram reorganizados para o mês correto da data.\n• ${removedDuplicates} lançamento(s) duplicados foram eliminados.\n\nAgora Setembro e Outubro estão 100% isolados!`);
  }

  return { movedCount, removedDuplicates };
}

// Calcula o quadro comparativo de evolução mensal do casal (Histórico a partir de Setembro + Projeção Futura)
function calculateMonthlyEvolution(periodsList, ownerFilter, scopeFilter) {
  const periods = periodsList || ['2026-09', '2026-10', '2026-11', '2026-12'];
  return periods.map(p => {
    // Verifica se este mês possui dados/saldos reais definidos (Set/26, Out/26 ou meses com lançamentos bancários reais)
    const hasRealBankTx = (state.transactions || []).some(t => t.period === p && t.type !== 'card' && !t.isProjected);
    const hasManualStart = state.periodStartingBalances?.[p]?.isManualOverride;
    const hasDefinedValues = (p <= '2026-10') || hasRealBankTx || hasManualStart;

    if (!hasDefinedValues) {
      // Meses futuros que ainda não têm saldos definidos: mantém todas as colunas rigorosamente zeradas (R$ 0,00)
      return {
        period: p,
        label: formatPeriodLabel(p),
        txCount: 0,
        startBalanceCents: 0,
        incomeCents: 0,
        bankDebitCents: 0,
        monthlyNetCents: 0,
        cardEveliCents: 0,
        cardVitalCents: 0,
        cardTotalCents: 0,
        invoicePaidInBankCents: 0,
        bankEndingCents: 0,
        projectedBalanceCents: 0,
        hasDefinedValues: false
      };
    }

    const pTx = (state.transactions || []).filter(t => {
      if (t.period !== p) return false;
      if (ownerFilter && ownerFilter !== 'ALL' && t.owner !== ownerFilter) return false;
      if (scopeFilter && scopeFilter !== 'ALL' && (t.scope || 'shared') !== scopeFilter) return false;
      return true;
    });
    const sum = calculatePeriodSummary(pTx, p);
    const incomeCents = sum.totalIncomeCents + sum.totalReimbursementBankCents;
    const bankDebitCents = sum.totalBankDebitCents;
    const monthlyNetCents = incomeCents - bankDebitCents;
    return {
      period: p,
      label: formatPeriodLabel(p),
      txCount: pTx.length,
      startBalanceCents: sum.prevBalanceCents,
      incomeCents,
      bankDebitCents,
      monthlyNetCents,
      cardEveliCents: sum.cardEveliCents,
      cardVitalCents: sum.cardMaridoCents,
      cardTotalCents: sum.totalCardCents,
      invoicePaidInBankCents: sum.totalInvoicePaidInBankCents,
      bankEndingCents: sum.bankEndingBalanceCents,
      projectedBalanceCents: sum.projectedBalanceCents,
      hasDefinedValues: true
    };
  });
}

// Calcula o consolidado geral com a soma de todos os meses de Conta e Cartões separados
function calculateConsolidatedAllMonths(ownerFilter, scopeFilter) {
  const allPeriodSet = new Set(['2026-09', '2026-10', '2026-11', '2026-12']);
  (state.transactions || []).forEach(t => {
    if (t.period && /^\d{4}-\d{2}$/.test(t.period) && t.period >= '2026-09') {
      allPeriodSet.add(t.period);
    }
  });
  const sortedPeriods = Array.from(allPeriodSet).sort();
  const evolution = calculateMonthlyEvolution(sortedPeriods, ownerFilter, scopeFilter);

  let totalIncomeCents = 0;
  let totalBankDebitCents = 0;
  let totalCardEveliCents = 0;
  let totalCardVitalCents = 0;
  let totalCardCents = 0;
  let totalInvoicePaidInBankCents = 0;

  evolution.forEach(row => {
    if (row.period <= '2026-10') {
      totalIncomeCents += row.incomeCents;
      totalBankDebitCents += row.bankDebitCents;
      totalCardEveliCents += row.cardEveliCents;
      totalCardVitalCents += row.cardVitalCents;
      totalCardCents += row.cardTotalCents;
      totalInvoicePaidInBankCents += row.invoicePaidInBankCents;
    }
  });

  const totalMonthlyNetCents = totalIncomeCents - totalBankDebitCents;
  const latestBankEnding = evolution.find(r => r.period === '2026-10')?.bankEndingCents ?? 0;
  const caixaSavingsBalanceCents = toCents(state.savingsAccounts?.poupanca_caixa?.balance || 0);

  // Total de outros investimentos da família (Tesouro Direto, Poupança Itaú, etc.)
  let extraInvestmentsCents = 0;
  if (state.savingsAccounts) {
    ['tesouro_direto', 'poupanca_itau'].forEach(k => {
      const acc = state.savingsAccounts[k];
      if (acc) {
        const m = acc.monthlyData?.['2026-10'] || acc.monthlyData?.['2026-09'];
        const b = m?.balance !== undefined ? m.balance : (acc.balance || 0);
        extraInvestmentsCents += toCents(b);
      }
    });
  }

  const totalInvestedAllCents = caixaSavingsBalanceCents + extraInvestmentsCents;
  const patrimonioTotalCents = latestBankEnding + totalInvestedAllCents;
  const initialBaseStartBalanceCents = evolution[0]?.startBalanceCents || 0;

  return {
    evolution,
    totals: {
      initialBaseStartBalanceCents,
      totalIncomeCents,
      totalBankDebitCents,
      totalMonthlyNetCents,
      totalCardEveliCents,
      totalCardVitalCents,
      totalCardCents,
      totalInvoicePaidInBankCents,
      latestBankEndingCents: latestBankEnding,
      caixaSavingsBalanceCents,
      extraInvestmentsCents,
      totalInvestedAllCents,
      patrimonioTotalCents
    }
  };
}

// Obtém a posição consolidada de Poupanças e Investimentos para o período selecionado
function getInvestmentsDataForPeriod(period) {
  const p = (!period || period === 'ALL') ? '2026-10' : period;
  const accounts = (typeof state !== 'undefined' && state && state.savingsAccounts) ? state.savingsAccounts : {};
  let totalInvestedCents = 0;
  let totalEarningsCents = 0;
  const items = [];

  const accKeys = ['tesouro_direto', 'poupanca_itau', 'poupanca_caixa'];
  Object.keys(accounts).forEach(k => {
    if (!accKeys.includes(k)) accKeys.push(k);
  });

  accKeys.forEach(accId => {
    const acc = accounts[accId];
    if (!acc) return;
    const mData = acc.monthlyData?.[p] || acc.monthlyData?.['2026-10'] || acc.monthlyData?.['2026-09'] || {};
    const bal = mData.balance !== undefined ? mData.balance : (acc.balance !== undefined ? acc.balance : 0);
    const earn = mData.earnings !== undefined ? mData.earnings : 0;
    const balCents = toCents(bal);
    const earnCents = toCents(earn);

    totalInvestedCents += balCents;
    totalEarningsCents += earnCents;

    items.push({
      id: acc.id || accId,
      name: acc.name || accId,
      bank: acc.bank || '',
      type: acc.type || 'investment',
      notes: acc.notes || '',
      balance: bal,
      balanceCents: balCents,
      earnings: earn,
      earningsCents: earnCents,
      updatedAt: mData.updatedAt || 'Recente',
      screenshotUri: mData.screenshotUri || null
    });
  });

  return {
    period: p,
    totalInvestedCents,
    totalEarningsCents,
    items
  };
}
