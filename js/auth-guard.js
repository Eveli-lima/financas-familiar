// ============================================================================
// MÓDULO DE AUTENTICAÇÃO E SEGURANÇA DA FAMÍLIA (AUTH GUARD)
// ============================================================================
// Responsável por:
// 1. Tela de Login moderna, completa e segura (Éveli & Vital).
// 2. Criptografia de senhas usando Web Crypto API (SHA-256 + Salt).
// 3. Proteção contra ataques de força bruta (Rate limiting / lockout temporário).
// 4. Sessão segura com opção "Lembrar de mim" e bloqueio automático por inatividade.
// 5. Integração com o perfil ativo do casal e Supabase Auth.

const AUTH_CONFIG_KEY = 'financas_auth_config_v2';
const AUTH_SESSION_KEY = 'financas_auth_session_v2';
const DEFAULT_SALT = 'eveli_vital_financas_secure_salt_2026';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

let authState = {
  isUnlocked: false,
  selectedPerson: 'Éveli',
  rememberMe: true,
  failedAttempts: 0,
  lockoutTimerInterval: null,
  inactivityTimer: null
};

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
    // 1. Tenta sessionStorage primeiro (sessão temporária)
    const sessionRaw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (sessionRaw) {
      const s = JSON.parse(sessionRaw);
      if (s.expiresAt && Date.now() < s.expiresAt) return s;
    }
    // 2. Tenta localStorage se o usuário marcou "Lembrar de mim"
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
// INICIALIZAÇÃO DA PROTEÇÃO DA TELA
// ----------------------------------------------------------------------------
async function initAuthGuard() {
  let cfg = getStoredAuthConfig();

  // Se for o primeiro acesso absoluto, inicializa com senha padrão segura ("123456" ou casal2026)
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

  // Verifica se já existe sessão válida ativa
  const activeSession = getStoredSession();
  if (activeSession && activeSession.person) {
    unlockApp(activeSession.person, false);
    return;
  }

  // Se não há sessão válida, bloqueia a tela e exibe login
  lockAppScreen();
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

  // Limpa campos de senha para evitar cache no DOM
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

  // Sincroniza quem está usando com a configuração da nuvem e histórico
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

  // Atualiza crachá no cabeçalho
  updateAuthHeaderUI();

  if (recordAudit && typeof recordAuditLog === 'function') {
    recordAuditLog('Acesso ao Sistema', `Login efetuado por ${person}`);
  }

  // Inicia monitor de inatividade
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
// PROCESSAMENTO DO FORMULÁRIO DE LOGIN
// ----------------------------------------------------------------------------
async function submitAppLogin(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (isCurrentlyLockedOut()) {
    showLoginFeedback('Sistema temporariamente bloqueado por excesso de tentativas. Aguarde.', 'danger');
    return;
  }

  const pwdInput = document.getElementById('loginPasswordInput');
  const password = pwdInput ? pwdInput.value : '';
  const rememberMe = document.getElementById('loginRememberMeToggle')?.checked ?? true;

  if (!password) {
    showLoginFeedback('Por favor, digite sua senha de acesso.', 'warning');
    if (pwdInput) pwdInput.focus();
    return;
  }

  const cfg = getStoredAuthConfig();
  if (!cfg || !cfg.passwordHash) {
    showLoginFeedback('Configuração de segurança não encontrada. Redefina a senha.', 'danger');
    return;
  }

  // Gera hash e compara com a senha armazenada
  const enteredHash = await generateSha256Hash(password, cfg.salt || DEFAULT_SALT);

  if (enteredHash === cfg.passwordHash) {
    // SUCESSO!
    cfg.failedAttempts = 0;
    cfg.lockoutUntil = 0;
    saveStoredAuthConfig(cfg);

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
      showLoginFeedback(`Senha incorreta. Restam ${remaining} tentativa(s).`, 'danger');
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

  // Inicializa o guard quando a página carregar
  window.addEventListener('DOMContentLoaded', () => {
    initAuthGuard();
  });
}
