// --- STATE ---
const STORAGE_KEY_USERS = 'gimgm_users_v2';
const STORAGE_KEY_CURRENT_USER = 'gimgm_current_user_v2';
const STORAGE_KEY_PROJECTS = 'gimgm_projects_v2_';

let currentUser = null;
let projects = [];
let currentProject = null;
let currentLang = 'html'; // Aktive Tab-Sprache

// --- INITIALISIERUNG ---
window.onload = () => {
    checkLogin();
    
    // Globaler Keydown Listener für "!" und Speichern (Ctrl+S)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentProject();
            showNotification('Gespeichert!', 'green');
        }
    });
};

// --- AUTH SYSTEM ---
function switchAuth(mode) {
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('auth-btn').innerText = mode === 'login' ? 'Anmelden' : 'Registrieren';
    document.getElementById('auth-form').reset();
    document.getElementById('auth-msg').innerText = '';
    // Animation reset trigger
    const box = document.querySelector('.auth-box');
    box.classList.remove('animate-pop');
    void box.offsetWidth; 
    box.classList.add('animate-pop');
}

document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
    const isRegister = document.getElementById('auth-btn').innerText === 'Registrieren';

    if (isRegister) {
        if (users.find(u => u.user === user)) return showAuthMsg('Name vergeben!', 'red');
        users.push({ user, pass });
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
        showAuthMsg('Erfolg! Bitte anmelden.', '#4caf50');
        switchAuth('login');
    } else {
        const valid = users.find(u => u.user === user && u.pass === pass);
        if (valid) loginUser(user);
        else showAuthMsg('Falsche Daten!', 'red');
    }
});

function showAuthMsg(msg, color) {
    const el = document.getElementById('auth-msg');
    el.innerText = msg;
    el.style.color = color;
}

function loginUser(user) {
    currentUser = user;
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, user);
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('ide-container').style.display = 'flex';
    loadProjects();
}

function logout() {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    location.reload();
}

function checkLogin() {
    const user = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (user) loginUser(user);
}

// --- PROJEKT MANAGEMENT ---

function loadProjects() {
    const data = localStorage.getItem(STORAGE_KEY_PROJECTS + currentUser);
    projects = data ? JSON.parse(data) : [];
    renderProjectList();
    
    if (projects.length > 0) {
        openProject(projects[0].id);
    } else {
        openNewProjectModal(); // Kein Projekt da? Mach eins auf.
    }
}

function renderProjectList() {
    const list = document.getElementById('project-list');
    list.innerHTML = '';
    projects.forEach(p => {
        const div = document.createElement('div');
        div.className = `file ${currentProject && currentProject.id === p.id ? 'active' : ''}`;
        div.innerHTML = `<i class="fas fa-folder text-yellow"></i> ${p.name}`;
        div.onclick = () => openProject(p.id);
        
        // Löschen Button (klein)
        const del = document.createElement('i');
        del.className = 'fas fa-trash';
        del.style.marginLeft = 'auto';
        del.style.fontSize = '10px';
        del.style.opacity = '0.5';
        del.onclick = (e) => { e.stopPropagation(); deleteProject(p.id); };
        
        div.appendChild(del);
        list.appendChild(div);
    });
}

function openNewProjectModal() {
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('new-project-name').focus();
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function createProject() {
    const name = document.getElementById('new-project-name').value || 'Unbenannt';
    const checkboxes = document.querySelectorAll('.lang-selector input:checked');
    const langs = Array.from(checkboxes).map(cb => cb.value);

    const newProj = {
        id: Date.now(),
        name: name,
        langs: langs,
        code: {
            html: '', css: '', js: '', php: '', py: ''
        }
    };
    
    // Standard Code
    if(langs.includes('html')) newProj.code.html = '<!DOCTYPE html>\n<html lang="de">\n<body>\n  <h1>Hallo Welt</h1>\n</body>\n</html>';
    if(langs.includes('css')) newProj.code.css = 'body { background: #f0f0f0; padding: 20px; }';
    if(langs.includes('js')) newProj.code.js = 'console.log("Start...");';
    if(langs.includes('php')) newProj.code.php = '<?php\n echo "Hallo vom Server";\n?>';
    if(langs.includes('py')) newProj.code.py = '# Python Script\nprint("Hello World")';

    projects.push(newProj);
    saveProjectsToStorage();
    closeModal();
    renderProjectList();
    openProject(newProj.id);
}

function deleteProject(id) {
    if(!confirm('Wirklich löschen?')) return;
    projects = projects.filter(p => p.id !== id);
    saveProjectsToStorage();
    if(projects.length > 0) openProject(projects[0].id);
    else renderProjectList();
}

function openProject(id) {
    currentProject = projects.find(p => p.id === id);
    renderProjectList();
    renderEditorUI();
    updatePreview();
}

function saveProjectsToStorage() {
    localStorage.setItem(STORAGE_KEY_PROJECTS + currentUser, JSON.stringify(projects));
}

// --- EDITOR LOGIK & UI ---

function renderEditorUI() {
    const tabContainer = document.getElementById('editor-tabs');
    const codeContainer = document.getElementById('code-container');
    const fileList = document.getElementById('file-list');

    tabContainer.innerHTML = '';
    codeContainer.innerHTML = '';
    fileList.innerHTML = '';

    const icons = {
        html: '<i class="fab fa-html5 text-orange"></i>',
        css: '<i class="fab fa-css3-alt text-blue"></i>',
        js: '<i class="fab fa-js text-yellow"></i>',
        php: '<i class="fab fa-php" style="color:#777bb3"></i>',
        py: '<i class="fab fa-python" style="color:#306998"></i>'
    };

    const filenames = { html: 'index.html', css: 'style.css', js: 'script.js', php: 'server.php', py: 'app.py' };

    currentProject.langs.forEach((lang, index) => {
        // Tab erstellen
        const tab = document.createElement('div');
        tab.className = `tab ${index === 0 ? 'active' : ''}`;
        tab.innerHTML = `${icons[lang]} ${filenames[lang]}`;
        tab.onclick = () => switchTab(lang);
        tabContainer.appendChild(tab);

        // Textarea erstellen
        const area = document.createElement('textarea');
        area.className = `code-input ${index === 0 ? 'active' : ''}`;
        area.id = `code-${lang}`;
        area.value = currentProject.code[lang];
        area.spellcheck = false;
        area.placeholder = `Code für ${lang}...`;
        
        // Event Listener für "!" Snippet und Input
        area.addEventListener('keydown', (e) => handleKeyInput(e, area, lang));
        area.addEventListener('input', () => {
            currentProject.code[lang] = area.value;
            saveProjectsToStorage(); // Auto-Save
            if(['html','css','js'].includes(lang)) updatePreview();
        });

        codeContainer.appendChild(area);

        // Sidebar File List
        const fileItem = document.createElement('div');
        fileItem.className = 'file';
        fileItem.innerHTML = `${icons[lang]} ${filenames[lang]}`;
        fileItem.onclick = () => switchTab(lang);
        fileList.appendChild(fileItem);
    });

    // Set default tab
    currentLang = currentProject.langs[0];
}

function switchTab(lang) {
    currentLang = lang;
    document.querySelectorAll('.code-input').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.editor-tabs .tab').forEach(el => el.classList.remove('active'));
    
    // Find index to set active tab
    const index = currentProject.langs.indexOf(lang);
    document.querySelectorAll('.editor-tabs .tab')[index].classList.add('active');
    document.getElementById(`code-${lang}`).classList.add('active');
}

// --- MAGIC FEATURES: Snippets & Emmet ---
function handleKeyInput(e, textarea, lang) {
    // VS Code Style "!" Tab Expansion für HTML
    if (lang === 'html' && e.key === 'Tab') {
        const val = textarea.value;
        const cursorPos = textarea.selectionStart;
        // Check if character before cursor is "!"
        if (val.substring(cursorPos - 1, cursorPos) === '!') {
            e.preventDefault(); // Stop Tab focus change
            const before = val.substring(0, cursorPos - 1);
            const after = val.substring(cursorPos);
            const snippet = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    
</body>
</html>`;
            textarea.value = before + snippet + after;
            // Cursor in Body setzen (grob geschätzt)
            textarea.selectionStart = textarea.selectionEnd = before.length + snippet.indexOf('<body>') + 7;
            updatePreview();
        } else {
            // Normaler Tab Indent
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }
    }
}

// --- RUNNER & PREVIEW ---
function updatePreview() {
    if (!currentProject) return;
    
    const html = currentProject.code.html || '';
    const css = currentProject.code.css ? `<style>${currentProject.code.css}</style>` : '';
    const js = currentProject.code.js ? `<script>${currentProject.code.js}<\/script>` : '';

    const content = `
        ${html}
        ${css}
        ${js}
    `;

    const doc = document.getElementById('preview-frame').contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();
}

function runCode() {
    updatePreview();
    const btn = document.querySelector('.fa-play');
    btn.style.color = '#00ff00';
    setTimeout(() => btn.style.color = '', 500);
}

// --- UPLOAD / DOWNLOAD ---
function triggerUpload() {
    document.getElementById('file-upload').click();
}

document.getElementById('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedProj = JSON.parse(event.target.result);
            if (!importedProj.id || !importedProj.code) throw new Error('Ungültiges Format');
            
            importedProj.id = Date.now(); // Neue ID vergeben um Konflikte zu vermeiden
            importedProj.name = importedProj.name + " (Import)";
            projects.push(importedProj);
            saveProjectsToStorage();
            renderProjectList();
            openProject(importedProj.id);
            alert('Projekt importiert!');
        } catch (err) {
            alert('Fehler beim Laden: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// Download Feature im "Dateien" Stil
function downloadCurrentProject() {
    // Wir speichern das ganze Projekt als JSON, damit man es später wieder bearbeiten kann
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProject));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = currentProject.name + ".json";
    a.click();
}

// Mobile Helper
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function toggleFullscreenPreview() {
    document.getElementById('preview-area').classList.toggle('fullscreen');
}

// CSS Helper Klassen für Icons
const styleIcons = document.createElement('style');
styleIcons.innerHTML = `
    .text-orange { color: #e34c26; }
    .text-blue { color: #264de4; }
    .text-yellow { color: #f0db4f; }
    .preview-area.fullscreen { position: fixed; inset: 0; z-index: 50; height: 100vh !important; }
`;
document.head.appendChild(styleIcons);