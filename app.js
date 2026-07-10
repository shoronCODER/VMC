/* ===== ULTRA-PREMIUM VMC APPLICATION ENGINE CODE ===== */

// ===== FIREBASE CONNECTION SYSTEM =====
const firebaseConfig = {
  apiKey: "AIzaSyBCdoZ4eK7yzzPtdQsTIGlGVVV-hW-enaQ",
  authDomain: "v-m-c-b4552.firebaseapp.com",
  databaseURL: "https://v-m-c-b4552-default-rtdb.firebaseio.com",
  projectId: "v-m-c-b4552",
  storageBucket: "v-m-c-b4552.firebasestorage.app",
  messagingSenderId: "198402348342",
  appId: "1:198402348342:web:e678f1a99c586106d24f97"
};

const fbApp = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ===== AUTH CONFIG =====
const AUTH_DOMAIN = '@vmctool.com';
const ADMIN_USERNAME = 'Admin.Shoron';
const ADMIN_EMAIL = ADMIN_USERNAME.toLowerCase() + AUTH_DOMAIN;
let currentUser = null;
let isAdmin = false;

function usernameToEmail(username) {
  return username.toLowerCase().trim() + AUTH_DOMAIN;
}

function emailToUsername(email) {
  return email.replace(AUTH_DOMAIN, '');
}

// ===== SYSTEM REGISTRY STACK =====
let CONFIG = {
  serpApiKey: "",
  gravatarApiKey: "9019:gk-KmOzRYhsny4YmyqgQ0agZ1yTX2-dXsTF1jG-bS803wnMWGKClsR3LZHRp60UC",
  imgbbApiKey: "",
  siteName: "VMC PRO",
  devName: "Shoron",
  logoUrl: "",
  faviconUrl: "",
  themePrimary: "#00f3ff",
  themeSecondary: "#ff007b",
  themeBg: "#03030d",
  // API mode: "individual" (each user uses their own key) | "global" (all use admin's shared key)
  apiMode: "individual",
  globalSerpApiKey: ""
};

let validEmails = [];
let claimedEmails = {}; // { email: timestamp }

// Per-user state loaded from Firebase
let USER_API_KEY = "";        // current user's personal SerpAPI key (Individual mode)
let USAGE_BAR_INTERVAL = null; // interval handle for live quota polling
let LAST_USAGE_BEFORE_SCRAPE = null; // for "+N used just now" indicator

// ===== WORLD GEOGRAPHIC RECORDS =====
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba",
  "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Estonia", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Guatemala",
  "Guinea", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Kyrgyzstan", "Laos",
  "Latvia", "Lebanon", "Libya", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
  "Malta", "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Panama", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
  "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea",
  "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Syria", "Taiwan", "Tanzania", "Thailand", "Togo",
  "Tunisia", "Turkey", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Venezuela",
  "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// ===== KICKSTART THE SYSTEM =====
document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  initPreLoader();

  // Load remembered credentials
  const remembered = localStorage.getItem('vmc_remember_user');
  if (remembered) {
    try {
      const data = JSON.parse(remembered);
      const loginUser = document.getElementById('login-username');
      const loginPass = document.getElementById('login-password');
      const rememberBox = document.getElementById('remember-me');
      if (loginUser) loginUser.value = data.username || '';
      if (loginPass) loginPass.value = data.password || '';
      if (rememberBox) rememberBox.checked = true;
    } catch (e) { }
  }

  // Listen for Enter key on auth inputs
  ['login-username', 'login-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });
  ['signup-username', 'signup-password', 'signup-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignup(); });
  });

  // Firebase Auth state observer
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      isAdmin = (user.email === ADMIN_EMAIL);
      const username = emailToUsername(user.email);

      // Store username in database
      await db.ref(`users/${user.uid}/username`).set(username);

      // Show user badge in header
      const badge = document.getElementById('header-user-badge');
      if (badge) badge.textContent = '👤 ' + username.toUpperCase();

      // Show/hide admin users tab
      const usersTab = document.getElementById('admin-users-tab-btn');
      if (usersTab) usersTab.style.display = isAdmin ? '' : 'none';
      // Show/hide admin-only controls (mode toggle, global key) based on role
      updateAdminOnlyControls();

      // Load user's API key from Firebase
      await loadUserApiKey(user.uid);

      // Transition from auth to dashboard
      transitionToDashboard();
    } else {
      currentUser = null;
      isAdmin = false;
      showAuthScreen();
    }
  });
});

// ===== AUTH SCREEN FUNCTIONS =====
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginTab = document.getElementById('login-tab-btn');
  const signupTab = document.getElementById('signup-tab-btn');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    loginTab.classList.remove('active');
    signupTab.classList.add('active');
  }
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!username || !password) {
    errorEl.textContent = 'USERNAME AND PASSWORD REQUIRED';
    return;
  }

  errorEl.textContent = '';
  btn.disabled = true;
  btn.querySelector('.auth-btn-text').textContent = 'AUTHENTICATING...';

  const email = usernameToEmail(username);

  try {
    await auth.signInWithEmailAndPassword(email, password);

    // Handle remember me
    const rememberMe = document.getElementById('remember-me').checked;
    if (rememberMe) {
      localStorage.setItem('vmc_remember_user', JSON.stringify({ username, password }));
    } else {
      localStorage.removeItem('vmc_remember_user');
    }
  } catch (err) {
    let msg = 'LOGIN FAILED';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') msg = 'INVALID USERNAME OR PASSWORD';
    else if (err.code === 'auth/wrong-password') msg = 'INCORRECT PASSWORD';
    else if (err.code === 'auth/too-many-requests') msg = 'TOO MANY ATTEMPTS. TRY LATER';
    errorEl.textContent = msg;
    btn.disabled = false;
    btn.querySelector('.auth-btn-text').textContent = 'INITIALIZE LOGIN';
  }
}

async function handleSignup() {
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  const errorEl = document.getElementById('signup-error');
  const btn = document.getElementById('signup-btn');

  if (!username || !password) {
    errorEl.textContent = 'ALL FIELDS REQUIRED';
    return;
  }
  if (username.length < 3) {
    errorEl.textContent = 'USERNAME MUST BE AT LEAST 3 CHARACTERS';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'PASSWORD MUST BE AT LEAST 6 CHARACTERS';
    return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'PASSWORDS DO NOT MATCH';
    return;
  }

  errorEl.textContent = '';
  btn.disabled = true;
  btn.querySelector('.auth-btn-text').textContent = 'CREATING ACCOUNT...';

  const email = usernameToEmail(username);

  try {
    await auth.createUserWithEmailAndPassword(email, password);
  } catch (err) {
    let msg = 'SIGNUP FAILED';
    if (err.code === 'auth/email-already-in-use') msg = 'USERNAME ALREADY TAKEN';
    else if (err.code === 'auth/weak-password') msg = 'PASSWORD TOO WEAK (MIN 6 CHARS)';
    errorEl.textContent = msg;
    btn.disabled = false;
    btn.querySelector('.auth-btn-text').textContent = 'CREATE ACCOUNT';
  }
}

function handleLogout() {
  localStorage.removeItem('vmc_remember_user');
  auth.signOut();
}

function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  const mainApp = document.getElementById('main-app');
  if (authScreen) {
    authScreen.classList.remove('fade-out');
    authScreen.style.display = 'flex';
  }
  if (mainApp) mainApp.classList.add('hidden');
}

function transitionToDashboard() {
  const authScreen = document.getElementById('auth-screen');
  const mainApp = document.getElementById('main-app');

  if (authScreen) {
    authScreen.classList.add('fade-out');
    setTimeout(() => {
      authScreen.style.display = 'none';
      if (mainApp) {
        mainApp.classList.remove('hidden');
        const particleEl = document.getElementById('particles-js');
        if (particleEl) particleEl.style.pointerEvents = 'auto';
      }
      // Initialize dashboard systems after auth
      loadConfigFromFirebase();
      loadClaimedEmails();
      initProtocolSelector();
      initManualProtocol();
      initAutoProtocol();
      initCodeMailProtocol();
      initControlStation();
      initHiddenTrigger();
      // Wire up live mode/key listeners (must run after auth so currentUser is set)
      initApiKeyListeners();
      checkAllStatuses();
      updateApiUsageBar();
      startUsageBarAutoRefresh();
    }, 800);
  }
}

// ===== USER API KEY MANAGEMENT =====
// NOTE: We no longer cache the SerpAPI key in localStorage. localStorage is
// browser-wide and shared across all users on a device, which previously caused
// a new user to silently inherit the previous user's exhausted/stale key.
// The active key is now resolved deterministically from Firebase per session.

async function loadUserApiKey(uid) {
  try {
    const snap = await db.ref(`users/${uid}/api_key`).once('value');
    USER_API_KEY = snap.exists() ? (snap.val() || "") : "";
    // Keep CONFIG.serpApiKey in sync with the currently resolved key
    await refreshActiveApiKey();
    // Reflect in the admin panel field (if open)
    syncApiKeyFieldWithValue();
  } catch (e) {
    console.warn('Failed to load user API key', e);
    USER_API_KEY = "";
  }
}

async function saveUserApiKey(apiKey) {
  if (!currentUser) return;
  try {
    await db.ref(`users/${currentUser.uid}/api_key`).set(apiKey);
    USER_API_KEY = apiKey;
  } catch (e) {
    console.warn('Failed to save user API key', e);
  }
}

// Resolve which SerpAPI key is currently authoritative based on the admin mode.
// Global mode -> the shared admin key from vmc_config/globalSerpApiKey
// Individual mode -> the signed-in user's personal key (fallback to admin's
//   shared key only if the admin themselves hasn't set a personal key yet).
async function resolveActiveApiKey() {
  const mode = (CONFIG.apiMode || "individual").toLowerCase();
  if (mode === "global") {
    return CONFIG.globalSerpApiKey || "";
  }
  // Individual mode
  if (USER_API_KEY) return USER_API_KEY;
  // Admin without a personal key may fall back to the global key
  if (isAdmin) return CONFIG.globalSerpApiKey || CONFIG.serpApiKey || "";
  return "";
}

// Refresh CONFIG.serpApiKey (the value actually used by executeAutoSearch)
// to match the resolved key, then refresh the usage bar + monitors.
async function refreshActiveApiKey() {
  CONFIG.serpApiKey = await resolveActiveApiKey();
  updateApiUsageBar();
  checkAllStatuses();
}

// Keep the admin-panel API key input in sync with whichever key is active,
// depending on the current mode and the viewer's role.
function syncApiKeyFieldWithValue() {
  const field = document.getElementById('admin-serp-key');
  if (!field) return;
  const mode = (CONFIG.apiMode || "individual").toLowerCase();
  if (mode === 'global') {
    // Show the shared global key to everyone, but lock it for non-admins
    field.value = CONFIG.globalSerpApiKey || "";
    if (isAdmin) {
      field.removeAttribute('readonly');
      field.classList.remove('admin-input-locked');
    } else {
      field.setAttribute('readonly', 'readonly');
      field.classList.add('admin-input-locked');
    }
  } else {
    // Individual mode: each user edits their own personal key
    field.value = USER_API_KEY || "";
    field.removeAttribute('readonly');
    field.classList.remove('admin-input-locked');
  }
  updateGlobalKeyBanner();
}

// Live Firebase listeners so a mode flip / key change by the admin propagates
// to every signed-in client in real time.
function initApiKeyListeners() {
  // Mode changes
  db.ref('vmc_config/apiMode').on('value', async (snap) => {
    const newMode = snap.exists() ? (snap.val() || 'individual') : 'individual';
    const changed = (newMode !== CONFIG.apiMode);
    CONFIG.apiMode = newMode;
    syncApiKeyFieldWithValue();
    updateModeToggleUI();
    await refreshActiveApiKey();
    if (changed) {
      showPremiumToast(`API mode switched to ${newMode.toUpperCase()}`, 'info');
    }
  });

  // Global key changes
  db.ref('vmc_config/globalSerpApiKey').on('value', async (snap) => {
    CONFIG.globalSerpApiKey = snap.exists() ? (snap.val() || "") : "";
    syncApiKeyFieldWithValue();
    await refreshActiveApiKey();
  });

  // Current user's personal key changes (e.g. saved from another device)
  if (currentUser) {
    db.ref(`users/${currentUser.uid}/api_key`).on('value', async (snap) => {
      USER_API_KEY = snap.exists() ? (snap.val() || "") : "";
      syncApiKeyFieldWithValue();
      await refreshActiveApiKey();
    });
  }
}

// Update the segmented mode-toggle UI to reflect CONFIG.apiMode
function updateModeToggleUI() {
  const mode = (CONFIG.apiMode || "individual").toLowerCase();
  document.querySelectorAll('.api-mode-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.mode === mode);
  });
  // Show/hide the global-key banner + read-only lock
  updateGlobalKeyBanner();
}

// Show or hide the "GLOBAL KEY IN USE" banner based on current mode/role
function updateGlobalKeyBanner() {
  const banner = document.getElementById('global-key-banner');
  if (!banner) return;
  const mode = (CONFIG.apiMode || "individual").toLowerCase();
  if (mode === 'global') {
    banner.classList.remove('hidden');
    const lockNote = banner.querySelector('.global-key-banner-note');
    if (lockNote) {
      lockNote.textContent = isAdmin
        ? 'Global mode active — your key is shared across all accounts.'
        : 'Global mode active — managed by administrator. Read-only.';
    }
  } else {
    banner.classList.add('hidden');
  }
}

// Toggle admin-only controls (the mode toggle is admin-only)
function updateAdminOnlyControls() {
  const modeToggleWrap = document.getElementById('api-mode-toggle-wrap');
  if (modeToggleWrap) {
    modeToggleWrap.style.display = isAdmin ? '' : 'none';
  }
}

// Switch the API mode (admin action). Persists to Firebase; the listener
// propagates the change to all clients.
async function setApiMode(mode) {
  if (!isAdmin) return showPremiumToast('ADMIN ACCESS REQUIRED', 'error');
  if (mode !== 'global' && mode !== 'individual') return;
  try {
    await db.ref('vmc_config/apiMode').set(mode);
    // updateModeToggleUI + refresh happen via the Firebase listener
  } catch (e) {
    showPremiumToast('Failed to switch API mode', 'error');
  }
}

// ===== ADMIN USER MANAGEMENT =====
async function adminAddUser() {
  if (!isAdmin) return showPremiumToast('ADMIN ACCESS REQUIRED', 'error');

  const username = document.getElementById('admin-new-username').value.trim();
  const password = document.getElementById('admin-new-password').value;

  if (!username || !password) return showPremiumToast('USERNAME AND PASSWORD REQUIRED', 'error');
  if (password.length < 6) return showPremiumToast('PASSWORD MUST BE AT LEAST 6 CHARACTERS', 'error');

  const email = usernameToEmail(username);

  try {
    // Save current user credentials to re-login admin after creating new user
    const adminEmail = currentUser.email;
    const adminCredential = localStorage.getItem('vmc_remember_user');

    // Create new user (this will sign in as the new user)
    const result = await auth.createUserWithEmailAndPassword(email, password);

    // Store username in database
    await db.ref(`users/${result.user.uid}/username`).set(username);

    // Sign back in as admin
    if (adminCredential) {
      const cred = JSON.parse(adminCredential);
      await auth.signInWithEmailAndPassword(usernameToEmail(cred.username), cred.password);
    } else {
      // Fallback: try to sign back with known admin creds
      await auth.signInWithEmailAndPassword(ADMIN_EMAIL, '0188283');
    }

    document.getElementById('admin-new-username').value = '';
    document.getElementById('admin-new-password').value = '';
    showPremiumToast(`User "${username}" created successfully!`, 'success');
    loadAdminUserList();
  } catch (err) {
    let msg = 'FAILED TO CREATE USER';
    if (err.code === 'auth/email-already-in-use') msg = 'USERNAME ALREADY EXISTS';
    showPremiumToast(msg, 'error');
  }
}

async function adminRemoveUser(uid, username) {
  if (!isAdmin) return;
  if (!confirm(`Remove user "${username}"? This will delete their data.`)) return;

  try {
    // Remove user data from database
    await db.ref(`users/${uid}`).remove();
    showPremiumToast(`User "${username}" data removed`, 'success');
    loadAdminUserList();
  } catch (e) {
    showPremiumToast('Failed to remove user', 'error');
  }
}

async function loadAdminUserList() {
  if (!isAdmin) return;
  const listEl = document.getElementById('admin-users-list');
  if (!listEl) return;

  try {
    const snap = await db.ref('users').once('value');
    if (!snap.exists()) {
      listEl.innerHTML = '<p style="color:var(--text-secondary);font-size:11px;">No users found</p>';
      return;
    }

    const users = snap.val();
    listEl.innerHTML = Object.keys(users).map(uid => {
      const user = users[uid];
      const uname = user.username || 'Unknown';
      const initial = uname.charAt(0).toUpperCase();
      const isAdminUser = (uname.toLowerCase() === ADMIN_USERNAME.toLowerCase());
      const badgeHtml = isAdminUser ? '<span class="admin-user-badge">ADMIN</span>' : '';
      const removeBtn = !isAdminUser ? `<button class="admin-user-remove" onclick="adminRemoveUser('${uid}','${uname}')">REMOVE</button>` : '';

      return `
        <div class="admin-user-item">
          <div class="admin-user-info">
            <div class="admin-user-avatar">${initial}</div>
            <span class="admin-user-name">${uname}${badgeHtml}</span>
          </div>
          ${removeBtn}
        </div>
      `;
    }).join('');
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--danger);font-size:11px;">Failed to load users</p>';
  }
}

// ===== CHROMATIC STARFIELD =====
function initStarsBg() {
  const container = document.getElementById("stars-bg");
  if (!container) return;
  for (let i = 0; i < 140; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";
    star.style.setProperty("--dur", (3 + Math.random() * 5) + "s");
    star.style.animationDelay = Math.random() * 4 + "s";
    star.style.opacity = Math.random();
    container.appendChild(star);
  }
}

// ===== PARTICLES.JS INTERACTIVE BACKGROUND =====
function initParticles() {
  if (typeof particlesJS === 'undefined') return;
  const container = document.getElementById('particles-js');
  if (!container) return;
  container.innerHTML = '';
  const pc = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#00f3ff';
  particlesJS('particles-js', {
    particles: {
      number: { value: 45, density: { enable: true, value_area: 900 } },
      color: { value: pc },
      shape: { type: 'circle' },
      opacity: { value: 0.4, random: true, anim: { enable: true, speed: 0.8, opacity_min: 0.1 } },
      size: { value: 3, random: true, anim: { enable: true, speed: 2, size_min: 0.5 } },
      line_linked: { enable: true, distance: 140, color: pc, opacity: 0.15, width: 1 },
      move: { enable: true, speed: 1.2, direction: 'none', random: true, straight: false, out_mode: 'out', bounce: false }
    },
    interactivity: {
      detect_on: 'window',
      events: {
        onhover: { enable: true, mode: 'grab' },
        onclick: { enable: true, mode: 'push' },
        resize: true
      },
      modes: {
        grab: { distance: 160, line_linked: { opacity: 0.4 } },
        push: { particles_nb: 3 }
      }
    },
    retina_detect: true
  });
}

// ===== LOADING ORCHESTRATION =====
function initPreLoader() {
  setTimeout(() => {
    const loader = document.getElementById("loader-screen");
    if (loader) {
      loader.classList.add("fade-out");
      setTimeout(() => {
        loader.style.display = "none";
      }, 800);
    }
  }, 2200);
}

// ===== INTRO INTERACTIVE 3D ORCHESTRATION =====
function initIntroSequence() {
  const win = document.getElementById("floating-window");
  const intro = document.getElementById("intro-screen");
  const mainApp = document.getElementById("main-app");

  if (!win) return;

  win.addEventListener("click", () => {
    win.classList.add("expanding");
    setTimeout(() => {
      if (intro) {
        intro.classList.add("fade-out");
        setTimeout(() => {
          intro.style.display = "none";
          if (mainApp) {
            mainApp.classList.remove("hidden");
            // Enable particle interactivity on dashboard
            const particleEl = document.getElementById('particles-js');
            if (particleEl) particleEl.style.pointerEvents = 'auto';
            // Rerun responsive and statuses trigger
            checkAllStatuses();
          }
        }, 600);
      }
    }, 450);
  });
}

// ===== DISPATCH SYSTEM ACTION PROTOCOLS =====
function initProtocolSelector() {
  const select = document.getElementById("mode-select");
  const manual = document.getElementById("manual-section");
  const auto = document.getElementById("auto-section");
  const codemail = document.getElementById("codemail-section");

  if (!select) return;

  select.addEventListener("change", () => {
    manual.classList.add("hidden");
    auto.classList.add("hidden");
    if (codemail) codemail.classList.add("hidden");
    if (select.value === "manual") {
      manual.classList.remove("hidden");
    } else if (select.value === "automatic") {
      auto.classList.remove("hidden");
    } else if (select.value === "codemail") {
      if (codemail) codemail.classList.remove("hidden");
    }
    const workspace = document.querySelector(".main-workspace");
    if (workspace) workspace.scrollTop = 0;
  });
}

// ===== RAW DATA MANIPULATION SYSTEM =====
function initManualProtocol() {
  // Mode tabs
  document.querySelectorAll(".workspace-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".workspace-tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.add("hidden"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.remove("hidden");
    });
  });

  // Manual plain text parser execution
  const runBtn = document.getElementById("validate-text-btn");
  if (runBtn) {
    runBtn.addEventListener("click", () => {
      const txtVal = document.getElementById("email-text-input").value;
      const emails = extractValidEmails(txtVal);
      if (emails.length === 0) return showPremiumToast("No target records found in plain text data", "error");
      processValidationQueue(emails, "Raw Input Stream");
    });
  }

  // Upload parser hooks
  const csvFile = document.getElementById("csv-file");
  if (csvFile) {
    csvFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const emails = extractValidEmails(ev.target.result);
        if (emails.length === 0) return showPremiumToast("Extracted empty record stack from CSV document", "error");
        processValidationQueue(emails, "CSV Database");
      };
      reader.readAsText(file);
    });
  }

  const xlsxFile = document.getElementById("excel-file");
  if (xlsxFile) {
    xlsxFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target.result, { type: "binary" });
          let fullStr = "";
          wb.SheetNames.forEach(sheet => {
            fullStr += XLSX.utils.sheet_to_csv(wb.Sheets[sheet]) + "\n";
          });
          const emails = extractValidEmails(fullStr);
          if (emails.length === 0) return showPremiumToast("Extracted empty record stack from Excel binary", "error");
          processValidationQueue(emails, "Excel Protocol");
        } catch (err) {
          showPremiumToast("Failed to parse premium spreadsheet structures", "error");
        }
      };
      reader.readAsBinaryString(file);
    });
  }

  setupCyberDropZone("csv-drop-zone", "csv-file");
  setupCyberDropZone("excel-drop-zone", "excel-file");
}

function setupCyberDropZone(zoneId, inputId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.style.borderColor = "var(--primary)";
    zone.style.boxShadow = "var(--shadow-neon)";
  });
  zone.addEventListener("dragleave", () => {
    zone.style.borderColor = "";
    zone.style.boxShadow = "";
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.style.borderColor = "";
    zone.style.boxShadow = "";
    if (e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event("change"));
    }
  });
}

// ===== AUTOMATED SEARCH CRUST INTERACTION =====
function initAutoProtocol() {
  setupCountrySelector();
  const searchBtn = document.getElementById("auto-search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", executeAutoSearch);
  }
}

function setupCountrySelector() {
  const input = document.getElementById("country-search");
  const dropdown = document.getElementById("country-dropdown");
  if (!input || !dropdown) return;

  function buildList(filter = "") {
    const list = COUNTRIES.filter(c => c.toLowerCase().includes(filter.toLowerCase()));
    dropdown.innerHTML = list.map(c => `<div class="country-option-item" data-val="${c}">${c}</div>`).join("");
    dropdown.classList.toggle("hidden", list.length === 0);

    dropdown.querySelectorAll(".country-option-item").forEach(item => {
      item.addEventListener("click", () => {
        input.value = item.dataset.val;
        dropdown.classList.add("hidden");
      });
    });
  }

  input.addEventListener("focus", () => buildList(input.value));
  input.addEventListener("input", () => buildList(input.value));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-drop-wrapper")) dropdown.classList.add("hidden");
  });
}

// CORS proxy list with fallbacks
const CORS_PROXIES = [
  (url) => `/.netlify/functions/api-proxy?targetUrl=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchWithCorsProxy(targetUrl) {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const proxyUrl = CORS_PROXIES[i](targetUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const text = await res.text();
        try { return JSON.parse(text); } catch { return text; }
      }
    } catch (e) {
      console.warn(`Proxy ${i + 1} failed, trying next...`, e.message);
    }
  }
  throw new Error("All connection proxies exhausted. Check network or API key.");
}

async function executeAutoSearch() {
  const queryName = document.getElementById("auto-name").value.trim();
  const locVal = document.getElementById("country-search").value.trim();
  const domainExt = document.getElementById("auto-extension").value;
  const maxEmails = parseInt(document.getElementById("auto-max-emails").value) || 50;

  if (!queryName) return showPremiumToast("Engine identity tag required", "error");
  if (!locVal) return showPremiumToast("Target geo-host parameter needed", "error");

  // Build multiple search queries for better email extraction
  const queries = [
    `"${domainExt}" ${queryName} ${locVal} email contact`,
    `${queryName} email "${domainExt}" ${locVal}`,
    `"${queryName}" "${locVal}" "@" "${domainExt.replace('@', '')}"`
  ];

  showProgressTrack("SPINNING SERPAPI SEARCH THREADS...");

  try {
    // Always resolve the freshest key right before scraping. This fixes the
    // bug where new users scraped with a stale/exhausted key from localStorage.
    CONFIG.serpApiKey = await resolveActiveApiKey();

    // NOTE: Even if CONFIG.serpApiKey is empty, the Netlify proxy will inject
    // the server-side SERPAPI_KEY from env vars. We only abort if the API
    // itself returns an error (handled below in the response error check).

    // Capture starting quota so we can show "+N used just now" afterwards
    LAST_USAGE_BEFORE_SCRAPE = await fetchSerpUsageQuiet();

    let uniqueEmails = new Set();
    let allExtractedBlocks = "";

    // Run queries
    for (let q = 0; q < queries.length; q++) {
      if (uniqueEmails.size >= maxEmails) break;

      // Paginate up to 3 pages per query to fetch "beyond 10" results (100 results per page)
      const resultsPerPage = 100;
      const maxPagesNeeded = Math.ceil((maxEmails - uniqueEmails.size) / resultsPerPage) || 1;
      const pagesToFetch = Math.min(maxPagesNeeded, 3); // Max 3 pages per query to respect budget/quota

      for (let page = 0; page < pagesToFetch; page++) {
        if (uniqueEmails.size >= maxEmails) break;

        const startOffset = page * resultsPerPage;
        // The api_key param is included so the URL structure is correct; the
        // Netlify proxy will strip it and replace with the server-side key.
        const serpEndpoint = `https://serpapi.com/search.json?q=${encodeURIComponent(queries[q])}&api_key=${CONFIG.serpApiKey || 'PROXY_INJECTED'}&num=${resultsPerPage}&start=${startOffset}`;

        showProgressTrack(`SERPAPI RUNNING (Query ${q + 1}/${queries.length}, Page ${page + 1}): ${uniqueEmails.size}/${maxEmails} COLLECTED`);

        try {
          const payload = await fetchWithCorsProxy(serpEndpoint);

          if (payload.error) {
            if (payload.error.includes("Invalid API key") || payload.error.includes("expired") || payload.error.includes("limit")) {
              triggerLimitAlert("SerpAPI");
              throw new Error(payload.error);
            }
          }

          let newBlock = "";
          if (payload.organic_results) {
            payload.organic_results.forEach(item => {
              newBlock += ` ${item.title || ''} ${item.snippet || ''} ${item.link || ''}`;
              if (item.rich_snippet) newBlock += ` ${JSON.stringify(item.rich_snippet)}`;
              if (item.displayed_link) newBlock += ` ${item.displayed_link}`;
            });
          }
          if (payload.answer_box) {
            newBlock += ` ${payload.answer_box.snippet || ''} ${payload.answer_box.answer || ''}`;
          }
          if (payload.knowledge_graph) {
            newBlock += ` ${JSON.stringify(payload.knowledge_graph)}`;
          }

          // Extract emails from this page and update our set
          const extracted = extractValidEmails(newBlock);
          extracted.forEach(e => {
            const domain = e.split('@')[1];
            if (FREE_DOMAINS.has(domain) && uniqueEmails.size < maxEmails && !isEmailClaimed(e)) {
              uniqueEmails.add(e);
            }
          });

          allExtractedBlocks += " " + newBlock;

          // If no organic results returned, stop paginating for this query
          if (!payload.organic_results || payload.organic_results.length === 0) {
            break;
          }

        } catch (innerErr) {
          if (innerErr.message.includes("API key") || innerErr.message.includes("limit")) throw innerErr;
          console.warn(`Search query ${q + 1} page ${page + 1} failed:`, innerErr.message);
          break; // break pagination for this query
        }

        // Small delay between page fetches
        if (page < pagesToFetch - 1) await new Promise(r => setTimeout(r, 600));
      }

      // Small delay between query blocks
      if (q < queries.length - 1 && uniqueEmails.size < maxEmails) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    const emails = Array.from(uniqueEmails);

    if (emails.length === 0) {
      hideProgressTrack();
      return showPremiumToast("Search complete. No email addresses found in results. Try different keywords.", "info");
    }

    showPremiumToast(`Found ${emails.length} email(s). Running validation & avatar scan...`, "info");
    processValidationQueue(emails, `Auto: ${queryName}`);
    // Refresh the bar; show "+N used just now" based on quota delta
    await updateApiUsageBar(true);
  } catch (err) {
    hideProgressTrack();
    const msg = (err && err.message) ? err.message : "Search failed.";
    showPremiumToast(msg, "error");
    // Surface a modal for any error that looks key/quota/network related so
    // failures are never silently swallowed (root cause of "scraping not working").
    const low = msg.toLowerCase();
    if (low.includes("limit") || low.includes("key") || low.includes("api") ||
      low.includes("credential") || low.includes("quota") || low.includes("proxy") ||
      low.includes("network") || low.includes("exhausted")) {
      triggerLimitAlert("SerpAPI");
    }
  }
}

// ===== UTILITIES =====
function extractValidEmails(text) {
  const matchPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const rawList = text.match(matchPattern) || [];
  // Filter out obviously invalid patterns
  const cleaned = rawList
    .map(e => e.toLowerCase().replace(/^[.]+|[.]+$/g, '')) // trim dots
    .filter(e => {
      // Must have exactly one @
      const parts = e.split('@');
      if (parts.length !== 2) return false;
      const [local, domain] = parts;
      // Local part checks
      if (!local || local.length < 1 || local.length > 64) return false;
      if (/\.\./.test(local)) return false; // no consecutive dots
      // Domain checks
      if (!domain || domain.length < 3) return false;
      if (!/\.[a-z]{2,}$/.test(domain)) return false; // must end with valid TLD
      if (/\.\./.test(domain)) return false;
      // Filter out common false positives
      const badDomains = ['example.com', 'test.com', 'email.com', 'domain.com', 'sentry.io', 'w3.org', 'schema.org', 'googleapis.com', 'gstatic.com', 'cloudflare.com'];
      if (badDomains.includes(domain)) return false;
      // Filter image/file extensions mistakenly caught
      if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|html|xml|json)$/i.test(domain)) return false;
      return true;
    });
  return [...new Set(cleaned)];
}

// ===== FREE PUBLIC MAIL DOMAIN REGISTRY =====
const FREE_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'protonmail.com', 'proton.me', 'icloud.com', 'mail.com', 'zoho.com',
  'yandex.com', 'gmx.com', 'mail.ru', 'live.com', 'msn.com', 'yahoo.co.uk',
  'yahoo.fr', 'gmx.de', 'web.de', 'rediffmail.com', 'inbox.com', 'fastmail.com'
]);

// ===== DNS MX LOOKUP VIA CLOUDFLARE DOH =====
async function checkMXRecords(domain) {
  if (FREE_DOMAINS.has(domain)) {
    return true; // Famous public email services always have active mail exchangers
  }
  try {
    const endpoint = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`;
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/dns-json'
      }
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !!(data.Answer && data.Answer.length > 0);
  } catch (err) {
    console.warn(`MX DNS query failed for domain: ${domain}`, err);
    return true; // Fallback to avoid aggressive false negatives
  }
}

// ===== MULTI-THREAD EXTRACTION & VALIDATION PIPELINE =====
async function processValidationQueue(emails, sourceLabel) {
  showProgressTrack(`RUNNING ALIGNMENT ENGINE: 0/${emails.length}`);
  const progressFill = document.getElementById("progress-bar");
  const progressTxt = document.getElementById("progress-text");

  let validHits = 0;

  // Check for duplicates against already-found emails AND claimed emails, and filter to ONLY free mail domains
  const existingSet = new Set(validEmails.map(v => v.email));
  const uniqueNew = emails.filter(e => {
    const domain = e.split('@')[1];
    return FREE_DOMAINS.has(domain) && !existingSet.has(e) && !isEmailClaimed(e);
  });

  if (uniqueNew.length === 0) {
    hideProgressTrack();
    return showPremiumToast("All found emails are already in results.", "info");
  }

  for (let i = 0; i < uniqueNew.length; i++) {
    const email = uniqueNew[i];
    if (progressTxt) progressTxt.textContent = `VERIFYING: ${email} (${i + 1}/${uniqueNew.length})`;
    if (progressFill) progressFill.style.width = `${((i + 1) / uniqueNew.length) * 100}%`;

    try {
      const domain = email.split('@')[1];
      const isPro = !FREE_DOMAINS.has(domain);
      const hasMX = await checkMXRecords(domain);
      const avatarData = await checkEmailAvatar(email);

      validEmails.push({
        email,
        avatar: avatarData.avatarUrl,
        avatarType: avatarData.type,
        hasRealAvatar: avatarData.hasRealAvatar,
        isProfessional: isPro,
        hasMX: hasMX,
        deliverable: hasMX,
        source: sourceLabel,
        time: Date.now()
      });
      validHits++;
      updateMailBoxGrid();
    } catch (err) {
      console.error(`Error validating ${email}:`, err);
      const domain = email.split('@')[1];
      const isPro = !FREE_DOMAINS.has(domain);
      validEmails.push({
        email,
        avatar: generateLetterAvatar(email),
        avatarType: "generated",
        hasRealAvatar: false,
        isProfessional: isPro,
        hasMX: true,
        deliverable: true,
        source: sourceLabel,
        time: Date.now()
      });
      validHits++;
      updateMailBoxGrid();
    }
    // Respectful delay between queries
    await new Promise(r => setTimeout(r, 100));
  }

  hideProgressTrack();
  if (validHits > 0) {
    showPremiumToast(`Successfully validated ${validHits} email(s)!`, "success");
  } else {
    showPremiumToast("No new valid emails found.", "warning");
  }
}

// ===== GENERATE LETTER AVATAR (SVG DATA URI) =====
function generateLetterAvatar(email) {
  const letter = email.charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const bg = `hsl(${hue}, 65%, 45%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="${bg}" width="100" height="100" rx="50"/><text x="50" y="62" text-anchor="middle" fill="white" font-size="44" font-family="Arial,sans-serif" font-weight="bold">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ===== MULTI-STAGE AVATAR LAYER (GRAVATAR -> GITHUB -> DICEBEAR) =====
async function checkEmailAvatar(email) {
  const emailLower = email.trim().toLowerCase();
  const hashedVal = md5(emailLower);
  const gravatarUrl = `https://www.gravatar.com/avatar/${hashedVal}?s=200`;
  const checkUrl = `https://www.gravatar.com/avatar/${hashedVal}?d=404&s=200`;

  // 1. Check Gravatar
  const hasGravatar = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 2000);
    const node = new Image();
    node.crossOrigin = 'anonymous';
    node.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    node.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    node.src = checkUrl;
  });

  if (hasGravatar) {
    return { hasRealAvatar: true, type: "gravatar", avatarUrl: gravatarUrl };
  }

  // 2. Check GitHub user search by email
  try {
    const gitResponse = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(emailLower)}+in:email`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (gitResponse.ok) {
      const gitData = await gitResponse.json();
      if (gitData.items && gitData.items.length > 0) {
        return { hasRealAvatar: true, type: "github", avatarUrl: gitData.items[0].avatar_url };
      }
    }
  } catch (gitErr) {
    console.warn("GitHub avatar check failed:", gitErr);
  }

  // 3. Fallback to DiceBear human illustration avatars
  const dicebearStyles = ['avataaars', 'adventurer', 'lorelei', 'open-peeps', 'fun-emoji'];
  let hash = 0;
  for (let i = 0; i < emailLower.length; i++) {
    hash = emailLower.charCodeAt(i) + ((hash << 5) - hash);
  }
  const styleIdx = Math.abs(hash) % dicebearStyles.length;
  const chosenStyle = dicebearStyles[styleIdx];
  const dicebearUrl = `https://api.dicebear.com/7.x/${chosenStyle}/svg?seed=${encodeURIComponent(emailLower)}`;

  return { hasRealAvatar: false, type: "generated", avatarUrl: dicebearUrl };
}

// ===== RENDER STACK RESULTS =====
function updateMailBoxGrid() {
  const grid = document.getElementById("mailbox-grid");
  const totalBadge = document.getElementById("valid-count");
  const exportBtn = document.getElementById("export-btn");
  const clearBtn = document.getElementById("clear-btn");

  if (!grid) return;

  // Restrict to display only free mail domains, excluding pro domains
  const displayList = validEmails.filter(item => {
    const domain = item.email.split('@')[1];
    return FREE_DOMAINS.has(domain);
  });

  totalBadge.textContent = `${displayList.length} VERIFIED RESULTS`;
  exportBtn.classList.toggle("hidden", displayList.length === 0);
  clearBtn.classList.toggle("hidden", displayList.length === 0);

  if (displayList.length === 0) {
    grid.innerHTML = `
      <div class="empty-mailbox-state">
        <span class="empty-state-visual">🛸</span>
        <p class="empty-state-head">SYSTEM PROTOCOLS INACTIVE</p>
        <p class="empty-state-sub">Select extraction parameters above to initialize raw database matching.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = displayList.map((item, idx) => {
    const domainBadge = item.isProfessional
      ? '<span class="badge-pro" title="Corporate/Business Domain">PRO DOMAIN</span>'
      : '<span class="badge-free" title="Free Public Mail Domain">FREE MAIL</span>';

    const mxBadge = item.hasMX
      ? '<span class="badge-mx-active" title="Mail Exchanger (MX) Records Found">MX ACTIVE</span>'
      : '<span class="badge-mx-inactive" title="No Mail Exchanger (MX) Records Found">MX INACTIVE</span>';

    const deliverableBadge = item.deliverable
      ? '<span class="badge-deliverable" title="Email is highly likely deliverable">DELIVERABLE</span>'
      : '<span class="badge-undeliverable" title="Email domain has no active mail server">UNDELIVERABLE</span>';

    const avatarSourceBadge = item.hasRealAvatar
      ? `<span class="gravatar-badge" title="Profile picture fetched from ${item.avatarType.toUpperCase()}">✓ ${item.avatarType.toUpperCase()}</span>`
      : '<span class="no-gravatar-badge" title="AI Generated fallback avatar">◦ GENERATED</span>';

    const isClaimed = isEmailClaimed(item.email);
    const btnClass = isClaimed ? "bookmarkBtn claimed" : "bookmarkBtn";
    const btnDisabled = isClaimed ? "disabled" : "";
    const btnText = isClaimed ? "Claimed" : "Get Mail";

    return `
    <div class="mail-item-card" style="animation-delay: ${idx * 0.05}s">
      <img class="mail-avatar-img" src="${item.avatar}" alt="${item.email}" onerror="this.src='${generateLetterAvatar(item.email)}'">
      <div class="mail-body-info">
        <div class="mail-addr">${item.email}</div>
        <div class="mail-meta-row" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
          <span class="mail-meta-src">${item.source.toUpperCase()}</span>
          ${domainBadge}
          ${mxBadge}
          ${deliverableBadge}
          ${avatarSourceBadge}
        </div>
      </div>
      <button class="${btnClass}" ${btnDisabled} onclick="getMailAction('${item.email}', this)" title="Copy email & claim it">
        <span class="IconContainer">
          <svg viewBox="0 0 384 512" height="0.9em" class="bookmark-icon">
            <path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z"></path>
          </svg>
        </span>
        <p class="bookmarkBtn-text">${btnText}</p>
      </button>
    </div>
  `;
  }).join("");

  exportBtn.onclick = downloadArchive;
  clearBtn.onclick = () => {
    validEmails = [];
    updateMailBoxGrid();
    showPremiumToast("System local index wiped clean", "warning");
  };
}

function downloadArchive() {
  const displayList = validEmails.filter(item => {
    const domain = item.email.split('@')[1];
    return FREE_DOMAINS.has(domain);
  });
  const content = "EMAIL,PROTOCOL_SOURCE,TIMESTAMP\n" + displayList.map(item =>
    `"${item.email}","${item.source}","${new Date(item.time).toISOString()}"`
  ).join("\n");

  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const trigger = document.createElement("a");
  trigger.href = url;
  trigger.download = `VMC_PRO_EXPORT_${Date.now()}.csv`;
  trigger.click();
  URL.revokeObjectURL(url);
  showPremiumToast("Database CSV downloaded securely", "success");
}

// ===== ENGINE CONTROLS =====
function showProgressTrack(text) {
  const section = document.getElementById("progress-section");
  if (section) section.classList.remove("hidden");
  const bar = document.getElementById("progress-bar");
  if (bar) bar.style.width = "0%";
  const indicator = document.getElementById("progress-text");
  if (indicator) indicator.textContent = text;
}

function hideProgressTrack() {
  const section = document.getElementById("progress-section");
  if (section) section.classList.add("hidden");
}

// ===== SYSTEM CONSOLE INTERACTION =====
function initControlStation() {
  // Control board tabs
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".admin-content").forEach(c => c.classList.add("hidden"));
      tab.classList.add("active");
      const target = document.getElementById(tab.dataset.adminTab);
      if (target) target.classList.remove("hidden");
    });
  });

  const usersTabBtn = document.getElementById('admin-users-tab-btn');
  if (usersTabBtn) {
    usersTabBtn.addEventListener('click', () => {
      loadAdminUserList();
    });
  }

  const closeBtn = document.getElementById("admin-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("admin-overlay").classList.add("hidden");
    });
  }

  // Save actions
  const saveApi = document.getElementById("save-api-keys");
  if (saveApi) {
    saveApi.addEventListener("click", async () => {
      const serpVal = document.getElementById("admin-serp-key").value.trim();
      const gravatarVal = document.getElementById("admin-gravatar-key").value;
      const imgbbVal = document.getElementById("admin-imgbb-key").value;

      localStorage.setItem("vmc_gravatarApiKey", gravatarVal);
      localStorage.setItem("vmc_imgbbApiKey", imgbbVal);
      CONFIG.gravatarApiKey = gravatarVal;
      CONFIG.imgbbApiKey = imgbbVal;

      const mode = (CONFIG.apiMode || "individual").toLowerCase();

      // SerpAPI key is routed based on the active mode:
      //  - GLOBAL:     admin writes the shared key to vmc_config/globalSerpApiKey
      //                (the listener propagates it to all clients). Non-admins
      //                are blocked by the read-only lock and cannot reach here.
      //  - INDIVIDUAL: the key is saved to the signed-in user's own node.
      if (mode === 'global') {
        if (!isAdmin) {
          return showPremiumToast("GLOBAL KEY is managed by the administrator", "error");
        }
        try {
          await db.ref("vmc_config/globalSerpApiKey").set(serpVal);
        } catch (e) {
          return showPremiumToast("Failed to save global API key", "error");
        }
      } else {
        await saveUserApiKey(serpVal);
      }

      // Re-resolve the active key (config.serpApiKey) and refresh UI
      await refreshActiveApiKey();

      showPremiumToast(
        mode === 'global'
          ? "Global API key synchronized across all accounts"
          : "API key saved to your account",
        "success"
      );
    });
  }

  // Mode toggle handlers (admin-only segmented control)
  document.querySelectorAll('.api-mode-option').forEach(opt => {
    opt.addEventListener('click', () => {
      if (!isAdmin) return showPremiumToast('ADMIN ACCESS REQUIRED', 'error');
      setApiMode(opt.dataset.mode);
    });
  });

  const saveTheme = document.getElementById("save-theme");
  if (saveTheme) {
    saveTheme.addEventListener("click", () => {
      CONFIG.themePrimary = document.getElementById("theme-primary").value;
      CONFIG.themeSecondary = document.getElementById("theme-secondary").value;
      CONFIG.themeBg = document.getElementById("theme-bg").value;
      applySystemTheme();
      saveGlobalRegistry();
      showPremiumToast("Chromatic profiles synchronized", "success");
    });
  }

  const saveBrand = document.getElementById("save-brand");
  if (saveBrand) {
    saveBrand.addEventListener("click", async () => {
      CONFIG.siteName = document.getElementById("brand-name").value || "VMC PRO";
      CONFIG.devName = document.getElementById("brand-dev").value || "Shoron";

      const logo = document.getElementById("logo-upload").files[0];
      if (logo && CONFIG.imgbbApiKey) {
        const logoUrl = await uploadImgbbAsset(logo);
        if (logoUrl) CONFIG.logoUrl = logoUrl;
      }

      const fav = document.getElementById("favicon-upload").files[0];
      if (fav && CONFIG.imgbbApiKey) {
        const favUrl = await uploadImgbbAsset(fav);
        if (favUrl) CONFIG.faviconUrl = favUrl;
      }

      applySystemBranding();
      saveGlobalRegistry();
      showPremiumToast("Branding registries rebuilt successfully", "success");
    });
  }
}

function initHiddenTrigger() {
  const triggerText = document.getElementById("footer-text");
  if (!triggerText) return;

  let clicks = 0;
  let timer = null;

  triggerText.addEventListener("click", () => {
    clicks++;
    if (clicks === 2) {
      clicks = 0;
      clearTimeout(timer);
      launchControlStation();
    } else {
      timer = setTimeout(() => { clicks = 0; }, 400);
    }
  });
}

function launchControlStation() {
  const overlay = document.getElementById("admin-overlay");
  if (overlay) overlay.classList.remove("hidden");

  // SerpAPI field is mode-aware (global -> shared key, individual -> user key)
  syncApiKeyFieldWithValue();
  updateModeToggleUI();
  document.getElementById("admin-gravatar-key").value = CONFIG.gravatarApiKey;
  document.getElementById("admin-imgbb-key").value = CONFIG.imgbbApiKey;
  document.getElementById("theme-primary").value = CONFIG.themePrimary;
  document.getElementById("theme-secondary").value = CONFIG.themeSecondary;
  document.getElementById("theme-bg").value = CONFIG.themeBg;
  document.getElementById("brand-name").value = CONFIG.siteName;
  document.getElementById("brand-dev").value = CONFIG.devName;

  // Refresh the in-panel quota mini-card
  updatePanelQuotaCard();
}

// ===== IMGBB UPLOAD LAYER =====
async function uploadImgbbAsset(file) {
  try {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbbApiKey}`, {
      method: "POST", body: form
    });
    const parsed = await res.json();
    if (parsed.success) return parsed.data.url;
    throw new Error("ImgBB engine rejection");
  } catch (e) {
    showPremiumToast(e.message, "error");
    triggerLimitAlert("ImgBB API");
    return null;
  }
}

// ===== API LIVE INTEGRITY CHECKS =====
async function checkAllStatuses() {
  // Database check
  let dbStatus = false;
  try {
    await db.ref(".info/connected").once("value");
    dbStatus = true;
    updateMonitorWidget("firebase", true, "CONNECTED");
  } catch (e) {
    updateMonitorWidget("firebase", false, "DISCONNECTED");
  }

  // Serp Check – even without a local key the Netlify proxy provides SERPAPI_KEY
  if (CONFIG.serpApiKey) {
    updateMonitorWidget("serp", true, "READY");
  } else {
    updateMonitorWidget("serp", true, "PROXY MODE");
  }

  // Gravatar Check
  updateMonitorWidget("gravatar", true, "ACTIVE");

  // ImgBB check
  if (CONFIG.imgbbApiKey) {
    updateMonitorWidget("imgbb", true, "READY");
  } else {
    updateMonitorWidget("imgbb", false, "NO KEY");
  }
}

function updateMonitorWidget(id, active, label) {
  const widget = document.getElementById(`db-mon-${id}`);
  const val = document.getElementById(`db-mon-${id}-txt`);
  if (!widget || !val) return;

  const glow = widget.querySelector(".indicator-glow");
  if (glow) {
    glow.className = "indicator-glow " + (active ? "bg-success" : "bg-danger");
  }
  val.textContent = label;
}

// ===== API EXPIRATION / LIMIT EXCEEDED ALERTS =====
function triggerLimitAlert(serviceName) {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(0,0,0,0.85)";
  modal.style.backdropFilter = "blur(15px)";
  modal.style.zIndex = "20000";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";

  modal.innerHTML = `
    <div style="background:#090918; border: 1px solid var(--danger); box-shadow: 0 0 30px rgba(255,0,85,0.25); border-radius:16px; padding:40px; text-align:center; max-width:440px; width:90%;">
      <span style="font-size:50px; display:block; margin-bottom:20px;">⚠️</span>
      <h2 style="font-family:var(--font-cyber); color:#fff; letter-spacing:2px; font-size:16px; margin-bottom:10px;">${serviceName.toUpperCase()} SERVICE ALARM</h2>
      <p style="color:var(--text-secondary); font-size:12px; line-height:1.6; margin-bottom:25px;">API credentials for ${serviceName} appear to have expired, reached limit capacities, or invalid credentials were saved. Please update options inside System Control console.</p>
      <button id="alert-console-trigger" style="background:var(--danger); border:none; border-radius:8px; padding:12px 24px; color:#fff; font-family:var(--font-cyber); font-size:10px; letter-spacing:2px; cursor:pointer; font-weight:700;">LAUNCH SYSTEM CONSOLE</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#alert-console-trigger").onclick = () => {
    modal.remove();
    launchControlStation();
  };
}

// ===== PERSISTENCY STATE =====
// NOTE: SerpAPI key is intentionally NOT stored in localStorage. It was
// previously cached browser-wide and shared across all users on a device,
// causing new users to silently inherit a stale/exhausted key. The active key
// is now resolved per-session via resolveActiveApiKey().
function loadLocalApiKeys() {
  const localGravatar = localStorage.getItem("vmc_gravatarApiKey");
  const localImgbb = localStorage.getItem("vmc_imgbbApiKey");
  if (localGravatar !== null) CONFIG.gravatarApiKey = localGravatar;
  if (localImgbb !== null) CONFIG.imgbbApiKey = localImgbb;
}

function saveGlobalRegistry() {
  const globalConfig = {
    siteName: CONFIG.siteName,
    devName: CONFIG.devName,
    logoUrl: CONFIG.logoUrl,
    faviconUrl: CONFIG.faviconUrl,
    themePrimary: CONFIG.themePrimary,
    themeSecondary: CONFIG.themeSecondary,
    themeBg: CONFIG.themeBg
  };
  db.ref("vmc_config").update(globalConfig).catch(err => console.error("Cloud synced failure", err));
}

function loadConfigFromFirebase() {
  db.ref("vmc_config").once("value").then(async snap => {
    if (snap.exists()) {
      const remote = snap.val();
      // Merge only safe fields. We deliberately do NOT blindly Object.assign
      // a remote `serpApiKey` over CONFIG, because the active key must be
      // resolved via resolveActiveApiKey() (mode-aware). We do read the
      // apiMode + globalSerpApiKey fields that drive that resolution.
      const safeFields = [
        'siteName', 'devName', 'logoUrl', 'faviconUrl',
        'themePrimary', 'themeSecondary', 'themeBg',
        'apiMode', 'globalSerpApiKey'
      ];
      safeFields.forEach(k => {
        if (remote[k] !== undefined) CONFIG[k] = remote[k];
      });
      loadLocalApiKeys();
      applySystemTheme();
      applySystemBranding();
      syncApiKeyFieldWithValue();
      updateModeToggleUI();
      await refreshActiveApiKey();
    } else {
      loadLocalApiKeys();
      await refreshActiveApiKey();
    }
  }).catch(async e => {
    console.error("Connection fallback active", e);
    loadLocalApiKeys();
    await refreshActiveApiKey();
  });
}

// ===== SPECTRAL SYNC =====
function applySystemTheme() {
  document.documentElement.style.setProperty("--primary", CONFIG.themePrimary);
  document.documentElement.style.setProperty("--secondary", CONFIG.themeSecondary);
  document.documentElement.style.setProperty("--bg", CONFIG.themeBg);
  initParticles();
}

// ===== BRAND REGISTRY SYNC =====
function applySystemBranding() {
  const displayNames = ["app-title", "site-name-display"];
  displayNames.forEach(id => {
    const node = document.getElementById(id);
    if (node) node.textContent = CONFIG.siteName;
  });

  document.title = `${CONFIG.siteName} | Ultra Validation Checker`;
  const dev = document.getElementById("footer-text");
  if (dev) dev.textContent = `Developed by ${CONFIG.devName}`;

  if (CONFIG.logoUrl) {
    const logo = document.getElementById("header-logo");
    if (logo) {
      logo.src = CONFIG.logoUrl;
      logo.classList.remove("hidden");
    }
  }

  if (CONFIG.faviconUrl) {
    const fav = document.getElementById("dynamic-favicon");
    if (fav) fav.href = CONFIG.faviconUrl;
  }
}

// ===== SYSTEM PREMIUM TOAST =====
function showPremiumToast(text, type = "info") {
  const old = document.querySelector(".toast");
  if (old) old.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

// ===== API USAGE BAR (real-time, cross-account, mode-aware) =====
// The bar always reflects the quota of the currently RESOLVED key, so in
// GLOBAL mode every account sees the same shared quota, and in INDIVIDUAL
// mode each account sees its own.

// Quietly fetch the SerpAPI usage object for the active key (no UI side effects).
// Returns null on failure.
async function fetchSerpUsageQuiet() {
  const key = await resolveActiveApiKey();
  // Even if the client-side key is empty, the Netlify proxy will inject
  // the server-side SERPAPI_KEY env var, so we can still check quota.
  const endpoint = `https://serpapi.com/account.json?api_key=${key || 'PROXY_INJECTED'}`;
  try {
    const data = await fetchWithCorsProxy(endpoint);
    if (data && data.error) return null;
    const left = data.total_searches_left !== undefined
      ? data.total_searches_left
      : (data.plan_searches_left !== undefined ? data.plan_searches_left : 0);
    const total = data.plan_monthly_searches || (left + (data.this_month_usage || 0)) || 250;
    const used = total - left;
    return { left, total, used, raw: data };
  } catch (err) {
    return null;
  }
}

// Main entry: refresh the header usage bar. Pass `true` after a scrape to show
// the "+N used just now" delta indicator.
async function updateApiUsageBar(showDelta = false) {
  const activeKey = await resolveActiveApiKey();

  // Even without a client-side key the Netlify proxy injects SERPAPI_KEY,
  // so we still try to fetch quota data from the server.

  const usage = await fetchSerpUsageQuiet();
  if (!usage) {
    setUsageBar({ pct: 0, state: 'offline' });
    updatePanelQuotaCard({ state: 'offline' });
    return;
  }

  // Fill represents REMAINING quota (a fuller bar = healthier quota)
  const pct = usage.total > 0
    ? Math.min(100, Math.max(0, Math.round((usage.left / usage.total) * 100)))
    : 0;

  // Compute "+N used just now" if requested and we have a baseline
  let delta = 0;
  if (showDelta && LAST_USAGE_BEFORE_SCRAPE && usage.total === LAST_USAGE_BEFORE_SCRAPE.total) {
    delta = Math.max(0, usage.used - LAST_USAGE_BEFORE_SCRAPE.used);
  }
  LAST_USAGE_BEFORE_SCRAPE = null; // consume

  setUsageBar({
    pct, left: usage.left, total: usage.total, used: usage.used, state: 'ok', delta
  });
  updatePanelQuotaCard({ pct, left: usage.left, total: usage.total, used: usage.used, state: 'ok' });
}

// Render the header usage bar. Accepts a state object so the markup stays rich.
function setUsageBar({ pct = 0, left = 0, total = 0, used = 0, state = 'ok', delta = 0 }) {
  const fill = document.getElementById('api-usage-fill');
  const txt = document.getElementById('api-usage-text');
  const modeBadge = document.getElementById('api-usage-mode');
  const numEl = document.getElementById('api-usage-numbers');
  const deltaEl = document.getElementById('api-usage-delta');
  const track = document.querySelector('.usage-track');

  // Fill width + color band based on remaining quota
  if (fill) {
    fill.style.width = pct + '%';
    fill.classList.remove('usage-low', 'usage-mid', 'usage-high');
    if (pct < 20) fill.classList.add('usage-low');
    else if (pct < 50) fill.classList.add('usage-mid');
    else fill.classList.add('usage-high');
  }
  // Pulse animation on track while live
  if (track) track.classList.add('usage-live');

  // Mode badge
  if (modeBadge) {
    const mode = (CONFIG.apiMode || 'individual').toLowerCase();
    modeBadge.textContent = mode === 'global' ? '🌐 GLOBAL' : '👤 INDIVIDUAL';
    modeBadge.classList.toggle('mode-global', mode === 'global');
    modeBadge.classList.toggle('mode-individual', mode !== 'global');
  }

  // Numeric readout + status text
  const fmt = (n) => Number(n).toLocaleString();
  if (state === 'no-key') {
    if (txt) txt.textContent = 'NO API KEY';
    if (numEl) numEl.textContent = '— / —';
  } else if (state === 'offline') {
    if (txt) txt.textContent = 'QUOTA OFFLINE';
    if (numEl) numEl.textContent = '— / —';
  } else {
    if (txt) txt.textContent = `${pct}% REMAINING`;
    if (numEl) numEl.textContent = `${fmt(left)} / ${fmt(total)} LEFT`;
  }

  // "+N used just now" micro-indicator
  if (deltaEl) {
    if (delta > 0) {
      deltaEl.textContent = `+${delta} used`;
      deltaEl.classList.add('visible');
      setTimeout(() => deltaEl.classList.remove('visible'), 5000);
    } else {
      deltaEl.classList.remove('visible');
    }
  }
}

// Auto-refresh the bar on a 60s interval for live, accurate results.
function startUsageBarAutoRefresh() {
  if (USAGE_BAR_INTERVAL) clearInterval(USAGE_BAR_INTERVAL);
  USAGE_BAR_INTERVAL = setInterval(() => {
    updateApiUsageBar(false).catch(() => { });
  }, 60000);
}

// Live quota mini-card rendered inside the Admin Panel (API INTERFACES tab).
function updatePanelQuotaCard(data) {
  const card = document.getElementById('panel-quota-card');
  if (!card) return;
  const bar = document.getElementById('panel-quota-fill');
  const nums = document.getElementById('panel-quota-numbers');
  const status = document.getElementById('panel-quota-status');
  const state = data?.state || 'loading';

  const fmt = (n) => Number(n || 0).toLocaleString();

  if (state === 'no-key') {
    card.classList.remove('hidden');
    if (bar) bar.style.width = '0%';
    if (nums) nums.textContent = 'No API key configured';
    if (status) { status.textContent = '⚠ NO KEY'; status.className = 'panel-quota-status warn'; }
    return;
  }
  if (state === 'offline') {
    card.classList.remove('hidden');
    if (nums) nums.textContent = 'Unable to reach SerpAPI';
    if (status) { status.textContent = '◐ OFFLINE'; status.className = 'panel-quota-status warn'; }
    return;
  }

  card.classList.remove('hidden');
  if (bar) {
    bar.style.width = (data.pct || 0) + '%';
    bar.classList.remove('usage-low', 'usage-mid', 'usage-high');
    if (data.pct < 20) bar.classList.add('usage-low');
    else if (data.pct < 50) bar.classList.add('usage-mid');
    else bar.classList.add('usage-high');
  }
  if (nums) nums.textContent = `${fmt(data.left)} / ${fmt(data.total)} searches left`;
  if (status) {
    status.textContent = `${data.pct || 0}% remaining`;
    status.className = 'panel-quota-status ' + (data.pct < 20 ? 'danger' : 'ok');
  }
}

// ===== CLAIMED EMAILS SYSTEM (60-DAY DATABASE) =====
const CLAIMED_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000; // 60 days in ms

function loadClaimedEmails() {
  db.ref("claimed_emails").once("value").then(snap => {
    if (snap.exists()) {
      claimedEmails = snap.val();
      cleanupExpiredClaims();
    }
  }).catch(e => console.error("Failed to load claimed emails", e));
}

function isEmailClaimed(email) {
  const entry = claimedEmails[emailToKey(email)];
  if (!entry) return false;
  // Check if still within 60-day window
  if (Date.now() - entry.claimedAt > CLAIMED_EXPIRY_MS) {
    return false; // Expired
  }
  return true;
}

function emailToKey(email) {
  // Firebase keys cannot contain . # $ [ ] /
  return email.replace(/[.#$\[\]\/]/g, '_');
}

function getMailAction(email, btnEl) {
  // Copy email to clipboard
  navigator.clipboard.writeText(email).then(() => {
    showPremiumToast(`Copied: ${email}`, "success");
  }).catch(() => {
    // Fallback copy method
    const ta = document.createElement('textarea');
    ta.value = email;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showPremiumToast(`Copied: ${email}`, "success");
  });

  // Save to Firebase claimed_emails with timestamp
  const key = emailToKey(email);
  claimedEmails[key] = { email: email, claimedAt: Date.now() };
  db.ref(`claimed_emails/${key}`).set(claimedEmails[key]).catch(err => {
    console.error("Failed to save claimed email", err);
  });

  // Animate the button to show "Claimed" state
  if (btnEl) {
    btnEl.classList.add('claimed');
    btnEl.setAttribute('disabled', 'true');
    const textEl = btnEl.querySelector('.bookmarkBtn-text');
    if (textEl) textEl.textContent = 'Claimed';
  }
}

function cleanupExpiredClaims() {
  const now = Date.now();
  let hasChanges = false;
  Object.keys(claimedEmails).forEach(key => {
    if (now - claimedEmails[key].claimedAt > CLAIMED_EXPIRY_MS) {
      delete claimedEmails[key];
      db.ref(`claimed_emails/${key}`).remove();
      hasChanges = true;
    }
  });
}

// ===== CODE MAIL ENGINE SYSTEM =====
let codeMailAccounts = []; // {email, password, status: 'idle'|'logging_in'|'success'|'failed', token: null}
let codeMailInbox = []; // Array of mail objects
let codeMailRowCounter = 1;

function initCodeMailProtocol() {
  const loginBtn = document.getElementById('codemail-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', executeCodeMailLogin);
  }

  const accountSelect = document.getElementById('codemail-account-select');
  if (accountSelect) {
    accountSelect.addEventListener('change', filterCodeMailInbox);
  }

  // Load any saved codemail accounts from Firebase
  loadCodeMailAccounts();
}

function addCredRow() {
  const list = document.getElementById('codemail-credentials-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'codemail-cred-row';
  row.setAttribute('data-row-index', codeMailRowCounter++);
  row.innerHTML = `
    <div class="codemail-cred-field">
      <label class="premium-label">EMAIL ADDRESS</label>
      <input type="email" class="premium-input codemail-email-input" placeholder="user@gmail.com">
    </div>
    <div class="codemail-cred-field">
      <label class="premium-label">APP PASSWORD</label>
      <input type="password" class="premium-input codemail-pass-input" placeholder="App password or mail password">
    </div>
    <button class="codemail-remove-row-btn" onclick="removeCredRow(this)" title="Remove">✕</button>
  `;
  list.appendChild(row);

  // Show remove buttons for all rows when there's more than one
  updateRemoveButtons();
}

function removeCredRow(btn) {
  const row = btn.closest('.codemail-cred-row');
  if (row) row.remove();
  updateRemoveButtons();
}

function updateRemoveButtons() {
  const rows = document.querySelectorAll('.codemail-cred-row');
  rows.forEach(row => {
    const btn = row.querySelector('.codemail-remove-row-btn');
    if (btn) {
      btn.classList.toggle('hidden', rows.length <= 1);
    }
  });
}

function gatherCredentials() {
  const rows = document.querySelectorAll('.codemail-cred-row');
  const creds = [];
  rows.forEach(row => {
    const email = row.querySelector('.codemail-email-input').value.trim();
    const pass = row.querySelector('.codemail-pass-input').value.trim();
    if (email && pass) {
      creds.push({ email, password: pass });
    }
  });
  return creds;
}

async function executeCodeMailLogin() {
  const creds = gatherCredentials();
  if (creds.length === 0) {
    return showPremiumToast('Enter at least one email and password', 'error');
  }

  // Show status panel
  const statusPanel = document.getElementById('codemail-status-panel');
  const statusList = document.getElementById('codemail-status-list');
  if (statusPanel) statusPanel.classList.remove('hidden');

  codeMailAccounts = creds.map(c => ({
    email: c.email,
    password: c.password,
    status: 'logging_in',
    token: null,
    messages: []
  }));

  // Render initial status
  renderLoginStatus();

  // Process each credential
  for (let i = 0; i < codeMailAccounts.length; i++) {
    const account = codeMailAccounts[i];
    try {
      statusList.children[i].querySelector('.codemail-status-indicator').className = 'codemail-status-indicator status-logging-in';
      statusList.children[i].querySelector('.codemail-status-text').textContent = 'CONNECTING...';

      // Attempt IMAP login via proxy
      const result = await imapLoginViaProxy(account.email, account.password);

      if (result.success) {
        account.status = 'success';
        account.token = result.token || 'authenticated';
        account.messages = result.messages || [];
        statusList.children[i].querySelector('.codemail-status-indicator').className = 'codemail-status-indicator status-success';
        statusList.children[i].querySelector('.codemail-status-text').textContent = 'LOGIN SUCCESS';
        statusList.children[i].querySelector('.codemail-status-text').style.color = 'var(--success)';
      } else {
        account.status = 'failed';
        statusList.children[i].querySelector('.codemail-status-indicator').className = 'codemail-status-indicator status-failed';
        statusList.children[i].querySelector('.codemail-status-text').textContent = result.error || 'LOGIN FAILED';
        statusList.children[i].querySelector('.codemail-status-text').style.color = 'var(--danger)';
      }
    } catch (err) {
      account.status = 'failed';
      if (statusList.children[i]) {
        statusList.children[i].querySelector('.codemail-status-indicator').className = 'codemail-status-indicator status-failed';
        statusList.children[i].querySelector('.codemail-status-text').textContent = err.message || 'CONNECTION ERROR';
        statusList.children[i].querySelector('.codemail-status-text').style.color = 'var(--danger)';
      }
    }

    // Small delay between accounts
    if (i < codeMailAccounts.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  // Check if any succeeded
  const successAccounts = codeMailAccounts.filter(a => a.status === 'success');
  if (successAccounts.length > 0) {
    showPremiumToast(`${successAccounts.length} account(s) logged in successfully!`, 'success');
    activateInboxPanel();
    saveCodeMailAccounts();
  } else {
    showPremiumToast('All login attempts failed. Check credentials.', 'error');
  }
}

function renderLoginStatus() {
  const statusList = document.getElementById('codemail-status-list');
  if (!statusList) return;

  statusList.innerHTML = codeMailAccounts.map((acc, idx) => `
    <div class="codemail-status-item" data-index="${idx}">
      <div class="codemail-status-indicator status-logging-in"></div>
      <div class="codemail-status-info">
        <span class="codemail-status-email">${acc.email}</span>
        <span class="codemail-status-text">INITIALIZING...</span>
      </div>
      <div class="codemail-status-spinner">
        <div class="codemail-spinner"></div>
      </div>
    </div>
  `).join('');
}

// IMAP Login Proxy System
// Since browsers can't do IMAP directly, we use a server-side proxy approach
// For demonstration, we'll use the built-in server.ps1 proxy
async function imapLoginViaProxy(email, password) {
  try {
    const response = await fetch('http://localhost:8000/imap-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        email: email,
        password: password
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Server returned error' };
    }
  } catch (proxyErr) {
    return { success: false, error: 'VMC Mail Server not running! Start it with server.ps1 or: node mail-server.js' };
  }
}

function activateInboxPanel() {
  const inboxCard = document.getElementById('codemail-inbox-card');
  if (inboxCard) inboxCard.classList.remove('hidden');

  const select = document.getElementById('codemail-account-select');
  if (select) {
    select.innerHTML = '<option value="all">ALL ACCOUNTS</option>';
    codeMailAccounts.filter(a => a.status === 'success').forEach(acc => {
      select.innerHTML += `<option value="${acc.email}">${acc.email}</option>`;
    });
  }

  buildCodeMailInbox();
}

function buildCodeMailInbox() {
  codeMailInbox = [];

  codeMailAccounts.filter(a => a.status === 'success').forEach(acc => {
    if (acc.messages && acc.messages.length > 0) {
      acc.messages.forEach(msg => {
        codeMailInbox.push({
          ...msg,
          accountEmail: msg.accountEmail || acc.email
        });
      });
    }
  });

  // Sort by date descending
  codeMailInbox.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  renderCodeMailInbox();
}

async function loadCodeMailMessages() {
  try {
    const snap = await db.ref('codemail_inbox').once('value');
    if (snap.exists()) {
      const data = snap.val();
      const fetchedMails = [];

      Object.keys(data).forEach(accountKey => {
        const accountMails = data[accountKey];
        if (typeof accountMails === 'object') {
          Object.keys(accountMails).forEach(mailId => {
            const mail = accountMails[mailId];
            // Check if this account is in our logged-in accounts
            const matchedAccount = codeMailAccounts.find(a => emailToKey(a.email) === accountKey && a.status === 'success');
            if (matchedAccount) {
              fetchedMails.push({
                id: mailId,
                from: mail.from || 'Unknown',
                subject: mail.subject || '(No Subject)',
                preview: mail.preview || mail.snippet || '',
                body: mail.body || mail.preview || '',
                date: mail.date || Date.now(),
                read: mail.read || false,
                accountEmail: matchedAccount.email
              });
            }
          });
        }
      });

      // Merge with existing inbox
      fetchedMails.forEach(fm => {
        if (!codeMailInbox.find(m => m.id === fm.id)) {
          codeMailInbox.push(fm);
        }
      });

      codeMailInbox.sort((a, b) => (b.date || 0) - (a.date || 0));
    }
  } catch (e) {
    console.warn('Failed to load codemail inbox from Firebase', e);
  }

  renderCodeMailInbox();
}

function renderCodeMailInbox() {
  const list = document.getElementById('codemail-inbox-list');
  const countBadge = document.getElementById('codemail-inbox-count');
  if (!list) return;

  const activeFilter = document.getElementById('codemail-account-select')?.value || 'all';
  const filteredMails = activeFilter === 'all'
    ? codeMailInbox
    : codeMailInbox.filter(m => m.accountEmail === activeFilter);

  if (countBadge) countBadge.textContent = `${filteredMails.length} MESSAGE${filteredMails.length !== 1 ? 'S' : ''}`;

  if (filteredMails.length === 0) {
    const successCount = codeMailAccounts.filter(a => a.status === 'success').length;
    list.innerHTML = `
      <div class="empty-mailbox-state">
        <span class="empty-state-visual">${successCount > 0 ? '📭' : '📭'}</span>
        <p class="empty-state-head">${successCount > 0 ? 'INBOX EMPTY' : 'AWAITING MAIL STREAM'}</p>
        <p class="empty-state-sub">${successCount > 0
        ? 'No messages found in the connected accounts. Try refreshing or wait for incoming mail.'
        : 'Login with your credentials above to activate the inbox scanner.'}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filteredMails.map((mail, idx) => {
    const fromInitial = (mail.from || '?').charAt(0).toUpperCase();

    // Check local read status as well
    const isRead = mail.read || (mail.id && JSON.parse(localStorage.getItem('vmc_read_mails') || '{}')[mail.id]);
    const readClass = isRead ? 'codemail-mail-read' : 'codemail-mail-unread';
    const dateStr = mail.date ? new Date(mail.date).toLocaleString() : '--';
    const avatarSvg = generateLetterAvatar(mail.from || 'U');

    return `
      <div class="codemail-mail-item ${readClass}" onclick="openMailReader(${idx})" style="animation-delay: ${idx * 0.04}s">
        <img class="codemail-mail-avatar" src="${avatarSvg}" alt="${fromInitial}">
        <div class="codemail-mail-body">
          <div class="codemail-mail-top-row">
            <span class="codemail-mail-from">${escapeHtml(mail.from || 'Unknown')}</span>
            <span class="codemail-mail-date">${dateStr}</span>
          </div>
          <div class="codemail-mail-subject">${escapeHtml(mail.subject || '(No Subject)')}</div>
          <div class="codemail-mail-preview">${escapeHtml((mail.preview || '').substring(0, 120))}${(mail.preview || '').length > 120 ? '...' : ''}</div>
          <span class="codemail-mail-account-badge">${mail.accountEmail}</span>
        </div>
        ${!isRead ? '<span class="codemail-unread-dot"></span>' : ''}
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function filterCodeMailInbox() {
  renderCodeMailInbox();
}

function openMailReader(index) {
  const activeFilter = document.getElementById('codemail-account-select')?.value || 'all';
  const filteredMails = activeFilter === 'all'
    ? codeMailInbox
    : codeMailInbox.filter(m => m.accountEmail === activeFilter);

  const mail = filteredMails[index];
  if (!mail) return;

  // Mark as read
  mail.read = true;

  // Update in localStorage
  if (mail.id && mail.accountEmail) {
    const readMails = JSON.parse(localStorage.getItem('vmc_read_mails') || '{}');
    readMails[mail.id] = true;
    localStorage.setItem('vmc_read_mails', JSON.stringify(readMails));
  }

  // Show reader overlay
  const overlay = document.getElementById('codemail-reader-overlay');
  if (overlay) overlay.classList.remove('hidden');

  document.getElementById('codemail-reader-subject').textContent = mail.subject || '(No Subject)';
  document.getElementById('codemail-reader-from').textContent = `From: ${mail.from || 'Unknown'}`;
  document.getElementById('codemail-reader-date').textContent = `Date: ${mail.date ? new Date(mail.date).toLocaleString() : '--'}`;

  const bodyEl = document.getElementById('codemail-reader-body');
  if (bodyEl) {
    // Check if the body contains HTML
    if (mail.body && (mail.body.includes('<') && mail.body.includes('>'))) {
      bodyEl.innerHTML = `<div class="codemail-html-content">${mail.body}</div>`;
    } else {
      bodyEl.innerHTML = `<pre class="codemail-text-content">${escapeHtml(mail.body || mail.preview || 'No content available.')}</pre>`;
    }
  }

  // Re-render inbox to update read status
  renderCodeMailInbox();
}

function closeMailReader() {
  const overlay = document.getElementById('codemail-reader-overlay');
  if (overlay) overlay.classList.add('hidden');
}

async function refreshCodeMailInbox() {
  showPremiumToast('Refreshing inbox...', 'info');
  const refreshBtn = document.getElementById('codemail-refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '↻ SCANNING...';
  }

  // Fetch fresh emails from each connected account via real IMAP
  for (const acc of codeMailAccounts.filter(a => a.status === 'success')) {
    try {
      const response = await fetch('http://localhost:8000/imap-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refresh',
          email: acc.email
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          acc.messages = data.messages;
        }
      }
    } catch (e) {
      console.warn(`Refresh failed for ${acc.email}:`, e.message);
    }
  }

  // Rebuild inbox from fresh data
  buildCodeMailInbox();

  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '↻ REFRESH';
  }
  showPremiumToast('Inbox refreshed', 'success');
}

function saveCodeMailAccounts() {
  const dataToSave = codeMailAccounts.map(acc => ({
    email: acc.email,
    password: btoa(acc.password),
    status: acc.status,
    loginTime: Date.now()
  }));
  localStorage.setItem('vmc_codemail_accounts', JSON.stringify(dataToSave));
}

async function loadCodeMailAccounts() {
  try {
    const saved = localStorage.getItem('vmc_codemail_accounts');
    if (saved) {
      const data = JSON.parse(saved);
      const loaded = [];
      data.forEach(acc => {
        if (acc.email) {
          loaded.push({
            email: acc.email,
            password: acc.password ? atob(acc.password) : '',
            status: acc.status || 'success'
          });
        }
      });

      if (loaded.length > 0) {
        populateCredentialRows(loaded);
      }
    }
  } catch (e) {
    console.warn('Failed to load codemail accounts', e);
  }
}

function populateCredentialRows(accounts) {
  const list = document.getElementById('codemail-credentials-list');
  if (!list || accounts.length === 0) return;

  list.innerHTML = '';
  accounts.forEach((acc, idx) => {
    const row = document.createElement('div');
    row.className = 'codemail-cred-row';
    row.setAttribute('data-row-index', idx);
    row.innerHTML = `
      <div class="codemail-cred-field">
        <label class="premium-label">EMAIL ADDRESS</label>
        <input type="email" class="premium-input codemail-email-input" value="${acc.email}" placeholder="user@gmail.com">
      </div>
      <div class="codemail-cred-field">
        <label class="premium-label">APP PASSWORD</label>
        <input type="password" class="premium-input codemail-pass-input" value="${acc.password}" placeholder="App password or mail password">
      </div>
      <button class="codemail-remove-row-btn ${accounts.length <= 1 ? 'hidden' : ''}" onclick="removeCredRow(this)" title="Remove">✕</button>
    `;
    list.appendChild(row);
  });
  codeMailRowCounter = accounts.length;
}

// ===== SEARCH PREVIOUS DOMAIN - FUZZY MATCHING ENGINE =====

// Levenshtein distance for fuzzy matching (handles typos)
function levenshtein(a, b) {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

// Check if query fuzzy-matches a target string
function fuzzyMatch(query, target) {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  // Exact substring match
  if (t.includes(q)) return { match: true, score: 100, type: 'exact' };

  // Check each word in target
  const targetWords = t.split(/[\s@._\-\/]+/);
  for (const word of targetWords) {
    if (word.includes(q)) return { match: true, score: 90, type: 'partial' };

    // Levenshtein distance - allow up to 2 char typos for short names, 3 for longer
    const maxDist = q.length <= 5 ? 2 : 3;
    const dist = levenshtein(q, word);
    if (dist <= maxDist && dist < q.length * 0.5) {
      return { match: true, score: 80 - dist * 10, type: 'fuzzy' };
    }
  }

  // Check if query letters appear in order (subsequence match)
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  if (qi === q.length && q.length >= 3) {
    return { match: true, score: 40, type: 'subsequence' };
  }

  return { match: false, score: 0, type: 'none' };
}

function executeDomainSearch() {
  const input = document.getElementById('domain-search-input');
  const resultsDiv = document.getElementById('domain-search-results');
  if (!input || !resultsDiv) return;

  const query = input.value.trim();
  if (!query || query.length < 2) {
    showPremiumToast('Enter at least 2 characters to search', 'warning');
    return;
  }

  resultsDiv.classList.remove('hidden');

  // Search through ALL inbox emails
  const matches = [];

  for (const mail of codeMailInbox) {
    let bestScore = 0;
    let matchType = 'none';
    let matchField = '';

    // Search in sender domain
    const senderDomain = mail.senderDomain || (mail.fromAddress || mail.from || '').split('@')[1] || '';
    let result = fuzzyMatch(query, senderDomain);
    if (result.match && result.score > bestScore) {
      bestScore = result.score;
      matchType = result.type;
      matchField = 'sender domain';
    }

    // Search in from name/address
    result = fuzzyMatch(query, mail.from || '');
    if (result.match && result.score > bestScore) {
      bestScore = result.score;
      matchType = result.type;
      matchField = 'sender';
    }

    // Search in subject
    result = fuzzyMatch(query, mail.subject || '');
    if (result.match && result.score > bestScore) {
      bestScore = result.score;
      matchType = result.type;
      matchField = 'subject';
    }

    // Search in body/preview (for company names in email content)
    const bodyText = (mail.body || '').replace(/<[^>]*>/g, '') + ' ' + (mail.preview || '');
    result = fuzzyMatch(query, bodyText);
    if (result.match && result.score > bestScore) {
      bestScore = result.score;
      matchType = result.type;
      matchField = 'body';
    }

    if (bestScore > 0) {
      matches.push({ mail, score: bestScore, matchType, matchField });
    }
  }

  // Sort by score (best matches first)
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    resultsDiv.innerHTML = `
      <div class="domain-search-empty">
        <span class="domain-search-empty-icon">🔍</span>
        <p class="domain-search-empty-text">NO PREVIOUS EMAILS FOUND</p>
        <p class="domain-search-empty-sub">No emails from "<strong>${escapeHtml(query)}</strong>" found in any inbox. This email has NOT been used with this company before.</p>
      </div>
    `;
    return;
  }

  // Show results
  const matchBadgeColors = {
    'exact': 'badge-match-exact',
    'partial': 'badge-match-partial',
    'fuzzy': 'badge-match-fuzzy',
    'subsequence': 'badge-match-subsequence'
  };

  resultsDiv.innerHTML = `
    <div class="domain-search-result-header">
      <span class="domain-search-found-icon">⚠️</span>
      <span class="domain-search-found-text">FOUND ${matches.length} PREVIOUS EMAIL${matches.length > 1 ? 'S' : ''} from "${escapeHtml(query)}"</span>
    </div>
    <div class="domain-search-result-list">
      ${matches.map((m, idx) => {
    const dateStr = m.mail.date ? new Date(m.mail.date).toLocaleString() : '--';
    const avatarSvg = generateLetterAvatar(m.mail.from || 'U');
    const matchLabel = m.matchType === 'exact' ? 'EXACT' : m.matchType === 'partial' ? 'PARTIAL' : m.matchType === 'fuzzy' ? 'FUZZY MATCH' : 'LOOSE';
    const badgeClass = matchBadgeColors[m.matchType] || 'badge-match-fuzzy';
    return `
          <div class="domain-search-result-item" onclick="openDomainSearchMail(${idx})" style="animation-delay: ${idx * 0.05}s">
            <img class="codemail-mail-avatar" src="${avatarSvg}" alt="">
            <div class="domain-search-result-info">
              <div class="domain-search-result-top">
                <span class="codemail-mail-from">${escapeHtml(m.mail.from || 'Unknown')}</span>
                <span class="codemail-mail-date">${dateStr}</span>
              </div>
              <div class="codemail-mail-subject">${escapeHtml(m.mail.subject || '(No Subject)')}</div>
              <div class="domain-search-result-meta">
                <span class="${badgeClass}">${matchLabel}</span>
                <span class="domain-search-match-field">matched in: ${m.matchField}</span>
                <span class="codemail-mail-account-badge">${m.mail.accountEmail || ''}</span>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;

  // Store matches for click handler
  window._domainSearchMatches = matches;
}

function openDomainSearchMail(idx) {
  const matches = window._domainSearchMatches;
  if (!matches || !matches[idx]) return;

  const mail = matches[idx].mail;

  // Mark as read
  mail.read = true;
  if (mail.id && mail.accountEmail) {
    const readMails = JSON.parse(localStorage.getItem('vmc_read_mails') || '{}');
    readMails[mail.id] = true;
    localStorage.setItem('vmc_read_mails', JSON.stringify(readMails));
  }

  // Open the mail reader overlay
  const overlay = document.getElementById('codemail-reader-overlay');
  if (overlay) overlay.classList.remove('hidden');

  document.getElementById('codemail-reader-subject').textContent = mail.subject || '(No Subject)';
  document.getElementById('codemail-reader-from').textContent = `From: ${mail.from || 'Unknown'}`;
  document.getElementById('codemail-reader-date').textContent = `Date: ${mail.date ? new Date(mail.date).toLocaleString() : '--'}`;

  const bodyEl = document.getElementById('codemail-reader-body');
  if (bodyEl) {
    if (mail.body && (mail.body.includes('<') && mail.body.includes('>'))) {
      bodyEl.innerHTML = `<div class="codemail-html-content">${mail.body}</div>`;
    } else {
      bodyEl.innerHTML = `<pre class="codemail-text-content">${escapeHtml(mail.body || mail.preview || 'No content available.')}</pre>`;
    }
  }

  // Re-render inbox to update read status
  renderCodeMailInbox();
}

// Add Enter key listener for domain search
document.addEventListener('DOMContentLoaded', () => {
  const domainInput = document.getElementById('domain-search-input');
  if (domainInput) {
    domainInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeDomainSearch();
    });
  }
});
