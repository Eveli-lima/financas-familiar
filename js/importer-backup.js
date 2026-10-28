// ============================================================================
// MÓDULO 5: IMPORTADOR (.PDF, .OFX, .CSV, .TXT) E BACKUP (.JSON / .CSV)
// ============================================================================
// Por que este módulo existe?
// Isola a leitura de arquivos externos, classificação automática de categorias,
// prevenção de lançamentos duplicados e exportação/restauração de backups.

if (typeof window !== 'undefined' && window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function openBackupModal() {
  document.getElementById('backupModal').classList.remove('hidden');
}

function closeBackupModal() {
  document.getElementById('backupModal').classList.add('hidden');
}

function exportBackupJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 'financas_casal_v5',
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `backup_financas_casal_${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackupJsonFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      const candidate = parsed.data && parsed.data.transactions ? parsed.data : parsed;
      if (!candidate || !Array.isArray(candidate.transactions)) {
        alert('Arquivo JSON inválido: não contém a lista de lançamentos.');
        return;
      }
      // Segurança: higieniza o arquivo antes de aceitar (ids, tipos e valores)
      const newState = sanitizeState(candidate);
      newState.transactions = enrichTransactionsAndProjectInstallments(newState.transactions);
      state = newState;
      saveState();
      renderAll();
      closeBackupModal();
      alert(`✅ Backup restaurado com sucesso! (${state.transactions.length} lançamentos carregados).`);
    } catch (err) {
      alert('Erro ao ler o arquivo de backup .JSON.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// Segurança (CSV Injection): se um texto começar com = + - @ o Excel pode
// executá-lo como fórmula. Colocamos um apóstrofo na frente para neutralizar.
function csvSafeText(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportTransactionsCsv() {
  const headers = ['ID', 'Período', 'Data', 'Titular', 'Escopo', 'Conta/Cartão', 'Natureza', 'Categoria', 'Descrição', 'Parcela', 'Valor (R$)'];
  const rows = state.transactions.map(t => {
    const instStr = t.installmentTotal ? `${t.installmentCurrent}/${t.installmentTotal}` : 'À vista';
    const valSigned = (t.type === 'income' || t.kind === 'income' || t.kind === 'reimbursement')
      ? t.amount.toFixed(2).replace('.', ',')
      : (-t.amount).toFixed(2).replace('.', ',');
    return [
      t.id,
      t.period,
      t.date,
      t.owner,
      t.scope === 'individual' ? 'Individual' : 'Casal',
      t.source,
      t.kind || t.type,
      t.category,
      csvSafeText(t.desc),
      instStr,
      valSigned
    ].join(';');
  });

  // UTF-8 BOM (\uFEFF) garante acentuação perfeita no Excel do Windows
  const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planilha_financas_casal_${state.selectedPeriod}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetRealData() {
  if (!confirm('Deseja zerar os lançamentos e começar com a base 100% limpa (R$ 0,00) para inserir ou importar seus extratos e notas?')) return;
  const fresh = getInitialFamilyData();
  fresh.transactions = [];
  fresh.dailyExpenses = [];
  fresh.uploadedFiles = [];
  fresh.importedSources = [];
  fresh.periodStartingBalances = {
    '2026-09': { amount: 0, label: 'Saldo Inicial (Setembro/2026)' },
    '2026-10': { amount: 0, label: 'Saldo Inicial (Outubro/2026)' },
    'ALL':     { amount: 0, label: 'Saldo Inicial' }
  };
  if (fresh.cardsConfig?.card_eveli_5544) {
    fresh.cardsConfig.card_eveli_5544.officialInvoiceTotals = {};
  }
  if (fresh.cardsConfig?.card_marido) {
    fresh.cardsConfig.card_marido.officialInvoiceTotals = {};
  }
  state = fresh;
  saveState();
  if (typeof pushStateToSupabaseCloud === 'function') {
    pushStateToSupabaseCloud(true);
  }
  renderAll();
  closeBackupModal();
  alert('✨ Sistema zerado com sucesso! Saldo inicial R$ 0,00, pronto para novos lançamentos e importações a partir de Setembro/2026.');
}

function classifyItemCategory(desc, isIncome, isCard) {
  const d = String(desc || '').toUpperCase();
  if (d.includes('FATURA ITAU') || d.includes('PAGTO FATURA') || d.includes('PAGAMENTO DA FATURA')) {
    return 'Faturas Antigas Pagas';
  }
  if (isIncome) return 'Receita';
  if (d.includes('UBER') || d.includes('99APP') || d.includes('99 POP') || d.includes('POSTO') || d.includes('SHELL') || d.includes('IPIRANGA')) {
    return 'Uber & Transporte';
  }
  if (d.includes('CHEIRIN') || d.includes('PIZZA') || d.includes('BURGER') || d.includes('RESTAUR') || d.includes('SIOLI') || d.includes('IFOOD') || d.includes('LANCHE') || d.includes('COFFEE') || d.includes('JOAO E JOAO') || d.includes('BRODAO') || d.includes('CONVEM') || d.includes('PADARIA')) {
    return 'Lanches & Restaurantes';
  }
  if (d.includes('PREZUNIC') || d.includes('MERCADO') || d.includes('ASSAI') || d.includes('ATACADAO') || d.includes('PRINCESA') || d.includes('HORTIFRUT') || d.includes('CASAS PEDRO') || d.includes('GUANABARA') || d.includes('CARREFOUR')) {
    return 'Mercado & Hortifruti';
  }
  if (d.includes('DROGA') || d.includes('FARMA') || d.includes('RAIA') || d.includes('PACHECO') || d.includes('GIGIO') || d.includes('FITNES') || d.includes('HEALTH') || d.includes('CARTAO DE TODOS')) {
    return 'Saúde, Farmácia & Academia';
  }
  if (d.includes('DETRAN') || d.includes('AUTO ESCOLA')) {
    return 'Auto Escola & Detran';
  }
  if (isCard && extractInstallmentFromDesc(d)) {
    return 'Parcelamentos Cartão';
  }
  return 'Casa, Serviços & Outros';
}

async function extractTextFromPdfFile(file) {
  if (typeof window.pdfjsLib === 'undefined') {
    throw new Error('A biblioteca de leitura de PDF (PDF.js) não foi carregada no navegador.');
  }

  if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Páginas de faturas (ex: Itaú) costumam ter layout de 2 colunas com compras na esquerda e direita
    const leftItems = textContent.items.filter(item => item.transform[4] < 350);
    const rightItems = textContent.items.filter(item => item.transform[4] >= 350);

    const hasTwoCols = leftItems.some(i => /\d{1,2}\s*[\/\-]\s*\d{1,2}/.test(i.str)) &&
                       rightItems.some(i => /\d{1,2}\s*[\/\-]\s*\d{1,2}/.test(i.str));

    function itemsToLines(items) {
      const rowsMap = {};
      items.forEach(item => {
        const yKey = Math.round(item.transform[5] / 4) * 4;
        if (!rowsMap[yKey]) rowsMap[yKey] = [];
        rowsMap[yKey].push({ x: item.transform[4], str: item.str });
      });
      const sortedYs = Object.keys(rowsMap).map(Number).sort((a, b) => b - a);
      const lines = [];
      sortedYs.forEach(y => {
        const rowStr = rowsMap[y]
          .sort((a, b) => a.x - b.x)
          .map(i => i.str.trim())
          .filter(Boolean)
          .join(' ');
        if (rowStr) lines.push(rowStr);
      });
      return lines;
    }

    if (hasTwoCols) {
      allLines.push(...itemsToLines(leftItems));
      allLines.push(...itemsToLines(rightItems));
    } else {
      allLines.push(...itemsToLines(textContent.items));
    }
  }
  return allLines.join('\n');
}

function buildImportSignature(accountId, period, dateStr, desc, amountCents) {
  const cleanDesc = String(desc || '').toUpperCase().replace(/\s+/g, ' ').trim();
  return `${accountId}|${period}|${dateStr}|${cleanDesc}|${amountCents}`;
}

let pendingImportPreviewItems = [];
let pendingImportSourceMeta = null;

function parseAnyFinancialText(rawText, owner, accountId, targetInvoicePeriod, previewOnly, fileMeta = null) {
  let addedCount = 0;
  let skippedDuplicates = 0;
  let invoicePaymentsDetected = 0;
  const candidates = [];
  const isCard = accountId !== 'cc_itau_conjunta';
  const sourceLabel = accountId === 'cc_itau_conjunta'
    ? 'Conta Conjunta Itaú'
    : (accountId === 'card_eveli_5544' ? 'Cartão MC Gold' : 'Cartão Vital');

  const existingSignatures = new Set(
    state.transactions.map(t => buildImportSignature(t.accountId, t.period, t.date, t.desc, toCents(t.amount)))
  );

  const pushCandidate = (txObj) => {
    if (fileMeta && fileMeta.id) {
      txObj.fileId = fileMeta.id;
      txObj.fileName = fileMeta.fileName || fileMeta.name;
    }
    if (txObj.kind === 'invoice_payment') invoicePaymentsDetected++;
    candidates.push({ ...txObj, selected: true });
    if (!previewOnly) {
      state.transactions.unshift(txObj);
    }
    addedCount++;
  };

  // 1. Formato .OFX (Extrato Oficial Itaú ou Cartão)
  if (rawText.includes('<STMTTRN>') || rawText.includes('<OFX>')) {
    const blocks = rawText.split('<STMTTRN>').slice(1);
    blocks.forEach((block, idx) => {
      const trnType = (block.match(/<TRNTYPE>([^\r\n<]+)/i) || [])[1]?.trim() || '';
      const dtPosted = (block.match(/<DTPOSTED>(\d{8})/i) || [])[1]?.trim() || '';
      const trnAmtRaw = (block.match(/<TRNAMT>([^\r\n<]+)/i) || [])[1]?.trim() || '0';
      const fitId = (block.match(/<FITID>([^\r\n<]+)/i) || [])[1]?.trim() || '';
      const memo = (block.match(/<MEMO>([^\r\n<]+)/i) || [])[1]?.trim() || 'Lançamento OFX';

      const amountVal = parseFloat(trnAmtRaw.replace(',', '.'));
      if (isNaN(amountVal) || amountVal === 0) return;

      let dateFormatted = '15/10/2026';
      if (dtPosted.length === 8) {
        dateFormatted = `${dtPosted.slice(6, 8)}/${dtPosted.slice(4, 6)}/${dtPosted.slice(0, 4)}`;
      }
      const period = typeof normalizePeriodByDate === 'function'
        ? normalizePeriodByDate(dateFormatted, accountId, targetInvoicePeriod || '2026-10')
        : `${dtPosted.slice(0, 4)}-${dtPosted.slice(4, 6)}`;

      const isPositive = amountVal > 0 || trnType.toUpperCase() === 'CREDIT';
      const absAmount = fromCents(toCents(Math.abs(amountVal)));
      const sig = fitId
        ? `${accountId}|FITID:${fitId}`
        : buildImportSignature(accountId, period, dateFormatted, memo, toCents(absAmount));

      if (existingSignatures.has(sig) || state.transactions.some(t => t.fitId && t.fitId === fitId)) {
        skippedDuplicates++;
        return;
      }
      existingSignatures.add(sig);

      const cat = classifyItemCategory(memo, isPositive && !isCard, isCard);
      const kind = cat === 'Faturas Antigas Pagas'
        ? 'invoice_payment'
        : (isCard ? (isPositive ? 'reimbursement' : 'expense') : (isPositive ? 'income' : 'expense'));

      pushCandidate({
        id: 'imp_ofx_' + Date.now() + '_' + idx,
        fitId: fitId || null,
        owner,
        source: sourceLabel,
        accountId,
        period,
        date: dateFormatted,
        type: isCard ? 'card' : (isPositive ? 'income' : 'debit'),
        kind,
        scope: 'shared',
        category: cat,
        desc: memo,
        amount: absAmount,
        createdBy: typeof getLoggedPerson === 'function' ? getLoggedPerson() : owner
      });
    });
    return { addedCount, skippedDuplicates, invoicePaymentsDetected, candidates };
  }

  // 2. Formato Texto de PDF, CSV ou TXT
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let inFutureInstallments = false;

  lines.forEach((line, idx) => {
    const up = line.toUpperCase();
    const norm = up.replace(/[\s\-_]/g, '');

    // Para faturas de cartão, seccionamento de parcelas futuras
    if (isCard) {
      if (norm.includes('COMPRASPARCELADAS') || 
          norm.includes('PROXIMASFATURAS') || 
          norm.includes('TOTALPARAPROXIMAS')) {
        inFutureInstallments = true;
        return;
      }
      if (inFutureInstallments) {
        return; // não lança compras das próximas faturas como despesa do mês atual
      }

      if (norm.includes('LANÇAMENTOSNOCARTÃO') ||
          norm.includes('LANÇAMENTOSPRODUTOSESERVIÇOS') ||
          norm.includes('TOTALDOSLANÇAMENTOSATUAIS') ||
          norm.includes('TOTALDESTAFATURA') ||
          norm.includes('TOTALDOSPAGAMENTOS') ||
          norm.includes('PAGAMENTOEFETUADO') ||
          norm.includes('PAGAMENTODEBAUTOMATIC')) {
        return;
      }
    }

    if (norm.includes('SALDODODIA') || norm.includes('SALDOANTERIOR') || norm.includes('SALDOFINAL') || norm.includes('AGENDADO')) {
      return;
    }

    if (line.includes(';') || /^\d{2}\/\d{2}(\/\d{2,4})?,/.test(line)) {
      const sep = line.includes(';') ? ';' : ',';
      const parts = line.split(sep).map(s => s.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 3) {
        const dStr = parts[0];
        const desc = parts[1];
        const rawVal = parts.slice(2).join(',').replace(/\./g, '').replace(',', '.');
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val !== 0 && /^\d{2}\/\d{2}/.test(dStr)) {
          const mm = dStr.slice(3, 5);
          const yyyy = dStr.length >= 10 ? dStr.slice(6, 10) : '2026';
          const fullDate = dStr.length === 5 ? `${dStr}/${yyyy}` : dStr;
          const period = (isCard && targetInvoicePeriod && targetInvoicePeriod !== 'ALL')
            ? targetInvoicePeriod
            : (typeof normalizePeriodByDate === 'function'
                ? normalizePeriodByDate(fullDate, accountId, targetInvoicePeriod || '2026-10')
                : `${yyyy}-${mm}`);
          const absAmount = fromCents(toCents(Math.abs(val)));
          const sig = buildImportSignature(accountId, period, fullDate, desc, toCents(absAmount));
          if (existingSignatures.has(sig)) {
            skippedDuplicates++;
            return;
          }
          existingSignatures.add(sig);

          const isPos = val > 0 && !isCard;
          const isCardRefund = isCard && val < 0;
          const cat = classifyItemCategory(desc, isPos, isCard);
          const inst = isCard ? extractInstallmentFromDesc(desc) : null;

          pushCandidate({
            id: 'imp_csv_' + Date.now() + '_' + idx,
            owner,
            source: sourceLabel,
            accountId,
            period,
            date: fullDate,
            type: isPos ? 'income' : (isCard ? 'card' : 'debit'),
            kind: cat === 'Faturas Antigas Pagas' ? 'invoice_payment' : (isCardRefund ? 'reimbursement' : (isPos ? 'income' : 'expense')),
            scope: 'shared',
            category: cat,
            installmentCurrent: inst ? inst.current : null,
            installmentTotal: inst ? inst.total : null,
            desc,
            amount: absAmount,
            createdBy: typeof getLoggedPerson === 'function' ? getLoggedPerson() : owner
          });
        }
      }
      return;
    }

    // Leitura inteligente de linha de PDF com tolerância a espaçamentos de fontes OCR
    let rawDate = null;
    let desc = null;
    let rawValStr = null;

    const matchDateAtStart = line.match(/^(\d\s*\d?\s*[\/\-]\s*\d\s*\d(?:\s*[\/\-]\s*[\d\s]{2,4})?)\s+(.+)$/);
    if (matchDateAtStart) {
      const rest = matchDateAtStart[2].trim();
      const matchAmtAtEnd = rest.match(/^(.+?)\s+([+-]?\s*\d{1,3}(?:\.\d{3})*\s*,\s*\d\s*\d-?|[+-]?\s*\d+\s*,\s*\d\s*\d-?)$/);
      if (matchAmtAtEnd) {
        rawDate = matchDateAtStart[1].replace(/\s+/g, '');
        desc = matchAmtAtEnd[1].replace(/\|/g, ' ').trim();
        rawValStr = matchAmtAtEnd[2].replace(/\s+/g, '');
      }
    }

    if (!rawDate) {
      const matchPdfLine = line.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+([+-]?\d+(?:\.\d{3})*\s*,\s*\d{2}-?)$/);
      if (matchPdfLine) {
        rawDate = matchPdfLine[1];
        desc = matchPdfLine[2].replace(/\|/g, ' ').trim();
        rawValStr = matchPdfLine[3].replace(/\s+/g, '');
      }
    }

    if (rawDate && desc && rawValStr) {
      const hasTrailingMinus = rawValStr.endsWith('-');
      if (hasTrailingMinus) rawValStr = '-' + rawValStr.slice(0, -1);

      const val = parseFloat(rawValStr.replace(/\./g, '').replace(',', '.'));
      if (isNaN(val) || val === 0) return;

      const parts = rawDate.split(/[\/\-]/);
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const yyyy = parts[2] ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : '2026';
      const fullDate = `${dd}/${mm}/${yyyy}`;

      const period = (isCard && targetInvoicePeriod && targetInvoicePeriod !== 'ALL')
        ? targetInvoicePeriod
        : (typeof normalizePeriodByDate === 'function'
            ? normalizePeriodByDate(fullDate, accountId, targetInvoicePeriod || '2026-10')
            : `${yyyy}-${mm}`);

      const absAmount = fromCents(toCents(Math.abs(val)));
      const sig = buildImportSignature(accountId, period, fullDate, desc, toCents(absAmount));
      if (existingSignatures.has(sig)) {
        skippedDuplicates++;
        return;
      }
      existingSignatures.add(sig);

      const isExplicitBankOutflow = !isCard && (val < 0 || /^(PAG|RSCSS|DEB|SAQUE|TAR|IOF|SEGURO)\b/i.test(desc));
      const isIncome = !isCard && !isExplicitBankOutflow && val > 0;
      const isCardRefund = isCard && val < 0;

      const cat = classifyItemCategory(desc, isIncome, isCard);
      const inst = isCard ? extractInstallmentFromDesc(desc) : null;

      pushCandidate({
        id: 'imp_pdf_' + Date.now() + '_' + idx,
        owner,
        source: sourceLabel,
        accountId,
        period,
        date: fullDate,
        type: isIncome ? 'income' : (isCard ? 'card' : 'debit'),
        kind: cat === 'Faturas Antigas Pagas' ? 'invoice_payment' : (isCardRefund ? 'reimbursement' : (isIncome ? 'income' : 'expense')),
        scope: 'shared',
        category: cat,
        installmentCurrent: inst ? inst.current : null,
        installmentTotal: inst ? inst.total : null,
        desc,
        amount: absAmount,
        createdBy: typeof getLoggedPerson === 'function' ? getLoggedPerson() : owner
      });
    }
  });

  return { addedCount, skippedDuplicates, invoicePaymentsDetected, candidates };
}

function renderImportPreviewPanel(candidates, skippedDuplicates, invoicePaymentsDetected, sourceLabel) {
  pendingImportPreviewItems = candidates;
  pendingImportSourceMeta = sourceLabel;

  const box = document.getElementById('importReconciliationPreviewBox');
  if (!box) return;

  if (candidates.length === 0) {
    box.innerHTML = `
      <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
        <strong>Nenhum lançamento inédito encontrado.</strong>
        ${skippedDuplicates > 0 ? `(${skippedDuplicates} lançamento(s) já estavam cadastrados e foram bloqueados contra duplicidade!)` : 'Verifique o formato do arquivo ou texto.'}
      </div>
    `;
    box.classList.remove('hidden');
    return;
  }

  const totalCents = candidates.reduce((acc, c) => acc + (c.selected ? toCents(c.amount) : 0), 0);

  box.innerHTML = `
    <div class="p-4 rounded-2xl bg-sky-50/80 border border-sky-300 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 pb-2.5">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-sky-700">Pré-Visualização & Conciliação Inteligente (Etapa 5)</span>
          <h4 class="font-bold text-sm text-slate-900">${candidates.length} novo(s) lançamento(s) prontos • Soma: <span class="text-sky-800">${formatCentsBRL(totalCents)}</span></h4>
        </div>
        <div class="flex flex-wrap gap-1.5 text-[11px]">
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            ${skippedDuplicates} duplicado(s) bloqueado(s)
          </span>
          ${invoicePaymentsDetected > 0 ? `
            <span class="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300 font-semibold" title="Pagamentos de fatura saem do saldo bancário mas não duplicam compras!">
              ${invoicePaymentsDetected} pagto(s) de fatura protegido(s)
            </span>
          ` : ''}
        </div>
      </div>

      <div class="max-h-48 overflow-y-auto custom-scroll space-y-1.5 pr-1">
        ${candidates.map((item, idx) => `
          <div class="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-sky-100 text-xs">
            <label class="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
              <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="togglePreviewCandidate(${idx}, this.checked)" class="rounded text-sky-600" />
              <span class="text-[11px] text-slate-400 shrink-0">${escapeHtml(item.date)}</span>
              <span class="font-semibold text-slate-800 truncate">${escapeHtml(item.desc)}</span>
              <span class="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200/60 shrink-0">${escapeHtml(item.category)}</span>
            </label>
            <div class="flex items-center gap-2 shrink-0">
              <select onchange="changePreviewCandidateScope(${idx}, this.value)" class="text-[10px] border border-sky-200 rounded-lg px-1.5 py-0.5 bg-sky-50/40 text-slate-700">
                <option value="shared" ${item.scope === 'shared' ? 'selected' : ''}>Casal</option>
                <option value="individual" ${item.scope === 'individual' ? 'selected' : ''}>Individual</option>
              </select>
              <strong class="text-slate-900 font-bold w-20 text-right">${formatBRL(item.amount)}</strong>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-sky-200">
        <button onclick="cancelImportPreview()" class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white">
          Descartar
        </button>
        <button onclick="confirmReconciledImport()" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition">
          ✓ Confirmar Importação Conciliada
        </button>
      </div>
    </div>
  `;
  box.classList.remove('hidden');
}

function togglePreviewCandidate(idx, checked) {
  if (pendingImportPreviewItems[idx]) {
    pendingImportPreviewItems[idx].selected = checked;
  }
}

function changePreviewCandidateScope(idx, scopeVal) {
  if (pendingImportPreviewItems[idx]) {
    pendingImportPreviewItems[idx].scope = scopeVal;
  }
}

function cancelImportPreview() {
  pendingImportPreviewItems = [];
  pendingImportSourceMeta = null;
  const box = document.getElementById('importReconciliationPreviewBox');
  if (box) {
    box.innerHTML = '';
    box.classList.add('hidden');
  }
}

function confirmReconciledImport() {
  const chosen = pendingImportPreviewItems.filter(i => i.selected);
  if (chosen.length === 0) {
    alert('Selecione pelo menos 1 item para importar.');
    return;
  }

  let fileId = null;
  if (pendingImportSourceMeta) {
    fileId = 'file_imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    if (!Array.isArray(state.uploadedFiles)) state.uploadedFiles = [];
    state.uploadedFiles.unshift({
      id: fileId,
      fileName: pendingImportSourceMeta.label || 'Importação Manual',
      fileType: pendingImportSourceMeta.accountId === 'cc_itau_conjunta' ? 'bank_ofx' : 'card_pdf',
      fileSize: 0,
      uploadedAt: new Date().toLocaleString('pt-BR'),
      period: state.selectedPeriod,
      targetAccount: pendingImportSourceMeta.accountId,
      accountLabel: pendingImportSourceMeta.accountId === 'cc_itau_conjunta' ? 'Conta Itaú' : 'Cartão de Crédito',
      itemCount: chosen.length,
      totalAmount: chosen.reduce((acc, c) => acc + (c.amount || 0), 0)
    });
  }

  chosen.forEach(item => {
    const cleanItem = { ...item };
    delete cleanItem.selected;
    if (fileId && !cleanItem.fileId) {
      cleanItem.fileId = fileId;
      cleanItem.fileName = pendingImportSourceMeta?.label || 'Importação Manual';
    }
    state.transactions.unshift(cleanItem);
  });

  state.transactions = enrichTransactionsAndProjectInstallments(state.transactions);

  if (pendingImportSourceMeta) {
    state.importedSources.push({
      id: 'src_' + Date.now(),
      owner: pendingImportSourceMeta.owner,
      name: `${pendingImportSourceMeta.label} (${chosen.length} itens)`,
      type: pendingImportSourceMeta.accountId === 'cc_itau_conjunta' ? 'bank' : 'card'
    });
  }

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Importação Conciliada', `${chosen.length} lançamentos importados (${pendingImportSourceMeta ? pendingImportSourceMeta.label : 'Arquivo'})`);
  }

  cancelImportPreview();
  document.getElementById('pasteRawTextarea').value = '';
  closeImportModal();
  saveState();
  renderAll();
}

function detectAccountFromFile(fileName, rawText) {
  const up = (String(fileName || '') + ' ' + String(rawText || '').slice(0, 3000)).toUpperCase();
  if (up.includes('CONTA CORRENTE') || up.includes('EXTRATO DE CONTA') || up.includes('AGENCIA') || up.includes('AGÊNCIA') || up.includes('SDO CTA') || up.includes('<BANKACCTFROM>')) {
    return 'cc_itau_conjunta';
  }
  if (up.includes('FATURA') || up.includes('CARTAO') || up.includes('CARTÃO') || up.includes('MASTERCARD') || up.includes('MC GOLD') || up.includes('FINAL 5544') || up.includes('<CCACCTFROM>')) {
    return 'card_eveli_5544';
  }
  return null;
}

// ============================================================================
// IMPORTAÇÃO DIRETA: CONTA BANCÁRIA (.OFX) & CARTÕES DE CRÉDITO (.PDF)
// ============================================================================
async function handleBankOfxUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.ofx')) {
    alert('Atenção: Para a Conta Bancária, selecione exclusivamente o arquivo .OFX gerado pelo banco Itaú.');
    event.target.value = '';
    return;
  }

  try {
    const rawText = await file.text();
    const owner = 'Éveli';
    const accountId = 'cc_itau_conjunta';

    const fileId = 'file_ofx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const fileMeta = {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: 'bank_ofx',
      uploadedAt: new Date().toLocaleString('pt-BR'),
      period: state.selectedPeriod,
      targetAccount: accountId,
      accountLabel: 'Conta Itaú'
    };

    const res = parseAnyFinancialText(rawText, owner, accountId, state.selectedPeriod, false, fileMeta);

    state.transactions = enrichTransactionsAndProjectInstallments(state.transactions);

    if (!Array.isArray(state.uploadedFiles)) state.uploadedFiles = [];
    state.uploadedFiles.unshift({
      id: fileId,
      fileName: file.name,
      fileType: 'bank_ofx',
      fileSize: file.size,
      uploadedAt: new Date().toLocaleString('pt-BR'),
      period: state.selectedPeriod,
      targetAccount: accountId,
      accountLabel: 'Conta Itaú',
      itemCount: res.addedCount,
      totalAmount: res.candidates.reduce((acc, c) => acc + (c.amount || 0), 0)
    });

    state.importedSources.push({
      id: fileId,
      fileId,
      owner: 'Casal',
      name: `OFX Itaú: ${file.name} (${res.addedCount} itens)`,
      type: 'bank'
    });

    if (typeof recordAuditLog === 'function') {
      recordAuditLog('Importação OFX Itaú', `${res.addedCount} lançamentos importados do arquivo ${file.name}`);
    }

    saveState();
    renderAll();

    alert(`✅ Extrato OFX importado com sucesso!\n\n• ${res.addedCount} movimentação(ões) bancária(s) adicionada(s) à Conta Itaú.\n• ${res.skippedDuplicates} lançamento(s) duplicados foram bloqueados automaticamente.\n\nTodas as movimentações foram organizadas no mês exato da data de cada uma!`);
  } catch (err) {
    console.error(err);
    alert('Erro ao processar o arquivo .OFX. Verifique se o arquivo baixado do Itaú está completo.');
  } finally {
    event.target.value = '';
  }
}

async function handleCardPdfUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Atenção: Para os Cartões de Crédito, selecione o arquivo da fatura em formato .PDF.');
    event.target.value = '';
    return;
  }

  try {
    const rawText = await extractTextFromPdfFile(file);
    if (!rawText || rawText.trim().length === 0) {
      alert('Não foi possível extrair o texto deste arquivo PDF da fatura.');
      event.target.value = '';
      return;
    }

    // Auto-detecta o titular e o cartão
    let accountId = 'card_eveli_5544';
    let owner = 'Éveli';
    const up = rawText.toUpperCase();
    if (up.includes('VITAL') && !up.includes('ÉVELI') && !up.includes('EVELI')) {
      accountId = 'card_marido';
      owner = 'Vital';
    }

    // Auto-detecta o período de vencimento da fatura
    let targetInvoicePeriod = state.selectedPeriod === 'ALL' ? '2026-10' : state.selectedPeriod;
    const dueMatch = rawText.match(/VENCIMENTO[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i) ||
                     rawText.match(/VENCE\s+EM[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i) ||
                     rawText.match(/COM\s+VENCIMENTO\s+EM[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i) ||
                     rawText.match(/(\d{2})\/(\d{2})\/(\d{4})\s*R\$\s*[\d\.,\s]+Limite/i) ||
                     rawText.match(/(\d{2})\/(\d{2})\/(\d{4})\s*=\s*Total\s+desta\s+fatura/i) ||
                     rawText.match(/(\d{2})\/(\d{2})\/(\d{4})\s+TOTAL/i);
    if (dueMatch) {
      const dueMm = dueMatch[2];
      const dueYyyy = dueMatch[3];
      targetInvoicePeriod = `${dueYyyy}-${dueMm}`;
    }

    // Auto-detecta valor oficial da fatura para conciliação perfeita
    let officialNum = 0;
    const totalMatch = rawText.match(/TOTAL\s+DESTA\s+FATURA[\s:R$]+([\d\.\s]+,\d{2})/i) ||
                       rawText.match(/VALOR\s+TOTAL[\s:R$]+([\d\.\s]+,\d{2})/i) ||
                       rawText.match(/TOTAL\s+A\s+PAGAR[\s:R$]+([\d\.\s]+,\d{2})/i) ||
                       rawText.match(/O\s+TOTAL\s+DA\s+SUA\s+FATURA\s+[ÉE][:\sR$]+([\d\.\s]+,\d{2})/i) ||
                       rawText.match(/TOTAL\s+DESTA\s+FATURA[\s:R$]+([\d\.,]+)/i) ||
                       rawText.match(/VALOR\s+TOTAL[\s:R$]+([\d\.,]+)/i) ||
                       rawText.match(/TOTAL\s+A\s+PAGAR[\s:R$]+([\d\.,]+)/i);
    if (totalMatch) {
      const cleanTotal = totalMatch[1].replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
      officialNum = parseFloat(cleanTotal);
      if (!isNaN(officialNum) && officialNum > 0 && state.cardsConfig && state.cardsConfig[accountId]) {
        if (!state.cardsConfig[accountId].officialInvoiceTotals) {
          state.cardsConfig[accountId].officialInvoiceTotals = {};
        }
        state.cardsConfig[accountId].officialInvoiceTotals[targetInvoicePeriod] = officialNum;
      }
    }

    const fileId = 'file_pdf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const cardLabel = accountId === 'card_marido' ? 'Cartão Vital' : 'Cartão Éveli (MC Gold 5544)';
    const fileMeta = {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: 'card_pdf',
      uploadedAt: new Date().toLocaleString('pt-BR'),
      period: targetInvoicePeriod,
      targetAccount: accountId,
      accountLabel: cardLabel
    };

    const res = parseAnyFinancialText(rawText, owner, accountId, targetInvoicePeriod, false, fileMeta);

    state.transactions = enrichTransactionsAndProjectInstallments(state.transactions);

    if (!Array.isArray(state.uploadedFiles)) state.uploadedFiles = [];
    state.uploadedFiles.unshift({
      id: fileId,
      fileName: file.name,
      fileType: 'card_pdf',
      fileSize: file.size,
      uploadedAt: new Date().toLocaleString('pt-BR'),
      period: targetInvoicePeriod,
      targetAccount: accountId,
      accountLabel: cardLabel,
      itemCount: res.addedCount,
      totalAmount: res.candidates.reduce((acc, c) => acc + (c.amount || 0), 0),
      officialInvoiceTotal: officialNum || 0
    });

    state.importedSources.push({
      id: fileId,
      fileId,
      owner,
      name: `Fatura PDF: ${file.name} (${res.addedCount} compras)`,
      type: 'card'
    });

    if (typeof recordAuditLog === 'function') {
      recordAuditLog('Importação Fatura PDF', `${res.addedCount} compras importadas do arquivo ${file.name}`);
    }

    saveState();
    renderAll();

    alert(`✅ Fatura em PDF importada com sucesso!\n\n• ${res.addedCount} compra(s) registrada(s) no ${cardLabel} para a Fatura ${formatPeriodLabel(targetInvoicePeriod)}.\n• ${res.skippedDuplicates} compra(s) duplicadas foram bloqueadas automaticamente.`);
  } catch (err) {
    console.error('Erro ao processar PDF da fatura:', err);
    alert('Erro ao processar o arquivo PDF da fatura: ' + (err.message || err));
  } finally {
    event.target.value = '';
  }
}

async function handleMultiFileUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  const owner = document.getElementById('importOwnerSelect').value;
  const initialAccountId = document.getElementById('importAccountSelect').value;
  const targetInvoicePeriod = document.getElementById('importInvoicePeriod').value || '2026-10';
  const statusEl = document.getElementById('pdfUploadStatus');
  statusEl.classList.remove('hidden');

  let allCandidates = [];
  let totalSkipped = 0;
  let totalInvoicePayments = 0;
  let fileNames = [];
  let finalAccountId = initialAccountId;

  for (const file of files) {
    let rawText = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        rawText = await extractTextFromPdfFile(file);
      } catch (err) {
        alert(`Não foi possível ler o PDF "${file.name}".`);
        continue;
      }
    } else {
      rawText = await file.text();
    }

    // Auto-detecta se o arquivo é Extrato Bancário ou Fatura de Cartão para nunca misturar!
    const detected = detectAccountFromFile(file.name, rawText);
    const effectiveAcc = detected || initialAccountId;
    finalAccountId = effectiveAcc;
    const accSel = document.getElementById('importAccountSelect');
    if (accSel && detected) accSel.value = detected;

    const res = parseAnyFinancialText(rawText, owner, effectiveAcc, targetInvoicePeriod, true);
    allCandidates = allCandidates.concat(res.candidates);
    totalSkipped += res.skippedDuplicates;
    totalInvoicePayments += res.invoicePaymentsDetected;
    fileNames.push(file.name.slice(0, 20));
  }

  statusEl.classList.add('hidden');
  event.target.value = '';

  renderImportPreviewPanel(allCandidates, totalSkipped, totalInvoicePayments, {
    owner,
    accountId: finalAccountId,
    label: fileNames.join(', ') || 'Arquivo Importado'
  });
}

function processPastedTextManual() {
  const text = document.getElementById('pasteRawTextarea').value.trim();
  if (!text) {
    alert('Cole os lançamentos na caixa de texto ou selecione os arquivos acima.');
    return;
  }
  const owner = document.getElementById('importOwnerSelect').value;
  const accountId = document.getElementById('importAccountSelect').value;
  const targetInvoicePeriod = document.getElementById('importInvoicePeriod').value || '2026-10';

  const res = parseAnyFinancialText(text, owner, accountId, targetInvoicePeriod, true);
  renderImportPreviewPanel(res.candidates, res.skippedDuplicates, res.invoicePaymentsDetected, {
    owner,
    accountId,
    label: 'Texto Colado'
  });
}

function syncImportAccountSelect() {
  const owner = document.getElementById('importOwnerSelect').value;
  const sel = document.getElementById('importAccountSelect');
  if ((owner === 'Vital' || owner === 'Marido') && sel.value === 'card_eveli_5544') {
    sel.value = 'card_marido';
  } else if (owner === 'Éveli' && sel.value === 'card_marido') {
    sel.value = 'card_eveli_5544';
  }
}

function openImportModal() {
  cancelImportPreview();
  document.getElementById('importModal').classList.remove('hidden');
}

function closeImportModal() {
  cancelImportPreview();
  document.getElementById('importModal').classList.add('hidden');
}

// ============================================================================
// AUTOTESTE DAS REGRAS FINANCEIRAS NO NAVEGADOR (ETAPA 5 — ENGENHARIA ADS)
// ============================================================================
function runBrowserFinancialSelfTest() {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok, detail });

  // 1. Precisão em centavos sem erro de ponto flutuante
  const centTest = toCents(19.99) + toCents(0.01);
  check('Aritmética exata em centavos', centTest === 2000, `19,99 + 0,01 = ${formatCentsBRL(centTest)}`);

  // 2. Conciliação da Fatura de Setembro (R$ 3.375,50) conforme PDF Oficial
  const seedData = getInitialFamilyData();
  seedData.transactions = enrichTransactionsAndProjectInstallments(seedData.transactions);
  const sepTx = seedData.transactions.filter(t => t.period === '2026-09');
  const octTx = seedData.transactions.filter(t => t.period === '2026-10');
  const sumSep = calculatePeriodSummary(sepTx, '2026-09', seedData);
  const sumOct = calculatePeriodSummary(octTx, '2026-10', seedData);
  check('Conciliação Fatura Setembro MC Gold 5544', sumSep.cardEveliCents === 337550, `Soma = ${formatCentsBRL(sumSep.cardEveliCents)} (Oficial: R$ 3.375,50)`);

  // 3. Saldo final da Conta Conjunta Itaú em Out/2026
  check('Saldo Conta Conjunta Itaú (Out/26)', sumOct.bankEndingBalanceCents === -449, `Saldo = ${formatCentsBRL(sumOct.bankEndingBalanceCents)}`);

  // 4. Não duplicação ao pagar fatura
  const beforeCat = sumOct.spentByCatCents['Lanches & Restaurantes'];
  const withPayTx = [
    ...octTx,
    {
      id: 'test_inv_pay',
      owner: 'Éveli',
      source: 'Conta Conjunta Itaú',
      accountId: 'cc_itau_conjunta',
      period: '2026-10',
      date: '21/10/2026',
      type: 'debit',
      kind: 'invoice_payment',
      scope: 'shared',
      category: 'Faturas Antigas Pagas',
      desc: 'PAGTO FATURA TESTE',
      amount: 3096.11
    }
  ];
  const sumAfterPay = calculatePeriodSummary(withPayTx, '2026-10', seedData);
  const noCatDuplication = sumAfterPay.spentByCatCents['Lanches & Restaurantes'] === beforeCat;
  check('Pagamento de fatura não duplica despesas', noCatDuplication, 'Orçamentos intactos ao quitar fatura');

  // 5. Projeção automática de parcelas para Nov/26 e Dez/26
  const novTx = seedData.transactions.filter(t => t.period === '2026-11');
  const sumNov = calculatePeriodSummary(novTx, '2026-11', seedData);
  check('Projeção automática de parcelas (Nov/26)', sumNov.totalCardCents === 65537, `Fatura projetada Nov/26 = ${formatCentsBRL(sumNov.totalCardCents)}`);

  // 6. Radar de parcelas liberadas
  const radarOct = calculateInstallmentsRadar(octTx);
  check('Radar de parcelas que acabam em Out/26', radarOct.endingNowCents === 41188, `Libera +${formatCentsBRL(radarOct.endingNowCents)}/mês em Nov/26`);

  const outBox = document.getElementById('selfTestResultsBox');
  if (outBox) {
    const allOk = results.every(r => r.ok);
    outBox.innerHTML = `
      <div class="mt-3 p-3.5 rounded-2xl ${allOk ? 'bg-emerald-50/90 border border-emerald-200' : 'bg-rose-50 border border-rose-200'} space-y-1.5 text-xs">
        <div class="font-bold ${allOk ? 'text-emerald-900' : 'text-rose-900'}">
          ${allOk ? '✓ Todos os 6 testes matemáticos passaram com 100% de precisão!' : '⚠ Atenção nos testes:'}
        </div>
        ${results.map(r => `
          <div class="flex items-center justify-between gap-2 text-[11px] py-0.5 border-b border-emerald-200/50 last:border-0">
            <span class="font-medium text-slate-800">${r.ok ? '✅' : '❌'} ${escapeHtml(r.name)}</span>
            <strong class="text-slate-700">${escapeHtml(r.detail)}</strong>
          </div>
        `).join('')}
      </div>
    `;
    outBox.classList.remove('hidden');
  }
}
