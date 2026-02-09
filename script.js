// --- STATE ---
const STORAGE_KEY_USERS = 'gimgm_users_v5';
const STORAGE_KEY_CURRENT_USER = 'gimgm_current_user_v5';
const STORAGE_KEY_PROJECTS = 'gimgm_projects_v5_';
const STORAGE_KEY_COOKIE = 'gimgm_cookie_consent_v5';

let currentUser = null;
let projects = [];
let currentProject = null;
let currentLang = 'html'; 

const SUGGESTIONS = {
    html: ['div', 'span', 'h1', 'p', 'a', 'img', 'ul', 'li', 'table', 'form', 'input', 'button', 'class', 'id', 'style'],
    css: ['color', 'background', 'margin', 'padding', 'border', 'display', 'flex', 'grid', 'font-size', 'width', 'height'],
    js: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'console.log', 'document.getElementById', 'addEventListener'],
    php: ['echo', 'function', 'if', 'else', 'return', '$this', 'include', 'require'],
    py: ['def', 'print', 'import', 'class', 'if', 'else', 'elif', 'for', 'while']
};

window.onload = () => {
    checkCookieConsent();
    checkLogin();
    setupDraggablePreview();
    
    // Global Save (Strg+S)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentProject) {
                saveProjectsToStorage();
                showToast('Projekt gespeichert!', 'success');
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-box')) {
            document.getElementById('autocomplete-box').style.display = 'none';
        }
    });
};

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = type === 'success' ? '#4caf50' : (type === 'error' ? '#f44336' : '#007acc');
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- AUTH & COOKIE ---
function checkCookieConsent() {
    if (!localStorage.getItem(STORAGE_KEY_COOKIE)) document.getElementById('cookie-overlay').style.display = 'flex';
}
function acceptCookies() { localStorage.setItem(STORAGE_KEY_COOKIE, 'accepted'); document.getElementById('cookie-overlay').style.display = 'none'; }
function rejectCookies() { document.getElementById('cookie-overlay').style.display = 'none'; showToast('Eingeschränkter Modus', 'info'); }

function switchAuth(mode) {
    const isReg = mode === 'register';
    document.getElementById('tab-login').classList.toggle('active', !isReg);
    document.getElementById('tab-register').classList.toggle('active', isReg);
    document.getElementById('auth-btn').innerText = isReg ? 'Registrieren' : 'Anmelden';
    document.getElementById('email-group').style.display = isReg ? 'block' : 'none';
    document.getElementById('register-extras').style.display = isReg ? 'block' : 'none';
    document.getElementById('auth-form').reset();
}

function togglePassword() {
    const input = document.getElementById('password');
    const icon = document.querySelector('.password-toggle');
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

function openAGB() { document.getElementById('agb-modal').style.display = 'flex'; }
function closeAGB() { document.getElementById('agb-modal').style.display = 'none'; }

document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const isRegister = document.getElementById('auth-btn').innerText === 'Registrieren';
    const users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');

    if (isRegister) {
        const email = document.getElementById('email').value;
        const agb = document.getElementById('agb-check').checked;
        if (!agb) return showToast('AGB akzeptieren!', 'error');
        if (!email) return showToast('E-Mail fehlt!', 'error');
        if (users.find(u => u.user === user)) return showToast('Name vergeben!', 'error');
        users.push({ user, pass, email });
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
        showToast('Registriert!', 'success');
        switchAuth('login');
    } else {
        const valid = users.find(u => u.user === user && u.pass === pass);
        if (valid) performLogin(user); else showToast('Falsche Daten!', 'error');
    }
});

function performLogin(user) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('loader-overlay').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('loader-overlay').style.display = 'none';
        currentUser = user;
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, user);
        document.getElementById('ide-container').style.display = 'flex';
        loadProjects();
    }, 2000);
}

function logout() { localStorage.removeItem(STORAGE_KEY_CURRENT_USER); location.reload(); }
function checkLogin() {
    const user = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (user) { currentUser = user; document.getElementById('auth-container').style.display = 'none'; document.getElementById('ide-container').style.display = 'flex'; loadProjects(); }
}

// --- PROJEKTE ---
function loadProjects() {
    const data = localStorage.getItem(STORAGE_KEY_PROJECTS + currentUser);
    projects = data ? JSON.parse(data) : [];
    renderProjectList();
    if (projects.length > 0) openProject(projects[0].id); else openNewProjectModal();
}

function renderProjectList() {
    const list = document.getElementById('project-list');
    list.innerHTML = '';
    projects.forEach(p => {
        const div = document.createElement('div');
        div.className = `file ${currentProject && currentProject.id === p.id ? 'active' : ''}`;
        div.innerHTML = `<i class="fas fa-folder text-yellow"></i> ${p.name}`;
        div.onclick = () => openProject(p.id);
        const del = document.createElement('i');
        del.className = 'fas fa-trash'; del.style.marginLeft = 'auto'; del.style.opacity = '0.5';
        del.onclick = (e) => { e.stopPropagation(); deleteProject(p.id); };
        div.appendChild(del); list.appendChild(div);
    });
}

function openNewProjectModal() { document.getElementById('new-project-modal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function createProject() {
    const name = document.getElementById('new-project-name').value || 'Unbenannt';
    const checkboxes = document.querySelectorAll('.lang-selector input:checked');
    const langs = Array.from(checkboxes).map(cb => cb.value);
    const newProj = { id: Date.now(), name: name, langs: langs, code: { html: '<h1>Neu</h1>', css: '', js: '', php: '', py: '' } };
    projects.push(newProj);
    saveProjectsToStorage();
    closeModal('new-project-modal');
    renderProjectList();
    openProject(newProj.id);
}
function deleteProject(id) {
    if(!confirm('Löschen?')) return;
    projects = projects.filter(p => p.id !== id);
    saveProjectsToStorage();
    if(projects.length > 0) openProject(projects[0].id); else location.reload();
}
function saveProjectsToStorage() { localStorage.setItem(STORAGE_KEY_PROJECTS + currentUser, JSON.stringify(projects)); }
function openProject(id) { currentProject = projects.find(p => p.id === id); renderProjectList(); renderEditorUI(); updatePreview(); }

// --- EDITOR LOGIK + TAB FIX ---
function renderEditorUI() {
    const tabContainer = document.getElementById('editor-tabs');
    const codeContainer = document.getElementById('code-container');
    const fileList = document.getElementById('file-list');

    Array.from(codeContainer.children).forEach(child => { if(child.id !== 'autocomplete-box') child.remove(); });
    tabContainer.innerHTML = '';
    fileList.innerHTML = '';

    const icons = { html: '<i class="fab fa-html5 text-orange"></i>', css: '<i class="fab fa-css3-alt text-blue"></i>', js: '<i class="fab fa-js text-yellow"></i>', php: '<i class="fab fa-php"></i>', py: '<i class="fab fa-python"></i>' };
    const ext = { html: '.html', css: '.css', js: '.js', php: '.php', py: '.py' };

    currentProject.langs.forEach((lang, index) => {
        // Tabs
        const tab = document.createElement('div');
        tab.className = `tab ${index === 0 ? 'active' : ''}`;
        tab.innerHTML = `${icons[lang]} ${lang === 'html' ? 'index' : 'style'}${ext[lang]}`;
        tab.onclick = () => switchTab(lang);
        tabContainer.appendChild(tab);

        // Sidebar File List
        const fileItem = document.createElement('div');
        fileItem.className = 'file';
        fileItem.innerHTML = `${icons[lang]} ${lang === 'html' ? 'index' : 'style'}${ext[lang]}`;
        fileItem.onclick = () => switchTab(lang);
        fileList.appendChild(fileItem);

        // Input Area
        const area = document.createElement('textarea');
        area.className = `code-input ${index === 0 ? 'active' : ''}`;
        area.id = `code-${lang}`;
        area.value = currentProject.code[lang];
        area.spellcheck = false;

        // EVENT: Input für Preview & Save
        area.addEventListener('input', (e) => {
            currentProject.code[lang] = area.value;
            handleAutocomplete(e, area, lang);
            if(['html','css','js'].includes(lang)) updatePreview();
        });

        // EVENT: Keydown für TAB und Autocomplete
        area.addEventListener('keydown', (e) => {
            // TAB KEY FIX: 4 Leerzeichen statt Fokus-Wechsel
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = area.selectionStart;
                const end = area.selectionEnd;
                // Text manipulation
                area.value = area.value.substring(0, start) + "    " + area.value.substring(end);
                // Cursor neu setzen
                area.selectionStart = area.selectionEnd = start + 4;
                currentProject.code[lang] = area.value; // State update
            }
            // Autocomplete Trigger Ctrl+Space
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                handleAutocomplete(e, area, lang, true);
            }
        });

        codeContainer.appendChild(area);
    });
    currentLang = currentProject.langs[0];
}

function switchTab(lang) {
    currentLang = lang;
    document.querySelectorAll('.code-input').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    const index = currentProject.langs.indexOf(lang);
    if(index > -1) {
        document.querySelectorAll('.tab')[index].classList.add('active');
        document.getElementById(`code-${lang}`).classList.add('active');
    }
}

// --- AUTOCOMPLETE ---
function handleAutocomplete(e, ta, lang, force = false) {
    const box = document.getElementById('autocomplete-box');
    const val = ta.value;
    const pos = ta.selectionEnd;
    const word = val.substring(0, pos).split(/[\s\n\t<>{}().;]+/).pop();

    if ((!word && !force) || !SUGGESTIONS[lang]) { box.style.display = 'none'; return; }
    const matches = SUGGESTIONS[lang].filter(w => w.startsWith(word));
    if (matches.length === 0) { box.style.display = 'none'; return; }

    box.innerHTML = '';
    matches.forEach(m => {
        const d = document.createElement('div');
        d.className = 'suggestion'; d.innerText = m;
        d.onclick = () => {
            ta.value = val.substring(0, pos - word.length) + m + val.substring(pos);
            box.style.display = 'none'; ta.focus();
            currentProject.code[lang] = ta.value; updatePreview();
        };
        box.appendChild(d);
    });
    box.style.display = 'block'; box.style.bottom = '20px'; box.style.left = '20px';
}

// --- AI BOT (Fehleranalyse) ---
function toggleAI() {
    document.getElementById('ai-panel').classList.toggle('open');
}

function runAICheck() {
    const chat = document.getElementById('ai-chat');
    chat.innerHTML += `<div class="ai-msg">Analysiere Code...</div>`;
    
    setTimeout(() => {
        let errors = [];
        const code = currentProject.code[currentLang];
        
        // Simpelste Regex-Regeln für die Demo
        if (currentLang === 'html') {
            if (!code.includes('<body>')) errors.push("Warnung: Kein &lt;body&gt; Tag gefunden.");
            if ((code.match(/<div/g) || []).length !== (code.match(/<\/div>/g) || []).length) errors.push("Fehler: Anzahl geöffneter und geschlossener &lt;div&gt; Tags stimmt nicht überein.");
        } else if (currentLang === 'css') {
            if (code.includes('{') && !code.includes('}')) errors.push("Fehler: Eine CSS-Regel wurde nicht geschlossen '}'.");
        } else if (currentLang === 'js') {
            if (code.includes('console.log') && !code.includes(';')) errors.push("Hinweis: In JS fehlen oft Semikolons ';'.");
            if (code.includes('(') && !code.includes(')')) errors.push("Syntax Error: Klammer '(' nicht geschlossen.");
        }

        if (errors.length > 0) {
            errors.forEach(err => {
                chat.innerHTML += `<div class="ai-msg bot error">${err}</div>`;
            });
            chat.innerHTML += `<div class="ai-msg bot">Soll ich versuchen, das zu beheben? (Demo)</div>`;
        } else {
            chat.innerHTML += `<div class="ai-msg bot success">Der Code sieht für mich sauber aus! 👍</div>`;
        }
        chat.scrollTop = chat.scrollHeight;
    }, 1500);
}

// --- FILE UPLOAD (Mehrere Dateien) ---
function triggerFileUpload() { document.getElementById('file-upload-input').click(); }

document.getElementById('file-upload-input').addEventListener('change', (e) => {
    // files ist eine FileList, wir können iterieren
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    let loadedCount = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const content = evt.target.result;
            let type = 'html'; // Fallback
            if(file.name.includes('.css')) type = 'css';
            if(file.name.includes('.js')) type = 'js';
            if(file.name.includes('.php')) type = 'php';
            if(file.name.includes('.py')) type = 'py';
            
            // Wenn Sprache noch nicht im Projekt, hinzufügen
            if (!currentProject.langs.includes(type)) currentProject.langs.push(type);
            
            // Inhalt überschreiben (oder anhängen - hier überschreiben wir für Demo)
            currentProject.code[type] = content;
            loadedCount++;
            
            if(loadedCount === files.length) {
                saveProjectsToStorage();
                renderEditorUI();
                switchTab(type);
                showToast(`${loadedCount} Dateien importiert!`, 'success');
            }
        };
        reader.readAsText(file);
    });
    e.target.value = ''; // Reset
});

function downloadActiveFile() {
    if (!currentProject || !currentLang) return;
    const content = currentProject.code[currentLang] || '';
    const ext = { html: 'html', css: 'css', js: 'js', php: 'php', py: 'py' };
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name}_${currentLang}.${ext[currentLang]}`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// --- FULLSCREEN & PREVIEW ---
function toggleFullscreen() {
    const p = document.getElementById('preview-area');
    p.classList.toggle('fullscreen');
    // Reset Position bei Fullscreen
    if(p.classList.contains('fullscreen')) {
        p.style.top = '0'; p.style.left = '0';
    } else {
        p.style.top = '60px'; p.style.right = '20px'; p.style.left = 'auto'; p.style.width = '400px'; p.style.height = '300px';
    }
}

function minimizePreview() {
    const p = document.getElementById('preview-area');
    if(p.style.height === '40px') {
        p.style.height = '300px'; 
    } else {
        p.style.height = '40px'; 
        p.style.overflow = 'hidden';
    }
}

function setupDraggablePreview() {
    const preview = document.getElementById('preview-area');
    const header = document.getElementById('preview-header');
    let isDragging = false, startX, startY, initLeft, initTop;

    header.addEventListener('mousedown', (e) => {
        if(window.innerWidth <= 768 || preview.classList.contains('fullscreen')) return; 
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        initLeft = preview.offsetLeft; initTop = preview.offsetTop;
        document.getElementById('preview-frame').style.pointerEvents = 'none';
        header.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        preview.style.left = `${initLeft + (e.clientX - startX)}px`;
        preview.style.top = `${initTop + (e.clientY - startY)}px`;
        preview.style.right = 'auto'; 
    });

    window.addEventListener('mouseup', () => {
        if(isDragging) {
            isDragging = false;
            document.getElementById('preview-frame').style.pointerEvents = 'auto';
            header.style.cursor = 'grab';
        }
    });
}

function runCode() { updatePreview(); showToast('Ausgeführt', 'success'); }
function updatePreview() {
    if (!currentProject) return;
    const doc = document.getElementById('preview-frame').contentWindow.document;
    doc.open();
    doc.write(currentProject.code.html + `<style>${currentProject.code.css}</style>` + `<script>${currentProject.code.js}<\/script>`);
    doc.close();
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
