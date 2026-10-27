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
  if (personName !== 'Éveli' && personName !== 'Vital' && personName !== 'Marido') return;
  cloudConfig.loggedPerson = personName === 'Marido' ? 'Vital' : personName;
  saveCloudConfig();

  // Ajusta o campo padrão do formulário de novo lançamento para quem está logado
  const ownerInput = typeof document !== 'undefined' ? document.getElementById('txOwnerInput') : null;
  if (ownerInput) {
    ownerInput.value = personName;
    if (typeof syncAccountDefaultByOwner === 'function') {
      syncAccountDefaultByOwner();
    }
  }

  recordAuditLog('Troca de Perfil Ativo', `Sessão ativa alterada para ${personName}`);
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
  cloudConfig.supabaseUrl = (document.getElementById('cloudSupabaseUrlInput').value || '').trim();
  cloudConfig.supabaseAnonKey = (document.getElementById('cloudSupabaseKeyInput').value || '').trim();
  cloudConfig.householdCode = (document.getElementById('cloudHouseholdCodeInput').value || 'casal_eveli_vital').trim();
  cloudConfig.loggedEmail = (document.getElementById('cloudUserEmailInput').value || '').trim();
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

// Envia o estado atual da família para a tabela `household_state_sync` no Supabase
async function pushStateToSupabaseCloud(silent) {
  if (! silent) saveCloudSettingsFromModal();
  const client = getSupabaseClient();
  const feedbackEl = typeof document !== 'undefined' ? document.getElementById('cloudSyncFeedbackMsg') : null;

  if (!client) {
    if (!silent) {
      alert('Para sincronizar em nuvem entre diferentes celulares/PCs, preencha a URL e a Anon Key do seu projeto Supabase.');
    }
    return false;
  }

  try {
    if (!(await hasActiveSupabaseSession(client))) {
      throw new Error('Faça login (e-mail e senha) antes de sincronizar com a nuvem.');
    }
    const cleanPayload = {
      ...state,
      // Não precisa salvar parcelas auto-projetadas no banco, pois o motor recria ao abrir
      transactions: (state.transactions || []).filter(t => !t.isAutoProjected)
    };

    const { error } = await client
      .from('household_state_sync')
      .upsert({
        household_code: cloudConfig.householdCode || 'casal_eveli_vital',
        state_json: cleanPayload,
        updated_by: getLoggedPerson(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'household_code' });

    if (error) throw error;

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

// Baixa os dados mais recentes da família salvos na nuvem do Supabase
async function pullStateFromSupabaseCloud(silent) {
  if (!silent) saveCloudSettingsFromModal();
  const client = getSupabaseClient();
  const feedbackEl = typeof document !== 'undefined' ? document.getElementById('cloudSyncFeedbackMsg') : null;

  if (!client) {
    if (!silent) {
      alert('Preencha a URL e a Anon Key do Supabase para buscar os dados da nuvem.');
    }
    return false;
  }

  try {
    if (!(await hasActiveSupabaseSession(client))) {
      throw new Error('Faça login (e-mail e senha) antes de baixar os dados da nuvem.');
    }
    const { data, error } = await client
      .from('household_state_sync')
      .select('state_json, updated_by, updated_at')
      .eq('household_code', cloudConfig.householdCode || 'casal_eveli_vital')
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.state_json) {
      if (!silent && feedbackEl) {
        feedbackEl.className = 'text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2';
        feedbackEl.textContent = 'Ainda não há dados salvos na nuvem para este código de família. Clique primeiro em "Enviar p/ Nuvem".';
        feedbackEl.classList.remove('hidden');
      }
      return false;
    }

    const incoming = sanitizeState(data.state_json);
    state = {
      ...getInitialFamilyData(),
      ...incoming,
      transactions: enrichTransactionsAndProjectInstallments(incoming.transactions || [])
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    const now = new Date();
    cloudConfig.lastSyncAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    saveCloudConfig();
    updateAuthHeaderUI();
    if (typeof renderAll === 'function') renderAll();

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

// Agenda envio automático em background quando o casal altera dados e a nuvem está configurada
function scheduleCloudAutoSync() {
  if (!cloudConfig.autoSync || !cloudConfig.supabaseUrl || !cloudConfig.supabaseAnonKey) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    pushStateToSupabaseCloud(true);
  }, 1500);
}
