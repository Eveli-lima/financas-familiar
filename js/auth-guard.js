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
// CONTROLE DE MODOS DE LOGIN (ENTRAR / CRIAR CONTA / RECUPERAR / PIN)
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

  const tabSignIn = document.getElementById('authTabBtnSignIn');
  const tabSignUp = document.getElementById('authTabBtnSignUp');
  const tabPin = document.getElementById('authTabBtnPin');

  const updateTabClass = (btn, active) => {
    if (!btn) return;
    btn.className = active
      ? 'flex-1 py-1.5 px-2 rounded-xl text-xs font-bold bg-sky-600 text-white shadow-sm transition'
      : 'flex-1 py-1.5 px-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition';
  };

  updateTabClass(tabSignIn, mode === 'signin');
  updateTabClass(tabSignUp, mode === 'signup');
  updateTabClass(tabPin, mode === 'pin');

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
    if (submitBtnText) submitBtnText.textContent = 'Criar Minha Conta ✨';
  } else if (mode === 'recovery') {
    if (passwordField) passwordField.classList.add('hidden');
    if (rememberField) rememberField.classList.add('hidden');
    if (googleBtnBox) googleBtnBox.classList.add('hidden');
    if (submitBtnText) submitBtnText.textContent = 'Enviar Link de Recuperação 📧';
  } else if (mode === 'pin') {
    if (emailField) emailField.classList.add('hidden');
    if (googleBtnBox) googleBtnBox.classList.add('hidden');
    if (submitBtnText) submitBtnText.textContent = 'Desbloquear com PIN 🔓';
  } else {
    // signin padrão
    if (submitBtnText) submitBtnText.textContent = 'Entrar no Sistema 🚀';
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

  showLoginFeedback('Conectando ao Google com segurança...', 'info');

  try {
    const redirectTo = (typeof window !== 'undefined' && window.location)
      ? window.location.origin + window.location.pathname
      : undefined;

    const { data, error } = await client.auth.signInWithOAuth({
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

function saveSession(person, rememberMe) {
  const durationMs = rememberMe ? (30 * 24 * 60 * 60 * 1000) : (8 * 60 * 60 * 1000); // 30 dias ou 8 horas
  const session = {
    person,
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
// INICIALIZAÇÃO DA PROTEÇÃO DA TELA E OAUTH LISTENER
// ----------------------------------------------------------------------------
async function initAuthGuard() {
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

  // Preenche o último e-mail lembrado se existir
  const emailInput = document.getElementById('loginEmailInput');
  if (emailInput && typeof cloudConfig !== 'undefined' && cloudConfig.loggedEmail) {
    emailInput.value = cloudConfig.loggedEmail;
  }

  // Configura o ouvinte oficial do Supabase Auth para Google e Magic Link
  setupSupabaseAuthListener();

  // Verifica se já existe sessão válida ativa
  const activeSession = getStoredSession();
  if (activeSession && activeSession.person) {
    unlockApp(activeSession.person, false);
    return;
  }

  // Se não há sessão válida, bloqueia a tela e exibe login
  lockAppScreen();
}

function setupSupabaseAuthListener() {
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (!client || !client.auth || !client.auth.onAuthStateChange) return;

  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && session.user) {
      const email = session.user.email || '';
      const meta = session.user.user_metadata || {};
      const person = meta.full_name || meta.name || meta.person || (email.toLowerCase().includes('vital') ? 'Vital' : (email.toLowerCase().includes('eveli') ? 'Éveli' : email.split('@')[0]));
      const household = meta.household_code || (typeof cloudConfig !== 'undefined' ? cloudConfig.householdCode : 'casal_eveli_vital') || 'casal_eveli_vital';

      if (typeof cloudConfig !== 'undefined') {
        cloudConfig.loggedEmail = email;
        cloudConfig.loggedPerson = person;
        cloudConfig.householdCode = household;
        if (typeof saveCloudConfig === 'function') saveCloudConfig();
      }

      saveSession(person, true);
      unlockApp(person, true);

      if (typeof pullStateFromSupabaseCloud === 'function') {
        pullStateFromSupabaseCloud(true);
      }
    } else if (event === 'SIGNED_OUT') {
      lockAppScreen();
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
    setTimeout(() => pwdInput.focus(), 100);
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

  if (recordAudit && typeof recordAuditLog === 'function') {
    recordAuditLog('Acesso ao Sistema', `Login efetuado por ${person}`);
  }

  resetInactivityTimer();
}

// ----------------------------------------------------------------------------
// SELEÇÃO DE PERFIL NA TELA DE LOGIN (ÉVELI OU VITAL)
// ----------------------------------------------------------------------------
function selectLoginProfile(person) {
  authState.selectedPerson = person;
  const btnEveli = document.getElementById('loginProfileBtnEveli');
  const btnVital = document.getElementById('loginProfileBtnVital');
  const avatarEl = document.getElementById('loginAvatarDisplay');
  const welcomeText = document.getElementById('loginWelcomeGreeting');

  if (person === 'Vital') {
    if (btnVital) {
      btnVital.className = 'flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs bg-sky-600 text-white shadow-md shadow-sky-600/20 border-2 border-sky-400 flex items-center justify-center gap-2 transition';
    }
    if (btnEveli) {
      btnEveli.className = 'flex-1 py-2.5 px-3 rounded-2xl font-semibold text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 transition';
    }
    if (avatarEl) avatarEl.textContent = '👨‍💼';
    if (welcomeText) welcomeText.textContent = 'Olá, Vital!';
  } else {
    if (btnEveli) {
      btnEveli.className = 'flex-1 py-2.5 px-3 rounded-2xl font-bold text-xs bg-sky-600 text-white shadow-md shadow-sky-600/20 border-2 border-sky-400 flex items-center justify-center gap-2 transition';
    }
    if (btnVital) {
      btnVital.className = 'flex-1 py-2.5 px-3 rounded-2xl font-semibold text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 transition';
    }
    if (avatarEl) avatarEl.textContent = '👩‍💼';
    if (welcomeText) welcomeText.textContent = 'Olá, Éveli!';
  }

  const pwdInput = document.getElementById('loginPasswordInput');
  if (pwdInput) pwdInput.focus();
}

// ----------------------------------------------------------------------------
// PROCESSAMENTO DO FORMULÁRIO DE LOGIN (EMAIL, SENHA, SUPABASE & PIN)
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

  // 2. MODO CADASTRO (SIGN UP)
  if (mode === 'signup') {
    const nameInput = document.getElementById('loginNameInput');
    const householdInput = document.getElementById('loginHouseholdInput');
    const name = nameInput ? nameInput.value.trim() : '';
    const customHousehold = householdInput ? householdInput.value.trim() : '';

    if (!name) {
      showLoginFeedback('Por favor, informe seu nome para o perfil.', 'warning');
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

    const resolvedHousehold = customHousehold || (typeof cloudConfig !== 'undefined' ? cloudConfig.householdCode : 'casal_eveli_vital') || 'casal_eveli_vital';

    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (client) {
      showLoginFeedback('Criando sua conta na nuvem...', 'info');
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              person: name,
              household_code: resolvedHousehold
            }
          }
        });
        if (error) throw error;

        if (typeof cloudConfig !== 'undefined') {
          cloudConfig.loggedEmail = email;
          cloudConfig.loggedPerson = name;
          cloudConfig.householdCode = resolvedHousehold;
          if (typeof saveCloudConfig === 'function') saveCloudConfig();
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

  // 3. MODO LOGIN POR EMAIL & SENHA OU PIN LOCAL
  if (!password) {
    showLoginFeedback('Por favor, digite sua senha de acesso.', 'warning');
    if (pwdInput) pwdInput.focus();
    return;
  }

  // Se tiver e-mail preenchido e cliente Supabase ativo, autentica na nuvem
  const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (email && email.includes('@') && client && mode !== 'pin') {
    showLoginFeedback('Autenticando com segurança...', 'info');
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (!error && data && data.user) {
        // SUCESSO VIA SUPABASE AUTH!
        const meta = data.user.user_metadata || {};
        const resolvedPerson = meta.full_name || meta.name || meta.person || (email.toLowerCase().includes('vital') ? 'Vital' : (email.toLowerCase().includes('eveli') ? 'Éveli' : email.split('@')[0]));
        const resolvedHousehold = meta.household_code || (typeof cloudConfig !== 'undefined' ? cloudConfig.householdCode : 'casal_eveli_vital') || 'casal_eveli_vital';

        if (typeof cloudConfig !== 'undefined') {
          cloudConfig.loggedEmail = email;
          cloudConfig.loggedPerson = resolvedPerson;
          cloudConfig.householdCode = resolvedHousehold;
          if (typeof saveCloudConfig === 'function') saveCloudConfig();
        }

        saveSession(resolvedPerson, rememberMe);
        showLoginFeedback(`Bem-vindo(a), ${resolvedPerson}! Acesso liberado.`, 'success');

        setTimeout(() => {
          unlockApp(resolvedPerson, true);
          if (typeof pullStateFromSupabaseCloud === 'function') {
            pullStateFromSupabaseCloud(true);
          }
        }, 300);
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
    // SUCESSO LOCAL!
    cfg.failedAttempts = 0;
    cfg.lockoutUntil = 0;
    saveStoredAuthConfig(cfg);

    if (email && typeof cloudConfig !== 'undefined') {
      cloudConfig.loggedEmail = email;
      if (typeof saveCloudConfig === 'function') saveCloudConfig();
    }

    saveSession(authState.selectedPerson, rememberMe);
    showLoginFeedback('Acesso liberado com sucesso!', 'success');

    setTimeout(() => {
      unlockApp(authState.selectedPerson, true);
    }, 250);
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
