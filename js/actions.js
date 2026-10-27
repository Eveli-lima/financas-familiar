// ============================================================================
// MÓDULO 6: CONTROLADORES DE AÇÕES DO USUÁRIO (CRUD, FILTROS, METAS E FATURAS)
// ============================================================================
// Por que este módulo existe?
// Reúne todas as funções disparadas por cliques do usuário (trocar abas,
// filtrar períodos, cadastrar/editar/excluir lançamentos, registrar pagamento
// de fatura e gerenciar metas e orçamentos).

function setActiveTab(tabName) {
  state.activeTab = tabName;
  saveState();
  renderAll();
}

function setPeriod(p) {
  state.selectedPeriod = p;
  const picker = document.getElementById('customPeriodPicker');
  if (picker && p !== 'ALL') picker.value = p;
  saveState();
  renderAll();
}

function setOwnerFilter(owner) {
  state.selectedOwner = owner;
  saveState();
  renderAll();
}

function setScopeFilter(scope) {
  state.selectedScope = scope;
  saveState();
  renderAll();
}

function toggleIncludeCardBill(checked) {
  state.includeCurrentCardBill = checked;
  saveState();
  renderAll();
}

function editPrevBalanceManual() {
  const p = state.selectedPeriod;
  const curInfo = getStartingBalanceForPeriod(p);
  const val = prompt(`Informe o Saldo Bancário Inicial da Conta Conjunta Itaú para (${formatPeriodLabel(p)}):`, curInfo.amount);
  if (val === null) return;
  const num = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
  if (!isNaN(num)) {
    state.periodStartingBalances[p] = {
      amount: fromCents(toCents(num)),
      label: `Ajustado manualmente (${formatPeriodLabel(p)})`,
      isManualOverride: true
    };
    saveState();
    renderAll();
  }
}

function editPoupancaCaixaBalanceManual() {
  if (!state.savingsAccounts) state.savingsAccounts = {};
  if (!state.savingsAccounts.poupanca_caixa) {
    state.savingsAccounts.poupanca_caixa = {
      id: 'poupanca_caixa',
      name: 'Poupança Caixa Econômica',
      bank: 'Caixa Econômica Federal',
      accountType: 'poupança',
      balance: 0,
      description: 'Reserva financeira e economias da família (separada da conta corrente)'
    };
  }
  const cur = state.savingsAccounts.poupanca_caixa.balance || 0;
  const val = prompt(
    `Informe o saldo atual guardado na Poupança da Caixa Econômica Federal (R$):\n(Este valor é sua reserva e NÃO mistura com o saldo do dia a dia do Itaú)`,
    cur > 0 ? cur.toFixed(2).replace('.', ',') : '0,00'
  );
  if (val === null) return;
  const num = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
  if (!isNaN(num) && num >= 0) {
    state.savingsAccounts.poupanca_caixa.balance = fromCents(toCents(num));
    saveState();
    renderAll();
    if (typeof alert === 'function') {
      alert(`✅ Saldo da Poupança Caixa atualizado para ${formatBRL(state.savingsAccounts.poupanca_caixa.balance)}!\n\nEle está 100% isolado da conta corrente do Itaú e somado no Patrimônio Total da família.`);
    }
  }
}

function editCardLimitOrInvoice(cardId) {
  openCardSettingsModal(cardId);
}

function openCardSettingsModal(cardId) {
  if (!state.cardsConfig) state.cardsConfig = {};
  if (!state.cardsConfig[cardId]) {
    state.cardsConfig[cardId] = cardId === 'card_eveli_5544'
      ? { id: 'card_eveli_5544', name: 'Cartão MC Gold 5544', holder: 'Éveli', limit: 7740, closingDay: 14, dueDay: 21, officialInvoiceTotals: {} }
      : { id: 'card_marido', name: 'Cartão Vital', holder: 'Vital', limit: 6000, closingDay: 10, dueDay: 17, officialInvoiceTotals: {} };
  }
  const card = state.cardsConfig[cardId];
  const p = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;

  const modal = document.getElementById('cardSettingsModal');
  if (!modal) return;

  document.getElementById('cardModalId').value = cardId;
  document.getElementById('cardModalHolderBadge').textContent = `Titular: ${card.holder || (cardId === 'card_marido' ? 'Vital' : 'Éveli')}`;
  document.getElementById('cardModalNameInput').value = card.name || '';
  document.getElementById('cardModalLimitInput').value = card.limit || 0;
  document.getElementById('cardModalClosingInput').value = card.closingDay || 14;
  document.getElementById('cardModalDueInput').value = card.dueDay || 21;
  document.getElementById('cardModalPeriodLabel').textContent = formatPeriodLabel(p);

  const curOfficial = (card.officialInvoiceTotals && card.officialInvoiceTotals[p] !== undefined)
    ? card.officialInvoiceTotals[p]
    : '';
  document.getElementById('cardModalOfficialInvoiceInput').value = curOfficial;

  modal.classList.remove('hidden');
}

function closeCardSettingsModal() {
  const modal = document.getElementById('cardSettingsModal');
  if (modal) modal.classList.add('hidden');
}

function saveCardSettingsModal() {
  const cardId = document.getElementById('cardModalId').value;
  if (!state.cardsConfig || !state.cardsConfig[cardId]) return;
  const card = state.cardsConfig[cardId];
  const p = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;

  const nameVal = (document.getElementById('cardModalNameInput').value || '').trim();
  const limitVal = parseFloat(document.getElementById('cardModalLimitInput').value);
  const closingVal = parseInt(document.getElementById('cardModalClosingInput').value, 10);
  const dueVal = parseInt(document.getElementById('cardModalDueInput').value, 10);
  const officialRaw = (document.getElementById('cardModalOfficialInvoiceInput').value || '').trim();

  if (nameVal) card.name = nameVal;
  if (!isNaN(limitVal) && limitVal >= 0) card.limit = fromCents(toCents(limitVal));
  if (!isNaN(closingVal) && closingVal >= 1 && closingVal <= 31) card.closingDay = closingVal;
  if (!isNaN(dueVal) && dueVal >= 1 && dueVal <= 31) card.dueDay = dueVal;

  if (!card.officialInvoiceTotals) card.officialInvoiceTotals = {};
  if (officialRaw === '') {
    delete card.officialInvoiceTotals[p];
  } else {
    const invNum = parseFloat(officialRaw.replace(',', '.'));
    if (!isNaN(invNum) && invNum >= 0) {
      card.officialInvoiceTotals[p] = fromCents(toCents(invNum));
    }
  }

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Configuração de Cartão', `${card.name} atualizado (Limite: ${formatBRL(card.limit)})`);
  }

  closeCardSettingsModal();
  saveState();
  renderAll();
}

function registerCardInvoicePayment(cardId) {
  const card = state.cardsConfig[cardId];
  const p = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;
  if (!card) return;

  let cardCents = 0;
  state.transactions.forEach(t => {
    if (t.period === p && t.accountId === cardId && t.type === 'card') {
      if (t.kind === 'reimbursement') cardCents -= toCents(t.amount);
      else cardCents += toCents(t.amount);
    }
  });

  const suggestedAmount = fromCents(cardCents);
  if (suggestedAmount <= 0) {
    alert(`Não há compras registradas neste cartão em ${formatPeriodLabel(p)}.`);
    return;
  }

  const alreadyPaid = state.transactions.some(
    t => t.period === p && t.kind === 'invoice_payment' && t.desc.toUpperCase().includes(card.holder.toUpperCase())
  );
  if (alreadyPaid) {
    if (!confirm(`Já existe um pagamento de fatura registrado para ${card.holder} em ${formatPeriodLabel(p)}. Deseja registrar outro mesmo assim?`)) {
      return;
    }
  }

  const confirmVal = prompt(
    `Registrar pagamento da fatura do ${card.name} saindo da Conta Conjunta Itaú em ${formatPeriodLabel(p)}?\n\n(Isso reduzirá o saldo da Conta Corrente, mas NÃO duplicará suas compras nas categorias de orçamento!)\n\nConfirme o valor pago (R$):`,
    suggestedAmount
  );
  if (confirmVal === null) return;
  const paidNum = parseFloat(String(confirmVal).replace(/\./g, '').replace(',', '.'));
  if (isNaN(paidNum) || paidNum <= 0) return;

  const dueDay = String(card.dueDay || 21).padStart(2, '0');
  const [yyyy, mm] = p.split('-');

  state.transactions.unshift({
    id: 'inv_pay_' + Date.now(),
    owner: card.holder,
    source: 'Conta Conjunta Itaú',
    accountId: 'cc_itau_conjunta',
    paidCardId: cardId,
    period: p,
    date: `${dueDay}/${mm}/${yyyy}`,
    type: 'debit',
    kind: 'invoice_payment',
    scope: 'shared',
    category: 'Faturas Antigas Pagas',
    desc: `PAGTO FATURA ${card.name.toUpperCase()} (${card.holder})`,
    amount: fromCents(toCents(paidNum)),
    createdBy: typeof getLoggedPerson === 'function' ? getLoggedPerson() : card.holder
  });

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Pagamento de Fatura', `Fatura ${card.name} paga pela Conta Conjunta (${formatBRL(paidNum)})`);
  }

  state.includeCurrentCardBill = false;
  saveState();
  renderAll();
}

// METAS E RESERVAS FUTURAS
function addFutureGoal() {
  const name = document.getElementById('goalNameInput')?.value?.trim();
  const total = parseFloat(document.getElementById('goalTotalInput')?.value);
  const saved = parseFloat(document.getElementById('goalSavedInput')?.value) || 0;
  const months = parseInt(document.getElementById('goalMonthsInput')?.value, 10);

  if (!name || isNaN(total) || total <= 0 || isNaN(months) || months < 1) {
    alert('Informe o nome da meta, o valor total e o prazo em meses.');
    return;
  }

  if (!Array.isArray(state.futureGoals)) state.futureGoals = [];

  const initialSaved = fromCents(toCents(Math.min(total, Math.max(0, saved))));
  const remaining = Math.max(0, total - initialSaved);
  const monthlySuggested = months > 0 ? (remaining / months) : 0;

  state.futureGoals.push({
    id: 'g_' + Date.now(),
    name,
    totalAmount: fromCents(toCents(total)),
    savedAmount: initialSaved,
    remainingMonths: months,
    postponedCount: 0,
    lastActionNote: `Meta criada: ${months}x de ${formatBRL(monthlySuggested)}`
  });

  if (document.getElementById('goalNameInput')) document.getElementById('goalNameInput').value = '';
  if (document.getElementById('goalTotalInput')) document.getElementById('goalTotalInput').value = '';
  if (document.getElementById('goalSavedInput')) document.getElementById('goalSavedInput').value = '';
  saveState();
  renderAll();
}

function openEditGoalModal(goalId) {
  const goal = (state.futureGoals || []).find(g => g.id === goalId);
  if (!goal) return;
  const modal = document.getElementById('editGoalModal');
  if (!modal) return;
  document.getElementById('editGoalId').value = goal.id;
  document.getElementById('editGoalName').value = goal.name;
  document.getElementById('editGoalTotal').value = goal.totalAmount;
  document.getElementById('editGoalSaved').value = goal.savedAmount || 0;
  document.getElementById('editGoalMonths').value = goal.remainingMonths;
  modal.classList.remove('hidden');
}

function closeEditGoalModal() {
  const modal = document.getElementById('editGoalModal');
  if (modal) modal.classList.add('hidden');
}

function saveEditGoal() {
  const id = document.getElementById('editGoalId')?.value;
  const goal = (state.futureGoals || []).find(g => g.id === id);
  if (!goal) return;

  const name = document.getElementById('editGoalName')?.value?.trim();
  const total = parseFloat(document.getElementById('editGoalTotal')?.value);
  const saved = parseFloat(document.getElementById('editGoalSaved')?.value) || 0;
  const months = parseInt(document.getElementById('editGoalMonths')?.value, 10);

  if (!name || isNaN(total) || total <= 0 || isNaN(months) || months < 0) {
    alert('Preencha os campos com valores válidos.');
    return;
  }

  goal.name = name;
  goal.totalAmount = fromCents(toCents(total));
  goal.savedAmount = fromCents(toCents(Math.min(total, Math.max(0, saved))));
  goal.remainingMonths = months;
  goal.lastActionNote = `Meta editada em ${new Date().toLocaleDateString('pt-BR')}`;

  saveState();
  renderAll();
  closeEditGoalModal();
}

function transferGoalMonthlyAmount(goalId) {
  const goal = state.futureGoals.find(g => g.id === goalId);
  if (!goal) return;

  const remCents = Math.max(0, toCents(goal.totalAmount) - toCents(goal.savedAmount));
  if (remCents <= 0 || goal.remainingMonths <= 0) {
    alert('Parabéns! Este objetivo já foi 100% concluído!');
    return;
  }

  const targetPeriod = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;

  const alreadyTransferredThisMonth = state.transactions.some(
    t => t.goalId === goalId && t.period === targetPeriod
  );
  if (alreadyTransferredThisMonth) {
    if (!confirm(`Você já separou a parcela desta meta em ${formatPeriodLabel(targetPeriod)}. Deseja separar mais uma parcela neste mesmo mês?`)) {
      return;
    }
  }

  const parcelCents = Math.round(remCents / goal.remainingMonths);
  const parcelAmount = fromCents(parcelCents);

  goal.savedAmount = fromCents(Math.min(toCents(goal.totalAmount), toCents(goal.savedAmount) + parcelCents));
  goal.remainingMonths = Math.max(0, goal.remainingMonths - 1);
  goal.lastActionNote = `✅ Guardou ${formatBRL(parcelAmount)} em ${formatPeriodLabel(targetPeriod)}!`;

  const [yyyy, mm] = targetPeriod.split('-');
  state.transactions.unshift({
    id: 'goal_tx_' + Date.now(),
    goalId: goal.id,
    owner: state.selectedOwner === 'ALL' ? 'Éveli' : state.selectedOwner,
    source: 'Reserva p/ Meta',
    accountId: 'cc_itau_conjunta',
    period: targetPeriod,
    date: `15/${mm}/${yyyy}`,
    type: 'debit',
    kind: 'transfer',
    scope: 'shared',
    category: 'Reserva p/ Meta',
    desc: `🎯 Guardado p/ Meta: ${goal.name}`,
    amount: parcelAmount
  });

  saveState();
  renderAll();
}

function postponeGoalMonth(goalId) {
  const goal = state.futureGoals.find(g => g.id === goalId);
  if (!goal) return;

  const rem = Math.max(0, goal.totalAmount - goal.savedAmount);
  if (rem <= 0) return;

  goal.remainingMonths += 1;
  goal.postponedCount = (goal.postponedCount || 0) + 1;
  const newParcel = rem / goal.remainingMonths;
  goal.lastActionNote = `⏳ Adiado +1 mês! Novo prazo: ${goal.remainingMonths} meses (${formatBRL(newParcel)}/mês).`;

  saveState();
  renderAll();
}

function deleteFutureGoal(goalId) {
  if (!confirm('Deseja excluir esta meta futura?')) return;
  state.futureGoals = state.futureGoals.filter(g => g.id !== goalId);
  saveState();
  renderAll();
}

// CADASTRO MANUAL, EDIÇÃO E EXCLUSÃO DE LANÇAMENTOS
function syncAccountDefaultByOwner() {
  const owner = document.getElementById('txOwnerInput').value;
  const accSelect = document.getElementById('txAccountInput');
  if ((owner === 'Vital' || owner === 'Marido') && accSelect.value === 'card_eveli_5544') {
    accSelect.value = 'card_marido';
  } else if (owner === 'Éveli' && accSelect.value === 'card_marido') {
    accSelect.value = 'card_eveli_5544';
  }
}

function toggleBankCategoryByType() {
  const kind = document.getElementById('bankTxKindInput')?.value;
  const catSelect = document.getElementById('bankTxCategoryInput');
  if (!catSelect) return;

  if (kind === 'income') {
    catSelect.innerHTML = `
      <option value="Receita">💰 Salário / Receita (+)</option>
      <option value="Rendimento Poupança/Investimento">📈 Rendimentos (+)</option>
      <option value="Reembolso">🔄 Reembolso / Estorno (+)</option>
      <option value="Outras Entradas">📥 Outras Entradas (+)</option>
    `;
  } else if (kind === 'invoice_payment') {
    catSelect.innerHTML = `<option value="Faturas Antigas Pagas">🧾 Pagamento de Fatura de Cartão</option>`;
  } else if (kind === 'transfer') {
    catSelect.innerHTML = `
      <option value="Reserva p/ Meta">🎯 Reserva / Caixinha</option>
      <option value="Aporte Poupança">🏦 Aporte na Poupança Caixa</option>
      <option value="Transferência entre o Casal">🔁 Transferência entre o Casal</option>
    `;
  } else {
    catSelect.innerHTML = `
      <option value="Casa, Serviços & Outros">🏠 Moradia, Aluguel & Condomínio</option>
      <option value="Contas de Consumo">💡 Água, Luz, Gás & Internet</option>
      <option value="Mercado & Hortifruti">🛒 Supermercado & Feira</option>
      <option value="Saúde, Farmácia & Academia">💊 Saúde & Farmácia</option>
      <option value="Auto Escola & Detran">🚗 Transporte, Combustível & Carro</option>
      <option value="Lanches & Restaurantes">🍔 Restaurantes & Alimentação</option>
      <option value="Despesas Diversas">📦 Outras Despesas</option>
    `;
  }
}

function addBankTransaction() {
  const owner = document.getElementById('bankTxOwnerInput')?.value || 'Éveli';
  const kind = document.getElementById('bankTxKindInput')?.value || 'expense';
  const scope = document.getElementById('bankTxScopeInput')?.value || 'shared';
  const rawDate = document.getElementById('bankTxDateInput')?.value;
  const category = document.getElementById('bankTxCategoryInput')?.value || 'Casa, Serviços & Outros';
  const rawDesc = document.getElementById('bankTxDescInput')?.value?.trim() || category;
  const amount = parseFloat(document.getElementById('bankTxAmountInput')?.value);

  if (isNaN(amount) || amount <= 0) {
    alert('Digite um valor válido maior que zero.');
    return;
  }

  let formattedDate = '15/10/2026';
  let basePeriod = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-');
    formattedDate = `${d}/${m}/${y}`;
    basePeriod = `${y}-${m}`;
  }
  const period = typeof normalizePeriodByDate === 'function'
    ? normalizePeriodByDate(formattedDate, 'cc_itau_conjunta', basePeriod)
    : basePeriod;

  const legacyType = (kind === 'income' || kind === 'reimbursement') ? 'income' : 'debit';
  const cleanAmount = fromCents(toCents(amount));

  state.transactions.unshift({
    id: 'bank_' + Date.now(),
    owner: 'Casal',
    source: 'Conta Conjunta Itaú',
    accountId: 'cc_itau_conjunta',
    period,
    date: formattedDate,
    type: legacyType,
    kind,
    scope: 'shared',
    category,
    desc: rawDesc,
    amount: cleanAmount,
    createdBy: typeof getLoggedPerson === 'function' ? getLoggedPerson() : owner
  });

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Lançamento Bancário', `${rawDesc} (${formatBRL(cleanAmount)})`);
  }

  const descEl = document.getElementById('bankTxDescInput');
  const amtEl = document.getElementById('bankTxAmountInput');
  if (descEl) descEl.value = '';
  if (amtEl) amtEl.value = '';

  saveState();
  renderAll();
}

function addCardTransaction() {
  const accountId = document.getElementById('cardTxAccountInput')?.value || 'card_eveli_5544';
  const owner = accountId === 'card_marido' ? 'Vital' : 'Éveli';
  const scope = document.getElementById('cardTxScopeInput')?.value || 'shared';
  const rawDate = document.getElementById('cardTxDateInput')?.value;
  const category = document.getElementById('cardTxCategoryInput')?.value || 'Lanches & Restaurantes';
  const rawDesc = document.getElementById('cardTxDescInput')?.value?.trim() || category;
  const installmentsCount = Math.max(1, parseInt(document.getElementById('cardTxInstallmentsInput')?.value, 10) || 1);
  const amount = parseFloat(document.getElementById('cardTxAmountInput')?.value);

  if (isNaN(amount) || amount <= 0) {
    alert('Digite um valor de compra válido maior que zero.');
    return;
  }

  let formattedDate = '15/10/2026';
  let basePeriod = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-');
    formattedDate = `${d}/${m}/${y}`;
    if (state.selectedPeriod === 'ALL') basePeriod = `${y}-${m}`;
  }

  const sourceLabel = accountId === 'card_marido' ? 'Cartão Vital' : 'Cartão MC Gold 5544';
  const cleanAmount = fromCents(toCents(amount));
  const baseId = 'card_tx_' + Date.now();

  for (let i = 1; i <= installmentsCount; i++) {
    const targetP = addMonthsToPeriod(basePeriod, i - 1);
    const instSuffix = installmentsCount > 1
      ? ` ${String(i).padStart(2, '0')}/${String(installmentsCount).padStart(2, '0')}`
      : '';
    state.transactions.unshift({
      id: i === 1 ? baseId : `${baseId}_inst_${i}`,
      parentInstallmentId: installmentsCount > 1 ? baseId : null,
      owner,
      source: sourceLabel,
      accountId,
      period: targetP,
      date: formattedDate,
      type: 'card',
      kind: 'expense',
      scope,
      category,
      installmentCurrent: installmentsCount > 1 ? i : null,
      installmentTotal: installmentsCount > 1 ? installmentsCount : null,
      desc: rawDesc + instSuffix,
      amount: cleanAmount,
      createdBy: typeof getLoggedPerson === 'function' ? getLoggedPerson() : owner
    });
  }

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Compra no Cartão', `${rawDesc} (${formatBRL(cleanAmount)}${installmentsCount > 1 ? ` em ${installmentsCount}x` : ''})`);
  }

  const descEl = document.getElementById('cardTxDescInput');
  const amtEl = document.getElementById('cardTxAmountInput');
  const instEl = document.getElementById('cardTxInstallmentsInput');
  if (descEl) descEl.value = '';
  if (amtEl) amtEl.value = '';
  if (instEl) instEl.value = '1';

  saveState();
  renderAll();
}

function toggleCategoryByType() {
  const kind = document.getElementById('txKindInput').value;
  const accSelect = document.getElementById('txAccountInput');
  const catSelect = document.getElementById('txCategoryInput');

  if ((kind === 'income' || kind === 'invoice_payment' || kind === 'transfer') &&
      (accSelect.value === 'card_eveli_5544' || accSelect.value === 'card_marido')) {
    accSelect.value = 'cc_itau_conjunta';
  }

  if (kind === 'income') {
    catSelect.innerHTML = `<option value="Receita">💰 Receita / Salário / Rendimento (+)</option>`;
  } else if (kind === 'invoice_payment') {
    catSelect.innerHTML = `<option value="Faturas Antigas Pagas">🧾 Pagamento de Fatura de Cartão</option>`;
  } else if (kind === 'transfer') {
    catSelect.innerHTML = `
      <option value="Receita">🔁 Aporte / Transferência entre o Casal</option>
      <option value="Reserva p/ Meta">🎯 Reserva / Caixinha</option>
    `;
  } else {
    catSelect.innerHTML = `
      <option value="Lanches & Restaurantes">🍔 Lanches & Restaurantes</option>
      <option value="Mercado & Hortifruti">🛒 Mercado & Hortifruti</option>
      <option value="Uber & Transporte">🚕 Uber & Transporte</option>
      <option value="Saúde, Farmácia & Academia">💊 Saúde, Farmácia & Academia</option>
      <option value="Auto Escola & Detran">🚗 Auto Escola & Detran</option>
      <option value="Casa, Serviços & Outros">🏠 Casa, Serviços & Outros</option>
      <option value="Parcelamentos Cartão">📦 Parcelamentos Cartão</option>
    `;
  }
}

function addManualTransaction() {
  const owner = document.getElementById('txOwnerInput').value;
  const accountId = document.getElementById('txAccountInput').value;
  const kind = document.getElementById('txKindInput').value;
  const scope = document.getElementById('txScopeInput').value;
  const rawDate = document.getElementById('txDateInput').value;
  const category = document.getElementById('txCategoryInput').value;
  const rawDesc = document.getElementById('txDescInput').value.trim() || category;
  const installmentsCount = Math.max(1, parseInt(document.getElementById('txInstallmentsInput').value, 10) || 1);
  const amount = parseFloat(document.getElementById('txAmountInput').value);

  if (isNaN(amount) || amount <= 0) {
    alert('Digite um valor válido maior que zero.');
    return;
  }

  let formattedDate = '15/10/2026';
  let basePeriod = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-');
    formattedDate = `${d}/${m}/${y}`;
    if (state.selectedPeriod === 'ALL') basePeriod = `${y}-${m}`;
  }

  const isCard = accountId === 'card_eveli_5544' || accountId === 'card_marido';
  const isSavings = accountId === 'poupanca_caixa';
  const sourceLabel = isSavings
    ? 'Poupança Caixa Econômica'
    : (accountId === 'cc_itau_conjunta'
      ? 'Conta Conjunta Itaú'
      : (accountId === 'card_eveli_5544' ? 'Cartão MC Gold' : 'Cartão Vital'));

  const legacyType = (kind === 'income' || (kind === 'reimbursement' && !isCard))
    ? 'income'
    : (isCard ? 'card' : 'debit');

  const cleanAmount = fromCents(toCents(amount));
  const baseId = 'm_' + Date.now();

  for (let i = 1; i <= installmentsCount; i++) {
    const targetP = addMonthsToPeriod(basePeriod, i - 1);
    const instSuffix = installmentsCount > 1
      ? ` ${String(i).padStart(2, '0')}/${String(installmentsCount).padStart(2, '0')}`
      : '';
    state.transactions.unshift({
      id: i === 1 ? baseId : `${baseId}_inst_${i}`,
      parentInstallmentId: installmentsCount > 1 ? baseId : null,
      owner,
      source: sourceLabel,
      accountId,
      period: targetP,
      date: formattedDate,
      type: legacyType,
      kind,
      scope,
      category,
      installmentCurrent: installmentsCount > 1 ? i : null,
      installmentTotal: installmentsCount > 1 ? installmentsCount : null,
      desc: rawDesc + instSuffix,
      amount: cleanAmount,
      createdBy: typeof getLoggedPerson === 'function' ? getLoggedPerson() : owner
    });
  }

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Novo Lançamento', `${rawDesc} (${formatBRL(cleanAmount)}${installmentsCount > 1 ? ` em ${installmentsCount}x` : ''})`);
  }

  document.getElementById('txDescInput').value = '';
  document.getElementById('txAmountInput').value = '';
  document.getElementById('txInstallmentsInput').value = '1';
  saveState();
  renderAll();
}

function openEditTxModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  document.getElementById('editTxId').value = tx.id;
  document.getElementById('editTxOwner').value = tx.owner || 'Éveli';
  document.getElementById('editTxScope').value = tx.scope || 'shared';
  document.getElementById('editTxAccount').value = tx.accountId || (tx.type === 'card' ? 'card_eveli_5544' : 'cc_itau_conjunta');
  document.getElementById('editTxKind').value = tx.kind || (tx.type === 'income' ? 'income' : 'expense');
  document.getElementById('editTxDate').value = tx.date || '';
  document.getElementById('editTxPeriod').value = tx.period || '2026-10';
  document.getElementById('editTxCategory').value = tx.category || 'Casa, Serviços & Outros';
  document.getElementById('editTxAmount').value = tx.amount;
  document.getElementById('editTxDesc').value = tx.desc || '';
  document.getElementById('editTxInstCur').value = tx.installmentCurrent || '';
  document.getElementById('editTxInstTot').value = tx.installmentTotal || '';
  document.getElementById('editTxModal').classList.remove('hidden');
}

function closeEditTxModal() {
  document.getElementById('editTxModal').classList.add('hidden');
}

function saveEditedTransaction() {
  const id = document.getElementById('editTxId').value;
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  const amount = parseFloat(document.getElementById('editTxAmount').value);
  if (isNaN(amount) || amount <= 0) {
    alert('Informe um valor válido.');
    return;
  }

  const accountId = document.getElementById('editTxAccount').value;
  const kind = document.getElementById('editTxKind').value;
  const isCard = accountId === 'card_eveli_5544' || accountId === 'card_marido';
  const isSavings = accountId === 'poupanca_caixa';

  tx.owner = document.getElementById('editTxOwner').value;
  tx.scope = document.getElementById('editTxScope').value;
  tx.accountId = accountId;
  tx.source = isSavings
    ? 'Poupança Caixa Econômica'
    : (accountId === 'cc_itau_conjunta'
      ? 'Conta Conjunta Itaú'
      : (accountId === 'card_eveli_5544' ? 'Cartão MC Gold' : 'Cartão Vital'));
  tx.kind = kind;
  tx.type = (kind === 'income' || (kind === 'reimbursement' && !isCard)) ? 'income' : (isCard ? 'card' : 'debit');
  tx.date = document.getElementById('editTxDate').value.trim();
  tx.period = document.getElementById('editTxPeriod').value.trim();
  tx.category = document.getElementById('editTxCategory').value;
  tx.amount = fromCents(toCents(amount));
  tx.desc = document.getElementById('editTxDesc').value.trim();

  const instCur = parseInt(document.getElementById('editTxInstCur').value, 10);
  const instTot = parseInt(document.getElementById('editTxInstTot').value, 10);
  tx.installmentCurrent = (!isNaN(instCur) && instCur >= 1) ? instCur : null;
  tx.installmentTotal = (!isNaN(instTot) && instTot >= 2) ? instTot : null;
  tx.updatedBy = typeof getLoggedPerson === 'function' ? getLoggedPerson() : tx.owner;

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Edição de Lançamento', `${tx.desc} (${formatBRL(tx.amount)})`);
  }

  closeEditTxModal();
  saveState();
  renderAll();
}

function deleteTransaction(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  if (tx.goalId) {
    const goal = state.futureGoals.find(g => g.id === tx.goalId);
    if (goal) {
      goal.savedAmount = fromCents(Math.max(0, toCents(goal.savedAmount) - toCents(tx.amount)));
      goal.remainingMonths = (goal.remainingMonths || 0) + 1;
      goal.lastActionNote = `↩️ Reserva de ${formatBRL(tx.amount)} desfeita; prazo restaurado.`;
    }
  }

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Exclusão de Lançamento', `${tx.desc} (${formatBRL(tx.amount)})`);
  }

  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderAll();
}

function editCategoryBudget(cat) {
  const current = state.budgets[cat] || 300;
  const input = prompt(`Definir meta mensal da família para "${cat}" (R$):`, current);
  if (input === null) return;
  const val = parseFloat(String(input).replace(',', '.'));
  if (!isNaN(val) && val >= 0) {
    state.budgets[cat] = fromCents(toCents(val));
    saveState();
    renderAll();
  }
}

const STANDARD_EXPENSE_CATEGORIES = [
  'Lanches & Restaurantes',
  'Mercado & Hortifruti',
  'Uber & Transporte',
  'Parcelamentos Cartão',
  'Saúde, Farmácia & Academia',
  'Auto Escola & Detran',
  'Casa, Serviços & Outros',
  'Outros'
];

function getAllExpenseCategories() {
  const custom = (typeof state !== 'undefined' && Array.isArray(state.customCategories)) ? state.customCategories : [];
  const fromBudgets = (typeof state !== 'undefined' && state.budgets) ? Object.keys(state.budgets) : [];
  const fromTx = (typeof state !== 'undefined' && Array.isArray(state.transactions))
    ? state.transactions.map(t => t.category).filter(Boolean)
    : [];
  const fromDaily = (typeof state !== 'undefined' && Array.isArray(state.dailyExpenses))
    ? state.dailyExpenses.map(d => d.category).filter(Boolean)
    : [];

  const systemCats = new Set([
    'Receita',
    'Rendimento Poupança/Investimento',
    'Reembolso',
    'Faturas Antigas Pagas',
    'Reserva p/ Meta',
    'Aporte Poupança',
    'Transferência entre o Casal',
    '__NEW__'
  ]);

  const set = new Set();
  STANDARD_EXPENSE_CATEGORIES.forEach(c => set.add(c));
  custom.forEach(c => { if (c && !systemCats.has(c)) set.add(c); });
  fromBudgets.forEach(c => { if (c && !systemCats.has(c)) set.add(c); });
  fromTx.forEach(c => { if (c && !systemCats.has(c)) set.add(c); });
  fromDaily.forEach(c => { if (c && !systemCats.has(c)) set.add(c); });

  return Array.from(set);
}

function promptAddNewCategory(targetSelectId) {
  const name = prompt('Digite o nome da nova categoria (ex: Pet & Veterinário, Presentes, Estudos):');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  if (!Array.isArray(state.customCategories)) state.customCategories = [];
  if (!state.customCategories.includes(trimmed)) {
    state.customCategories.push(trimmed);
  }
  if (!state.budgets) state.budgets = {};
  if (state.budgets[trimmed] === undefined) {
    state.budgets[trimmed] = 300;
  }

  saveState();
  updateCategoryDropdowns(trimmed);
  renderAll();

  if (targetSelectId) {
    const sel = document.getElementById(targetSelectId);
    if (sel) sel.value = trimmed;
  }
}

function promptAddNewCategoryForBudget() {
  const name = prompt('Digite o nome da nova categoria de orçamento para a família:');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  const limitInput = prompt(`Qual o teto mensal (R$) sugerido para "${trimmed}"?`, '300');
  if (limitInput === null) return;
  const limitNum = parseFloat(String(limitInput).replace(',', '.')) || 300;

  if (!Array.isArray(state.customCategories)) state.customCategories = [];
  if (!state.customCategories.includes(trimmed)) {
    state.customCategories.push(trimmed);
  }
  if (!state.budgets) state.budgets = {};
  state.budgets[trimmed] = fromCents(toCents(limitNum));

  saveState();
  updateCategoryDropdowns();
  renderAll();
}

function handleCategorySelectChange(selectEl) {
  if (selectEl && selectEl.value === '__NEW__') {
    promptAddNewCategory(selectEl.id);
  }
}

function updateCategoryDropdowns(selectedVal) {
  const cats = getAllExpenseCategories();

  // 1. dailyCategory (Controle Diário)
  const dailyCat = document.getElementById('dailyCategory');
  if (dailyCat) {
    const cur = selectedVal || dailyCat.value || 'Outros';
    dailyCat.innerHTML = cats.map(c => `
      <option value="${escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${escapeHtml(c)}</option>
    `).join('') + `<option value="__NEW__">➕ Criar Nova Categoria...</option>`;
    if (cats.includes(cur)) dailyCat.value = cur;
  }

  // 2. editTxCategory (Modal de Edição)
  const editCat = document.getElementById('editTxCategory');
  if (editCat) {
    const cur = selectedVal || editCat.value;
    const baseHtml = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    editCat.innerHTML = `
      ${baseHtml}
      <option value="Receita">Receita</option>
      <option value="Faturas Antigas Pagas">Pagamento de Fatura</option>
      <option value="Reserva p/ Meta">Reserva p/ Meta</option>
      <option value="__NEW__">➕ Criar Nova Categoria...</option>
    `;
    if (cur) editCat.value = cur;
  }
}

// ============================================================================
// EDUCADORA FINANCEIRA IA (MODAL & CONSULTORIA PARA LEIGOS)
// ============================================================================
function openAiAdvisorModal() {
  const modal = document.getElementById('aiAdvisorModal');
  if (!modal) return;

  const p = state.selectedPeriod;
  const pTx = (state.transactions || []).filter(t => p === 'ALL' || t.period === p);
  const summary = calculatePeriodSummary(pTx, p);
  const radar = calculateInstallmentsRadar(pTx);

  const badgeEl = document.getElementById('aiAdvisorPeriodBadge');
  if (badgeEl) badgeEl.textContent = formatPeriodLabel(p);

  const quickEl = document.getElementById('aiAdvisorQuickSummary');
  if (quickEl) {
    const bankBal = summary.bankEndingBalanceCents;
    const cardsBal = summary.totalCardCents;
    const projBal = summary.projectedBalanceCents;

    quickEl.innerHTML = `
      <p>• <strong>Dinheiro no banco hoje:</strong> <span class="${bankBal >= 0 ? 'text-emerald-700' : 'text-rose-700'} font-bold">${formatCentsBRL(bankBal)}</span>.</p>
      <p>• <strong>Compras nos cartões no período:</strong> <span class="text-sky-900 font-bold">${formatCentsBRL(cardsBal)}</span>.</p>
      <p>• <strong>Situação final prevista:</strong> ${projBal >= 0
        ? `<span class="text-emerald-700 font-bold">Positiva (${formatCentsBRL(projBal)})!</span> O dinheiro cobre a conta e as faturas.`
        : `<span class="text-rose-700 font-bold">Faltam ${formatCentsBRL(Math.abs(projBal))}</span> para cobrir todas as despesas e faturas do mês.`
      }</p>
    `;
  }

  // Renderiza FAQ explicativo
  const faqEl = document.getElementById('aiFaqContainer');
  if (faqEl && typeof FINANCIAL_COACH_FAQ !== 'undefined') {
    faqEl.innerHTML = FINANCIAL_COACH_FAQ.map((item, idx) => `
      <details class="bg-white rounded-xl border border-sky-100 p-3 text-xs group cursor-pointer">
        <summary class="font-bold text-slate-800 list-none flex items-center justify-between">
          <span>${escapeHtml(item.q)}</span>
          <span class="text-sky-600 font-bold group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div class="mt-2 text-slate-600 leading-relaxed pt-2 border-t border-sky-50">
          ${item.a}
        </div>
      </details>
    `).join('');
  }

  modal.classList.remove('hidden');
}

function closeAiAdvisorModal() {
  const modal = document.getElementById('aiAdvisorModal');
  if (modal) modal.classList.add('hidden');
}

function askCustomAiFinancialAdvice() {
  const input = document.getElementById('aiCustomQuestionInput');
  const box = document.getElementById('aiCustomResponseBox');
  if (!input || !box) return;

  const q = (input.value || '').trim().toLowerCase();
  if (!q) return;

  let answer = '';

  if (q.includes('cartao') || q.includes('cartão') || q.includes('fatura')) {
    answer = '<strong>Conselho da IA sobre Cartões:</strong><br>O cartão de crédito não é extensão do salário, é um empréstimo com prazo de 30 dias! Se a fatura estiver pesada, a prioridade máxima número 1 é <strong>pagar o valor total da fatura</strong> para não cair nos juros rotativos (que passam de 400% ao ano). Se faltar dinheiro, cortem gastos de lanche e lazer até a fatura desafogar!';
  } else if (q.includes('meta') || q.includes('guardar') || q.includes('economizar') || q.includes('poupar') || q.includes('investir')) {
    answer = '<strong>Conselho da IA para Guardar Dinheiro:</strong><br>Para quem está organizando a vida a dois, o primeiro passo é criar a <strong>Reserva de Emergência</strong> (o equivalente a 3 a 6 meses das despesas básicas da casa). Usem nossa aba <em>Orçamentos & Metas</em> para separar um valor fixo por mês logo que o dinheiro entrar na conta!';
  } else if (q.includes('mercado') || q.includes('lanche') || q.includes('comida') || q.includes('ifood') || q.includes('uber')) {
    answer = '<strong>Conselho da IA sobre Gastos do Dia a Dia:</strong><br>Esses são os famosos "gastos formiga"! Isoladamente R$ 30 parece pouco, mas 10 pedidos no mês viram R$ 300. A dica de ouro é: definam um "limite de lanches por semana" (ex: 1 vez na sexta-feira). No supermercado, nunca vão com fome e façam uma lista rígida antes de sair de casa!';
  } else if (q.includes('dividir') || q.includes('casal') || q.includes('marido') || q.includes('esposa') || q.includes('salario') || q.includes('salário')) {
    answer = '<strong>Conselho da IA para o Casal:</strong><br>O segredo de não brigar por dinheiro é a <strong>regra 50-30-20 adaptada</strong>: 50% da renda conjunta para necessidades da casa (aluguel, mercado, luz), 30% para estilo de vida e pequenos gastos individuais, e 20% para o futuro da família (metas, viagens e reserva). Conversem sobre dinheiro como parceiros de um mesmo time!';
  } else {
    answer = `<strong>Dica da Educadora IA:</strong><br>O segredo de finanças saudáveis para vocês dois é manter a regra básica: <strong>Gastem sempre menos do que ganham</strong> e acompanhem os gastos toda semana. No sistema de vocês, fiquem sempre de olho no <em>Balanço Projetado</em> (Card 5 da Visão Geral) para garantir que ele fique azul e positivo!`;
  }

  box.innerHTML = `
    <div class="flex items-start gap-2.5">
      <span class="text-base shrink-0">✨</span>
      <div>${answer}</div>
    </div>
  `;
  box.classList.remove('hidden');
}

// ============================================================================
// CONTROLE DE POUPANÇAS E INVESTIMENTOS (POR IMAGEM / PRINT E POR ESCRITO)
// ============================================================================
let currentInvestmentScreenshotDataUri = null;

function openInvestmentImageModal(defaultAcc) {
  const modal = document.getElementById('investmentImageModal');
  if (!modal) return;
  const pSelect = document.getElementById('investmentImgPeriodSelect');
  if (pSelect) pSelect.value = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;
  applyInvestmentScreenshotPresets(pSelect?.value || '2026-10');
  modal.classList.remove('hidden');
}

function closeInvestmentImageModal() {
  const modal = document.getElementById('investmentImageModal');
  if (modal) modal.classList.add('hidden');
}

function handleInvestmentImageSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    currentInvestmentScreenshotDataUri = evt.target.result;
    const previewBox = document.getElementById('investmentImagePreviewBox');
    const previewImg = document.getElementById('investmentImagePreviewImg');
    if (previewBox && previewImg) {
      previewImg.src = currentInvestmentScreenshotDataUri;
      previewBox.classList.remove('hidden');
    }
  };
  reader.readAsDataURL(file);
}

function applyInvestmentScreenshotPresets(p) {
  const tBal = document.getElementById('imgTesouroBalanceInput');
  const tEarn = document.getElementById('imgTesouroEarningsInput');
  const pBal = document.getElementById('imgPoupItauBalanceInput');
  const pEarn = document.getElementById('imgPoupItauEarningsInput');
  const dInp = document.getElementById('imgDateInput');

  if (p === '2026-09') {
    if (tBal) tBal.value = '8198.11';
    if (tEarn) tEarn.value = '87.37';
    if (pBal) pBal.value = '13.36';
    if (pEarn) pEarn.value = '0.09';
    if (dInp) dInp.value = '30/09/2026';
  } else {
    if (tBal) tBal.value = '8260.70';
    if (tEarn) tEarn.value = '62.59';
    if (pBal) pBal.value = '13.45';
    if (pEarn) pEarn.value = '0.09';
    if (dInp) dInp.value = '22/10/2026';
  }
}

function saveInvestmentImageInfo() {
  const p = document.getElementById('investmentImgPeriodSelect')?.value || '2026-10';
  const tBal = parseFloat(document.getElementById('imgTesouroBalanceInput')?.value) || 0;
  const tEarn = parseFloat(document.getElementById('imgTesouroEarningsInput')?.value) || 0;
  const pBal = parseFloat(document.getElementById('imgPoupItauBalanceInput')?.value) || 0;
  const pEarn = parseFloat(document.getElementById('imgPoupItauEarningsInput')?.value) || 0;
  const dVal = document.getElementById('imgDateInput')?.value || (p === '2026-09' ? '30/09/2026' : '22/10/2026');

  if (!state.savingsAccounts) state.savingsAccounts = {};
  if (!state.savingsAccounts.tesouro_direto) {
    state.savingsAccounts.tesouro_direto = { id: 'tesouro_direto', name: 'Tesouro Direto', bank: 'Tesouro Nacional / Itaú Corretora', type: 'investment', monthlyData: {} };
  }
  if (!state.savingsAccounts.tesouro_direto.monthlyData) state.savingsAccounts.tesouro_direto.monthlyData = {};
  state.savingsAccounts.tesouro_direto.monthlyData[p] = {
    balance: fromCents(toCents(tBal)),
    earnings: fromCents(toCents(tEarn)),
    updatedAt: dVal,
    screenshotUri: currentInvestmentScreenshotDataUri
  };

  if (!state.savingsAccounts.poupanca_itau) {
    state.savingsAccounts.poupanca_itau = { id: 'poupanca_itau', name: 'Poupança Itaú', bank: 'Banco Itaú', type: 'savings', monthlyData: {} };
  }
  if (!state.savingsAccounts.poupanca_itau.monthlyData) state.savingsAccounts.poupanca_itau.monthlyData = {};
  state.savingsAccounts.poupanca_itau.monthlyData[p] = {
    balance: fromCents(toCents(pBal)),
    earnings: fromCents(toCents(pEarn)),
    updatedAt: dVal,
    screenshotUri: currentInvestmentScreenshotDataUri
  };

  saveState();
  renderAll();
  closeInvestmentImageModal();
  alert(`✅ Informações de Poupanças & Investimentos de ${formatPeriodLabel(p)} salvas com sucesso a partir da imagem!`);
}

function openInvestmentEditModal(accId) {
  const modal = document.getElementById('investmentEditModal');
  if (!modal) return;
  const accSel = document.getElementById('editInvestmentAccountSelect');
  if (accSel && accId) accSel.value = accId;
  const pSel = document.getElementById('editInvestmentPeriodSelect');
  if (pSel) pSel.value = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;
  loadCurrentInvestmentValuesForEdit();
  modal.classList.remove('hidden');
}

function closeInvestmentEditModal() {
  const modal = document.getElementById('investmentEditModal');
  if (modal) modal.classList.add('hidden');
}

function loadCurrentInvestmentValuesForEdit() {
  const accId = document.getElementById('editInvestmentAccountSelect')?.value || 'tesouro_direto';
  const p = document.getElementById('editInvestmentPeriodSelect')?.value || '2026-10';
  const acc = state.savingsAccounts?.[accId];
  const mData = acc?.monthlyData?.[p] || acc?.monthlyData?.['2026-10'] || acc?.monthlyData?.['2026-09'] || {};
  const bal = mData.balance !== undefined ? mData.balance : (acc?.balance || 0);
  const earn = mData.earnings !== undefined ? mData.earnings : 0;

  const bInp = document.getElementById('editInvestmentBalanceInput');
  const eInp = document.getElementById('editInvestmentEarningsInput');
  const dInp = document.getElementById('editInvestmentDateInput');

  if (bInp) bInp.value = bal;
  if (eInp) eInp.value = earn;
  if (dInp) dInp.value = mData.updatedAt || 'Hoje';
}

function saveInvestmentManualEdit() {
  const accId = document.getElementById('editInvestmentAccountSelect')?.value || 'tesouro_direto';
  const p = document.getElementById('editInvestmentPeriodSelect')?.value || '2026-10';
  const bal = parseFloat(document.getElementById('editInvestmentBalanceInput')?.value);
  const earn = parseFloat(document.getElementById('editInvestmentEarningsInput')?.value) || 0;
  const dVal = document.getElementById('editInvestmentDateInput')?.value || 'Hoje';

  if (isNaN(bal) || bal < 0) {
    alert('Digite um saldo válido.');
    return;
  }

  if (!state.savingsAccounts) state.savingsAccounts = {};
  if (!state.savingsAccounts[accId]) {
    state.savingsAccounts[accId] = { id: accId, name: accId, monthlyData: {} };
  }
  if (!state.savingsAccounts[accId].monthlyData) state.savingsAccounts[accId].monthlyData = {};
  state.savingsAccounts[accId].monthlyData[p] = {
    balance: fromCents(toCents(bal)),
    earnings: fromCents(toCents(earn)),
    updatedAt: dVal
  };
  if (accId === 'poupanca_caixa') {
    state.savingsAccounts.poupanca_caixa.balance = fromCents(toCents(bal));
  }

  saveState();
  renderAll();
  closeInvestmentEditModal();
  alert(`✅ Dados atualizados por escrito com sucesso!`);
}

// ============================================================================
// CONTROLE PESSOAL: GASTOS DIÁRIOS, FOTO DE NOTAS FISCAIS E CONCILIAÇÃO MENSAL
// ============================================================================

let tempReceiptBase64 = null;
let tempReceiptFileName = null;

function handleReceiptPhotoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  tempReceiptFileName = file.name || 'Nota_Fiscal.jpg';

  const reader = new FileReader();
  reader.onload = function(evt) {
    const rawData = evt.target.result;

    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressedUri = canvas.toDataURL('image/jpeg', 0.75);

      tempReceiptBase64 = compressedUri;
      const previewBox = document.getElementById('receiptPreviewBox');
      const previewImg = document.getElementById('receiptPreviewImg');
      if (previewBox && previewImg) {
        previewImg.src = compressedUri;
        previewBox.classList.remove('hidden');
      }

      const dateInp = document.getElementById('dailyDate');
      if (dateInp && !dateInp.value) {
        const today = new Date().toISOString().split('T')[0];
        dateInp.value = today;
      }
    };
    img.src = rawData;
  };
  reader.readAsDataURL(file);
}

function removeReceiptPhoto() {
  tempReceiptBase64 = null;
  tempReceiptFileName = null;
  const previewBox = document.getElementById('receiptPreviewBox');
  const previewImg = document.getElementById('receiptPreviewImg');
  const fileInput = document.getElementById('receiptFileInput');
  if (previewBox) previewBox.classList.add('hidden');
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
}

function saveDailyExpense(e) {
  if (e && e.preventDefault) e.preventDefault();

  const amountInp = document.getElementById('dailyAmount');
  const paymentMethodInp = document.getElementById('dailyPaymentMethod');
  const cardHolderInp = document.getElementById('dailyCardHolder');
  const directionInp = document.querySelector('input[name="dailyDirection"]:checked');
  const dateInp = document.getElementById('dailyDate');
  const descInp = document.getElementById('dailyDesc');
  const catInp = document.getElementById('dailyCategory');

  const amount = parseFloat(amountInp?.value);
  if (isNaN(amount) || amount <= 0) {
    alert('Por favor, informe um valor válido maior que zero.');
    amountInp?.focus();
    return;
  }

  const desc = (descInp?.value || '').trim();
  if (!desc) {
    alert('Por favor, digite a descrição do gasto.');
    descInp?.focus();
    return;
  }

  const rawDate = dateInp?.value || new Date().toISOString().split('T')[0];
  let formattedDate = rawDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const parts = rawDate.split('-');
    formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const period = typeof normalizePeriodByDate === 'function'
    ? normalizePeriodByDate(formattedDate, null, state.selectedPeriod)
    : (rawDate.slice(0, 7) || '2026-10');

  const paymentMethod = paymentMethodInp?.value || 'pix';
  const cardHolder = cardHolderInp?.value || 'Éveli';
  const direction = directionInp?.value === 'income' ? 'income' : 'expense';
  const category = catInp?.value || 'Outros';

  const dailyId = 'daily_' + Date.now();
  let fileId = null;

  if (tempReceiptBase64) {
    fileId = 'file_receipt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    if (!Array.isArray(state.uploadedFiles)) state.uploadedFiles = [];
    state.uploadedFiles.unshift({
      id: fileId,
      fileName: tempReceiptFileName || `Nota_${formattedDate.replace(/\//g, '-')}_${desc.slice(0, 20)}.jpg`,
      fileType: 'receipt_photo',
      fileSize: Math.round(tempReceiptBase64.length * 0.75),
      uploadedAt: new Date().toLocaleString('pt-BR'),
      period,
      targetAccount: 'daily_expenses',
      accountLabel: `Controle Diário (${paymentMethod === 'credit_card' ? 'Cartão ' + cardHolder : 'Pix/Débito'})`,
      itemCount: 1,
      totalAmount: amount,
      receiptImage: tempReceiptBase64,
      dailyExpenseId: dailyId,
      desc
    });
  }

  const newDaily = {
    id: dailyId,
    date: formattedDate,
    period,
    desc,
    amount: fromCents(toCents(amount)),
    direction,
    paymentMethod,
    cardHolder: paymentMethod === 'credit_card' ? cardHolder : undefined,
    category,
    receiptImage: tempReceiptBase64 || null,
    fileId,
    reconciled: false,
    reconciledAt: null,
    reconciledTxId: null
  };

  if (!Array.isArray(state.dailyExpenses)) state.dailyExpenses = [];
  state.dailyExpenses.unshift(newDaily);

  saveState();
  if (typeof renderAll === 'function') renderAll();

  if (amountInp) amountInp.value = '';
  if (descInp) descInp.value = '';
  removeReceiptPhoto();

  if (typeof alert === 'function') {
    alert(`✅ Lançamento de R$ ${amount.toFixed(2)} salvo no Controle Diário!`);
  }
}

function deleteDailyExpense(id) {
  if (typeof confirm === 'function' && !confirm('Deseja excluir este lançamento diário?')) return;
  const target = (state.dailyExpenses || []).find(d => d.id === id);
  if (target && target.fileId) {
    state.uploadedFiles = (state.uploadedFiles || []).filter(f => f.id !== target.fileId && f.dailyExpenseId !== id);
  }
  state.dailyExpenses = (state.dailyExpenses || []).filter(d => d.id !== id);
  saveState();
  if (typeof renderAll === 'function') renderAll();
}

function toggleManualDailyReconciliation(id) {
  const item = (state.dailyExpenses || []).find(d => d.id === id);
  if (!item) return;
  item.reconciled = !item.reconciled;
  item.reconciledAt = item.reconciled ? new Date().toLocaleDateString('pt-BR') : null;
  saveState();
  if (typeof renderAll === 'function') renderAll();
}

function viewReceiptModal(id) {
  const item = (state.dailyExpenses || []).find(d => d.id === id);
  if (!item || !item.receiptImage) return;

  const modal = document.getElementById('receiptViewerModal');
  const imgEl = document.getElementById('receiptViewerImg');
  const titleEl = document.getElementById('receiptViewerTitle');
  if (modal && imgEl) {
    imgEl.src = item.receiptImage;
    if (titleEl) titleEl.textContent = `Nota Fiscal: ${item.desc} (R$ ${item.amount.toFixed(2)})`;
    modal.classList.remove('hidden');
  }
}

function closeReceiptViewerModal() {
  const modal = document.getElementById('receiptViewerModal');
  if (modal) modal.classList.add('hidden');
}

function reconcileDailyExpensesWithBank(targetPeriod) {
  const p = targetPeriod || state.selectedPeriod || '2026-10';
  const dailyList = (state.dailyExpenses || []).filter(d => d.period === p);
  const txList = (state.transactions || []).filter(t => t.period === p);

  if (dailyList.length === 0) {
    alert(`Nenhum lançamento diário encontrado no mês ${formatPeriodLabel(p)} para conciliar.`);
    return;
  }

  let reconciledCount = 0;
  let alreadyReconciled = 0;
  let notFoundCount = 0;
  let cashCount = 0;

  const usedTxIds = new Set();

  dailyList.forEach(d => {
    if (d.reconciled) {
      alreadyReconciled++;
      if (d.reconciledTxId) usedTxIds.add(d.reconciledTxId);
      return;
    }

    if (d.paymentMethod === 'cash') {
      cashCount++;
      return;
    }

    const dCents = toCents(d.amount);

    const match = txList.find(t => {
      if (usedTxIds.has(t.id)) return false;
      const tCents = toCents(t.amount);
      if (Math.abs(tCents - dCents) > 5) return false;

      if (d.direction === 'expense') {
        const isExpense = t.type === 'debit' || t.type === 'card' || t.kind === 'expense' || t.kind === 'debit';
        if (!isExpense) return false;
      } else {
        const isIncome = t.type === 'income' || t.kind === 'income';
        if (!isIncome) return false;
      }

      if (d.paymentMethod === 'credit_card' && t.type !== 'card') return false;

      return true;
    });

    if (match) {
      d.reconciled = true;
      d.reconciledAt = new Date().toLocaleDateString('pt-BR');
      d.reconciledTxId = match.id;
      usedTxIds.add(match.id);
      reconciledCount++;
    } else {
      notFoundCount++;
    }
  });

  saveState();
  if (typeof renderAll === 'function') renderAll();

  if (typeof alert === 'function') {
    alert(
      `🔍 Resultado da Conciliação de ${formatPeriodLabel(p)}:\n\n` +
      `• ✅ ${reconciledCount} novo(s) gasto(s) conciliado(s) com sucesso no extrato/fatura!\n` +
      `• 🆗 ${alreadyReconciled} já estavam conciliados.\n` +
      `• 💵 ${cashCount} em Dinheiro Vivo (não aparecem no banco).\n` +
      `• 🟡 ${notFoundCount} pendente(s) não encontrado(s) no extrato.`
    );
  }
}

// ============================================================================
// CENTRAL DE CONCILIAÇÃO MENSAL (CONTROLE PESSOAL VS. BANCO & CARTÕES)
// ============================================================================

function openReconciliationModal(overridePeriod) {
  const p = (overridePeriod && overridePeriod !== 'ALL') ? overridePeriod : (state.selectedPeriod === 'ALL' ? '2026-10' : (state.selectedPeriod || '2026-10'));
  const modal = document.getElementById('reconciliationCenterModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const pSelect = document.getElementById('reconModalPeriodSelect');
  if (pSelect) pSelect.value = p;

  renderReconciliationModalContent(p);
}

function closeReconciliationModal() {
  const modal = document.getElementById('reconciliationCenterModal');
  if (modal) modal.classList.add('hidden');
}

function renderReconciliationModalContent(targetPeriod) {
  const p = (targetPeriod && targetPeriod !== 'ALL') ? targetPeriod : (state.selectedPeriod === 'ALL' ? '2026-10' : (state.selectedPeriod || '2026-10'));
  const container = document.getElementById('reconciliationModalBody');
  const badgeEl = document.getElementById('reconModalMonthBadge');
  const pSelect = document.getElementById('reconModalPeriodSelect');

  if (badgeEl) badgeEl.textContent = formatPeriodLabel(p);
  if (pSelect && pSelect.value !== p) pSelect.value = p;
  if (!container) return;

  // 1. Controle Pessoal não conciliado do mês
  const pendingDaily = (state.dailyExpenses || []).filter(d => d.period === p && !d.reconciled);

  // 2. Transações Oficiais do Banco (sem a quitação total da fatura) e dos Cartões não conciliadas
  const pendingTx = (state.transactions || []).filter(t => {
    if (t.period !== p) return false;
    if (t.kind === 'invoice_payment') return false; // EXCETO o pagamento total da fatura que debita na conta!
    if (t.reconciledWithDaily) return false;
    return true;
  });

  // 3. Busca pares compatíveis entre Controle Pessoal e Banco/Cartão
  const suggestedPairs = [];
  const matchedDailyIds = new Set();
  const matchedTxIds = new Set();

  pendingDaily.forEach(d => {
    if (d.paymentMethod === 'cash') return; // Dinheiro físico não passa pelo banco
    const dCents = toCents(d.amount);

    const match = pendingTx.find(t => {
      if (matchedTxIds.has(t.id)) return false;
      const tCents = toCents(t.amount);
      if (Math.abs(tCents - dCents) > 5) return false;

      if (d.direction === 'expense') {
        const isExp = t.type === 'debit' || t.type === 'card' || t.kind === 'expense' || t.kind === 'debit';
        if (!isExp) return false;
      } else {
        const isInc = t.type === 'income' || t.kind === 'income';
        if (!isInc) return false;
      }

      if (d.paymentMethod === 'credit_card' && t.type !== 'card') return false;
      if ((d.paymentMethod === 'pix' || d.paymentMethod === 'debit_card') && t.accountId !== 'cc_itau_conjunta') return false;

      return true;
    });

    if (match) {
      suggestedPairs.push({ daily: d, tx: match });
      matchedDailyIds.add(d.id);
      matchedTxIds.add(match.id);
    }
  });

  // 4. Lançamentos que NÃO foram conciliados
  const remainingDaily = pendingDaily.filter(d => !matchedDailyIds.has(d.id));
  const remainingTx = pendingTx.filter(t => !matchedTxIds.has(t.id));

  // 5. Histórico e Registro do Mês (se houver fechamento salvo)
  const snapshot = state.monthlySnapshots?.[p];
  const snapshotHtml = snapshot
    ? `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-base">🔒</span>
          <div>
            <strong class="text-emerald-950 font-bold">Mês Encerrado & Registro Histórico Salvo</strong>
            <p class="text-emerald-700 text-[11px]">Fechado em: ${snapshot.closedAt} • Saldo em Conta: ${formatCentsBRL(snapshot.bankEndingBalanceCents)}</p>
          </div>
        </div>
        <button onclick="saveMonthEndClosing('${p}')" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-xl transition">
          Atualizar Registro
        </button>
      </div>
    `
    : `
      <div class="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-base">📅</span>
          <div>
            <strong class="text-indigo-950 font-bold">Fechamento Mensal de ${formatPeriodLabel(p)}</strong>
            <p class="text-indigo-700 text-[11px]">Ao finalizar a conciliação, salve o registro histórico para guardar o histórico do mês.</p>
          </div>
        </div>
        <button onclick="saveMonthEndClosing('${p}')" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition">
          🔒 Encerrar Mês & Salvar Histórico
        </button>
      </div>
    `;

  // 6. Bloco de Pares Sugeridos com Checkbox [x]
  let pairsHtml = '';
  if (suggestedPairs.length > 0) {
    pairsHtml = `
      <div class="bg-sky-50/60 border border-sky-200 rounded-2xl p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-base">✨</span>
            <div>
              <h4 class="font-bold text-sm text-slate-900">${suggestedPairs.length} Par(es) Sugerido(s) Encontrados</h4>
              <p class="text-[11px] text-slate-500">Valor e tipo correspondentes entre o seu Controle Pessoal e o Banco/Cartão. Marque os quadradinhos para conciliar:</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="toggleAllReconCheckboxes(true)" class="text-[11px] text-sky-700 hover:underline font-semibold">Marcar Todos</button>
            <span class="text-slate-300">|</span>
            <button onclick="toggleAllReconCheckboxes(false)" class="text-[11px] text-slate-500 hover:underline">Desmarcar</button>
          </div>
        </div>

        <div class="space-y-2 max-h-[300px] overflow-y-auto custom-scroll pr-1">
          ${suggestedPairs.map((pair, idx) => {
            const d = pair.daily;
            const t = pair.tx;
            const sourceBadge = t.type === 'card'
              ? `<span class="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-semibold">💳 Cartão (${escapeHtml(t.owner)})</span>`
              : `<span class="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded font-semibold">🏦 Conta Itaú</span>`;

            return `
              <label class="flex items-center justify-between p-3 rounded-xl border border-sky-200 bg-white hover:bg-sky-50/70 transition cursor-pointer gap-3 text-xs">
                <div class="flex items-center gap-3 min-w-0">
                  <input type="checkbox" name="reconCheckPair" value="${d.id}|${t.id}" checked class="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer" />
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <strong class="text-slate-900 truncate">📝 ${escapeHtml(d.desc)}</strong>
                      <span class="text-slate-400">⟷</span>
                      <span class="text-slate-700 truncate">${sourceBadge} ${escapeHtml(t.desc)}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>Data Diário: ${escapeHtml(d.date)}</span>
                      <span>•</span>
                      <span>Data Banco/Cartão: ${escapeHtml(t.date)}</span>
                    </div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <strong class="text-sm font-bold text-slate-900">R$ ${d.amount.toFixed(2)}</strong>
                  <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded block mt-0.5">Valor Igual</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>

        <div class="mt-3 pt-3 border-t border-sky-200/80 flex items-center justify-between">
          <span class="text-xs text-slate-500">Ao confirmar, os itens ticados somem daqui e ficam apenas os pendentes.</span>
          <button onclick="confirmSelectedReconciliations('${p}')" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5">
            <span>✅</span>
            <span>Confirmar Conciliação dos Selecionados</span>
          </button>
        </div>
      </div>
    `;
  }

  // 7. Bloco em 2 Colunas dos Itens Pendentes (Não Conciliados)
  const remainingHtml = `
    <div>
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-bold text-xs uppercase tracking-wider text-slate-700">Lançamentos Ainda Não Conciliados (Pendentes no Mês)</h4>
        <span class="text-[11px] text-slate-500">${remainingDaily.length} no diário • ${remainingTx.length} no banco/cartão</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Coluna da Esquerda: Controle Pessoal Pendente -->
        <div class="bg-white border border-amber-200 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-amber-100">
              <span class="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                <span>📝</span>
                <span>Controle Pessoal (${remainingDaily.length})</span>
              </span>
              <span class="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-semibold">Sem Par no Extrato</span>
            </div>
            
            <div class="space-y-2 max-h-[320px] overflow-y-auto custom-scroll pr-1">
              ${remainingDaily.length === 0
                ? '<div class="p-4 text-center text-xs text-slate-400 italic">Todos os gastos diários foram conciliados!</div>'
                : remainingDaily.map(d => `
                  <div class="p-2.5 rounded-xl border border-amber-100 bg-amber-50/20 text-xs flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <strong class="text-slate-900 block truncate">${escapeHtml(d.desc)}</strong>
                      <span class="text-[10px] text-slate-500">${escapeHtml(d.date)} • ${escapeHtml(d.paymentMethod)}</span>
                    </div>
                    <div class="text-right shrink-0">
                      <strong class="font-bold text-slate-900 block">R$ ${d.amount.toFixed(2)}</strong>
                      <button onclick="toggleManualDailyReconciliation('${d.id}'); renderReconciliationModalContent('${p}');" class="text-[10px] text-emerald-700 hover:underline font-semibold">Conciliar Manual</button>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          </div>
          <p class="text-[11px] text-slate-400 pt-2 border-t border-slate-100 mt-2">Gastos em dinheiro vivo ou compras ainda não compensadas.</p>
        </div>

        <!-- Coluna da Direita: Extrato & Cartões Pendentes -->
        <div class="bg-white border border-sky-200 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-sky-100">
              <span class="font-bold text-xs text-sky-950 flex items-center gap-1.5">
                <span>🏦</span>
                <span>Extrato Itaú & Cartões (${remainingTx.length})</span>
              </span>
              <span class="text-[10px] bg-sky-50 text-sky-800 px-2 py-0.5 rounded font-semibold">Sem Par no Diário</span>
            </div>

            <div class="space-y-2 max-h-[320px] overflow-y-auto custom-scroll pr-1">
              ${remainingTx.length === 0
                ? '<div class="p-4 text-center text-xs text-slate-400 italic">Todos os lançamentos do banco e cartões estão conciliados!</div>'
                : remainingTx.map(t => {
                  const isCard = t.type === 'card';
                  const badge = isCard
                    ? `<span class="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Cartão ${escapeHtml(t.owner)}</span>`
                    : `<span class="text-[9px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded font-semibold">Conta Itaú</span>`;

                  return `
                    <div class="p-2.5 rounded-xl border border-sky-100 bg-sky-50/20 text-xs flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <strong class="text-slate-900 block truncate">${escapeHtml(t.desc)}</strong>
                        <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          ${badge}
                          <span>${escapeHtml(t.date)}</span>
                        </div>
                      </div>
                      <div class="text-right shrink-0">
                        <strong class="font-bold text-slate-900 block">R$ ${Math.abs(t.amount).toFixed(2)}</strong>
                        <button onclick="copyBankOrCardTxToDaily('${t.id}')" class="text-[10px] text-indigo-700 hover:underline font-semibold" title="Copiar para o controle diário e conciliar">➕ Copiar p/ Diário</button>
                      </div>
                    </div>
                  `;
                }).join('')
              }
            </div>
          </div>
          <p class="text-[11px] text-slate-400 pt-2 border-t border-slate-100 mt-2">Clique em "Copiar p/ Diário" para incluir lançamentos que você esqueceu de anotar.</p>
        </div>

      </div>
    </div>
  `;

  const allClear = suggestedPairs.length === 0 && remainingDaily.length === 0 && remainingTx.length === 0;
  const allClearHtml = allClear
    ? `
      <div class="p-8 text-center bg-emerald-50/80 border border-emerald-200 rounded-3xl">
        <span class="text-4xl block mb-2">🎉</span>
        <h4 class="font-bold text-base text-emerald-950">Conciliação 100% Concluída em ${formatPeriodLabel(p)}!</h4>
        <p class="text-xs text-emerald-800 mt-1">Todos os lançamentos do Controle Pessoal, da Conta Corrente Itaú e dos Cartões de Crédito estão perfeitamente conciliados.</p>
      </div>
    `
    : '';

  container.innerHTML = `
    <div class="space-y-4">
      ${snapshotHtml}
      ${allClearHtml}
      ${pairsHtml}
      ${allClear ? '' : remainingHtml}
    </div>
  `;
}

function toggleAllReconCheckboxes(check) {
  const checkboxes = document.querySelectorAll('input[name="reconCheckPair"]');
  checkboxes.forEach(cb => { cb.checked = !!check; });
}

function confirmSelectedReconciliations(p) {
  const checkboxes = document.querySelectorAll('input[name="reconCheckPair"]:checked');
  if (checkboxes.length === 0) {
    if (typeof alert === 'function') alert('Nenhum par marcado para conciliar.');
    return;
  }

  let count = 0;
  checkboxes.forEach(cb => {
    const parts = cb.value.split('|');
    const dailyId = parts[0];
    const txId = parts[1];

    const d = (state.dailyExpenses || []).find(x => x.id === dailyId);
    const t = (state.transactions || []).find(x => x.id === txId);
    if (d && t) {
      d.reconciled = true;
      d.reconciledAt = new Date().toLocaleDateString('pt-BR');
      d.reconciledTxId = t.id;
      t.reconciledWithDaily = true;
      t.reconciledDailyId = d.id;
      count++;
    }
  });

  saveState();
  if (typeof renderAll === 'function') renderAll();
  renderReconciliationModalContent(p);

  if (typeof alert === 'function') {
    alert(`✅ ${count} par(es) conciliado(s) com sucesso! Eles foram arquivados e agora ficam visíveis apenas os itens pendentes.`);
  }
}

function saveMonthEndClosing(p) {
  const targetP = (p && p !== 'ALL') ? p : (state.selectedPeriod === 'ALL' ? '2026-10' : (state.selectedPeriod || '2026-10'));
  if (!state.monthlySnapshots) state.monthlySnapshots = {};

  const dailyList = (state.dailyExpenses || []).filter(d => d.period === targetP);
  const reconDailyCount = dailyList.filter(d => d.reconciled).length;
  const pendingDailyCount = dailyList.length - reconDailyCount;

  const pTx = (state.transactions || []).filter(t => t.period === targetP);
  const sum = calculatePeriodSummary(pTx, targetP);

  state.monthlySnapshots[targetP] = {
    period: targetP,
    closedAt: new Date().toLocaleString('pt-BR'),
    dailyCount: dailyList.length,
    reconDailyCount,
    pendingDailyCount,
    bankEndingBalanceCents: sum.bankEndingBalanceCents,
    totalIncomeCents: sum.totalIncomeCents,
    totalBankDebitCents: sum.totalBankDebitCents,
    totalCardCents: sum.totalCardCents,
    projectedBalanceCents: sum.projectedBalanceCents
  };

  saveState();
  if (typeof renderAll === 'function') renderAll();
  renderReconciliationModalContent(targetP);

  if (typeof alert === 'function') {
    alert(`🔒 Mês de ${formatPeriodLabel(targetP)} encerrado e histórico mensal salvo com sucesso!\n\nEste registro oficial fica guardado para consultas e prestação de contas.`);
  }
}

function copyBankOrCardTxToDaily(txId) {
  const t = (state.transactions || []).find(x => x.id === txId);
  if (!t) return;

  const isCard = t.type === 'card';
  const method = isCard ? 'credit_card' : 'debit_card';
  const holder = t.owner === 'Vital' ? 'Vital' : 'Éveli';
  const direction = (t.type === 'income' || t.kind === 'income') ? 'income' : 'expense';

  const newDaily = {
    id: 'daily_' + Date.now(),
    date: t.date || new Date().toLocaleDateString('pt-BR'),
    period: t.period,
    desc: t.desc,
    amount: Math.abs(t.amount),
    direction,
    paymentMethod: method,
    cardHolder: isCard ? holder : undefined,
    category: t.category || 'Outros',
    reconciled: true,
    reconciledAt: new Date().toLocaleDateString('pt-BR'),
    reconciledTxId: t.id
  };

  t.reconciledWithDaily = true;
  t.reconciledDailyId = newDaily.id;

  if (!Array.isArray(state.dailyExpenses)) state.dailyExpenses = [];
  state.dailyExpenses.unshift(newDaily);

  saveState();
  if (typeof renderAll === 'function') renderAll();
  renderReconciliationModalContent(t.period);

  if (typeof alert === 'function') {
    alert(`✅ Lançamento "${t.desc}" copiado e conciliado no Controle Diário!`);
  }
}

// ============================================================================
// CENTRAL DE GERENCIAMENTO DE ARQUIVOS, FATURAS E FOTOS (EXCLUSÃO EM CASCATA)
// ============================================================================

let currentFilesFilter = 'ALL';
let currentFilesSearch = '';
let activeFileDetailsId = null;

function openFilesManagerModal(filterType = 'ALL') {
  currentFilesFilter = filterType || 'ALL';
  currentFilesSearch = '';
  activeFileDetailsId = null;

  const modal = document.getElementById('filesManagerModal');
  if (modal) modal.classList.remove('hidden');

  renderFilesManagerModalContent();
}

function closeFilesManagerModal() {
  const modal = document.getElementById('filesManagerModal');
  if (modal) modal.classList.add('hidden');
  activeFileDetailsId = null;
}

function setFilesFilter(type) {
  currentFilesFilter = type;
  renderFilesManagerModalContent();
}

function setFilesSearch(val) {
  currentFilesSearch = String(val || '').trim().toLowerCase();
  renderFilesManagerModalContent();
}

function toggleFileDetails(fileId) {
  activeFileDetailsId = (activeFileDetailsId === fileId) ? null : fileId;
  renderFilesManagerModalContent();
}

function renderFilesManagerModalContent() {
  const container = document.getElementById('filesManagerModalBody');
  if (!container) return;

  const files = Array.isArray(state.uploadedFiles) ? state.uploadedFiles : [];

  const totalFiles = files.length;
  const ofxCount = files.filter(f => f.fileType === 'bank_ofx').length;
  const pdfCount = files.filter(f => f.fileType === 'card_pdf').length;
  const photoCount = files.filter(f => f.fileType === 'receipt_photo').length;

  // Atualiza badge de contagem no cabeçalho geral
  const headerBadge = document.getElementById('headerFilesCountBadge');
  if (headerBadge) headerBadge.textContent = String(totalFiles);

  // Filtra por tipo e por busca
  const filtered = files.filter(f => {
    if (currentFilesFilter !== 'ALL' && f.fileType !== currentFilesFilter) return false;
    if (currentFilesSearch) {
      const matchName = String(f.fileName || '').toLowerCase().includes(currentFilesSearch);
      const matchAcc = String(f.accountLabel || '').toLowerCase().includes(currentFilesSearch);
      const matchDesc = String(f.desc || '').toLowerCase().includes(currentFilesSearch);
      if (!matchName && !matchAcc && !matchDesc) return false;
    }
    return true;
  });

  const html = `
    <!-- Barra Superior: Estatísticas & Resumo -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <div onclick="setFilesFilter('ALL')" class="cursor-pointer p-3 rounded-xl border transition ${currentFilesFilter === 'ALL' ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-300/60' : 'bg-white border-sky-100 hover:bg-slate-50'}">
        <div class="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
          <span>Todos</span>
          <span>📁</span>
        </div>
        <div class="text-lg font-bold text-slate-900 mt-0.5">${totalFiles}</div>
        <div class="text-[10px] text-slate-400">Total de arquivos</div>
      </div>

      <div onclick="setFilesFilter('bank_ofx')" class="cursor-pointer p-3 rounded-xl border transition ${currentFilesFilter === 'bank_ofx' ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-300/60' : 'bg-white border-sky-100 hover:bg-slate-50'}">
        <div class="flex items-center justify-between text-sky-700 text-[11px] font-semibold">
          <span>Extratos Itaú</span>
          <span>🏦</span>
        </div>
        <div class="text-lg font-bold text-sky-950 mt-0.5">${ofxCount}</div>
        <div class="text-[10px] text-slate-400">Arquivos .OFX</div>
      </div>

      <div onclick="setFilesFilter('card_pdf')" class="cursor-pointer p-3 rounded-xl border transition ${currentFilesFilter === 'card_pdf' ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-300/60' : 'bg-white border-purple-100 hover:bg-slate-50'}">
        <div class="flex items-center justify-between text-purple-700 text-[11px] font-semibold">
          <span>Faturas Cartão</span>
          <span>💳</span>
        </div>
        <div class="text-lg font-bold text-purple-950 mt-0.5">${pdfCount}</div>
        <div class="text-[10px] text-slate-400">Faturas .PDF</div>
      </div>

      <div onclick="setFilesFilter('receipt_photo')" class="cursor-pointer p-3 rounded-xl border transition ${currentFilesFilter === 'receipt_photo' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/60' : 'bg-white border-amber-100 hover:bg-slate-50'}">
        <div class="flex items-center justify-between text-amber-700 text-[11px] font-semibold">
          <span>Fotos de Notas</span>
          <span>📷</span>
        </div>
        <div class="text-lg font-bold text-amber-950 mt-0.5">${photoCount}</div>
        <div class="text-[10px] text-slate-400">Comprovantes</div>
      </div>
    </div>

    <!-- Regra de Exclusão em Cascata (Banner Educativo) -->
    <div class="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
      <span class="text-base shrink-0 mt-0.5">ℹ️</span>
      <div class="space-y-0.5">
        <strong class="font-bold">Controle com Exclusão em Cascata:</strong>
        <p class="text-[11px] text-amber-800 leading-relaxed">
          Cada extrato, fatura ou foto enviada fica registrada nesta área. Se você enviou um arquivo por engano ou duplicado, ao clicar em <strong>"Excluir Arquivo"</strong> o sistema apaga em cascata o arquivo e <strong>todos os lançamentos gerados por ele</strong> de uma única vez.
        </p>
      </div>
    </div>

    <!-- Barra de Filtros, Pesquisa e Botões de Upload Rápido -->
    <div class="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs font-semibold text-slate-600 pl-1">Filtrar:</span>
        <button onclick="setFilesFilter('ALL')" class="text-xs px-2.5 py-1 rounded-lg font-semibold transition ${currentFilesFilter === 'ALL' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}">Todos (${totalFiles})</button>
        <button onclick="setFilesFilter('bank_ofx')" class="text-xs px-2.5 py-1 rounded-lg font-semibold transition ${currentFilesFilter === 'bank_ofx' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}">🏦 Extratos (${ofxCount})</button>
        <button onclick="setFilesFilter('card_pdf')" class="text-xs px-2.5 py-1 rounded-lg font-semibold transition ${currentFilesFilter === 'card_pdf' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}">💳 Faturas (${pdfCount})</button>
        <button onclick="setFilesFilter('receipt_photo')" class="text-xs px-2.5 py-1 rounded-lg font-semibold transition ${currentFilesFilter === 'receipt_photo' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}">📷 Notas Fiscais (${photoCount})</button>
      </div>

      <div class="flex items-center gap-2">
        <input type="text" placeholder="Buscar por nome..." value="${escapeHtml(currentFilesSearch)}" oninput="setFilesSearch(this.value)" class="text-xs border border-slate-300 rounded-xl px-3 py-1.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 w-44 sm:w-56" />
      </div>
    </div>

    <!-- Lista de Arquivos -->
    <div class="space-y-3">
      ${filtered.length === 0 ? `
        <div class="text-center py-10 bg-white border border-dashed border-slate-200 rounded-2xl p-6">
          <div class="text-3xl mb-2">📂</div>
          <h4 class="font-bold text-sm text-slate-800">Nenhum arquivo encontrado</h4>
          <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">
            ${currentFilesSearch ? 'Nenhum resultado com os termos pesquisados.' : 'Você ainda não enviou nenhum arquivo. Quando importar um extrato .OFX da Conta Itaú, uma fatura .PDF ou tirar fotos de notas fiscais, eles aparecerão organizados aqui!'}
          </p>
        </div>
      ` : filtered.map((file, idx) => {
        // Encontra movimentações vinculadas a este arquivo
        const linkedTxs = (state.transactions || []).filter(t => t.fileId === file.id);
        const linkedDaily = (state.dailyExpenses || []).filter(d => d.fileId === file.id || d.id === file.dailyExpenseId);
        const totalItems = linkedTxs.length + linkedDaily.length;

        const isExpanded = activeFileDetailsId === file.id;

        // Metadados visuais por tipo
        let typeIcon = '📄';
        let typeBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
        let typeTitle = 'Arquivo';
        if (file.fileType === 'bank_ofx') {
          typeIcon = '🏦';
          typeBadgeClass = 'bg-sky-50 text-sky-800 border-sky-200';
          typeTitle = 'Extrato Bancário (.OFX)';
        } else if (file.fileType === 'card_pdf') {
          typeIcon = '💳';
          typeBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
          typeTitle = 'Fatura de Cartão (.PDF)';
        } else if (file.fileType === 'receipt_photo') {
          typeIcon = '📷';
          typeBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
          typeTitle = 'Foto de Nota Fiscal';
        }

        // Formatação de tamanho
        const sizeKb = file.fileSize ? `${Math.round(file.fileSize / 1024)} KB` : '';

        return `
          <div class="bg-white border ${isExpanded ? 'border-sky-400 ring-2 ring-sky-200/50' : 'border-slate-200'} rounded-2xl shadow-xs transition hover:border-slate-300 overflow-hidden">
            <div class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex items-start gap-3 min-w-0 flex-1">
                ${file.fileType === 'receipt_photo' && file.receiptImage ? `
                  <div onclick="viewReceiptModal('${file.receiptImage}', '${escapeHtml(file.fileName)}')" class="shrink-0 w-12 h-12 rounded-xl border border-amber-200 overflow-hidden bg-slate-100 cursor-pointer shadow-xs hover:opacity-90 relative group" title="Clique para ampliar a foto da nota">
                    <img src="${file.receiptImage}" alt="Nota" class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-xs">🔍</div>
                  </div>
                ` : `
                  <div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0 border border-slate-200 shadow-2xs">
                    ${typeIcon}
                  </div>
                `}

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeBadgeClass}">
                      ${typeTitle}
                    </span>
                    <span class="text-[11px] text-slate-500 font-medium">
                      ${escapeHtml(file.accountLabel || 'Conta')}
                    </span>
                    ${file.period ? `
                      <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                        Mês: ${formatPeriodLabel(file.period)}
                      </span>
                    ` : ''}
                  </div>

                  <h4 class="font-bold text-sm text-slate-900 mt-1 truncate" title="${escapeHtml(file.fileName)}">
                    ${escapeHtml(file.fileName)}
                  </h4>

                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1">
                    <span>📅 Enviado em: <strong>${escapeHtml(file.uploadedAt || 'Recente')}</strong></span>
                    ${sizeKb ? `<span>💾 Tamanho: <strong>${sizeKb}</strong></span>` : ''}
                    <span class="${totalItems > 0 ? 'text-sky-700 font-bold' : 'text-slate-400'}">
                      🔗 <strong>${totalItems}</strong> lançamento(s) vinculados
                    </span>
                  </div>
                </div>
              </div>

              <!-- Ações do Arquivo -->
              <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                ${totalItems > 0 ? `
                  <button onclick="toggleFileDetails('${file.id}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1" title="Ver lista de lançamentos que vieram deste arquivo">
                    <span>${isExpanded ? '▲ Ocultar' : '▼ Ver'} Itens (${totalItems})</span>
                  </button>
                ` : ''}

                ${file.receiptImage ? `
                  <button onclick="viewReceiptModal('${file.receiptImage}', '${escapeHtml(file.fileName)}')" class="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-2.5 py-1.5 rounded-xl transition flex items-center gap-1" title="Ver foto em tela cheia">
                    <span>📷</span>
                    <span class="hidden sm:inline">Foto</span>
                  </button>
                ` : ''}

                <button onclick="deleteUploadedFileCascade('${file.id}')" class="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer" title="Excluir este arquivo e apagar em cascata todos os lançamentos gerados por ele">
                  <span>🗑️</span>
                  <span>Excluir Arquivo</span>
                </button>
              </div>
            </div>

            <!-- Gaveta Expansível com os Lançamentos do Arquivo -->
            ${isExpanded ? `
              <div class="bg-slate-50/90 border-t border-slate-200 p-4 space-y-2.5 text-xs">
                <div class="flex items-center justify-between font-bold text-slate-800 pb-1 border-b border-slate-200">
                  <span>Lançamentos gerados por este arquivo:</span>
                  <span class="text-[11px] text-slate-500">Total: ${totalItems} lançamento(s)</span>
                </div>

                <div class="space-y-1.5 max-h-60 overflow-y-auto custom-scroll pr-1">
                  ${linkedTxs.map(t => `
                    <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200 text-slate-700">
                      <div class="min-w-0 flex-1 flex items-center gap-2">
                        <span class="text-[11px] font-bold text-slate-500 shrink-0">${escapeHtml(t.date || '')}</span>
                        <span class="font-semibold text-slate-900 truncate">${escapeHtml(t.desc || '')}</span>
                        <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">${escapeHtml(t.category || '')}</span>
                      </div>
                      <div class="font-bold shrink-0 ${(t.type === 'income' || t.kind === 'income') ? 'text-emerald-700' : 'text-slate-900'}">
                        ${(t.type === 'income' || t.kind === 'income') ? '+' : '-'}${formatCentsBRL(toCents(t.amount))}
                      </div>
                    </div>
                  `).join('')}

                  ${linkedDaily.map(d => `
                    <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-amber-200 text-slate-700">
                      <div class="min-w-0 flex-1 flex items-center gap-2">
                        <span class="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">Controle Diário</span>
                        <span class="text-[11px] font-bold text-slate-500 shrink-0">${escapeHtml(d.date || '')}</span>
                        <span class="font-semibold text-slate-900 truncate">${escapeHtml(d.desc || '')}</span>
                        <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">${escapeHtml(d.category || '')}</span>
                      </div>
                      <div class="font-bold shrink-0 ${d.direction === 'income' ? 'text-emerald-700' : 'text-slate-900'}">
                        ${d.direction === 'income' ? '+' : '-'}${formatCentsBRL(toCents(d.amount))}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = html;
}

function deleteUploadedFileCascade(fileId) {
  if (!Array.isArray(state.uploadedFiles)) return;
  const file = state.uploadedFiles.find(f => f.id === fileId);
  if (!file) return;

  const linkedTxs = (state.transactions || []).filter(t => t.fileId === fileId);
  const linkedDaily = (state.dailyExpenses || []).filter(d => d.fileId === fileId || d.id === file.dailyExpenseId);
  const totalItems = linkedTxs.length + linkedDaily.length;

  const typeLabels = {
    bank_ofx: 'Extrato Bancário (.OFX)',
    card_pdf: 'Fatura de Cartão (.PDF)',
    receipt_photo: 'Foto de Nota Fiscal / Comprovante',
    other: 'Arquivo Importado'
  };
  const typeLabel = typeLabels[file.fileType] || 'Arquivo';

  const confirmMsg = `⚠️ EXCLUSÃO EM CASCATA DE ARQUIVO\n\n` +
    `• Arquivo: ${file.fileName}\n` +
    `• Tipo: ${typeLabel}\n` +
    `• Origem: ${file.accountLabel || '-'}\n` +
    `• Lançamentos vinculados: ${totalItems} item(ns)\n\n` +
    `Ao confirmar a exclusão deste arquivo, TODOS os ${totalItems} lançamentos gerados por ele serão excluídos permanentemente das suas contas.\n\n` +
    `Deseja realmente excluir este arquivo e seus dados?`;

  if (typeof confirm === 'function' && !confirm(confirmMsg)) return;

  // 1. Remove as transações geradas por este arquivo
  if (linkedTxs.length > 0) {
    state.transactions = state.transactions.filter(t => t.fileId !== fileId);
    state.transactions = enrichTransactionsAndProjectInstallments(state.transactions);
  }

  // 2. Remove as despesas diárias vinculadas a este arquivo
  if (linkedDaily.length > 0) {
    state.dailyExpenses = (state.dailyExpenses || []).filter(d => d.fileId !== fileId && d.id !== file.dailyExpenseId);
  }

  // 3. Se for fatura de cartão e registrou valor oficial, limpa se não restar mais compras
  if (file.fileType === 'card_pdf' && file.targetAccount && file.period) {
    const cardRemaining = (state.transactions || []).filter(t => t.accountId === file.targetAccount && t.period === file.period);
    if (cardRemaining.length === 0 && state.cardsConfig?.[file.targetAccount]?.officialInvoiceTotals?.[file.period]) {
      delete state.cardsConfig[file.targetAccount].officialInvoiceTotals[file.period];
    }
  }

  // 4. Remove o arquivo da lista
  state.uploadedFiles = state.uploadedFiles.filter(f => f.id !== fileId);

  // 5. Remove de importedSources se existir
  if (Array.isArray(state.importedSources)) {
    state.importedSources = state.importedSources.filter(s => s.id !== fileId && s.fileId !== fileId);
  }

  saveState();
  if (typeof renderAll === 'function') renderAll();
  renderFilesManagerModalContent();

  if (typeof alert === 'function') {
    alert(`🗑️ Arquivo "${file.fileName}" e seus ${totalItems} lançamento(s) foram excluídos com sucesso!`);
  }
}

// ============================================================================
// AUXILIARES DE NAVEGAÇÃO E USABILIDADE MOBILE (SMARTPHONES)
// ============================================================================
function openMobileMoreMenu() {
  const modal = document.getElementById('mobileMoreMenuModal');
  if (modal) modal.classList.remove('hidden');
}

function closeMobileMoreMenu() {
  const modal = document.getElementById('mobileMoreMenuModal');
  if (modal) modal.classList.add('hidden');
}

function quickOpenDailyExpense() {
  setActiveTab('daily');
  setTimeout(() => {
    const amtInput = document.getElementById('dailyAmount');
    if (amtInput) {
      amtInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      amtInput.focus();
    }
  }, 120);
}
