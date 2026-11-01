// ============================================================================
// MÓDULO DE AUTENTICAÇÃO E SEGURANÇA DA FAMÍLIA (AUTH GUARD)
// ============================================================================
// Responsável por:
// 1. Tela de Login moderna, completa e segura (Éveli & Vital).
// 2. Autenticação por E-mail e Senha via Supabase Auth + Fallback Local.
// 3. Login com 1 clique pelo Google (Google OAuth).
// 4. Gerador e sugestão de senha forte com medidor de força (Password Strength).
// 5. Criptografia de senhas usando Web Crypto API (SHA-256 + Salt).
// 6. Proteção contra ataques de força bruta (Rate limiting / lockout temporário).
// 7. Sessão segura com opção "Lembrar de mim" e bloqueio automático por inatividade.

const AUTH_CONFIG_KEY = 'financas_auth_config_v2';
const AUTH_SESSION_KEY = 'financas_auth_session_v2';
const DEFAULT_SALT = 'eveli_vital_financas_secure_salt_2026';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

let authState = {
  isUnlocked: false,
  selectedPerson: 'Éveli',
  authMode: 'signin', // 'signin' | 'signup' | 'recovery' | 'pin'
  rememberMe: true,
  failedAttempts: 0,
  lockoutTimerInterval: null,
  inactivityTimer: null
};

// ----------------------------------------------------------------------------
// GERADOR DE SENHA FORTE & MEDIDOR DE FORÇA
// ----------------------------------------------------------------------------
function generateStrongPassword(length = 16) {
  // Caracteres legíveis sem símbolos ambíguos (evita l, I, 0, O)
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const symbols = '!@#$%*&_+-=';
  const all = lower + upper + numbers + symbols;

  const getRandomChar = str => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return str[arr[0] % str.length];
  };

  // Garante pelo menos 2 de cada categoria
  const pwd = [
    getRandomChar(lower), getRandomChar(lower),
    getRandomChar(upper), getRandomChar(upper),
    getRandomChar(numbers), getRandomChar(numbers),
    getRandomChar(symbols), getRandomChar(symbols)
  ];

  while (pwd.length < Math.max(length, 12)) {
    pwd.push(getRandomChar(all));
  }

  // Embaralhamento criptográfico Fisher-Yates
  for (let i = pwd.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join('');
}

function evaluatePasswordStrength(password) {
  if (!password) {
    return {
      score: 0,
      percent: 0,
      label: 'Vazia',
      color: 'slate',
      badgeClass: 'text-slate-400 bg-slate-800 border-slate-700',
      barColor: 'bg-slate-700',
      bars: 0,
      feedback: 'Digite uma senha para analisar a força.'
    };
  }

  let score = 0;
  const len = password.length;

  if (len >= 8) score += 20;
  if (len >= 12) score += 15;
  if (len >= 16) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  let label = 'Fraca';
  let badgeClass = 'text-rose-400 bg-rose-950/40 border-rose-800/40';
  let barColor = 'bg-rose-500';
  let bars = 1;

  if (score >= 85) {
    label = 'Excelente';
    badgeClass = 'text-emerald-300 bg-emerald-950/40 border-emerald-700/50';
    barColor = 'bg-emerald-400';
    bars = 4;
  } else if (score >= 65) {
    label = 'Forte';
    badgeClass = 'text-sky-300 bg-sky-950/40 border-sky-700/50';
    barColor = 'bg-sky-400';
    bars = 3;
  } else if (score >= 40) {
    label = 'Média';
    badgeClass = 'text-amber-300 bg-amber-950/40 border-amber-700/50';
    barColor = 'bg-amber-400';
    bars = 2;
  }

  return {
    score,
    percent: Math.min(score, 100),
    label,
    badgeClass,
    barColor,
    bars,
    feedback: score >= 65 ? 'Senha forte e recomendada!' : 'Dica: use letras maiúsculas, minúsculas, números e símbolos.'
  };
}

function updatePasswordStrengthUI(password) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('passwordStrengthContainer');
  if (!container) return;

  const res = evaluatePasswordStrength(password);
  const badge = document.getElementById('passwordStrengthBadge');
  const feed = document.getElementById('passwordStrengthFeedback');
  const bars = [
    document.getElementById('pwdBar1'),
    document.getElementById('pwdBar2'),
    document.getElementById('pwdBar3'),
    document.getElementById('pwdBar4')
  ];

  if (badge) {
    badge.textContent = res.label;
    badge.className = `text-[10px] px-2 py-0.5 rounded-full border font-bold ${res.badgeClass}`;
  }
  if (feed) {
    feed.textContent = res.feedback;
  }

  bars.forEach((bar, idx) => {
    if (!bar) return;
    if (idx < res.bars) {
      bar.className = `h-1 flex-1 rounded-full transition-all duration-300 ${res.barColor}`;
    } else {
      bar.className = 'h-1 flex-1 rounded-full bg-slate-800 transition-all duration-300';
    }
  });
}

function suggestStrongPassword(targetInputId = 'loginPasswordInput') {
  const pwd = generateStrongPassword(16);
  const input = document.getElementById(targetInputId);
  if (input) {
    input.value = pwd;
    input.type = 'text'; // exibe temporariamente para visualização
    const icon = document.getElementById('loginEyeIcon');
    if (icon) icon.textContent = '🙈';
    updatePasswordStrengthUI(pwd);
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pwd).catch(() => {});
  }

  showLoginFeedback('✨ Senha forte gerada e copiada para sua área de transferência!', 'success');
}

// ----------------------------------------------------------------------------
// ISOLAMENTO MULTI-CONTA: IDENTIFICA SE É O CASAL (ÉVELI & VITAL) OU OUTRO USUÁRIO
// ----------------------------------------------------------------------------
function isAuthorizedCoupleUser(email = '', fullName = '', metaHousehold = '', customHousehold = '') {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(fullName || '').trim().toLowerCase();
  const coupleCode = typeof COUPLE_HOUSEHOLD_CODE !== 'undefined' ? COUPLE_HOUSEHOLD_CODE : 'casal_eveli_vital';

  if (metaHousehold === coupleCode || customHousehold === coupleCode) return true;

  const allowedList = (typeof window !== 'undefined' && window.SUPABASE_CONFIG && Array.isArray(window.SUPABASE_CONFIG.coupleEmails))
    ? window.SUPABASE_CONFIG.coupleEmails.map(e => String(e).toLowerCase())
    : [];
  if (cleanEmail && allowedList.includes(cleanEmail)) return true;

  if (
    cleanEmail.includes('eveli') ||
    cleanEmail.includes('vital') ||
    cleanName.includes('eveli') ||
    cleanName.includes('éveli') ||
    cleanName.includes('vital')
  ) {
    return true;
  }

  return false;
}

function resolveUserHouseholdAndProfile(user, customHouseholdInput = '', fallbackEmail = '', fallbackName = '') {
  const email = String(user?.email || fallbackEmail || '').trim();
  const lowerEmail = email.toLowerCase();
  const meta = (user && user.user_metadata) ? user.user_metadata : {};
  const rawName = String(fallbackName || meta.full_name || meta.name || meta.person || '').trim();
  const metaHousehold = String(meta.household_code || '').trim();
  const customHousehold = String(customHouseholdInput || '').trim();
  const coupleCode = typeof COUPLE_HOUSEHOLD_CODE !== 'undefined' ? COUPLE_HOUSEHOLD_CODE : 'casal_eveli_vital';

  // 1. Verifica se pertence à conta oficial da Éveli e do Vital
  if (isAuthorizedCoupleUser(lowerEmail, rawName, metaHousehold, customHousehold)) {
    const isVital = lowerEmail.includes('vital') || rawName.toLowerCase().includes('vital');
    return {
      person: isVital ? 'Vital' : 'Éveli',
      householdCode: coupleCode,
      isCouple: true
    };
  }

  // 2. Qualquer outra pessoa entra em uma conta 100% isolada e começa do zero
  const safeId = typeof sanitizeId === 'function'
    ? sanitizeId(
        customHousehold ||
        (metaHousehold && metaHousehold !== coupleCode ? metaHousehold : '') ||
        user?.id ||
        lowerEmail ||
        'novo_usuario'
      )
    : String(user?.id || lowerEmail || 'novo_usuario').replace(/[^A-Za-z0-9_.\-]/g, '_');

  const isolatedHousehold = safeId.startsWith('conta_') ? safeId : `conta_${safeId}`;
  const displayPerson = rawName || (email ? email.split('@')[0] : 'Titular');

  return {
    person: displayPerson,
    householdCode: isolatedHousehold,
    isCouple: false
  };
}

// ----------------------------------------------------------------------------
// CONTROLE DE MODOS DE LOGIN (ENTRAR / CRIAR CONTA / RECUPERAR)
// ----------------------------------------------------------------------------
function setAuthMode(mode) {
  authState.authMode = mode;
  if (typeof document === 'undefined') return;

  const nameField = document.getElementById('loginNameField');
  const householdField = document.getElementById('loginHouseholdField');
  const emailField = document.getElementById('loginEmailField');
  const passwordField = document.getElementById('loginPasswordField');
  const rememberField = document.getElementById('loginRememberField');
  const googleBtnBox = document.getElementById('loginGoogleBtnBox');
  const submitBtnText = document.getElementById('loginSubmitBtnText');
  const strengthContainer = document.getElementById('passwordStrengthContainer');
  const btnSuggestPwd = document.getElementById('btnSuggestStrongPassword');
  const suggestPwdDot = document.getElementById('suggestPwdSeparatorDot');
  const btnForgotPwd = document.getElementById('btnForgotPasswordLink');

  const tabSignIn = document.getElementById('authTabBtnSignIn');
  const tabSignUp = document.getElementById('authTabBtnSignUp');

  const updateTabClass = (btn, active) => {
    if (!btn) return;
    btn.className = active
      ? 'flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-sky-600 text-white shadow-sm transition cursor-pointer'
      : 'flex-1 py-2 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer';
  };

  updateTabClass(tabSignIn, mode === 'signin');
  updateTabClass(tabSignUp, mode === 'signup');

  // Reseta visibilidade dos campos
  if (nameField) nameField.classList.add('hidden');
  if (householdField) householdField.classList.add('hidden');
  if (emailField) emailField.classList.remove('hidden');
  if (passwordField) passwordField.classList.remove('hidden');
  if (rememberField) rememberField.classList.remove('hidden');
  if (googleBtnBox) googleBtnBox.classList.remove('hidden');

  if (mode === 'signup') {
    if (nameField) nameField.classList.remove('hidden');
    if (householdField) householdField.classList.remove('hidden');
    if (strengthContainer) strengthContainer.classList.remove('hidden');
    if (btnSuggestPwd) btnSuggestPwd.classList.remove('hidden');
    if (suggestPwdDot) suggestPwdDot.classList.add('hidden');
    if (btnForgotPwd) btnForgotPwd.classList.add('hidden');
    if (submitBtnText) submitBtnText.textContent = 'Criar Minha Conta do Zero ✨';
  } else if (mode === 'recovery') {
    if (passwordField) passwordField.classList.add('hidden');
    if (rememberField) rememberField.classList.add('hidden');
    if (googleBtnBox) googleBtnBox.classList.add('hidden');
    if (submitBtnText) submitBtnText.textContent = 'Enviar Link de Recuperação 📧';
  } else {
    // signin padrão (tela limpa, sem barras de força de senha)
    if (strengthContainer) strengthContainer.classList.add('hidden');
    if (btnSuggestPwd) btnSuggestPwd.classList.add('hidden');
    if (suggestPwdDot) suggestPwdDot.classList.add('hidden');
    if (btnForgotPwd) btnForgotPwd.classList.remove('hidden');
    if (submitBtnText) submitBtnText.textContent = 'Entrar';
  }

  const feedback = document.getElementById('loginFeedbackMsg');
  if (feedback) feedback.classList.add('hidden');
}

// ----------------------------------------------------------------------------
// LOGIN COM O GOOGLE (SUPABASE OAUTH COM 1 CLIQUE)
// ----------------------------------------------------------------------------
async function loginWithGoogleOAuth() {
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (!client) {
    showLoginFeedback('Conectando ao Supabase... Verifique as configurações de nuvem.', 'warning');
    return;
  }

  showLoginFeedback('Redirecionando para o Google com segurança...', 'info');

  try {
    const redirectTo = (typeof window !== 'undefined' && window.location)
      ? window.location.origin + window.location.pathname
      : undefined;

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
      }
    });

    if (error) throw error;
  } catch (err) {
    console.error('Google OAuth error:', err);
    const msg = err.message || String(err);
    if (msg.includes('provider is not enabled') || msg.includes('Google provider is not enabled')) {
      showLoginFeedback('Dica: ative o provedor Google no painel do Supabase (Authentication > Providers > Google).', 'warning');
    } else {
      showLoginFeedback('Erro ao conectar com Google: ' + msg, 'danger');
    }
  }
}

// ----------------------------------------------------------------------------
// CRIPTOGRAFIA & HASH SEGURO (SHA-256)
// ----------------------------------------------------------------------------
async function generateSha256Hash(plainText, salt = DEFAULT_SALT) {
  const salted = `${salt}:${plainText}:${salt}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(salted);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredAuthConfig() {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveStoredAuthConfig(cfg) {
  try {
    localStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {}
}

function getStoredSession() {
  try {
    const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (sessionRaw) {
      const s = JSON.parse(sessionRaw);
      if (s.expiresAt && Date.now() < s.expiresAt) return s;
    }
    const localRaw = localStorage.getItem(AUTH_SESSION_KEY);
    if (localRaw) {
      const s = JSON.parse(localRaw);
      if (s.expiresAt && Date.now() < s.expiresAt) return s;
    }
  } catch (e) {}
  return null;
}

function saveSession(person, rememberMe, householdCode, email) {
  const durationMs = rememberMe ? (30 * 24 * 60 * 60 * 1000) : (8 * 60 * 60 * 1000); // 30 dias ou 8 horas
  const session = {
    person,
    householdCode: householdCode || (typeof cloudConfig !== 'undefined' ? cloudConfig.householdCode : 'casal_eveli_vital'),
    email: email || (typeof cloudConfig !== 'undefined' ? cloudConfig.loggedEmail : ''),
    rememberMe,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMs
  };
  const str = JSON.stringify(session);
  if (rememberMe) {
    localStorage.setItem(AUTH_SESSION_KEY, str);
  } else {
    sessionStorage.setItem(AUTH_SESSION_KEY, str);
    localStorage.removeItem(AUTH_SESSION_KEY);
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// INICIALIZAÇÃO DA PROTEÇÃO DA TELA E OAUTH LISTENER (SEM PISCAR TELA!)
// ----------------------------------------------------------------------------
let lastHandledAuthUserId = null;

async function initAuthGuard() {
  // 1. Verifica IMEDIATAMENTE (de forma síncrona, antes de qualquer await) se já há sessão válida,
  // evitando que a tela de login pisque ao abrir ou atualizar a página!
  const activeSession = getStoredSession();
  if (activeSession && activeSession.person) {
    if (typeof cloudConfig !== 'undefined') {
      if (activeSession.householdCode) cloudConfig.householdCode = activeSession.householdCode;
      if (activeSession.email) cloudConfig.loggedEmail = activeSession.email;
      cloudConfig.loggedPerson = activeSession.person;
      if (typeof saveCloudConfig === 'function') saveCloudConfig();
    }
    if (typeof switchActiveHouseholdState === 'function' && activeSession.householdCode) {
      switchActiveHouseholdState(activeSession.householdCode, activeSession.person);
    }
    unlockApp(activeSession.person, false);
  } else {
    lockAppScreen();
  }

  // 2. Preenche o último e-mail lembrado se existir
  const emailInput = typeof document !== 'undefined' ? document.getElementById('loginEmailInput') : null;
  if (emailInput && typeof cloudConfig !== 'undefined' && cloudConfig.loggedEmail) {
    emailInput.value = cloudConfig.loggedEmail;
  }

  // 3. Configura o ouvinte oficial do Supabase Auth para Google OAuth
  setupSupabaseAuthListener();

  // 4. Se já estava desbloqueado, sincroniza silenciosamente em background
  if (authState.isUnlocked && typeof pullStateFromSupabaseCloud === 'function') {
    pullStateFromSupabaseCloud(true);
  }

  // 5. Inicializa hash local padrão em segundo plano caso ainda não exista
  let cfg = getStoredAuthConfig();
  if (!cfg || !cfg.passwordHash) {
    const defaultHash = await generateSha256Hash('123456', DEFAULT_SALT);
    cfg = {
      isConfigured: true,
      passwordHash: defaultHash,
      hint: 'Senha padrão inicial: 123456 (você pode alterar a qualquer momento)',
      salt: DEFAULT_SALT,
      failedAttempts: 0,
      lockoutUntil: 0,
      autoLockMinutes: 15
    };
    saveStoredAuthConfig(cfg);
  }
}

function setupSupabaseAuthListener() {
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (!client || !client.auth || !client.auth.onAuthStateChange) return;

  client.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
      const email = session.user.email || '';
      const resolved = resolveUserHouseholdAndProfile(session.user);

      // Se a tela já está desbloqueada para este mesmo usuário e mesma conta, ignora para não piscar a tela!
      if (
        authState.isUnlocked &&
        lastHandledAuthUserId === session.user.id &&
        typeof cloudConfig !== 'undefined' &&
        cloudConfig.householdCode === resolved.householdCode
      ) {
        return;
      }

      lastHandledAuthUserId = session.user.id;
      const previousHousehold = typeof cloudConfig !== 'undefined' ? cloudConfig.householdCode : null;

      if (typeof cloudConfig !== 'undefined') {
        cloudConfig.loggedEmail = email;
        cloudConfig.loggedPerson = resolved.person;
        cloudConfig.householdCode = resolved.householdCode;
        if (typeof saveCloudConfig === 'function') saveCloudConfig();
      }

      if (typeof switchActiveHouseholdState === 'function' && previousHousehold !== resolved.householdCode) {
        switchActiveHouseholdState(resolved.householdCode, resolved.person);
      }

      const wasUnlocked = authState.isUnlocked;
      saveSession(resolved.person, true, resolved.householdCode, email);
      unlockApp(resolved.person, !wasUnlocked);

      if (typeof pullStateFromSupabaseCloud === 'function') {
        pullStateFromSupabaseCloud(true);
      }
    } else if (event === 'SIGNED_OUT') {
      // Só bloqueia se realmente havia uma sessão Supabase ativa sendo encerrada
      if (lastHandledAuthUserId !== null) {
        lastHandledAuthUserId = null;
        lockAppScreen();
      }
    }
  });
}

// ----------------------------------------------------------------------------
// AÇÕES DE BLOQUEIO E DESBLOQUEIO
// ----------------------------------------------------------------------------
function lockAppScreen() {
  authState.isUnlocked = false;
  clearSession();

  const overlay = document.getElementById('appLoginOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
  }

  const pwdInput = document.getElementById('loginPasswordInput');
  if (pwdInput) {
    pwdInput.value = '';
  }

  const feedback = document.getElementById('loginFeedbackMsg');
  if (feedback) feedback.classList.add('hidden');

  checkLockoutStatus();
  updateAuthHeaderUI();
}

function unlockApp(person, recordAudit = true) {
  authState.isUnlocked = true;
  authState.selectedPerson = person || 'Éveli';

  if (typeof setLoggedPerson === 'function') {
    setLoggedPerson(person);
  } else if (typeof cloudConfig !== 'undefined') {
    cloudConfig.loggedPerson = person;
  }

  const overlay = document.getElementById('appLoginOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }

  updateAuthHeaderUI();

  if (typeof subscribeToSupabaseRealtime === 'function') {
    subscribeToSupabaseRealtime();
  }

  if (recordAudit && typeof recordAuditLog === 'function') {
    recordAuditLog('Acesso ao Sistema', `Login efetuado por ${person}`);
  }

  resetInactivityTimer();
}

// ----------------------------------------------------------------------------
// SELEÇÃO DE PERFIL NA TELA DE LOGIN
// ----------------------------------------------------------------------------
function selectLoginProfile(person) {
  authState.selectedPerson = person;
}

// ----------------------------------------------------------------------------
// PROCESSAMENTO DO FORMULÁRIO DE LOGIN (EMAIL, SENHA E SUPABASE)
// ----------------------------------------------------------------------------
async function submitAppLogin(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (isCurrentlyLockedOut()) {
    showLoginFeedback('Sistema temporariamente bloqueado por excesso de tentativas. Aguarde.', 'danger');
    return;
  }

  const emailInput = document.getElementById('loginEmailInput');
  const pwdInput = document.getElementById('loginPasswordInput');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value : '';
  const rememberMe = document.getElementById('loginRememberMeToggle')?.checked ?? true;
  const mode = authState.authMode || 'signin';

  // 1. MODO RECUPERAÇÃO DE SENHA POR EMAIL
  if (mode === 'recovery') {
    if (!email || !email.includes('@')) {
      showLoginFeedback('Por favor, informe um e-mail válido para recuperação.', 'warning');
      if (emailInput) emailInput.focus();
      return;
    }
    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client) {
      showLoginFeedback('Enviando e-mail de redefinição...', 'info');
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        showLoginFeedback(`Link de redefinição enviado com sucesso para ${email}! Verifique sua caixa de entrada.`, 'success');
      } catch (err) {
        showLoginFeedback('Erro ao enviar e-mail: ' + (err.message || String(err)), 'danger');
      }
    } else {
      showPasswordHint();
    }
    return;
  }

  // 2. MODO CADASTRO (SIGN UP) — NOVOS USUÁRIOS COMEÇAM EM CONTA ZERADA PRÓPRIA
  if (mode === 'signup') {
    const nameInput = document.getElementById('loginNameInput');
    const householdInput = document.getElementById('loginHouseholdInput');
    const name = nameInput ? nameInput.value.trim() : '';
    const customHousehold = householdInput ? householdInput.value.trim() : '';

    if (!name) {
      showLoginFeedback('Por favor, informe seu nome.', 'warning');
      if (nameInput) nameInput.focus();
      return;
    }
    if (!email || !email.includes('@')) {
      showLoginFeedback('Por favor, informe um e-mail válido.', 'warning');
      if (emailInput) emailInput.focus();
      return;
    }
    if (!password || password.length < 6) {
      showLoginFeedback('A senha deve ter pelo menos 6 caracteres.', 'warning');
      if (pwdInput) pwdInput.focus();
      return;
    }

    // Se a pessoa não informou o código privado do casal, cria um código exclusivo e isolado do zero!
    const resolved = resolveUserHouseholdAndProfile(null, customHousehold, email, name);

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client) {
      showLoginFeedback('Criando sua conta isolada na nuvem...', 'info');
      try {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              person: resolved.person,
              household_code: resolved.householdCode
            }
          }
        });
        if (error) throw error;

        if (typeof cloudConfig !== 'undefined') {
          cloudConfig.loggedEmail = email;
          cloudConfig.loggedPerson = resolved.person;
          cloudConfig.householdCode = resolved.householdCode;
          if (typeof saveCloudConfig === 'function') saveCloudConfig();
        }

        if (typeof switchActiveHouseholdState === 'function') {
          switchActiveHouseholdState(resolved.householdCode, resolved.person);
        }

        showLoginFeedback(`Conta criada com sucesso para ${name}! Você já pode entrar.`, 'success');
        setTimeout(() => setAuthMode('signin'), 1500);
      } catch (err) {
        showLoginFeedback('Erro ao cadastrar: ' + (err.message || String(err)), 'danger');
      }
    } else {
      showLoginFeedback('Configure a URL e Anon Key do Supabase para criar conta na nuvem.', 'warning');
    }
    return;
  }

  // 3. MODO LOGIN POR EMAIL & SENHA
  if (!password) {
    showLoginFeedback('Por favor, digite sua senha de acesso.', 'warning');
    if (pwdInput) pwdInput.focus();
    return;
  }

  // Se tiver e-mail preenchido e cliente Supabase ativo, autentica na nuvem
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (email && email.includes('@') && client) {
    showLoginFeedback('Autenticando com segurança...', 'info');
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (!error && data && data.user) {
        const resolved = resolveUserHouseholdAndProfile(data.user, '', email);

        if (typeof cloudConfig !== 'undefined') {
          cloudConfig.loggedEmail = email;
          cloudConfig.loggedPerson = resolved.person;
          cloudConfig.householdCode = resolved.householdCode;
          if (typeof saveCloudConfig === 'function') saveCloudConfig();
        }

        if (typeof switchActiveHouseholdState === 'function') {
          switchActiveHouseholdState(resolved.householdCode, resolved.person);
        }

        saveSession(resolved.person, rememberMe, resolved.householdCode, email);
        showLoginFeedback(`Bem-vindo(a), ${resolved.person}!`, 'success');

        unlockApp(resolved.person, true);
        if (typeof pullStateFromSupabaseCloud === 'function') {
          pullStateFromSupabaseCloud(true);
        }
        return;
      }
    } catch (err) {
      console.warn('Falha no login Supabase, tentando validação local:', err);
    }
  }

  // Validação Local (SHA-256 + Salt) como contingência offline
  const cfg = getStoredAuthConfig();
  if (!cfg || !cfg.passwordHash) {
    showLoginFeedback('Configuração de segurança não encontrada. Redefina a senha.', 'danger');
    return;
  }

  const enteredHash = await generateSha256Hash(password, cfg.salt || DEFAULT_SALT);

  if (enteredHash === cfg.passwordHash) {
    cfg.failedAttempts = 0;
    cfg.lockoutUntil = 0;
    saveStoredAuthConfig(cfg);

    const resolved = resolveUserHouseholdAndProfile(null, '', email || 'eveli@casal.local', authState.selectedPerson);

    if (typeof cloudConfig !== 'undefined') {
      if (email) cloudConfig.loggedEmail = email;
      cloudConfig.loggedPerson = resolved.person;
      cloudConfig.householdCode = resolved.householdCode;
      if (typeof saveCloudConfig === 'function') saveCloudConfig();
    }

    if (typeof switchActiveHouseholdState === 'function') {
      switchActiveHouseholdState(resolved.householdCode, resolved.person);
    }

    saveSession(resolved.person, rememberMe, resolved.householdCode, email);
    showLoginFeedback('Acesso liberado com sucesso!', 'success');

    unlockApp(resolved.person, true);
  } else {
    // SENHA INCORRETA: Proteção contra força bruta
    cfg.failedAttempts = (cfg.failedAttempts || 0) + 1;
    const remaining = MAX_FAILED_ATTEMPTS - cfg.failedAttempts;

    if (cfg.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      cfg.lockoutUntil = Date.now() + (LOCKOUT_SECONDS * 1000);
      saveStoredAuthConfig(cfg);
      startLockoutCountdown(LOCKOUT_SECONDS);
      showLoginFeedback(`Muitas tentativas incorretas! Bloqueado por ${LOCKOUT_SECONDS} segundos.`, 'danger');
    } else {
      saveStoredAuthConfig(cfg);
      showLoginFeedback(`E-mail ou senha incorretos. Restam ${remaining} tentativa(s).`, 'danger');
    }

    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.focus();
    }
  }
}

// ----------------------------------------------------------------------------
// FEEDBACK VISUAL & TEMPORIZADOR DE FORÇA BRUTA
// ----------------------------------------------------------------------------
function showLoginFeedback(msg, type = 'info') {
  const el = document.getElementById('loginFeedbackMsg');
  if (!el) return;

  el.classList.remove('hidden');
  let bgClass = 'bg-sky-500/20 text-sky-200 border-sky-400/40';
  if (type === 'danger') bgClass = 'bg-rose-500/20 text-rose-200 border-rose-500/40';
  if (type === 'warning') bgClass = 'bg-amber-500/20 text-amber-200 border-amber-500/40';
  if (type === 'success') bgClass = 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40';

  el.className = `p-3 rounded-xl border text-xs font-medium text-center transition-all ${bgClass}`;
  el.textContent = msg;
}

function isCurrentlyLockedOut() {
  const cfg = getStoredAuthConfig();
  return !!(cfg && cfg.lockoutUntil && Date.now() < cfg.lockoutUntil);
}

function checkLockoutStatus() {
  const cfg = getStoredAuthConfig();
  if (cfg && cfg.lockoutUntil && Date.now() < cfg.lockoutUntil) {
    const secondsLeft = Math.ceil((cfg.lockoutUntil - Date.now()) / 1000);
    startLockoutCountdown(secondsLeft);
  }
}

function startLockoutCountdown(seconds) {
  if (authState.lockoutTimerInterval) clearInterval(authState.lockoutTimerInterval);

  const btn = document.getElementById('loginSubmitBtn');
  const pwdInput = document.getElementById('loginPasswordInput');
  if (btn) btn.disabled = true;
  if (pwdInput) pwdInput.disabled = true;

  let remaining = seconds;
  authState.lockoutTimerInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(authState.lockoutTimerInterval);
      if (btn) btn.disabled = false;
      if (pwdInput) {
        pwdInput.disabled = false;
        pwdInput.focus();
      }
      const cfg = getStoredAuthConfig();
      if (cfg) {
        cfg.failedAttempts = 0;
        cfg.lockoutUntil = 0;
        saveStoredAuthConfig(cfg);
      }
      showLoginFeedback('Você já pode tentar novamente.', 'info');
    } else {
      showLoginFeedback(`Bloqueado por segurança: aguarde ${remaining}s...`, 'danger');
    }
  }, 1000);
}

// ----------------------------------------------------------------------------
// EXIBIR / OCULTAR SENHA
// ----------------------------------------------------------------------------
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.textContent = '🙈';
  } else {
    input.type = 'password';
    if (icon) icon.textContent = '👁️';
  }
}

// ----------------------------------------------------------------------------
// ALTERAÇÃO / DEFINIÇÃO DE SENHA
// ----------------------------------------------------------------------------
function openChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) modal.classList.add('hidden');
}

async function submitChangePassword(e) {
  if (e && e.preventDefault) e.preventDefault();

  const currentInput = document.getElementById('changeCurrentPasswordInput');
  const newInput = document.getElementById('changeNewPasswordInput');
  const confirmInput = document.getElementById('changeConfirmPasswordInput');
  const hintInput = document.getElementById('changeHintInput');

  const current = currentInput?.value || '';
  const newPwd = newInput?.value || '';
  const confirm = confirmInput?.value || '';
  const hint = hintInput?.value?.trim() || '';

  if (!newPwd || newPwd.length < 4) {
    alert('A nova senha deve ter no mínimo 4 caracteres.');
    return;
  }

  if (newPwd !== confirm) {
    alert('A confirmação da senha não coincide.');
    return;
  }

  const cfg = getStoredAuthConfig();
  if (cfg && cfg.passwordHash) {
    const curHash = await generateSha256Hash(current, cfg.salt || DEFAULT_SALT);
    if (curHash !== cfg.passwordHash) {
      alert('A senha atual informada está incorreta.');
      if (currentInput) currentInput.focus();
      return;
    }
  }

  const newHash = await generateSha256Hash(newPwd, DEFAULT_SALT);
  saveStoredAuthConfig({
    ...(cfg || {}),
    passwordHash: newHash,
    hint: hint || 'Definida pelo casal',
    failedAttempts: 0,
    lockoutUntil: 0
  });

  if (currentInput) currentInput.value = '';
  if (newInput) newInput.value = '';
  if (confirmInput) confirmInput.value = '';

  alert('Senha alterada com sucesso!');
  closeChangePasswordModal();

  if (typeof recordAuditLog === 'function') {
    recordAuditLog('Segurança', 'Senha de acesso familiar atualizada');
  }
}

// ----------------------------------------------------------------------------
// RECUPERAÇÃO / DICA DE SENHA
// ----------------------------------------------------------------------------
function showPasswordHint() {
  const cfg = getStoredAuthConfig();
  if (cfg && cfg.hint) {
    alert(`💡 Dica de senha da família:\n\n${cfg.hint}`);
  } else {
    alert('💡 Dica inicial:\n\nA senha padrão inicial do sistema é "123456".');
  }
}

// ----------------------------------------------------------------------------
// TIMER DE INATIVIDADE (AUTO-LOCK APÓS 15 MINUTOS)
// ----------------------------------------------------------------------------
function resetInactivityTimer() {
  if (authState.inactivityTimer) clearTimeout(authState.inactivityTimer);

  const cfg = getStoredAuthConfig();
  const minutes = (cfg && cfg.autoLockMinutes) ? cfg.autoLockMinutes : 15;
  const timeoutMs = minutes * 60 * 1000;

  authState.inactivityTimer = setTimeout(() => {
    if (authState.isUnlocked) {
      console.log('Bloqueando tela por inatividade...');
      lockAppScreen();
    }
  }, timeoutMs);
}

// Monitora atividade do usuário quando desbloqueado
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    window.addEventListener(evt, () => {
      if (authState.isUnlocked) resetInactivityTimer();
    }, { passive: true });
  });

  window.addEventListener('DOMContentLoaded', () => {
    initAuthGuard();
  });
}
