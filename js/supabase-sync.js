// ============================================================================
// MÓDULO 8: AUTENTICAÇÃO DO CASAL, AUDITORIA E SINCRONIZAÇÃO SUPABASE (ETAPA 3/4)
// ============================================================================
// Por que este módulo existe?
// 1. Identifica quem está utilizando o sistema no dispositivo (Éveli ou Vital),
//    garantindo que os dois vejam e administrem 100% da Conta Conjunta Itaú e
//    dos 2 Cartões de Crédito.
// 2. Registra um Histórico de Alterações (Auditoria) para o casal saber quem
//    cadastrou, editou ou quitou cada item.
// 3. Conecta a aplicação ao banco de dados em nuvem (Supabase PostgreSQL + Auth)
//    para sincronizar os dados entre o celular/computador da Éveli e do Vital.

const CLOUD_CONFIG_KEY = 'financas_familia_cloud_config_v1';

function getDefaultSupabaseConfig() {
  const globalCfg = (typeof window !== 'undefined' && window.SUPABASE_CONFIG) ? window.SUPABASE_CONFIG : {};
  return {
    loggedPerson: 'Éveli',
    loggedEmail: '',
    supabaseUrl: globalCfg.url || '',
    supabaseAnonKey: globalCfg.anonKey || '',
    householdCode: globalCfg.householdCode || 'casal_eveli_vital',
    autoSync: true,
    lastSyncAt: null
  };
}

function loadCloudConfig() {
  const defaults = getDefaultSupabaseConfig();
  if (typeof localStorage === 'undefined') {
    return defaults;
  }
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        supabaseUrl: parsed.supabaseUrl || defaults.supabaseUrl,
        supabaseAnonKey: parsed.supabaseAnonKey || defaults.supabaseAnonKey,
        householdCode: parsed.householdCode || defaults.householdCode
      };
    }
  } catch (e) {}
  return defaults;
}

let cloudConfig = loadCloudConfig();
let supabaseClientInstance = null;
let autoSyncTimer = null;

function saveCloudConfig() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
  }
}

function getLoggedPerson() {
  return cloudConfig.loggedPerson || 'Éveli';
}

function setLoggedPerson(personName) {
  if (!personName) return;
  const cleanName = personName === 'Marido' ? 'Vital' : String(personName).trim();
  cloudConfig.loggedPerson = cleanName;
  saveCloudConfig();

  // Ajusta o campo padrão do formulário de novo lançamento para quem está logado
  const ownerInput = typeof document !== 'undefined' ? document.getElementById('txOwnerInput') : null;
  if (ownerInput) {
    ownerInput.value = (cleanName === 'Vital' || cleanName === 'Éveli') ? cleanName : 'Éveli';
    if (typeof syncAccountDefaultByOwner === 'function') {
      syncAccountDefaultByOwner();
    }
  }

  recordAuditLog('Troca de Perfil Ativo', `Sessão ativa alterada para ${cleanName}`);
  updateAuthHeaderUI();
}

// Registra no histórico do casal quem fez cada ação
function recordAuditLog(action, details) {
  if (typeof state === 'undefined' || !state) return;
  if (!Array.isArray(state.auditLogs)) state.auditLogs = [];

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  state.auditLogs.unshift({
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timestamp,
    actor: getLoggedPerson(),
    action,
    details
  });

  // Mantém os 60 registros mais recentes para não pesar o armazenamento
  if (state.auditLogs.length > 60) {
    state.auditLogs = state.auditLogs.slice(0, 60);
  }
}

// Inicializa o cliente oficial do Supabase caso URL e Anon Key estejam preenchidas
function getSupabaseClient() {
  if (!cloudConfig.supabaseUrl || !cloudConfig.supabaseAnonKey) return null;
  if (typeof window === 'undefined' || !window.supabase || !window.supabase.createClient) return null;

  if (
    !supabaseClientInstance ||
    supabaseClientInstance._configuredUrl !== cloudConfig.supabaseUrl ||
    supabaseClientInstance._configuredKey !== cloudConfig.supabaseAnonKey
  ) {
    try {
      supabaseClientInstance = window.supabase.createClient(
        cloudConfig.supabaseUrl.trim(),
        cloudConfig.supabaseAnonKey.trim()
      );
      supabaseClientInstance._configuredUrl = cloudConfig.supabaseUrl;
      supabaseClientInstance._configuredKey = cloudConfig.supabaseAnonKey;
    } catch (e) {
      return null;
    }
  }
  return supabaseClientInstance;
}

function updateAuthHeaderUI() {
  if (typeof document === 'undefined') return;

  const personBadge = document.getElementById('loggedPersonBadgeText');
  if (personBadge) {
    personBadge.textContent = getLoggedPerson();
  }

  const authUserBadge = document.getElementById('headerAuthUserBadge');
  if (authUserBadge) {
    authUserBadge.textContent = `Bloquear (${getLoggedPerson()})`;
  }

  const headerSubtitle = document.getElementById('headerSubtitleText');
  if (headerSubtitle) {
    const coupleMode = typeof isCoupleHousehold === 'function' ? isCoupleHousehold(cloudConfig.householdCode) : true;
    headerSubtitle.textContent = coupleMode
      ? 'Éveli & Vital • Itaú + Poupança + 2 Cartões'
      : `${getLoggedPerson()} • Gestão Financeira Pessoal & Familiar`;
  }

  const syncDot = document.getElementById('cloudSyncStatusDot');
  const syncText = document.getElementById('cloudSyncStatusText');
  const hasCloud = !!(cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey);

  if (syncDot && syncText) {
    if (hasCloud) {
      syncDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
      syncText.textContent = cloudConfig.lastSyncAt ? `Nuvem (${cloudConfig.lastSyncAt})` : 'Nuvem Ativa';
    } else {
      syncDot.className = 'w-2 h-2 rounded-full bg-sky-500';
      syncText.textContent = 'Local Seguro';
    }
  }

  // Atualiza também os botões dentro do modal de Acesso & Nuvem se estiver aberto
  const btnEveli = document.getElementById('modalProfileBtnEveli');
  const btnVital = document.getElementById('modalProfileBtnVital') || document.getElementById('modalProfileBtnMarido');
  if (btnEveli && btnVital) {
    const isEveli = getLoggedPerson() === 'Éveli';
    btnEveli.className = isEveli
      ? 'flex-1 py-2.5 px-3 rounded-xl font-bold text-xs bg-sky-600 text-white shadow-sm transition'
      : 'flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs bg-white text-slate-700 border border-sky-200 hover:bg-sky-50 transition';
    btnVital.className = !isEveli
      ? 'flex-1 py-2.5 px-3 rounded-xl font-bold text-xs bg-sky-600 text-white shadow-sm transition'
      : 'flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs bg-white text-slate-700 border border-sky-200 hover:bg-sky-50 transition';
  }

  renderAuditLogsInModal();
}

function renderAuditLogsInModal() {
  if (typeof document === 'undefined') return;
  const listEl = document.getElementById('auditLogsListContainer');
  if (!listEl) return;

  const logs = (state && Array.isArray(state.auditLogs)) ? state.auditLogs : [];
  if (logs.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Nenhuma alteração recente registrada ainda.</p>`;
    return;
  }

  listEl.innerHTML = logs.slice(0, 15).map(item => `
    <div class="flex items-start justify-between gap-2 py-1.5 border-b border-sky-100 last:border-0 text-[11px]">
      <div>
        <span class="font-semibold text-sky-900">${escapeHtml(item.actor)}</span>
        <span class="text-slate-500">• ${escapeHtml(item.action)}:</span>
        <span class="text-slate-700">${escapeHtml(item.details)}</span>
      </div>
      <span class="text-[10px] text-slate-400 shrink-0">${escapeHtml(item.timestamp)}</span>
    </div>
  `).join('');
}

function openAuthCloudModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('authCloudModal');
  if (!modal) return;

  document.getElementById('cloudSupabaseUrlInput').value = cloudConfig.supabaseUrl || '';
  document.getElementById('cloudSupabaseKeyInput').value = cloudConfig.supabaseAnonKey || '';
  document.getElementById('cloudHouseholdCodeInput').value = cloudConfig.householdCode || 'casal_eveli_vital';
  document.getElementById('cloudUserEmailInput').value = cloudConfig.loggedEmail || '';

  updateAuthHeaderUI();
  modal.classList.remove('hidden');
}

function closeAuthCloudModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('authCloudModal');
  if (modal) modal.classList.add('hidden');
}

function saveCloudSettingsFromModal() {
  const urlInput = document.getElementById('cloudSupabaseUrlInput');
  const keyInput = document.getElementById('cloudSupabaseKeyInput');
  const codeInput = document.getElementById('cloudHouseholdCodeInput');
  const emailInput = document.getElementById('cloudUserEmailInput');

  if (urlInput && urlInput.value.trim()) cloudConfig.supabaseUrl = urlInput.value.trim();
  if (keyInput && keyInput.value.trim()) cloudConfig.supabaseAnonKey = keyInput.value.trim();
  if (codeInput && codeInput.value.trim()) cloudConfig.householdCode = codeInput.value.trim();
  if (emailInput && emailInput.value.trim()) cloudConfig.loggedEmail = emailInput.value.trim();
  saveCloudConfig();
  updateAuthHeaderUI();

  const feedbackEl = document.getElementById('cloudSyncFeedbackMsg');
  if (feedbackEl) {
    feedbackEl.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mt-2';
    feedbackEl.textContent = cloudConfig.supabaseUrl
      ? 'Configurações do Supabase salvas! Você já pode clicar em "Enviar p/ Nuvem" ou "Baixar da Nuvem".'
      : 'Modo Local ativo. Seus dados continuam salvos com segurança neste navegador.';
    feedbackEl.classList.remove('hidden');
  }
}

// Login com E-mail e Senha via Supabase Auth (opcional para proteger o banco)
async function signInWithSupabaseAuth(isSignUp) {
  saveCloudSettingsFromModal();
  const client = getSupabaseClient();
  const feedbackEl = document.getElementById('cloudSyncFeedbackMsg');

  if (!client) {
    alert('Preencha primeiro a URL do Projeto Supabase e a Chave Anon Key.');
    return;
  }

  const email = (document.getElementById('cloudUserEmailInput').value || '').trim();
  const password = (document.getElementById('cloudUserPasswordInput').value || '').trim();
  if (!email || !password || password.length < 6) {
    alert('Informe seu e-mail e uma senha de pelo menos 6 caracteres.');
    return;
  }

  try {
    if (feedbackEl) {
      feedbackEl.className = 'text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-xl p-2.5 mt-2';
      feedbackEl.textContent = isSignUp ? 'Criando conta do integrante no Supabase...' : 'Autenticando no Supabase...';
      feedbackEl.classList.remove('hidden');
    }

    const res = isSignUp
      ? await client.auth.signUp({ email, password, options: { data: { person: getLoggedPerson() } } })
      : await client.auth.signInWithPassword({ email, password });

    if (res.error) throw res.error;

    // Segurança: o perfil ativo passa a seguir quem fez login de verdade
    const loggedUser = res.data && res.data.user;
    const personFromLogin = loggedUser && loggedUser.user_metadata && loggedUser.user_metadata.person;
    if (personFromLogin === 'Éveli' || personFromLogin === 'Vital' || personFromLogin === 'Marido') {
      cloudConfig.loggedPerson = personFromLogin === 'Marido' ? 'Vital' : personFromLogin;
    }
    const pwdInput = document.getElementById('cloudUserPasswordInput');
    if (pwdInput) pwdInput.value = ''; // a senha nunca fica guardada
    cloudConfig.loggedEmail = email;
    saveCloudConfig();
    recordAuditLog('Autenticação Nuvem', `Login realizado com sucesso (${email})`);
    updateAuthHeaderUI();

    if (feedbackEl) {
      feedbackEl.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mt-2';
      feedbackEl.textContent = isSignUp
        ? `Conta criada para ${email} (${getLoggedPerson()})!`
        : `Conectado como ${email} (${getLoggedPerson()})!`;
    }
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.className = 'text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 mt-2';
      feedbackEl.textContent = 'Erro na autenticação: ' + (err.message || String(err));
    }
  }
}

// Confirma que existe uma sessão de login válida antes de falar com a nuvem
async function hasActiveSupabaseSession(client) {
  try {
    const { data } = await client.auth.getSession();
    return !!(data && data.session);
  } catch (e) {
    return false;
  }
}

// Sai da conta (importante em aparelhos compartilhados)
async function signOutSupabase() {
  const client = getSupabaseClient();
  if (client) {
    try { await client.auth.signOut(); } catch (e) {}
  }
  cloudConfig.lastSyncAt = null;
  saveCloudConfig();
  recordAuditLog('Autenticação Nuvem', 'Logout realizado neste aparelho');
  updateAuthHeaderUI();
  const feedbackEl = document.getElementById('cloudSyncFeedbackMsg');
  if (feedbackEl) {
    feedbackEl.className = 'text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-xl p-2.5 mt-2';
    feedbackEl.textContent = 'Você saiu da conta neste aparelho.';
    feedbackEl.classList.remove('hidden');
  }
}

let lastAutoPullTimestamp = 0;
let lastAppliedCloudUpdatedAt = null;

// Helpers REST diretos usando a Anon Key (imunes a relógio adiantado em 2026 ou token OAuth expirado no notebook)
async function fetchHouseholdRowDirect(householdCode) {
  const baseUrl = (cloudConfig.supabaseUrl || '').trim().replace(/\/+$/, '');
  const anonKey = (cloudConfig.supabaseAnonKey || '').trim();

  if (baseUrl && anonKey && typeof fetch === 'function') {
    try {
      const endpoint = `${baseUrl}/rest/v1/household_state_sync?household_code=eq.${encodeURIComponent(householdCode)}&select=state_json,updated_by,updated_at&limit=1`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      if (res.ok) {
        const rows = await res.json();
        return { data: Array.isArray(rows) && rows.length > 0 ? rows[0] : null, error: null };
      }
    } catch (e) {}
  }

  const client = getSupabaseClient();
  if (!client) return { data: null, error: new Error('Cliente Supabase indisponível') };
  return await client
    .from('household_state_sync')
    .select('state_json, updated_by, updated_at')
    .eq('household_code', householdCode)
    .maybeSingle();
}

async function upsertHouseholdRowDirect(rowPayload) {
  const baseUrl = (cloudConfig.supabaseUrl || '').trim().replace(/\/+$/, '');
  const anonKey = (cloudConfig.supabaseAnonKey || '').trim();

  if (baseUrl && anonKey && typeof fetch === 'function') {
    try {
      const endpoint = `${baseUrl}/rest/v1/household_state_sync?on_conflict=household_code`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rowPayload)
      });
      if (res.ok) {
        return { error: null };
      }
    } catch (e) {}
  }

  const client = getSupabaseClient();
  if (!client) return { error: new Error('Cliente Supabase indisponível') };
  return await client
    .from('household_state_sync')
    .upsert(rowPayload, { onConflict: 'household_code' });
}

// Mescla itens protegidos (OFX/PDF/meses fechados) de uma fonte externa sem perder nada
function mergeProtectedItemsIntoTarget(targetState, sourceState) {
  let addedAny = false;
  if (!targetState || !sourceState) return addedAny;

  if (!Array.isArray(targetState.transactions)) targetState.transactions = [];
  if (!Array.isArray(targetState.uploadedFiles)) targetState.uploadedFiles = [];
  if (!Array.isArray(targetState.importedSources)) targetState.importedSources = [];

  const txSignature = (t) => {
    const amt = typeof toCents === 'function' ? toCents(t.amount) : Math.round((Number(t.amount) || 0) * 100);
    const normDesc = String(t.desc || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    return `${t.accountId || ''}|${t.period || ''}|${t.type || ''}|${t.date || ''}|${amt}|${normDesc}`;
  };

  const targetTxIds = new Set(targetState.transactions.map(t => t.id));
  const targetTxSigs = new Set(targetState.transactions.map(txSignature));
  const sourceProtectedTx = (sourceState.transactions || []).filter(
    t => !t.isAutoProjected && typeof isTransactionProtected === 'function' && isTransactionProtected(t)
  );
  sourceProtectedTx.forEach(pt => {
    const sig = txSignature(pt);
    if (!targetTxIds.has(pt.id) && !targetTxSigs.has(sig)) {
      targetState.transactions.push(pt);
      targetTxIds.add(pt.id);
      targetTxSigs.add(sig);
      addedAny = true;
    }
  });

  const fileSignature = (f) => `${String(f.fileName || '').toLowerCase()}|${f.period || ''}|${f.fileType || ''}`;
  const targetFileIds = new Set(targetState.uploadedFiles.map(f => f.id));
  const targetFileSigs = new Set(targetState.uploadedFiles.map(fileSignature));
  const sourceProtectedFiles = (sourceState.uploadedFiles || []).filter(
    f => typeof isUploadedFileProtected === 'function' && isUploadedFileProtected(f)
  );
  sourceProtectedFiles.forEach(pf => {
    const fSig = fileSignature(pf);
    if (!targetFileIds.has(pf.id) && !targetFileSigs.has(fSig)) {
      targetState.uploadedFiles.push(pf);
      targetFileIds.add(pf.id);
      targetFileSigs.add(fSig);
      addedAny = true;
    }
  });

  const targetSourceIds = new Set(targetState.importedSources.map(s => s.id));
  (sourceState.importedSources || []).forEach(src => {
    if (src && src.id && !targetSourceIds.has(src.id)) {
      targetState.importedSources.push(src);
      targetSourceIds.add(src.id);
    }
  });

  return addedAny;
}

// Envia o estado atual da família para a tabela `household_state_sync` no Supabase
async function pushStateToSupabaseCloud(silent) {
  if (!silent) saveCloudSettingsFromModal();
  const feedbackEl = typeof document !== 'undefined' ? document.getElementById('cloudSyncFeedbackMsg') : null;

  if (!cloudConfig.supabaseUrl || !cloudConfig.supabaseAnonKey) {
    if (!silent) {
      alert('Para sincronizar em nuvem entre diferentes celulares/PCs, preencha a URL e a Anon Key do seu projeto Supabase.');
    }
    return false;
  }

  try {
    const householdCode = cloudConfig.householdCode || 'casal_eveli_vital';

    // Antes de sobrescrever a nuvem, verifica se a nuvem já possui arquivos/lançamentos protegidos que ainda não estão neste aparelho
    const existingCloud = await fetchHouseholdRowDirect(householdCode);
    if (existingCloud && existingCloud.data && existingCloud.data.state_json) {
      const cloudSanitized = sanitizeState(existingCloud.data.state_json, householdCode);
      const absorbedFromCloud = mergeProtectedItemsIntoTarget(state, cloudSanitized);
      if (absorbedFromCloud) {
        state.transactions = enrichTransactionsAndProjectInstallments(state.transactions || []);
        if (typeof renderAll === 'function') renderAll();
      }
    }

    const cleanPayload = {
      ...state,
      // Não precisa salvar parcelas auto-projetadas no banco, pois o motor recria ao abrir
      transactions: (state.transactions || []).filter(t => !t.isAutoProjected)
    };

    const updatedAtIso = new Date().toISOString();
    const { error } = await upsertHouseholdRowDirect({
      household_code: householdCode,
      state_json: cleanPayload,
      updated_by: getLoggedPerson(),
      updated_at: updatedAtIso
    });

    if (error) throw error;

    lastAppliedCloudUpdatedAt = updatedAtIso;
    const now = new Date();
    cloudConfig.lastSyncAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    saveCloudConfig();
    updateAuthHeaderUI();

    if (!silent && feedbackEl) {
      feedbackEl.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mt-2';
      feedbackEl.textContent = `Dados enviados para a nuvem com sucesso às ${cloudConfig.lastSyncAt}! O outro integrante já pode baixar.`;
      feedbackEl.classList.remove('hidden');
    }
    return true;
  } catch (err) {
    if (!silent && feedbackEl) {
      feedbackEl.className = 'text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 mt-2';
      feedbackEl.textContent = 'Erro ao enviar para o Supabase: ' + (err.message || String(err));
      feedbackEl.classList.remove('hidden');
    }
    return false;
  }
}

// Aplica no app os dados recebidos da nuvem (com mesclagem protetora de documentos e meses anteriores e reenvio automático se o aparelho local tiver arquivos novos)
function applyIncomingState(incomingJson, updatedBy, cloudUpdatedAt) {
  if (!incomingJson) return;
  try {
    const householdCode = cloudConfig.householdCode || 'casal_eveli_vital';
    const incoming = sanitizeState(incomingJson, householdCode);

    // Garante que nenhum documento oficial (.OFX / .PDF) ou registro de mês anterior já salvo localmente (ex: no notebook) seja perdido
    const localHasMoreProtectedData = mergeProtectedItemsIntoTarget(incoming, state);

    const baseData = typeof getBaseDataForHousehold === 'function'
      ? getBaseDataForHousehold(householdCode, getLoggedPerson())
      : getInitialFamilyData();

    state = {
      ...baseData,
      ...incoming,
      transactions: enrichTransactionsAndProjectInstallments(incoming.transactions || [])
    };

    if (typeof localStorage !== 'undefined') {
      try {
        const storageKey = typeof getActiveStorageKey === 'function' ? getActiveStorageKey() : STORAGE_KEY;
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (e) {}
    }

    if (cloudUpdatedAt) {
      lastAppliedCloudUpdatedAt = cloudUpdatedAt;
    }

    const now = new Date();
    cloudConfig.lastSyncAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    saveCloudConfig();
    updateAuthHeaderUI();
    if (typeof renderAll === 'function') renderAll();

    // Se este aparelho (ex: Notebook) tinha arquivos OFX/PDF ou lançamentos oficiais que ainda não estavam na nuvem,
    // envia automaticamente o estado completo de volta para a nuvem para atualizar o Celular!
    if (localHasMoreProtectedData) {
      setTimeout(() => {
        pushStateToSupabaseCloud(true);
      }, 400);
    }
  } catch (err) {
    console.error('Erro ao aplicar dados recebidos da nuvem:', err);
  }
}

// Baixa os dados mais recentes da família salvos na nuvem do Supabase
async function pullStateFromSupabaseCloud(silent) {
  if (!silent) saveCloudSettingsFromModal();
  const feedbackEl = typeof document !== 'undefined' ? document.getElementById('cloudSyncFeedbackMsg') : null;

  if (!cloudConfig.supabaseUrl || !cloudConfig.supabaseAnonKey) {
    if (!silent) {
      alert('Preencha a URL e a Anon Key do Supabase para buscar os dados da nuvem.');
    }
    return false;
  }

  try {
    lastAutoPullTimestamp = Date.now();
    const householdCode = cloudConfig.householdCode || 'casal_eveli_vital';
    const { data, error } = await fetchHouseholdRowDirect(householdCode);

    if (error) throw error;
    if (!data || !data.state_json) {
      // Se for uma nova conta de outra pessoa/família que ainda não possui dados na nuvem,
      // garante que ela inicie 100% do zero (sem herdar dados do casal)
      if (typeof isCoupleHousehold === 'function' && !isCoupleHousehold(householdCode)) {
        if (typeof switchActiveHouseholdState === 'function') {
          switchActiveHouseholdState(householdCode, getLoggedPerson());
        }
      } else {
        // Se for a conta do casal e a nuvem ainda estiver vazia, envia os dados locais para a nuvem automaticamente
        pushStateToSupabaseCloud(true);
      }
      if (!silent && feedbackEl) {
        feedbackEl.className = 'text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2';
        feedbackEl.textContent = 'Sincronizando base inicial com a nuvem...';
        feedbackEl.classList.remove('hidden');
      }
      return false;
    }

    // Se este aparelho já tem arquivos/lançamentos locais que faltam na nuvem, ou se a nuvem mudou, aplica e sincroniza
    const incomingFilesCount = Array.isArray(data.state_json.uploadedFiles) ? data.state_json.uploadedFiles.length : 0;
    const localFilesCount = Array.isArray(state?.uploadedFiles) ? state.uploadedFiles.length : 0;
    const incomingTxCount = Array.isArray(data.state_json.transactions) ? data.state_json.transactions.length : 0;
    const localRealTxCount = Array.isArray(state?.transactions) ? state.transactions.filter(t => !t.isAutoProjected).length : 0;

    if (
      silent &&
      lastAppliedCloudUpdatedAt &&
      data.updated_at === lastAppliedCloudUpdatedAt &&
      localFilesCount <= incomingFilesCount &&
      localRealTxCount <= incomingTxCount
    ) {
      return true;
    }

    applyIncomingState(data.state_json, data.updated_by, data.updated_at);

    if (!silent && feedbackEl) {
      feedbackEl.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mt-2';
      feedbackEl.textContent = `Dados sincronizados da nuvem (última atualização por ${data.updated_by || 'Casal'})!`;
      feedbackEl.classList.remove('hidden');
    }
    return true;
  } catch (err) {
    if (!silent && feedbackEl) {
      feedbackEl.className = 'text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 mt-2';
      feedbackEl.textContent = 'Erro ao baixar da nuvem: ' + (err.message || String(err));
      feedbackEl.classList.remove('hidden');
    }
    return false;
  }
}

// Canal de Sincronização em Tempo Real (Supabase Realtime WebSockets)
let realtimeChannelInstance = null;
function subscribeToSupabaseRealtime() {
  const client = getSupabaseClient();
  if (!client || typeof client.channel !== 'function') return;

  try {
    if (realtimeChannelInstance && typeof client.removeChannel === 'function') {
      client.removeChannel(realtimeChannelInstance);
    }

    const code = cloudConfig.householdCode || 'casal_eveli_vital';
    realtimeChannelInstance = client
      .channel(`household_realtime_${code}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_state_sync',
          filter: `household_code=eq.${code}`
        },
        payload => {
          if (payload.new && payload.new.state_json) {
            applyIncomingState(payload.new.state_json, payload.new.updated_by);
          }
        }
      )
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscription:', e);
  }
}

// Agenda envio automático em background quando o casal altera dados e a nuvem está configurada
function scheduleCloudAutoSync() {
  if (!cloudConfig.autoSync || !cloudConfig.supabaseUrl || !cloudConfig.supabaseAnonKey) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    pushStateToSupabaseCloud(true);
  }, 1500);
}

// Sincroniza automaticamente quando o usuário volta para a aba do navegador (com intervalo mínimo de 30s para evitar piscar a tela)
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('focus', () => {
    if (
      cloudConfig.supabaseUrl &&
      typeof authState !== 'undefined' &&
      authState.isUnlocked &&
      Date.now() - lastAutoPullTimestamp > 30000
    ) {
      pullStateFromSupabaseCloud(true);
    }
  });

  window.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      cloudConfig.supabaseUrl &&
      typeof authState !== 'undefined' &&
      authState.isUnlocked &&
      Date.now() - lastAutoPullTimestamp > 30000
    ) {
      pullStateFromSupabaseCloud(true);
    }
  });

  // Verificação silenciosa a cada 15s (só renderiza se a nuvem tiver mudança nova ou se faltar subir arquivos locais)
  setInterval(() => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      cloudConfig.supabaseUrl &&
      typeof authState !== 'undefined' &&
      authState.isUnlocked
    ) {
      pullStateFromSupabaseCloud(true);
    }
  }, 15000);
}
