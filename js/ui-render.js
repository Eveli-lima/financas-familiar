// ============================================================================
// MÓDULO 7: CAMADA DE APRESENTAÇÃO E INTERFACE (RENDERIZAÇÃO DAS 4 ABAS)
// ============================================================================
// Por que este módulo existe?
// Consome os cálculos já prontos do `finance-engine.js` e atualiza os cartões,
// listas e barras de progresso no HTML, mantendo a lógica matemática separada
// da lógica visual.

function renderAll() {
  const p = state.selectedPeriod;
  const owner = state.selectedOwner;
  const scopeFilter = state.selectedScope || 'ALL';
  const activeTab = state.activeTab || 'overview';
  const catFilter = document.getElementById('categoryFilterSelect')?.value || 'ALL';
  const accFilter = document.getElementById('accountFilterSelect')?.value || 'ALL';
  const typeFilter = document.getElementById('typeFilterSelect')?.value || 'ALL';
  const searchQ = (document.getElementById('txSearchInput')?.value || '').trim().toUpperCase();

  // Alterna a visibilidade dos Menus (Abas Separadas: Conta Bancária vs. Cartões de Crédito)
  let resolvedTab = activeTab;
  if (resolvedTab === 'transactions') resolvedTab = 'banking';
  if (resolvedTab === 'installments') resolvedTab = 'cards';
  if (resolvedTab === 'planning') resolvedTab = 'investments';

  ['overview', 'banking', 'cards', 'daily', 'investments', 'goals', 'planning', 'transactions', 'installments'].forEach(tab => {
    const container = document.getElementById(`tab_${tab}`);
    const btn = document.getElementById(`btnTab_${tab}`);
    if (container) container.classList.toggle('hidden', tab !== resolvedTab);
    if (btn) btn.classList.toggle('active', tab === resolvedTab);

    // Sincroniza também os botões da barra inferior mobile
    const bottomBtn = document.getElementById(`btnBottomTab_${tab}`);
    if (bottomBtn) {
      const isCur = tab === resolvedTab;
      bottomBtn.classList.toggle('text-sky-600', isCur);
      bottomBtn.classList.toggle('text-slate-500', !isCur);
      const labelSpan = bottomBtn.querySelector('span:last-child');
      if (labelSpan) {
        labelSpan.classList.toggle('font-bold', isCur);
        labelSpan.classList.toggle('font-medium', !isCur);
      }
    }
  });

  const bottomMoreBtn = document.getElementById('btnBottomTab_more');
  if (bottomMoreBtn) {
    const isMoreTab = resolvedTab === 'goals' || resolvedTab === 'investments';
    bottomMoreBtn.classList.toggle('text-sky-600', isMoreTab);
    bottomMoreBtn.classList.toggle('text-slate-500', !isMoreTab);
  }

  const demoBadge = document.getElementById('demoModeBadge');
  if (demoBadge) demoBadge.classList.toggle('hidden', !state.isDemoMode);
  const incBillToggle = document.getElementById('includeCurrentCardBillToggle');
  if (incBillToggle) incBillToggle.checked = !!state.includeCurrentCardBill;

  // Atualiza opções dos selects de categorias com categorias personalizadas
  if (typeof updateCategoryDropdowns === 'function') {
    updateCategoryDropdowns();
  }

  // Atualiza badge de contagem de arquivos e fotos no cabeçalho
  const headerFilesBadge = document.getElementById('headerFilesCountBadge');
  if (headerFilesBadge) {
    const totalFiles = (state.uploadedFiles || []).length;
    headerFilesBadge.textContent = String(totalFiles);
  }

  // Sincroniza o seletor único de meses (dropdown)
  const periodDropdown = document.getElementById('periodDropdownSelect');
  if (periodDropdown) {
    if (p && !Array.from(periodDropdown.options).some(o => o.value === p)) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = formatPeriodLabel(p);
      periodDropdown.appendChild(opt);
    }
    periodDropdown.value = p;
  }

  // Destaca botões de período, pessoa e escopo
  ['2026-09', '2026-10', '2026-11', '2026-12', 'ALL'].forEach(k => {
    const b = document.getElementById(`btnPeriod_${k}`);
    if (b) b.classList.toggle('active', k === p);
  });
  ['ALL', 'Éveli', 'Vital'].forEach(k => {
    const b = document.getElementById(`btnOwner_${k}`);
    if (b) b.classList.toggle('active', k === owner);
  });
  ['ALL', 'shared', 'individual'].forEach(k => {
    const b = document.getElementById(`btnScope_${k}`);
    if (b) b.classList.toggle('active', k === scopeFilter);
  });

  // Badges de fontes integradas
  const badgesEl = document.getElementById('importedSourcesBadges');
  if (badgesEl) {
    badgesEl.innerHTML = (state.importedSources || []).map(s => `
      <span class="text-[11px] px-2.5 py-0.5 rounded-lg font-medium bg-sky-50 text-sky-700 border border-sky-200/70">
        ${escapeHtml(s.owner)} • ${escapeHtml(s.name)}
      </span>
    `).join('');
  }

  // Filtra transações para os cálculos do período, pessoa e escopo
  const periodTx = state.transactions.filter(t => {
    if (p !== 'ALL' && t.period !== p) return false;
    if (owner !== 'ALL' && t.owner !== owner) return false;
    if (scopeFilter !== 'ALL' && (t.scope || 'shared') !== scopeFilter) return false;
    return true;
  });

  // Chama o motor financeiro puro (Módulo 4)
  const summary = calculatePeriodSummary(periodTx, p);
  const {
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
    sharedExpensesCents,
    individualEveliCents,
    individualMaridoCents,
    spentByCatCents,
    lanchesCount,
    cheirinCount,
    cheirinCents,
    uberCount
  } = summary;

  // 1. Atualiza os 5 Cartões Superiores
  document.getElementById('prevMonthBalanceDisplay').textContent = formatCentsBRL(prevBalanceCents);
  document.getElementById('subPrevBalance').textContent = startInfo.label;

  document.getElementById('incomeTotalDisplay').textContent = '+ ' + formatCentsBRL(totalIncomeCents);
  document.getElementById('incomeCountSub').textContent = totalReimbursementBankCents > 0
    ? `+ ${formatCentsBRL(totalReimbursementBankCents)} em reembolsos abatidos`
    : 'Receitas e aportes na conta conjunta';

  document.getElementById('bankDebitTotalDisplay').textContent = '- ' + formatCentsBRL(totalBankDebitCents);
  document.getElementById('bankBalanceNowSub').textContent =
    `Saldo em Conta Hoje: ${formatCentsBRL(bankEndingBalanceCents)}`;

  document.getElementById('cardTotalDisplay').textContent = '- ' + formatCentsBRL(totalCardCents);
  document.getElementById('cardBreakdownSub').textContent =
    `Éveli: ${formatCentsBRL(cardEveliCents)} | Vital: ${formatCentsBRL(cardMaridoCents)}`;

  // Conciliação automática da fatura com o valor oficial impresso no PDF
  const reconBadge = document.getElementById('invoiceReconciliationBadge');
  const eveliOfficial = state.cardsConfig?.card_eveli_5544?.officialInvoiceTotals?.[p];
  if (cardEveliCents === 0) {
    reconBadge.className = 'text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500';
    reconBadge.textContent = 'Sem compras';
  } else if (eveliOfficial !== undefined && owner !== 'Vital' && owner !== 'Marido') {
    const diffCents = cardEveliCents - toCents(eveliOfficial);
    if (diffCents === 0 && scopeFilter === 'ALL') {
      reconBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70';
      reconBadge.textContent = 'Conciliada';
    } else if (scopeFilter !== 'ALL') {
      reconBadge.className = 'text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700';
      reconBadge.textContent = 'Filtro Ativo';
    } else {
      reconBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200';
      reconBadge.textContent = `Dif: ${formatCentsBRL(diffCents)}`;
    }
  } else {
    reconBadge.className = 'text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700';
    reconBadge.textContent = p > '2026-10' ? 'Fatura Futura' : 'Fatura Aberta';
  }

  const valEl = document.getElementById('currentMonthTotalDisplay');
  if (valEl) valEl.textContent = formatCentsBRL(projectedBalanceCents);
  const dotEl = document.getElementById('balanceDotIndicator');
  const statusEl = document.getElementById('currentBalanceStatusText');
  if (valEl) {
    if (projectedBalanceCents >= 0) {
      valEl.className = 'text-xl sm:text-2xl font-bold text-emerald-600 tracking-tight';
      if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-emerald-500';
      if (statusEl) {
        statusEl.textContent = state.includeCurrentCardBill
          ? 'Saldo cobre a conta e as faturas do período'
          : 'Saldo bancário positivo na Conta Conjunta';
      }
    } else {
      valEl.className = 'text-xl sm:text-2xl font-bold text-rose-600 tracking-tight';
      if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-rose-500';
      if (statusEl) {
        statusEl.textContent = state.includeCurrentCardBill
          ? `Faltam ${formatCentsBRL(Math.abs(projectedBalanceCents))} p/ cobrir conta + faturas`
          : `Utilizando ${formatCentsBRL(Math.abs(projectedBalanceCents))} do limite da conta`;
      }
    }
  }

  // 2. Renderiza Painel Dedicado: Conta Conjunta Itaú + Cartão Éveli + Cartão Vital
  const cEveli = state.cardsConfig?.card_eveli_5544 || { name: 'Cartão MC Gold 5544', holder: 'Éveli', limit: 7740, closingDay: 14, dueDay: 21 };
  const cMarido = state.cardsConfig?.card_marido || { name: 'Cartão Vital', holder: 'Vital', limit: 6000, closingDay: 10, dueDay: 17 };

  const limEveli = typeof calculateCardLimitsUsage === 'function'
    ? calculateCardLimitsUsage('card_eveli_5544', p)
    : { availableLimitCents: toCents(cEveli.limit) - cardEveliCents, totalCommittedCents: cardEveliCents, usagePct: 40, isPaidThisPeriod: false };
  const limMarido = typeof calculateCardLimitsUsage === 'function'
    ? calculateCardLimitsUsage('card_marido', p)
    : { availableLimitCents: toCents(cMarido.limit) - cardMaridoCents, totalCommittedCents: cardMaridoCents, usagePct: 0, isPaidThisPeriod: false };

  const renderCardBox = (cardId, cfg, cardPeriodCents, limInfo) => {
    const barColor = limInfo.usagePct >= 90 ? 'bg-rose-500' : (limInfo.usagePct >= 75 ? 'bg-amber-400' : 'bg-sky-500');
    const statusPill = limInfo.isPaidThisPeriod
      ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">Fatura Paga</span>`
      : `<span class="text-[10px] text-slate-500">Fecha dia ${cfg.closingDay} • Vence dia ${cfg.dueDay}</span>`;

    return `
      <div class="bg-white rounded-2xl p-5 border border-sky-200/70 shadow-sm shadow-sky-900/[0.03] flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Titular: ${escapeHtml(cfg.holder)}</span>
            ${statusPill}
          </div>
          <h4 class="font-bold text-sm sm:text-base text-slate-900 mt-1">${escapeHtml(cfg.name)}</h4>

          <div class="mt-3 grid grid-cols-2 gap-2 bg-sky-50/60 p-3 rounded-xl border border-sky-100 text-xs">
            <div>
              <span class="text-sky-800/70 block text-[10px]">Fatura ${formatPeriodLabel(p)}</span>
              <strong class="text-slate-900 text-sm font-bold">${formatCentsBRL(cardPeriodCents)}</strong>
            </div>
            <div>
              <span class="text-sky-800/70 block text-[10px]">Limite Disponível</span>
              <strong class="text-emerald-700 text-sm font-bold">${formatCentsBRL(limInfo.availableLimitCents)}</strong>
            </div>
          </div>

          <!-- Barra de Uso do Limite (Fatura + Parcelas Futuras) -->
          <div class="mt-2.5">
            <div class="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>Comprometido c/ parcelas: <strong class="text-slate-700">${formatCentsBRL(limInfo.totalCommittedCents)}</strong></span>
              <span>Limite: <strong class="text-sky-900">${formatBRL(cfg.limit)}</strong> (${limInfo.usagePct}%)</span>
            </div>
            <div class="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden">
              <div class="h-full ${barColor} rounded-full transition-all" style="width: ${limInfo.usagePct}%;"></div>
            </div>
          </div>
        </div>

        <div class="mt-3 pt-2.5 border-t border-sky-100 flex items-center justify-between text-[11px]">
          <span class="text-slate-500">Vencimento: <strong>dia ${cfg.dueDay}</strong></span>
          <button onclick="setActiveTab('cards')" class="text-sky-700 hover:text-sky-900 font-semibold underline">Ver Fatura →</button>
        </div>
      </div>
    `;
  };

  const cardsHtml = `
    ${renderCardBox('card_eveli_5544', cEveli, cardEveliCents, limEveli)}
    ${renderCardBox('card_marido', cMarido, cardMaridoCents, limMarido)}
  `;

  const invData = typeof getInvestmentsDataForPeriod === 'function'
    ? getInvestmentsDataForPeriod(p)
    : { totalInvestedCents: 0, totalEarningsCents: 0, items: [] };

  const investmentsSummaryBoxHtml = `
    <!-- Poupanças & Investimentos (Tesouro Direto, Poupança Itaú e Caixa) -->
    <div class="bg-white rounded-2xl p-5 border border-sky-200/70 shadow-sm shadow-sky-900/[0.03] flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Poupanças & Investimentos</span>
          <span class="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">100% Isolados</span>
        </div>
        <h4 class="font-bold text-sm sm:text-base text-slate-900 mt-1">Patrimônio Guardado</h4>
        <div class="mt-3 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 p-3 rounded-xl border border-emerald-100 text-xs">
          <div class="flex items-baseline justify-between">
            <span class="text-emerald-900/80 block text-[10px] font-medium">Saldo Investido (${formatPeriodLabel(p)})</span>
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+${formatCentsBRL(invData.totalEarningsCents)}</span>
          </div>
          <strong class="text-emerald-800 text-lg font-bold block mt-1">${formatCentsBRL(invData.totalInvestedCents)}</strong>
          <p class="text-[10px] text-slate-500 mt-1">Tesouro Direto + Poupança Itaú + Poupança Caixa.</p>
        </div>
      </div>
      <div class="mt-3 pt-2.5 border-t border-sky-100 flex items-center justify-between text-[11px]">
        <span class="text-slate-500">3 Ativos Ativos</span>
        <button onclick="setActiveTab('investments')" class="text-emerald-700 hover:text-emerald-900 font-semibold underline">Ver Detalhes →</button>
      </div>
    </div>
  `;

  document.getElementById('accountsAndCardsSection').innerHTML = `
    <!-- Conta Conjunta Itaú -->
    <div class="bg-white rounded-2xl p-5 border border-sky-200/70 shadow-sm shadow-sky-900/[0.03] flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Conta Conjunta</span>
          <span class="text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">Éveli & Vital</span>
        </div>
        <h4 class="font-bold text-sm sm:text-base text-slate-900 mt-1">Conta Corrente Itaú</h4>
        <div class="mt-3 grid grid-cols-2 gap-2 bg-sky-50/60 p-3 rounded-xl border border-sky-100 text-xs">
          <div>
            <span class="text-sky-800/70 block text-[10px]">Saldo (${formatPeriodLabel(p)})</span>
            <strong class="${bankEndingBalanceCents >= 0 ? 'text-emerald-600' : 'text-rose-600'} text-sm font-bold">${formatCentsBRL(bankEndingBalanceCents)}</strong>
          </div>
          <div>
            <span class="text-sky-800/70 block text-[10px]">Faturas Pagas no Mês</span>
            <strong class="text-sky-900 text-sm font-semibold">${formatCentsBRL(totalInvoicePaidInBankCents)}</strong>
          </div>
        </div>
      </div>
      <div class="mt-3 pt-2.5 border-t border-sky-100 flex items-center justify-between text-[11px]">
        <span class="text-slate-500">Reservas no mês: <strong class="text-sky-900">${formatCentsBRL(totalGoalReserveCents)}</strong></span>
        <button onclick="editPrevBalanceManual()" class="text-sky-700 hover:text-sky-900 underline font-medium">Ajustar Saldo</button>
      </div>
    </div>
    ${investmentsSummaryBoxHtml}
    ${cardsHtml}
  `;

  const cardsTabEl = document.getElementById('cardsTabHeaderSection');
  if (cardsTabEl) cardsTabEl.innerHTML = cardsHtml;

  // 2.5 Renderiza o Quadro Comparativo de Evolução Mensal (Set/26 a Dez/26 - Etapa 5)
  const evoEl = document.getElementById('monthlyEvolutionGrid');
  if (evoEl && typeof calculateMonthlyEvolution === 'function') {
    const evoRows = calculateMonthlyEvolution(['2026-09', '2026-10', '2026-11', '2026-12'], owner, scopeFilter);
    evoEl.innerHTML = evoRows.map(row => {
      const isSelected = row.period === p;
      const isFuture = row.period > '2026-10';
      return `
        <div onclick="setPeriod('${row.period}')" class="cursor-pointer rounded-xl p-3 border transition ${isSelected ? 'bg-sky-50 border-sky-400 shadow-sm' : 'bg-white border-sky-100 hover:border-sky-300'}">
          <div class="flex items-center justify-between mb-1.5">
            <span class="font-bold text-xs ${isSelected ? 'text-sky-900' : 'text-slate-800'}">${escapeHtml(row.label)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${isFuture ? 'bg-sky-100 text-sky-800 font-semibold' : 'bg-slate-100 text-slate-600'}">
              ${isFuture ? 'Projeção' : `${row.txCount} itens`}
            </span>
          </div>
          <div class="space-y-1 text-[11px]">
            <div class="flex justify-between text-slate-500">
              <span>Entradas:</span>
              <strong class="text-emerald-600">+${formatCentsBRL(row.incomeCents)}</strong>
            </div>
            <div class="flex justify-between text-slate-500">
              <span>Saídas Conta:</span>
              <strong class="text-slate-700">-${formatCentsBRL(row.bankDebitCents)}</strong>
            </div>
            <div class="flex justify-between text-slate-500">
              <span>Cartões:</span>
              <strong class="text-sky-900">-${formatCentsBRL(row.cardTotalCents)}</strong>
            </div>
            <div class="flex justify-between pt-1 border-t border-sky-100 font-semibold">
              <span class="text-slate-600">Balanço:</span>
              <strong class="${row.projectedBalanceCents >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatCentsBRL(row.projectedBalanceCents)}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2.6 Renderiza o Consolidado Geral: Entradas e Saídas de Todos os Meses (Conta e Cartão Separados)
  renderConsolidatedAllMonthsSection(owner, scopeFilter);

  // 3. Renderiza o Painel de Parcelamentos (via calculateInstallmentsRadar do Módulo 4)
  const radar = calculateInstallmentsRadar(periodTx);

  // 3.5 Renderiza os Insights e Dicas da Educadora Financeira IA
  const aiContainer = document.getElementById('aiInsightsContainer');
  if (aiContainer && typeof generateFinancialAiInsights === 'function') {
    const aiInsights = generateFinancialAiInsights(summary, radar, p);
    aiContainer.innerHTML = aiInsights.map(item => {
      let borderBg = 'bg-white border-sky-200/80 text-sky-950';
      let tagBg = 'bg-sky-50 text-sky-700 border-sky-200';
      if (item.type === 'danger') {
        borderBg = 'bg-rose-50/50 border-rose-200 text-rose-950';
        tagBg = 'bg-rose-100/70 text-rose-800 border-rose-300';
      } else if (item.type === 'warning') {
        borderBg = 'bg-amber-50/50 border-amber-200 text-amber-950';
        tagBg = 'bg-amber-100/70 text-amber-800 border-amber-300';
      } else if (item.type === 'success') {
        borderBg = 'bg-emerald-50/50 border-emerald-200 text-emerald-950';
        tagBg = 'bg-emerald-100/70 text-emerald-800 border-emerald-300';
      }

      return `
        <div class="rounded-xl border p-3.5 shadow-xs flex flex-col justify-between ${borderBg}">
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <span class="text-base">${item.icon}</span>
              <h4 class="font-bold text-xs sm:text-sm tracking-tight">${item.title}</h4>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed mt-1">${item.message}</p>
          </div>
          <div class="mt-2.5 pt-2 border-t border-sky-100/60 text-[11px] font-medium text-sky-900 flex items-center justify-between">
            <span>${item.action}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3.6 Renderiza o Diagnóstico Descomplicado em Português Claro (Economia Doméstica para Leigos)
  renderPlainLanguageDiagnostic(p, summary, owner);
  const {
    installmentTx,
    endingNow,
    endingNext,
    continuingAfter,
    endingNowCents,
    endingNextCents,
    continuingAfterCents,
    committedNextMonthCents,
    totalFutureRemainingCents
  } = radar;

  const nextMonthName = p === 'ALL' ? 'próximo mês' : formatPeriodLabel(addMonthsToPeriod(p, 1));
  const afterNextMonthName = p === 'ALL' ? 'meses seguintes' : formatPeriodLabel(addMonthsToPeriod(p, 2));

  document.getElementById('radarHeadline').textContent = endingNow.length > 0
    ? `${endingNow.length} compra(s) parcelada(s) terminam em ${formatPeriodLabel(p)} (liberando ${formatCentsBRL(endingNowCents)}/mês em ${nextMonthName})`
    : `${installmentTx.length} compra(s) parcelada(s) ativas em ${formatPeriodLabel(p)}`;

  document.getElementById('radarLimitsBox').innerHTML = `
    <div>Parcelas neste mês: <strong class="text-sky-950">${formatCentsBRL(endingNowCents + committedNextMonthCents)}</strong> (${installmentTx.length} itens)</div>
    <div>Comprometido p/ ${nextMonthName}: <strong class="text-sky-950">${formatCentsBRL(committedNextMonthCents)}</strong> • Restante futuro: <strong class="text-sky-950">${formatCentsBRL(totalFutureRemainingCents)}</strong></div>
  `;

  const formatInstItem = (t) => {
    const cleanName = t.desc.replace(/\s*\(.*?\)/g, '').trim();
    return `<li class="flex justify-between gap-2 py-1 border-b border-sky-200/50 last:border-0 text-slate-700">
      <span class="truncate">${escapeHtml(cleanName)}</span>
      <strong class="shrink-0 font-semibold text-slate-900">${formatBRL(t.amount)}</strong>
    </li>`;
  };

  document.getElementById('radarInstallmentsGrid').innerHTML = `
    <div class="bg-sky-50/50 border border-sky-200/70 rounded-xl p-4 flex flex-col justify-between">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-900">Terminam em ${formatPeriodLabel(p)} (${endingNow.length})</span>
        </div>
        <ul class="mt-2.5 space-y-0.5">
          ${endingNow.length > 0 ? endingNow.map(formatInstItem).join('') : '<li class="text-slate-400 italic py-1">Nenhuma parcela terminando neste mês</li>'}
        </ul>
      </div>
      <p class="text-emerald-700 font-semibold mt-3 pt-2 border-t border-sky-200/60">
        Libera +${formatCentsBRL(endingNowCents)}/mês em ${nextMonthName}
      </p>
    </div>

    <div class="bg-sky-50/50 border border-sky-200/70 rounded-xl p-4 flex flex-col justify-between">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-900">Terminam em ${nextMonthName} (${endingNext.length})</span>
        </div>
        <ul class="mt-2.5 space-y-0.5">
          ${endingNext.length > 0 ? endingNext.map(formatInstItem).join('') : '<li class="text-slate-400 italic py-1">Nenhuma penúltima parcela neste mês</li>'}
        </ul>
      </div>
      <p class="text-sky-900 font-semibold mt-3 pt-2 border-t border-sky-200/60">
        Libera +${formatCentsBRL(endingNextCents)}/mês em ${afterNextMonthName}
      </p>
    </div>

    <div class="bg-sky-50/50 border border-sky-200/70 rounded-xl p-4 flex flex-col justify-between">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-sky-500"></span>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-900">Continuam após ${nextMonthName} (${continuingAfter.length})</span>
        </div>
        <ul class="mt-2.5 space-y-0.5">
          ${continuingAfter.length > 0 ? continuingAfter.map(formatInstItem).join('') : '<li class="text-slate-400 italic py-1">Nenhuma parcela longa ativa</li>'}
        </ul>
      </div>
      <p class="text-sky-900 font-semibold mt-3 pt-2 border-t border-sky-200/60">
        Seguem ativas: ${formatCentsBRL(continuingAfterCents)}/mês
      </p>
    </div>
  `;

  // 4. Renderiza Resumo de Metas da Família na Visão Geral e Divisão por Conta/Cartão
  const goalsEl = document.getElementById('overviewGoalsSummaryCard');
  if (goalsEl) {
    const goalsList = state.futureGoals || [];
    const totalGoalsCount = goalsList.length;
    let totalTargetCents = 0;
    let totalSavedCents = 0;
    goalsList.forEach(g => {
      totalTargetCents += toCents(g.totalAmount || 0);
      totalSavedCents += toCents(g.savedAmount || 0);
    });
    const overallPct = totalTargetCents > 0 ? Math.min(100, Math.round((totalSavedCents / totalTargetCents) * 100)) : 0;
    const remainingCents = Math.max(0, totalTargetCents - totalSavedCents);
    const topGoalName = totalGoalsCount > 0 ? goalsList[0].name : 'Nenhuma meta no momento';

    goalsEl.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-semibold uppercase tracking-wider text-indigo-700">Metas da Família</span>
          <span class="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">${totalGoalsCount} Meta(s) Ativa(s)</span>
        </div>
        <h4 class="font-bold text-sm text-slate-900 mb-2">Objetivos & Sonhos Financeiros</h4>
        <div class="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-600">Guardado: <strong class="text-emerald-700 font-bold">${formatCentsBRL(totalSavedCents)}</strong></span>
            <span class="text-slate-500">Total Alvo: <strong class="text-slate-800">${formatCentsBRL(totalTargetCents)}</strong></span>
          </div>
          <div class="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full transition-all" style="width: ${overallPct}%"></div>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500">
            <span>Progresso Geral: <strong class="text-indigo-700 font-bold">${overallPct}%</strong></span>
            <span>A Realizar: <strong class="text-slate-700 font-semibold">${formatCentsBRL(remainingCents)}</strong></span>
          </div>
        </div>
      </div>
      <div class="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between text-xs">
        <span class="text-slate-500 truncate max-w-[200px]" title="${escapeHtml(topGoalName)}">🎯 ${escapeHtml(topGoalName)}</span>
        <button onclick="setActiveTab('goals')" class="text-indigo-700 hover:text-indigo-900 font-semibold underline shrink-0">Ver Metas →</button>
      </div>
    `;
  }

  // 4.2 Renderiza o FAQ do Educador Financeiro na Visão Geral (Recolhível por toque)
  const faqCard = document.getElementById('financialCoachFaqCard');
  if (faqCard && typeof FINANCIAL_COACH_FAQ !== 'undefined') {
    const isFaqExpanded = isCollapsibleCardExpanded('financial_faq', false);
    faqCard.innerHTML = `
      <div class="overflow-hidden h-full flex flex-col justify-between">
        <div>
          <button 
            type="button" 
            onclick="toggleCollapsibleCard('financialFaqBody', 'financialFaqChevron', 'financial_faq')"
            class="w-full flex items-center justify-between text-left collapsible-faixa select-none p-1 -m-1 rounded-xl transition"
          >
            <div class="flex items-center gap-2">
              <span class="text-base">🎓</span>
              <div>
                <span class="text-[10px] font-semibold uppercase tracking-wider text-sky-700/80 block">Educador Financeiro</span>
                <h4 class="font-bold text-xs sm:text-sm text-slate-900">Perguntas Frequentes do Casal</h4>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60 hidden sm:inline-block">Dúvidas Rápidas</span>
              <span id="financialFaqChevron" class="text-xs text-sky-700 font-bold bg-sky-100/70 w-6 h-6 rounded-full flex items-center justify-center transition-transform">
                ${isFaqExpanded ? '▲' : '▼'}
              </span>
            </div>
          </button>

          <div id="financialFaqBody" class="${isFaqExpanded ? '' : 'hidden'} mt-3 space-y-2 pt-2 border-t border-sky-100">
            ${FINANCIAL_COACH_FAQ.slice(0, 3).map((item) => `
              <details class="bg-sky-50/50 rounded-xl border border-sky-100/80 p-2.5 text-xs group cursor-pointer">
                <summary class="font-semibold text-slate-800 list-none flex items-center justify-between gap-2">
                  <span>❓ ${escapeHtml(item.q)}</span>
                  <span class="text-sky-600 font-bold group-open:rotate-180 transition-transform text-[11px]">▼</span>
                </summary>
                <div class="mt-2 text-slate-600 leading-relaxed pt-2 border-t border-sky-100/70 text-[11px]">
                  ${item.a}
                </div>
              </details>
            `).join('')}
            <div class="mt-3 pt-2 border-t border-sky-100 flex items-center justify-between text-xs">
              <span class="text-slate-500">Aprenda sem complicação</span>
              <button onclick="openAiAdvisorModal()" class="text-sky-700 hover:text-sky-900 font-semibold underline shrink-0">Abrir Assistente Completo →</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const lanchesCents = Math.max(0, spentByCatCents['Lanches & Restaurantes'] || 0);
  const uberCents = Math.max(0, spentByCatCents['Uber & Transporte'] || 0);
  const antTotalCents = lanchesCents + uberCents;
  const antBadge = document.getElementById('antExpensesBadge');
  if (antBadge) antBadge.textContent = formatCentsBRL(antTotalCents);
  const antDetail = document.getElementById('antExpensesDetailText');
  if (antDetail) {
    antDetail.innerHTML = `
      Em ${formatPeriodLabel(p)}: <strong class="text-slate-800">${lanchesCount} lançamento(s) em Lanches/Restaurantes (${formatCentsBRL(lanchesCents)})</strong>
      ${cheirinCount > 0 ? `— sendo <strong class="text-sky-800">${cheirinCount}x no Cheirin Bão (${formatCentsBRL(cheirinCents)})</strong> —` : ''}
      e <strong class="text-slate-800">${uberCount} corrida(s) de Uber/Transporte (${formatCentsBRL(uberCents)})</strong>.
    `;
  }

  const scopeSplitEl = document.getElementById('scopeSplitSummary');
  if (scopeSplitEl) {
    scopeSplitEl.innerHTML = `
      <div class="flex justify-between"><span>Conta Conjunta Itaú:</span> <strong class="text-sky-950">${formatCentsBRL(totalBankDebitCents)}</strong></div>
      <div class="flex justify-between"><span>Cartão Éveli (MC Gold):</span> <strong class="text-slate-800">${formatCentsBRL(cardEveliCents)}</strong></div>
      <div class="flex justify-between"><span>Cartão Vital:</span> <strong class="text-slate-800">${formatCentsBRL(cardMaridoCents)}</strong></div>
    `;
  }

  // 5. Renderiza Metas Futuras e Poupança Caixa
  const elPlanningCaixa = document.getElementById('planningCaixaSavingsDisplay');
  if (elPlanningCaixa) {
    elPlanningCaixa.textContent = formatCentsBRL(toCents(state.savingsAccounts?.poupanca_caixa?.balance || 0));
  }

  document.getElementById('futureGoalsContainer').innerHTML = (state.futureGoals || []).map(g => {
    const rem = Math.max(0, g.totalAmount - g.savedAmount);
    const pct = Math.min(100, Math.round((g.savedAmount / g.totalAmount) * 100));
    const parcel = g.remainingMonths > 0 ? (rem / g.remainingMonths) : 0;

    return `
      <div class="rounded-2xl border border-sky-200/70 bg-white p-4 shadow-sm shadow-sky-900/[0.02] flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <h4 class="font-bold text-sm text-slate-900">${escapeHtml(g.name)}</h4>
              <span class="text-[11px] text-slate-500">
                Alvo: <strong class="text-slate-700">${formatBRL(g.totalAmount)}</strong> • Guardado: <strong class="text-emerald-600">${formatBRL(g.savedAmount)}</strong>
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="openEditGoalModal('${g.id}')" class="text-sky-600 hover:text-sky-800 text-xs font-semibold px-2 py-0.5 rounded-lg hover:bg-sky-50 transition" title="Editar Meta">✏️ Editar</button>
              <button onclick="deleteFutureGoal('${g.id}')" class="text-slate-300 hover:text-rose-600 text-xs font-bold px-1.5 py-0.5 rounded-lg hover:bg-rose-50 transition" title="Excluir Meta">✕</button>
            </div>
          </div>
          <div class="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden my-2">
            <div class="h-full bg-sky-600 rounded-full transition-all" style="width: ${pct}%;"></div>
          </div>
          <div class="bg-sky-50/60 rounded-xl p-2.5 border border-sky-100 my-2 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-500">Prazo restante:</span>
              <strong class="text-slate-800">${g.remainingMonths} ${g.remainingMonths === 1 ? 'mês' : 'meses'} ${g.postponedCount > 0 ? `(Adiado ${g.postponedCount}x)` : ''}</strong>
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-slate-500">Valor mensal:</span>
              <strong class="text-sky-900 font-bold">${formatBRL(parcel)} / mês</strong>
            </div>
          </div>
          <p class="text-[11px] text-slate-500 mb-3">${escapeHtml(g.lastActionNote || '')}</p>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-sky-100">
          <button onclick="transferGoalMonthlyAmount('${g.id}')" class="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs py-2 px-2 rounded-xl shadow-sm transition">
            Guardar no Mês
          </button>
          <button onclick="postponeGoalMonth('${g.id}')" class="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/70 font-semibold text-xs py-2 px-2 rounded-xl transition">
            Adiar (+1 Mês)
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 6. Renderiza Orçamento por Categoria
  const distinctMonthsCount = p === 'ALL'
    ? Math.max(1, new Set(periodTx.map(t => t.period)).size)
    : 1;

  const allExpenseCats = typeof getAllExpenseCategories === 'function'
    ? getAllExpenseCategories()
    : [
        'Parcelamentos Cartão',
        'Lanches & Restaurantes',
        'Mercado & Hortifruti',
        'Auto Escola & Detran',
        'Casa, Serviços & Outros',
        'Uber & Transporte',
        'Saúde, Farmácia & Academia'
      ];

  const catList = allExpenseCats.map(key => ({ key }));

  document.getElementById('budgetCategoriesList').innerHTML = catList.map(c => {
    const spent = fromCents(Math.max(0, spentByCatCents[c.key] || 0));
    const monthlyLimit = state.budgets[c.key] || 400;
    const effectiveLimit = monthlyLimit * distinctMonthsCount;
    const pct = effectiveLimit > 0 ? Math.round((spent / effectiveLimit) * 100) : 100;
    const barW = Math.min(100, pct);
    const color = pct >= 100 ? 'bg-rose-500' : (pct >= 85 ? 'bg-amber-400' : 'bg-sky-500');

    return `
      <div class="p-3 rounded-xl border border-sky-100 bg-sky-50/40">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="font-semibold text-slate-700">${c.key}</span>
          <button onclick="editCategoryBudget('${c.key}')" class="text-sky-900 hover:text-sky-700 font-semibold">
            ${formatBRL(spent)} <span class="text-slate-400 font-normal">/ ${formatBRL(effectiveLimit)}</span>
          </button>
        </div>
        <div class="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden">
          <div class="h-full ${color} transition-all" style="width: ${barW}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  // 6.5 Renderiza a Aba de Poupanças & Investimentos
  const invGrid = document.getElementById('investmentCardsGrid');
  if (invGrid) {
    const invTotalEl = document.getElementById('investmentsTotalDisplay');
    const invEarnEl = document.getElementById('investmentsEarningsDisplay');
    const navBadge = document.getElementById('navInvestmentsTotalBadge');

    if (invTotalEl) invTotalEl.textContent = formatCentsBRL(invData.totalInvestedCents);
    if (invEarnEl) invEarnEl.textContent = `+ ${formatCentsBRL(invData.totalEarningsCents)}`;
    if (navBadge) navBadge.textContent = formatCentsBRL(invData.totalInvestedCents);

    const assetIcons = {
      tesouro_direto: '🏛️',
      poupanca_itau: '🏦',
      poupanca_caixa: '🪙'
    };

    invGrid.innerHTML = invData.items.map(item => {
      const icon = assetIcons[item.id] || '💰';
      const isTesouro = item.id === 'tesouro_direto';
      return `
        <div class="bg-white rounded-2xl p-5 border border-sky-200/80 shadow-sm shadow-sky-900/[0.03] flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-2xl">${icon}</span>
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${isTesouro ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}">
                ${escapeHtml(item.bank)}
              </span>
            </div>
            <h4 class="font-bold text-base text-slate-900">${escapeHtml(item.name)}</h4>
            <p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(item.notes || 'Economia familiar protegida')}</p>

            <div class="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
              <div class="flex justify-between items-baseline">
                <span class="text-[10px] font-semibold uppercase text-slate-500">Saldo Bruto (${formatPeriodLabel(p)})</span>
                <strong class="text-base sm:text-lg font-bold text-slate-900">${formatCentsBRL(item.balanceCents)}</strong>
              </div>
              <div class="flex justify-between items-baseline pt-1.5 border-t border-slate-200 text-xs">
                <span class="text-[10px] text-slate-500">Rendimento no mês:</span>
                <strong class="text-emerald-700 font-semibold">+ ${formatCentsBRL(item.earningsCents)}</strong>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span class="text-[10px] text-slate-400">Atualizado: ${escapeHtml(item.updatedAt)}</span>
            <div class="flex items-center gap-1.5">
              <button onclick="openInvestmentEditModal('${item.id}')" class="text-sky-700 hover:text-sky-900 font-semibold underline text-xs">
                ✏️ Escrever
              </button>
              <button onclick="openInvestmentImageModal('${item.id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-lg border border-emerald-200/80 text-[11px] transition">
                📷 Print
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 7. Renderiza Lista de Lançamentos Filtrada e Ordenada por Data
  const visibleTx = periodTx
    .filter(t => {
      if (accFilter !== 'ALL' && t.accountId !== accFilter) return false;
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'income' && t.type !== 'income' && t.kind !== 'income' && t.kind !== 'reimbursement') return false;
        if (typeFilter === 'expense' && t.type !== 'card' && t.type !== 'debit' && t.kind !== 'expense') return false;
        if (typeFilter === 'invoice_payment' && t.kind !== 'invoice_payment') return false;
      }
      if (catFilter !== 'ALL') {
        if (catFilter === 'Parcelamentos Cartão') {
          return t.category === 'Parcelamentos Cartão' || (t.installmentTotal && t.installmentTotal >= 2);
        }
        if (t.category !== catFilter) return false;
      }
      if (searchQ) {
        const hay = `${t.desc} ${t.category} ${t.owner} ${t.date} ${t.amount.toFixed(2)}`.toUpperCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      const da = toSortableDate(a.date, a.period);
      const db = toSortableDate(b.date, b.period);
      return db.localeCompare(da);
    });

  // 7. Renderiza Lista de Lançamentos da Conta Bancária (Exclusivo da Conta Itaú)
  const elBankPrev = document.getElementById('bankTabPrevBalance');
  if (elBankPrev) elBankPrev.textContent = formatCentsBRL(prevBalanceCents);
  const elBankIncome = document.getElementById('bankTabIncome');
  if (elBankIncome) elBankIncome.textContent = '+ ' + formatCentsBRL(totalIncomeCents);
  const elBankDebit = document.getElementById('bankTabDebit');
  if (elBankDebit) elBankDebit.textContent = '- ' + formatCentsBRL(totalBankDebitCents);
  const elBankInvoices = document.getElementById('bankTabInvoices');
  if (elBankInvoices) elBankInvoices.textContent = totalInvoicePaidInBankCents > 0 ? `🧾 ${formatCentsBRL(totalInvoicePaidInBankCents)}` : 'R$ 0,00';
  const elBankEnding = document.getElementById('bankTabEnding');
  if (elBankEnding) {
    elBankEnding.textContent = formatCentsBRL(bankEndingBalanceCents);
    elBankEnding.className = bankEndingBalanceCents >= 0
      ? 'text-sm sm:text-base font-bold text-emerald-600 block mt-1'
      : 'text-sm sm:text-base font-bold text-rose-600 block mt-1';
  }

  const bankSearchQ = (document.getElementById('bankTxSearchInput')?.value || '').trim().toUpperCase();
  const bankTypeFilter = document.getElementById('bankTypeFilterSelect')?.value || 'ALL';
  const bankCatFilter = document.getElementById('bankCategoryFilterSelect')?.value || 'ALL';

  const allBankTx = periodTx.filter(t => t.accountId === 'cc_itau_conjunta');
  const navBankBadge = document.getElementById('navBankTxCountBadge');
  if (navBankBadge) navBankBadge.textContent = String(allBankTx.length);

  const filteredBankTx = allBankTx.filter(t => {
    if (bankTypeFilter !== 'ALL') {
      if (bankTypeFilter === 'income' && t.type !== 'income' && t.kind !== 'income' && t.kind !== 'reimbursement') return false;
      if (bankTypeFilter === 'expense' && (t.type === 'income' || t.kind === 'income' || t.kind === 'invoice_payment')) return false;
      if (bankTypeFilter === 'invoice_payment' && t.kind !== 'invoice_payment') return false;
    }
    if (bankCatFilter !== 'ALL' && t.category !== bankCatFilter) return false;
    if (bankSearchQ) {
      const hay = `${t.desc} ${t.category} ${t.owner} ${t.date} ${t.amount.toFixed(2)}`.toUpperCase();
      if (!hay.includes(bankSearchQ)) return false;
    }
    return true;
  }).sort((a, b) => toSortableDate(b.date, b.period).localeCompare(toSortableDate(a.date, a.period)));

  const bankCountBadge = document.getElementById('bankTxCountBadge');
  if (bankCountBadge) bankCountBadge.textContent = `${filteredBankTx.length} itens`;

  const bankListEl = document.getElementById('bankTransactionsList');
  if (bankListEl) {
    if (filteredBankTx.length === 0) {
      bankListEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 italic bg-sky-50/30 rounded-xl border border-sky-100">Nenhuma movimentação encontrada na Conta Bancária para os filtros selecionados.</div>`;
    } else {
      bankListEl.innerHTML = filteredBankTx.map(t => {
        const isInc = t.type === 'income' || t.kind === 'income' || t.kind === 'reimbursement';
        const isInvoicePay = t.kind === 'invoice_payment';
        const kindPill = isInvoicePay
          ? `<span class="text-[10px] bg-sky-50 text-sky-800 font-semibold px-2 py-0.5 rounded-md border border-sky-200">Quitação de Fatura</span>`
          : (isInc
            ? `<span class="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-md">Entrada (+)</span>`
            : `<span class="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md">Saída Débito (-)</span>`);

        return `
          <div class="flex items-center justify-between p-3 rounded-xl border border-sky-100 hover:bg-sky-50/50 transition text-xs sm:text-sm">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-20 shrink-0">
                <span class="text-[11px] font-bold text-slate-700 block">${escapeHtml(t.date)}</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600 inline-block mt-0.5">${formatPeriodLabel(t.period)}</span>
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-slate-800 truncate">${escapeHtml(t.desc)}</p>
                <div class="flex flex-wrap items-center gap-1.5 mt-1">
                  <span class="text-[10px] bg-sky-50 text-sky-800 font-semibold px-2 py-0.5 rounded-md border border-sky-200/60">Conta Itaú</span>
                  ${kindPill}
                  <span class="text-[11px] text-slate-400">${escapeHtml(t.category)}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              <strong class="${isInc ? 'text-emerald-600' : 'text-slate-900'} font-semibold">
                ${isInc ? '+' : '-'} ${formatBRL(t.amount)}
              </strong>
              <button onclick="openEditTxModal('${t.id}')" class="text-sky-600 hover:text-sky-800 px-1" title="Editar lançamento">✎</button>
              <button onclick="deleteTransaction('${t.id}')" class="text-slate-300 hover:text-rose-600 px-1" title="Excluir lançamento">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 8. Renderiza Lista de Compras Exclusivas dos Cartões de Crédito (Éveli & Vital)
  const cardSearchQ = (document.getElementById('cardTxSearchInput')?.value || '').trim().toUpperCase();
  const cardAccFilter = document.getElementById('cardAccountFilterSelect')?.value || 'ALL';
  const cardCatFilter = document.getElementById('cardCategoryFilterSelect')?.value || 'ALL';
  const cardInstFilter = document.getElementById('cardInstallmentsFilterSelect')?.value || 'ALL';

  const allCardTx = periodTx.filter(t => t.type === 'card' || (t.accountId && t.accountId !== 'cc_itau_conjunta' && t.accountId !== 'poupanca_caixa'));
  const navCardBadge = document.getElementById('navCardTxCountBadge');
  if (navCardBadge) navCardBadge.textContent = String(allCardTx.length);

  const filteredCardTx = allCardTx.filter(t => {
    if (cardAccFilter !== 'ALL' && t.accountId !== cardAccFilter) return false;
    if (cardCatFilter !== 'ALL' && t.category !== cardCatFilter) return false;
    if (cardInstFilter === 'parceladas' && (!t.installmentTotal || t.installmentTotal < 2)) return false;
    if (cardInstFilter === 'avista' && t.installmentTotal && t.installmentTotal >= 2) return false;
    if (cardSearchQ) {
      const hay = `${t.desc} ${t.category} ${t.owner} ${t.date} ${t.amount.toFixed(2)}`.toUpperCase();
      if (!hay.includes(cardSearchQ)) return false;
    }
    return true;
  }).sort((a, b) => toSortableDate(b.date, b.period).localeCompare(toSortableDate(a.date, a.period)));

  const cardCountBadge = document.getElementById('cardTxCountBadge');
  if (cardCountBadge) cardCountBadge.textContent = `${filteredCardTx.length} compras`;

  const cardListEl = document.getElementById('cardTransactionsList');
  if (cardListEl) {
    if (filteredCardTx.length === 0) {
      cardListEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 italic bg-sky-50/30 rounded-xl border border-sky-100">Nenhuma compra no cartão encontrada para os filtros selecionados.</div>`;
    } else {
      cardListEl.innerHTML = filteredCardTx.map(t => {
        const instBadge = (t.installmentTotal && t.installmentTotal >= 2)
          ? `<span class="text-[10px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-md">${t.installmentCurrent}/${t.installmentTotal}</span>`
          : `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">À vista</span>`;

        const cardLabel = t.accountId === 'card_marido' ? 'Cartão Vital' : 'Cartão Éveli';

        return `
          <div class="flex items-center justify-between p-3 rounded-xl border border-sky-100 hover:bg-sky-50/50 transition text-xs sm:text-sm">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-24 shrink-0">
                <span class="text-[11px] font-bold text-slate-700 block">${escapeHtml(t.date)}</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-medium bg-sky-50 text-sky-800 border border-sky-200/80 inline-block mt-0.5" title="Mês da Fatura">Fatura ${formatPeriodLabel(t.period)}</span>
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-slate-800 truncate">${escapeHtml(t.desc)}</p>
                <div class="flex flex-wrap items-center gap-1.5 mt-1">
                  <span class="text-[10px] bg-sky-50 text-sky-800 font-semibold px-2 py-0.5 rounded-md border border-sky-200/60">${cardLabel}</span>
                  ${instBadge}
                  <span class="text-[11px] text-slate-400">${escapeHtml(t.category)}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              <strong class="text-slate-900 font-semibold">
                - ${formatBRL(t.amount)}
              </strong>
              <button onclick="openEditTxModal('${t.id}')" class="text-sky-600 hover:text-sky-800 px-1" title="Editar compra">✎</button>
              <button onclick="deleteTransaction('${t.id}')" class="text-slate-300 hover:text-rose-600 px-1" title="Excluir compra">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Compatibilidade com lista mista legada (caso ainda exista no DOM)
  const legacyListEl = document.getElementById('transactionsList');
  if (legacyListEl) {
    const txBadge = document.getElementById('txCountBadge');
    if (txBadge) txBadge.textContent = `${visibleTx.length} itens`;
    const navLegacyBadge = document.getElementById('navTxCountBadge');
    if (navLegacyBadge) navLegacyBadge.textContent = String(periodTx.length);

    legacyListEl.innerHTML = visibleTx.map(t => {
      const isInc = t.type === 'income' || t.kind === 'income' || t.kind === 'reimbursement';
      const isSavings = t.accountId === 'poupanca_caixa';
      const isCard = t.type === 'card' || (t.accountId && t.accountId !== 'cc_itau_conjunta' && !isSavings);
      const ownerBadge = `<span class="text-[10px] bg-sky-50 text-sky-800 font-medium px-2 py-0.5 rounded-md border border-sky-200/60">${escapeHtml(t.owner)} • ${escapeHtml(t.source)}</span>`;

      const scopeBadge = t.scope === 'individual'
        ? `<span class="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md">Individual</span>`
        : `<span class="text-[10px] bg-sky-50/70 text-sky-700 font-normal px-2 py-0.5 rounded-md">Casal</span>`;

      const instBadge = (t.installmentTotal && t.installmentTotal >= 2)
        ? `<span class="text-[10px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-md">${t.installmentCurrent}/${t.installmentTotal}</span>`
        : '';

      const kindBadge = t.kind === 'invoice_payment'
        ? `<span class="text-[10px] bg-sky-50 text-sky-700 font-medium px-2 py-0.5 rounded-md">Quitação de Fatura</span>`
        : (t.kind === 'reimbursement'
          ? `<span class="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-md">Reembolso</span>`
          : (t.kind === 'transfer'
            ? `<span class="text-[10px] bg-sky-50 text-sky-700 font-medium px-2 py-0.5 rounded-md">Reserva Meta</span>`
            : ''));

      const periodBadge = isSavings
        ? `<span class="text-[9px] px-1.5 py-0.5 rounded font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80 inline-block mt-0.5">Poupança Caixa</span>`
        : (isCard
          ? `<span class="text-[9px] px-1.5 py-0.5 rounded font-medium bg-sky-50 text-sky-800 border border-sky-200/80 inline-block mt-0.5" title="Mês da Fatura em que o gasto foi cobrado">Fatura ${formatPeriodLabel(t.period)}</span>`
          : `<span class="text-[9px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600 inline-block mt-0.5" title="Mês do Extrato da Conta">${formatPeriodLabel(t.period)}</span>`);

      return `
        <div class="flex items-center justify-between p-3 rounded-xl border border-sky-100 hover:bg-sky-50/50 transition text-xs sm:text-sm">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-24 shrink-0">
              <span class="text-[11px] font-bold text-slate-700 block">${escapeHtml(t.date)}</span>
              ${periodBadge}
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-slate-800 truncate">${escapeHtml(t.desc)}</p>
              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                ${ownerBadge}
                ${scopeBadge}
                ${instBadge}
                ${kindBadge}
                <span class="text-[11px] text-slate-400">${escapeHtml(t.category)}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-2">
            <strong class="${isInc ? 'text-emerald-600' : 'text-slate-900'} font-semibold">
              ${isInc ? '+' : '-'} ${formatBRL(t.amount)}
            </strong>
            <button onclick="openEditTxModal('${t.id}')" class="text-sky-600 hover:text-sky-800 px-1" title="Editar lançamento">✎</button>
            <button onclick="deleteTransaction('${t.id}')" class="text-slate-300 hover:text-rose-600 px-1" title="Excluir lançamento">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 8.6 Renderiza Controle Diário (Gastos Pessoais & Foto de Notas Fiscais)
  renderDailyExpensesSection(p);

  if (typeof updateAuthHeaderUI === 'function') {
    updateAuthHeaderUI();
  }
}

// ----------------------------------------------------------------------------
// RENDERIZAÇÃO DO CONTROLE PESSOAL DE GASTOS DIÁRIOS & NOTAS FISCAIS
// ----------------------------------------------------------------------------
function renderDailyExpensesSection(p) {
  const dailyTabEl = document.getElementById('dailyExpensesList');
  const allDaily = (state.dailyExpenses || []).filter(d => p === 'ALL' || d.period === p);

  const navDailyBadge = document.getElementById('navDailyCountBadge');
  if (navDailyBadge) navDailyBadge.textContent = String(allDaily.length);

  const dailyCountBadge = document.getElementById('dailyExpenseCountBadge');
  if (dailyCountBadge) dailyCountBadge.textContent = `${allDaily.length} itens`;

  let dailyTotalSpentCents = 0;
  let dailyTotalIncomeCents = 0;
  let dailyReconciledCount = 0;
  let dailyPendingCount = 0;

  allDaily.forEach(d => {
    const c = toCents(d.amount);
    if (d.direction === 'expense') dailyTotalSpentCents += c;
    else dailyTotalIncomeCents += c;
    if (d.reconciled) dailyReconciledCount++;
    else dailyPendingCount++;
  });

  const dailySpentDisplay = document.getElementById('dailyTotalSpentDisplay');
  if (dailySpentDisplay) dailySpentDisplay.textContent = formatCentsBRL(dailyTotalSpentCents);

  const dailyIncomeDisplay = document.getElementById('dailyTotalIncomeDisplay');
  if (dailyIncomeDisplay) dailyIncomeDisplay.textContent = formatCentsBRL(dailyTotalIncomeCents);

  const dailyReconDisplay = document.getElementById('dailyReconciledDisplay');
  if (dailyReconDisplay) dailyReconDisplay.textContent = `${dailyReconciledCount} de ${allDaily.length} itens`;

  const dailyPendingDisplay = document.getElementById('dailyPendingDisplay');
  if (dailyPendingDisplay) dailyPendingDisplay.textContent = `${dailyPendingCount} itens pendentes`;

  // Define data padrão de hoje no formulário diário se estiver vazio
  const dailyDateInp = document.getElementById('dailyDate');
  if (dailyDateInp && !dailyDateInp.value) {
    dailyDateInp.value = new Date().toISOString().split('T')[0];
  }

  // Define o mês anterior para o botão de conciliação do dia 1º
  const prevPeriod = (p === 'ALL' || !p) ? '2026-09' : addMonthsToPeriod(p, -1);
  const reconPrevBtn = document.getElementById('btnReconcilePrevMonth');
  if (reconPrevBtn) {
    reconPrevBtn.textContent = `🔍 Conciliar Mês Anterior (${formatPeriodLabel(prevPeriod)}) c/ o Banco`;
    reconPrevBtn.onclick = () => reconcileDailyExpensesWithBank(prevPeriod);
  }

  const reconCurBtn = document.getElementById('btnReconcileCurMonth');
  if (reconCurBtn) {
    reconCurBtn.textContent = `⚡ Conciliar Mês Atual (${formatPeriodLabel(p)})`;
    reconCurBtn.onclick = () => reconcileDailyExpensesWithBank(p);
  }

  if (dailyTabEl) {
    if (allDaily.length === 0) {
      dailyTabEl.innerHTML = `
        <div class="p-8 text-center text-xs text-slate-500 bg-sky-50/40 rounded-2xl border border-sky-100 flex flex-col items-center justify-center">
          <span class="text-3xl mb-2">📝</span>
          <p class="font-bold text-slate-700">Nenhum gasto anotado no Controle Diário para ${formatPeriodLabel(p)}.</p>
          <p class="text-slate-400 mt-1 max-w-md">Use o formulário acima para anotar compras do dia a dia ou fotografe notas fiscais. Todo dia 1º, concilie seus registros com o extrato bancário!</p>
        </div>
      `;
    } else {
      dailyTabEl.innerHTML = allDaily.map(d => {
        const isExp = d.direction === 'expense';
        let methodBadge = '';
        if (d.paymentMethod === 'credit_card') {
          methodBadge = `<span class="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-semibold">💳 Crédito (${escapeHtml(d.cardHolder || 'Cartão')})</span>`;
        } else if (d.paymentMethod === 'debit_card') {
          methodBadge = `<span class="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md font-semibold">💳 Débito Itaú</span>`;
        } else if (d.paymentMethod === 'pix') {
          methodBadge = `<span class="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-semibold">💠 PIX</span>`;
        } else if (d.paymentMethod === 'cash') {
          methodBadge = `<span class="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">💵 Dinheiro Vivo</span>`;
        } else {
          methodBadge = `<span class="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-semibold">Outros</span>`;
        }

        const reconBadge = d.reconciled
          ? `<span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><span>✅ Conciliado</span><span class="text-[9px] font-normal text-emerald-600">(${d.reconciledAt || 'Banco'})</span></span>`
          : (d.paymentMethod === 'cash'
            ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Dinheiro Físico (Não passa pelo banco)</span>`
            : `<span class="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">🟡 Pendente de Conciliação</span>`);

        const photoBtn = d.receiptImage
          ? `<button onclick="viewReceiptModal('${d.id}')" class="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition" title="Ver foto da nota fiscal"><span>📷</span> <span>Ver Nota</span></button>`
          : '';

        return `
          <div class="flex flex-wrap items-center justify-between p-3.5 rounded-2xl border ${d.reconciled ? 'border-sky-100 bg-white' : 'border-amber-200/70 bg-amber-50/20'} hover:bg-sky-50/40 transition gap-3 text-xs sm:text-sm">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="w-20 shrink-0 text-left">
                <span class="text-xs font-bold text-slate-800 block">${escapeHtml(d.date)}</span>
                <span class="text-[9px] text-slate-400 block">${formatPeriodLabel(d.period)}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  <p class="font-bold text-slate-900 truncate">${escapeHtml(d.desc)}</p>
                  ${reconBadge}
                </div>
                <div class="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  ${methodBadge}
                  <span class="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">${escapeHtml(d.category)}</span>
                  ${photoBtn}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <strong class="text-sm sm:text-base font-bold ${isExp ? 'text-slate-900' : 'text-emerald-600'}">
                ${isExp ? '- ' : '+ '}${formatBRL(d.amount)}
              </strong>
              <button onclick="toggleManualDailyReconciliation('${d.id}')" class="text-[11px] font-semibold px-2 py-1 rounded-lg border transition ${d.reconciled ? 'bg-slate-50 text-slate-500 border-slate-200 hover:text-amber-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}" title="${d.reconciled ? 'Desmarcar conciliação' : 'Marcar como conciliado manualmente'}">
                ${d.reconciled ? '↩ Desconciliar' : '✓ Conciliar'}
              </button>
              <button onclick="deleteDailyExpense('${d.id}')" class="text-slate-300 hover:text-rose-600 font-bold px-1.5 py-1 text-sm transition" title="Excluir lançamento">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// ----------------------------------------------------------------------------
// RESUMO DESCOMPLICADO DO MÊS (Didática de Economia Doméstica para Leigos)
// ----------------------------------------------------------------------------
function renderPlainLanguageDiagnostic(p, summary, owner) {
  const container = document.getElementById('plainLanguageDiagnosticContainer');
  if (!container) return;

  const {
    startInfo,
    prevBalanceCents,
    totalIncomeCents,
    totalReimbursementBankCents,
    totalBankDebitCents,
    totalInvoicePaidInBankCents,
    cardEveliCents,
    cardMaridoCents,
    bankEndingBalanceCents,
    projectedBalanceCents
  } = summary;

  const pLabel = p === 'ALL' ? 'Todo o Período' : formatPeriodLabel(p);
  const totalInBankInflow = totalIncomeCents + totalReimbursementBankCents;
  const isOutubro = p === '2026-10';
  const isSetembro = p === '2026-09';

  const bankStatusBadge = bankEndingBalanceCents >= 0
    ? `<span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Saldo Positivo (${formatCentsBRL(bankEndingBalanceCents)})</span>`
    : `<span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Cheque Especial (${formatCentsBRL(bankEndingBalanceCents)})</span>`;

  let contextualNote = '';
  if (isSetembro) {
    contextualNote = `
      <div class="mt-3 p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 leading-relaxed">
        <strong>💡 O que aconteceu em Setembro/2026:</strong><br>
        O dinheiro que entrou na Conta Conjunta (depósitos de Vital somando R$ 3.400,00) pagou a fatura antiga do cartão (R$ 3.375,50 em 21/09) e outras despesas do mês. A conta terminou o mês com <strong>R$ 48,17</strong> positivos, e esse valor passou automaticamente a ser o saldo inicial de Outubro!
      </div>
    `;
  } else if (isOutubro) {
    contextualNote = `
      <div class="mt-3 p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 leading-relaxed">
        <strong>💡 O que está acontecendo em Outubro/2026 (dados reais até 24/10):</strong><br>
        • <strong>Conta Itaú:</strong> Recebeu R$ 500,00 de transferência de Vital e pagou R$ 552,66 em débitos (Detran R$ 419,55, etc.), estando em <strong>${formatCentsBRL(bankEndingBalanceCents)}</strong> hoje.<br>
        • <strong>Fatura do Cartão Itaú Éveli:</strong> Fechou dia 14/10 em <strong>R$ 3.096,11</strong> (venceu 21/10). Ao ser paga pelo banco, a saída é registrada no extrato da conta sem duplicar lançamentos.<br>
        • <strong>Compras feitas após 14/10:</strong> Como o cartão fechou dia 14, as compras posteriores pertencem à fatura de Novembro.<br>
        • <strong>Cartão Vital:</strong> Limite total de R$ 6.000,00 preservado e disponível para quando Vital for usar.
      </div>
    `;
  } else if (p > '2026-10') {
    contextualNote = `
      <div class="mt-3 p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 leading-relaxed">
        <strong>💡 Projeção para ${pLabel}:</strong><br>
        Este é um mês futuro. Ele só terá saldos, receitas e débitos quando o mês chegar ou quando você importar o extrato do banco ou fatura do cartão correspondente. Se houver compras parceladas registradas em meses anteriores, as parcelas previstas já aparecerão nos radares automaticamente.
      </div>
    `;
  } else if (p === 'ALL') {
    contextualNote = `
      <div class="mt-3 p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 leading-relaxed">
        <strong>💡 Visão Geral Consolidada:</strong><br>
        Aqui você vê a soma de todas as movimentações registradas de Setembro/2026 até hoje. Para ver o diagnóstico específico de um mês e receber as dicas detalhadas de cada período, use o seletor de mês no topo da tela!
      </div>
    `;
  }

  const isExpanded = isCollapsibleCardExpanded('plain_diagnostic', false);

  container.innerHTML = `
    <div class="bg-white rounded-2xl border border-sky-200/80 shadow-sm shadow-sky-900/[0.03] overflow-hidden mb-4">
      <button 
        type="button" 
        onclick="toggleCollapsibleCard('plainDiagnosticBody', 'plainDiagnosticIcon', 'plain_diagnostic')" 
        class="w-full flex flex-wrap items-center justify-between gap-2 p-3.5 sm:p-4 text-left hover:bg-sky-50/50 collapsible-faixa select-none transition"
      >
        <div class="flex items-center gap-2.5">
          <span class="text-base sm:text-lg">📖</span>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-xs sm:text-sm md:text-base text-slate-900">Resumo Descomplicado da IA — ${pLabel}</h3>
              <span class="text-[10px] font-semibold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full uppercase">Didático</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">Diagnóstico em linguagem simples de dinheiro real e cartões</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div>${bankStatusBadge}</div>
          <span id="plainDiagnosticIcon" class="text-xs text-sky-700 font-bold bg-sky-100/70 w-6 h-6 rounded-full flex items-center justify-center transition-transform">
            ${isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      <div id="plainDiagnosticBody" class="${isExpanded ? '' : 'hidden'} border-t border-sky-100 p-4 sm:p-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <!-- Coluna 1: Conta Bancária Itaú -->
          <div class="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
            <div class="flex items-center justify-between font-semibold text-slate-800 mb-1.5">
              <span>🏦 Conta Conjunta Itaú</span>
              <span class="text-[10px] text-slate-500">Dinheiro Vivo</span>
            </div>
            <div class="space-y-1 text-slate-600">
              <div class="flex justify-between"><span>Saldo inicial recebido:</span> <strong>${formatCentsBRL(prevBalanceCents)}</strong></div>
              <div class="flex justify-between text-emerald-700"><span>Entrou (Salários/PIX):</span> <strong>+ ${formatCentsBRL(totalInBankInflow)}</strong></div>
              <div class="flex justify-between text-slate-700"><span>Saiu (Contas/Faturas):</span> <strong>- ${formatCentsBRL(totalBankDebitCents)}</strong></div>
              <div class="flex justify-between pt-1 border-t border-slate-200 font-bold ${bankEndingBalanceCents >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
                <span>Saldo na Conta Hoje:</span> <span>${formatCentsBRL(bankEndingBalanceCents)}</span>
              </div>
            </div>
          </div>

          <!-- Coluna 2: Cartões de Crédito -->
          <div class="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
            <div class="flex items-center justify-between font-semibold text-slate-800 mb-1.5">
              <span>💳 Cartões de Crédito</span>
              <span class="text-[10px] text-slate-500">Gastos no Mês</span>
            </div>
            <div class="space-y-1 text-slate-600">
              <div class="flex justify-between"><span>Cartão Éveli (MC Gold):</span> <strong class="text-slate-800">${formatCentsBRL(cardEveliCents)}</strong></div>
              <div class="flex justify-between"><span>Cartão Vital:</span> <strong class="text-slate-800">${formatCentsBRL(cardMaridoCents)}</strong></div>
              <div class="flex justify-between text-[11px] text-sky-800"><span>Faturas pagas no banco:</span> <strong>${formatCentsBRL(totalInvoicePaidInBankCents)}</strong></div>
              <div class="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                <span>Total Compras Cartão:</span> <span>${formatCentsBRL(cardEveliCents + cardMaridoCents)}</span>
              </div>
            </div>
          </div>

          <!-- Coluna 3: Visão Final do Casal -->
          <div class="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
            <div class="flex items-center justify-between font-semibold text-slate-800 mb-1.5">
              <span>⚖️ Balanço Geral Projetado</span>
              <span class="text-[10px] text-slate-500">${state.includeCurrentCardBill ? 'Conta - Cartão' : 'Só Conta'}</span>
            </div>
            <p class="text-slate-600 text-[11px] leading-relaxed">
              ${state.includeCurrentCardBill
                ? `Mostra quanto sobra se a fatura de <strong>${formatCentsBRL(cardEveliCents + cardMaridoCents)}</strong> for paga com o saldo da conta.`
                : 'Mostra estritamente o dinheiro que está disponível na conta corrente Itaú hoje.'}
            </p>
            <div class="mt-2 text-center p-2 rounded-lg ${projectedBalanceCents >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'} font-bold text-sm">
              ${formatCentsBRL(projectedBalanceCents)}
            </div>
          </div>
        </div>

        ${contextualNote}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// SEÇÃO CONSOLIDADA: CONTA E CARTÕES SEPARADOS MÊS A MÊS + TOTAL ACUMULADO
// ----------------------------------------------------------------------------
function renderConsolidatedAllMonthsSection(owner, scopeFilter) {
  const container = document.getElementById('consolidatedAllMonthsSection');
  if (!container || typeof calculateConsolidatedAllMonths !== 'function') return;

  const data = calculateConsolidatedAllMonths(owner, scopeFilter);
  const { evolution, totals } = data;
  const curPeriod = state.selectedPeriod;

  const totalMonthlyNetCents = totals.totalMonthlyNetCents !== undefined
    ? totals.totalMonthlyNetCents
    : (totals.totalIncomeCents - totals.totalBankDebitCents);

  const rowsHtml = evolution.map(r => {
    const isCur = r.period === curPeriod;
    const isFuture = r.period > '2026-10';
    const isDefined = r.hasDefinedValues !== false;

    const statusBadge = !isDefined
      ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Aguardando Mês</span>`
      : (r.period === '2026-10'
        ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">Mês Atual (Em Aberto)</span>`
        : `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Fechado</span>`);

    const monthlyNet = r.monthlyNetCents !== undefined ? r.monthlyNetCents : (r.incomeCents - r.bankDebitCents);

    if (!isDefined) {
      return `
        <tr onclick="setPeriod('${r.period}')" class="cursor-pointer transition border-b border-sky-100/70 hover:bg-sky-50/30 ${isCur ? 'bg-sky-50/80 font-medium' : 'text-slate-400'}">
          <td class="py-2.5 px-3">
            <div class="flex items-center gap-1.5">
              <span class="font-medium text-slate-500">${escapeHtml(r.label)}</span>
              ${isCur ? '<span class="text-[9px] bg-sky-600 text-white px-1.5 py-0.5 rounded font-bold">Ativo</span>' : ''}
            </div>
          </td>
          <td class="py-2.5 px-3 text-right text-slate-400">R$ 0,00</td>
          <td class="py-2.5 px-3 text-right text-slate-400">+ R$ 0,00</td>
          <td class="py-2.5 px-3 text-right text-slate-400">- R$ 0,00</td>
          <td class="py-2.5 px-3 text-right text-slate-400">+ R$ 0,00</td>
          <td class="py-2.5 px-3 text-right text-slate-400">R$ 0,00</td>
          <td class="py-2.5 px-3 text-right text-slate-400">R$ 0,00</td>
          <td class="py-2.5 px-3 text-center">${statusBadge}</td>
        </tr>
      `;
    }

    return `
      <tr onclick="setPeriod('${r.period}')" class="cursor-pointer transition border-b border-sky-100/70 hover:bg-sky-50/50 ${isCur ? 'bg-sky-50/80 font-medium' : ''}">
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1.5">
            <span class="font-bold ${isCur ? 'text-sky-900' : 'text-slate-800'}">${escapeHtml(r.label)}</span>
            ${isCur ? '<span class="text-[9px] bg-sky-600 text-white px-1.5 py-0.5 rounded font-bold">Ativo</span>' : ''}
          </div>
        </td>
        <td class="py-2.5 px-3 text-right text-sky-900 font-semibold" title="Saldo que a conta tinha no início deste mês">
          ${formatCentsBRL(r.startBalanceCents)}
        </td>
        <td class="py-2.5 px-3 text-right text-emerald-600 font-semibold">+ ${formatCentsBRL(r.incomeCents)}</td>
        <td class="py-2.5 px-3 text-right text-slate-700 font-medium">- ${formatCentsBRL(r.bankDebitCents)}</td>
        <td class="py-2.5 px-3 text-right font-bold ${monthlyNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}" title="Diferença entre entradas e saídas deste mês isolado">
          ${monthlyNet >= 0 ? '+' : ''}${formatCentsBRL(monthlyNet)}
        </td>
        <td class="py-2.5 px-3 text-right font-extrabold ${r.bankEndingCents >= 0 ? 'text-emerald-700' : 'text-rose-600'}" title="Saldo Anterior + Entradas - Saídas = Saldo real na conta">
          ${formatCentsBRL(r.bankEndingCents)}
        </td>
        <td class="py-2.5 px-3 text-right text-slate-700 font-medium">
          ${r.cardTotalCents > 0 ? `- ${formatCentsBRL(r.cardTotalCents)}` : 'R$ 0,00'}
          <div class="text-[10px] text-slate-400">É: ${formatCentsBRL(r.cardEveliCents)} | V: ${formatCentsBRL(r.cardVitalCents)}</div>
        </td>
        <td class="py-2.5 px-3 text-center">${statusBadge}</td>
      </tr>
    `;
  }).join('');

  const currentBankEnding = evolution.find(r => r.period === '2026-10')?.bankEndingCents ?? 0;
  const isExpanded = isCollapsibleCardExpanded('consolidated_annual', false);

  container.innerHTML = `
    <div class="overflow-hidden">
      <button 
        type="button" 
        onclick="toggleCollapsibleCard('consolidatedAnnualBody', 'consolidatedAnnualChevron', 'consolidated_annual')"
        class="w-full flex flex-wrap items-center justify-between gap-3 text-left hover:bg-sky-50/60 p-2 -m-2 rounded-xl collapsible-faixa select-none transition"
      >
        <div class="flex items-center gap-2.5">
          <span class="text-base sm:text-lg">📊</span>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-xs sm:text-sm md:text-base text-slate-900">Quadro de Resumo Anual (Todos os Meses)</h4>
              <span class="text-[10px] font-semibold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full uppercase">Isolado</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              Saldo anterior somado mês a mês, entradas/saídas da conta e saldo final acumulado
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-semibold text-sky-700 hidden sm:inline-block">Toque para ${isExpanded ? 'recolher' : 'expandir'}</span>
          <span id="consolidatedAnnualChevron" class="text-xs text-sky-700 font-bold bg-sky-100/70 w-6 h-6 rounded-full flex items-center justify-center transition-transform">
            ${isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      <div id="consolidatedAnnualBody" class="${isExpanded ? '' : 'hidden'} mt-4 pt-3 border-t border-sky-100">

      <!-- Banner Explicativo da Matemática Financeira -->
      <div class="mb-4 p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div class="flex items-center gap-2">
          <span class="text-base">💡</span>
          <div>
            <strong>Fórmula do Saldo em Conta:</strong>
            <span class="text-slate-700 ml-1">
              <strong>Saldo Anterior (+)</strong> + <strong>Entradas (+)</strong> − <strong>Saídas (−)</strong> = <strong class="text-emerald-800">Saldo Final em Conta</strong>.
            </span>
          </div>
        </div>
        <div class="text-[11px] text-slate-500">
          O <em>Resultado do Mês</em> fica vermelho quando saem mais recursos do que entram no mês (ex: mês com fatura de cartão), mas o Saldo Final permanece positivo porque o <strong>Saldo Anterior</strong> cobre a diferença.
        </div>
      </div>

      <!-- 4 Cards de Resumo Consolidado -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div class="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <div class="flex items-center justify-between font-bold text-slate-800 text-xs mb-2">
            <span>🏦 Conta Itaú (Acumulado)</span>
            <span class="text-[10px] text-slate-500 font-normal">Realizado</span>
          </div>
          <div class="space-y-1.5 text-xs text-slate-600">
            <div class="flex justify-between text-emerald-700">
              <span>Total Entradas:</span>
              <strong>+ ${formatCentsBRL(totals.totalIncomeCents)}</strong>
            </div>
            <div class="flex justify-between text-slate-700">
              <span>Total Saídas Conta:</span>
              <strong>- ${formatCentsBRL(totals.totalBankDebitCents)}</strong>
            </div>
            <div class="flex justify-between pt-1 border-t border-slate-200 font-bold ${currentBankEnding >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
              <span>Saldo Conta Hoje:</span>
              <span>${formatCentsBRL(currentBankEnding)}</span>
            </div>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
          <div class="flex items-center justify-between font-bold text-slate-800 text-xs mb-2">
            <span>💳 Cartões de Crédito</span>
            <span class="text-[10px] text-slate-500 font-normal">Faturas</span>
          </div>
          <div class="space-y-1.5 text-xs text-slate-600">
            <div class="flex justify-between">
              <span>Compras Éveli:</span>
              <strong>${formatCentsBRL(totals.totalCardEveliCents)}</strong>
            </div>
            <div class="flex justify-between">
              <span>Compras Vital:</span>
              <strong>${formatCentsBRL(totals.totalCardVitalCents)}</strong>
            </div>
            <div class="flex justify-between text-sky-800 pt-1 border-t border-slate-200 font-bold">
              <span>Total Compras Cartões:</span>
              <span>${formatCentsBRL(totals.totalCardCents)}</span>
            </div>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
          <div class="flex items-center justify-between font-bold text-emerald-950 text-xs mb-2">
            <span>💰 Poupança & Investimentos</span>
            <span class="text-[10px] text-emerald-800 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded">Reserva</span>
          </div>
          <p class="text-[11px] text-slate-600 leading-relaxed mb-2">
            Economias guardadas na Caixa, Tesouro Direto e Poupança Itaú.
          </p>
          <div class="flex justify-between items-center pt-1 border-t border-emerald-200 font-bold text-emerald-800">
            <span>Total Guardado:</span>
            <span class="text-sm">${formatCentsBRL(totals.totalInvestedAllCents)}</span>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-sky-50/80 border border-sky-200">
          <div class="flex items-center justify-between font-bold text-sky-950 text-xs mb-2">
            <span>💎 Patrimônio da Família</span>
            <span class="text-[10px] text-sky-800 font-semibold bg-sky-100 px-1.5 py-0.5 rounded">Total Geral</span>
          </div>
          <p class="text-[11px] text-slate-600 leading-relaxed mb-1">
            Saldo em conta corrente + Poupanças e Investimentos:
          </p>
          <div class="text-center p-2 rounded-lg ${totals.patrimonioTotalCents >= 0 ? 'bg-sky-100/80 text-sky-900' : 'bg-rose-50 text-rose-800'} font-bold text-base mt-2">
            ${formatCentsBRL(totals.patrimonioTotalCents)}
          </div>
        </div>
      </div>

      <!-- Tabela Comparativa de Resumo Anual Mês a Mês -->
      <div class="overflow-x-auto custom-scroll border border-sky-100 rounded-xl">
        <table class="w-full text-xs text-left">
          <thead class="bg-sky-50 text-sky-900 border-b border-sky-200 font-bold">
            <tr>
              <th class="py-2.5 px-3">Mês</th>
              <th class="py-2.5 px-3 text-right text-sky-900" title="Saldo que a conta tinha no início do mês">Saldo Anterior (+)</th>
              <th class="py-2.5 px-3 text-right text-emerald-700">Entrada Conta (+)</th>
              <th class="py-2.5 px-3 text-right text-slate-700">Saída Conta (-)</th>
              <th class="py-2.5 px-3 text-right text-slate-800" title="Diferença deste mês: Entradas menos Saídas">Resultado do Mês</th>
              <th class="py-2.5 px-3 text-right text-slate-900 font-extrabold" title="Saldo Anterior + Entradas - Saídas">Saldo Final em Conta</th>
              <th class="py-2.5 px-3 text-right text-slate-700">Fatura Cartões (-)</th>
              <th class="py-2.5 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot class="bg-sky-100/90 font-bold border-t-2 border-sky-400 text-slate-900">
            <tr class="text-xs sm:text-sm">
              <td class="py-3 px-3 uppercase tracking-wider font-extrabold text-sky-950">TOTAIS GERAIS</td>
              <td class="py-3 px-3 text-right text-sky-950 font-extrabold" title="Saldo de partida inicial da base em Setembro">${formatCentsBRL(totals.initialBaseStartBalanceCents || 0)}</td>
              <td class="py-3 px-3 text-right text-emerald-700 font-extrabold">+ ${formatCentsBRL(totals.totalIncomeCents)}</td>
              <td class="py-3 px-3 text-right text-rose-700 font-extrabold">- ${formatCentsBRL(totals.totalBankDebitCents)}</td>
              <td class="py-3 px-3 text-right font-extrabold ${totalMonthlyNetCents >= 0 ? 'text-emerald-700' : 'text-rose-700'}" title="Total acumulado de entradas menos saídas">
                ${totalMonthlyNetCents >= 0 ? '+' : ''}${formatCentsBRL(totalMonthlyNetCents)}
              </td>
              <td class="py-3 px-3 text-right font-extrabold ${currentBankEnding >= 0 ? 'text-emerald-700' : 'text-rose-700'}" title="Saldo final atual da conta bancária">
                ${formatCentsBRL(currentBankEnding)}
              </td>
              <td class="py-3 px-3 text-right text-slate-900 font-extrabold">
                ${totals.totalCardCents > 0 ? `- ${formatCentsBRL(totals.totalCardCents)}` : 'R$ 0,00'}
                <div class="text-[10px] text-slate-500 font-normal">Éveli: ${formatCentsBRL(totals.totalCardEveliCents)} | Vital: ${formatCentsBRL(totals.totalCardVitalCents)}</div>
              </td>
              <td class="py-3 px-3 text-center text-xs text-sky-800 font-bold">Consolidado</td>
            </tr>
            <tr class="bg-emerald-50 text-emerald-950 font-bold border-t border-emerald-200">
              <td colspan="5" class="py-2.5 px-3 text-xs">
                🏦 <strong>POUPANÇAS & INVESTIMENTOS ISOLADOS:</strong> Poupança Caixa (${formatCentsBRL(totals.caixaSavingsBalanceCents)}) + Tesouro & Poupança Itaú (${formatCentsBRL(totals.extraInvestmentsCents)})
              </td>
              <td colspan="2" class="py-2.5 px-3 text-right text-xs text-emerald-800">
                Total Guardado: <strong>${formatCentsBRL(totals.totalInvestedAllCents)}</strong>
              </td>
              <td class="py-2.5 px-3 text-right text-xs text-sky-950 font-extrabold">
                💎 Patrimônio Total: ${formatCentsBRL(totals.patrimonioTotalCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Isola os meses automaticamente caso arquivos importados tenham misturado períodos
    if (typeof reorganizeAndIsolateMonths === 'function') {
      reorganizeAndIsolateMonths(false);
    }
    if (typeof restoreCollapsibleCardsState === 'function') {
      restoreCollapsibleCardsState();
    }
    renderAll();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  });

  // Permite fechar qualquer janela modal apertando a tecla ESC do teclado
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (typeof closeEditTxModal === 'function') closeEditTxModal();
      if (typeof closeBackupModal === 'function') closeBackupModal();
      if (typeof closeImportModal === 'function') closeImportModal();
      if (typeof closeCardSettingsModal === 'function') closeCardSettingsModal();
      if (typeof closeAuthCloudModal === 'function') closeAuthCloudModal();
      if (typeof closeAiAdvisorModal === 'function') closeAiAdvisorModal();
      if (typeof closeInvestmentImageModal === 'function') closeInvestmentImageModal();
      if (typeof closeInvestmentEditModal === 'function') closeInvestmentEditModal();
      if (typeof closeReceiptViewerModal === 'function') closeReceiptViewerModal();
      if (typeof closeReconciliationModal === 'function') closeReconciliationModal();
      if (typeof closeFilesManagerModal === 'function') closeFilesManagerModal();
    }
  });
}
