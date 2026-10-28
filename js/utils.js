// ============================================================================
// MÓDULO 1: UTILITÁRIOS (MATEMÁTICA EM CENTAVOS, DATAS E SEGURANÇA XSS)
// ============================================================================
// Por que este módulo existe?
// Centraliza funções puras que não dependem da interface (HTML) nem do banco
// de dados. Assim, qualquer cálculo financeiro em todo o sistema usa sempre a
// mesma regra exata de centavos inteiros.

const STORAGE_KEY = 'financas_familia_completa_v5';
const LEGACY_STORAGE_KEY = 'financas_familia_completa_v4';

// Converte um valor em Reais (ex: 19.86) para centavos inteiros (ex: 1986)
// evitando erros de ponto flutuante do JavaScript (como 0.1 + 0.2 = 0.30000000000000004)
function toCents(val) {
  const n = Number(val || 0);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

// Converte centavos inteiros (ex: 1986) de volta para Reais (ex: 19.86)
function fromCents(cents) {
  return Number((Math.round(cents || 0) / 100).toFixed(2));
}

// Formata número em Reais no padrão brasileiro (R$ 1.234,56)
function formatBRL(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata centavos inteiros diretamente para o padrão brasileiro (R$ 1.234,56)
function formatCentsBRL(cents) {
  return formatBRL(fromCents(cents));
}

// Sanitiza textos antes de inseri-los no HTML, protegendo contra injeção XSS
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Extrai parcela atual e total de descrições como "ALURA 11/12" ou "SuperBruno 10/10"
function extractInstallmentFromDesc(desc) {
  if (!desc) return null;
  const matches = [...String(desc).matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)];
  for (const m of matches) {
    const cur = parseInt(m[1], 10);
    const tot = parseInt(m[2], 10);
    // Evita confundir datas como 21/09 ou 01/10 na descrição de PIX
    if (!String(desc).toUpperCase().includes('PIX') && cur >= 1 && tot >= 2 && cur <= tot && tot <= 48) {
      return { current: cur, total: tot };
    }
  }
  return null;
}

// Converte datas "DD/MM/YYYY" ou "DD/MM (Parc)" em chave ordenável "YYYY-MM-DD"
function toSortableDate(dateStr, fallbackPeriod) {
  const s = String(dateStr || '').trim();
  const fullMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (fullMatch) {
    return `${fullMatch[3]}-${fullMatch[2]}-${fullMatch[1]}`;
  }
  const shortMatch = s.match(/^(\d{2})\/(\d{2})/);
  if (shortMatch) {
    const year = (fallbackPeriod && fallbackPeriod.slice(0, 4)) || '2026';
    return `${year}-${shortMatch[2]}-${shortMatch[1]}`;
  }
  return `${fallbackPeriod || '2026-10'}-01`;
}

// Soma meses a um período no formato "YYYY-MM" (ex: addMonthsToPeriod("2026-10", 2) -> "2026-12")
function addMonthsToPeriod(periodStr, monthsToAdd) {
  const [yStr, mStr] = String(periodStr || '2026-10').split('-');
  let year = parseInt(yStr, 10) || 2026;
  let month = (parseInt(mStr, 10) || 10) - 1 + monthsToAdd;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

// Formata "2026-10" como "Out/26"
function formatPeriodLabel(periodStr) {
  if (periodStr === 'ALL') return 'Todos os Meses';
  const [y, m] = String(periodStr || '').split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const idx = parseInt(m, 10) - 1;
  if (idx >= 0 && idx < 12) return `${names[idx]}/${String(y).slice(-2)}`;
  return periodStr;
}

// ============================================================================
// ACORDEÕES E CARDS RECOLHÍVEIS (Interface Limpa com Toque na Faixa)
// ============================================================================

// Verifica se um card recolhível deve estar aberto ou fechado (com persistência em localStorage)
function isCollapsibleCardExpanded(storageKey, defaultVal = false) {
  if (typeof localStorage === 'undefined' || !storageKey) return defaultVal;
  try {
    const val = localStorage.getItem('card_expanded_' + storageKey);
    if (val === null) return defaultVal;
    return val === 'true';
  } catch (e) {
    return defaultVal;
  }
}

// Alterna o estado recolhido/expandido de um card ao tocar na faixa
function toggleCollapsibleCard(contentId, iconId, storageKey, onToggleCallback) {
  if (typeof document === 'undefined') return;
  const content = document.getElementById(contentId);
  const icon = iconId ? document.getElementById(iconId) : null;
  if (!content) return;

  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    if (icon) {
      icon.textContent = '▲';
    }
    if (storageKey && typeof localStorage !== 'undefined') {
      try { localStorage.setItem('card_expanded_' + storageKey, 'true'); } catch (e) {}
    }
  } else {
    content.classList.add('hidden');
    if (icon) {
      icon.textContent = '▼';
    }
    if (storageKey && typeof localStorage !== 'undefined') {
      try { localStorage.setItem('card_expanded_' + storageKey, 'false'); } catch (e) {}
    }
  }

  if (typeof onToggleCallback === 'function') {
    onToggleCallback(!isHidden);
  }
}

// Restaura o estado persistido de um card recolhível
function applyCollapsibleCardState(contentId, iconId, storageKey, defaultVal = false) {
  if (typeof document === 'undefined') return;
  const content = document.getElementById(contentId);
  const icon = iconId ? document.getElementById(iconId) : null;
  if (!content) return;
  const expanded = isCollapsibleCardExpanded(storageKey, defaultVal);
  if (expanded) {
    content.classList.remove('hidden');
    if (icon) icon.textContent = '▲';
  } else {
    content.classList.add('hidden');
    if (icon) icon.textContent = '▼';
  }
}

// Restaura os cards recolhíveis estáticos na inicialização
function restoreCollapsibleCardsState() {
  if (typeof document === 'undefined') return;
  applyCollapsibleCardState('aiInsightsCardContent', 'aiInsightsChevron', 'ai_insights', false);
  applyCollapsibleCardState('accountsAndCardsSectionWrapper', 'accountsAndCardsChevron', 'accounts_cards', false);
  applyCollapsibleCardState('bankSummaryCardsContainer', 'bankSummaryCardsChevron', 'bank_cards', false);
  applyCollapsibleCardState('radarCollapsibleBody', 'radarCollapsibleChevron', 'radar_cards', false);
  applyCollapsibleCardState('dailyExpenseFormWrapper', 'dailyExpenseFormChevron', 'daily_form', false);
  applyCollapsibleCardState('newGoalFormContainer', 'newGoalFormChevron', 'goals_form', false);
}

