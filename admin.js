// ============================================
// CONFIGURACIÓ ADMIN
// ============================================

const ADMIN_ENABLED = true; // Canvia a false per desactivar la pestanya Actes

// CONFIGURA AQUÍ LES TEVES CREDENCIALS OAUTH (pendent)
const CLIENT_ID = '249755894132-dih81ui9hv20dqqusr14vjpm7m5ll30u.apps.googleusercontent.com';
const API_KEY = 'AIzaSyB6U8QiwtEvNSyO-fqS1fVnqHJrxyGBA8U';

// ID de la carpeta de Drive on es guardaran les fotos
const DRIVE_FOLDER_ID = '1iyyAySpi-2zDXlNRW6H2dc4WBQY201UX';

// Scopes necessaris
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

// ============================================
// VARIABLES GLOBALS
// ============================================

let tokenClient;
let gapiInited = false;
let gisInited = false;
let isAuthenticated = false;
let userEmail = '';
let userRole = ''; // 'Admin' o 'Tècnic'

let resultatsData = null;
let currentViewType = 'pistes'; // 'pistes' o 'temps'
let currentSelection = '';
let editingRowIndex = null;

// ========== MODE DEBUG - DESCOMENTA PER TREBALLAR SENSE AUTENTICACIÓ ==========
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('actesContent').style.display = 'block';
        isAuthenticated = true;
        userRole = 'Admin';
        userEmail = 'test@test.com';
        loadResultatsData();
    }, 1000);
});
// ===============================================================================

// ============================================
// INICIALITZACIÓ
// ============================================

if (ADMIN_ENABLED) {
    // Mostrar la pestanya immediatament
    window.addEventListener('load', () => {
        document.getElementById('actesTab').style.display = 'block';
    });

    // Carregar les APIs de Google
    function gapiLoaded() {
        gapi.load('client', initializeGapiClient);
    }

    function initializeGapiClient() {
        gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [
                'https://sheets.googleapis.com/$discovery/rest?version=v4',
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
            ],
        }).then(function () {
            gapiInited = true;
            console.log('GAPI inicialitzat correctament');
        }).catch(function(error) {
            console.error('Error inicialitzant GAPI:', error);
        });
    }

    function gisLoaded() {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // definit més endavant
        });
        gisInited = true;
        console.log('GIS inicialitzat correctament');
    }

    // Carregar scripts de Google només si les credencials estan configurades
    if (CLIENT_ID !== 'EL_TEU_CLIENT_ID.apps.googleusercontent.com' && API_KEY !== 'LA_TEVA_API_KEY') {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = gapiLoaded;
        gapiScript.onerror = () => console.error('Error carregant GAPI');
        document.head.appendChild(gapiScript);

        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = gisLoaded;
        gisScript.onerror = () => console.error('Error carregant GIS');
        document.head.appendChild(gisScript);
    } else {
        console.warn('Credencials OAuth no configurades. Configura CLIENT_ID i API_KEY a admin.js');
    }
}

// ============================================
// AUTENTICACIÓ
// ============================================

function handleAuthClick() {
    if (!gapiInited || !gisInited) {
        showStatus('Les APIs de Google encara s\'estan carregant. Si us plau, espera uns segons i torna-ho a provar.', 'error');
        return;
    }

    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('Error en el callback:', resp);
            showStatus('Error d\'autenticació: ' + resp.error, 'error');
            return;
        }
        console.log('Token rebut correctament');
        await checkUserPermissions();
    };

    if (gapi.client.getToken() === null) {
        // Sol·licitar token per primera vegada
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Ja tenim token, sol·licitar-ne un de nou
        tokenClient.requestAccessToken({prompt: ''});
    }
}

async function checkUserPermissions() {
    try {
        // Obtenir el token d'accés
        const token = gapi.client.getToken();
        
        if (!token || !token.access_token) {
            throw new Error('No s\'ha pogut obtenir el token d\'accés');
        }
        
        console.log('Token obtingut, consultant informació de l\'usuari...');

        // Obtenir el correu de l'usuari des del token d'accés
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${token.access_token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('Error resposta API:', errorData);
            throw new Error('No s\'ha pogut obtenir la informació de l\'usuari');
        }
        
        const userData = await response.json();
        userEmail = userData.email;
        
        console.log('Usuari autenticat:', userEmail);

        // Carregar la llista d'usuaris autoritzats del full Info
        console.log('Carregant llista d\'usuaris autoritzats...');
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Info&range=F3:G`;
        const sheetResponse = await fetch(url);
        const text = await sheetResponse.text();
        const jsonText = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonText);

        // Comprovar si l'usuari està autoritzat
        let authorized = false;
        if (data.table && data.table.rows) {
            console.log('Total usuaris a la llista:', data.table.rows.length);
            for (let row of data.table.rows) {
                const role = row.c[0] ? (row.c[0].v || '') : '';
                const email = row.c[1] ? (row.c[1].v || '') : '';
                
                console.log('Comprovant:', email, 'Rol:', role);
                
                if (email.toLowerCase() === userEmail.toLowerCase() && (role === 'Admin' || role === 'Tècnic')) {
                    authorized = true;
                    userRole = role;
                    console.log('✅ Usuari autoritzat!');
                    break;
                }
            }
        }
        if (authorized) {
            isAuthenticated = true;
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('actesContent').style.display = 'block';
            showStatus(`Autenticat com ${userRole}: ${userEmail}`, 'success');
            setTimeout(hideStatus, 3000);
            loadResultatsData();
        } else {
            console.log('❌ Usuari NO autoritzat');
            showStatus(`No tens permisos per accedir a aquesta secció. Correu: ${userEmail}`, 'error');
        }
    } catch (error) {
        console.error('Error d\'autenticació:', error);
        showStatus('Error d\'autenticació: ' + error.message, 'error');
    }
}
    
// ============================================
// CÀRREGA DE DADES
// ============================================

async function loadResultatsData() {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Resultats dels partits&range=A1:ZZ&headers=1`;
        const response = await fetch(url);
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        resultatsData = JSON.parse(jsonText);
        
        updateSelectionDropdown();
        loadActesTable();
    } catch (error) {
        console.error('Error carregant resultats:', error);
        showStatus('Error carregant dades dels resultats', 'error');
    }
}

function changeViewType() {
    currentViewType = document.querySelector('input[name="viewType"]:checked').value;
    updateSelectionDropdown();
    loadActesTable();
}

function updateSelectionDropdown() {
    const select = document.getElementById('actesSelect');
    select.innerHTML = '';
    
    if (!resultatsData || !resultatsData.table) return;
    
    if (currentViewType === 'pistes') {
        // Fila 2 (índex 0) - Pistes
        const pistesRow = resultatsData.table.rows[0];
        pistesRow.c.forEach((cell, index) => {
            if (cell && (cell.v || cell.f)) {
                const value = cell.f || cell.v || '';
                if (value.trim() !== '') {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = value;
                    select.appendChild(option);
                    if (index === 1) { // B2 per defecte (índex 1)
                        option.selected = true;
                        currentSelection = index;
                    }
                }
            }
        });
    } else {
        // Columna A - Temps
        resultatsData.table.rows.forEach((row, index) => {
            if (index === 0) return; // Saltar la primera fila (capçaleres de pistes)
            const cell = row.c[0];
            if (cell && (cell.v || cell.f)) {
                const value = cell.f || cell.v || '';
                if (value.trim() !== '') {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = value;
                    select.appendChild(option);
                    if (index === 1) { // A3 per defecte (índex 1)
                        option.selected = true;
                        currentSelection = index;
                    }
                }
            }
        });
    }
}

function loadActesTable() {
    if (!resultatsData) return;
    
    const select = document.getElementById('actesSelect');
    currentSelection = select.value;
    
    const thead = document.getElementById('tableHeadActes');
    const tbody = document.getElementById('tableBodyActes');
    
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    if (currentViewType === 'pistes') {
        loadPistesView();
    } else {
        loadTempsView();
    }
}

function loadPistesView() {
    const colIndex = parseInt(currentSelection);
    const thead = document.getElementById('tableHeadActes');
    const tbody = document.getElementById('tableBodyActes');
    
    // Crear capçalera (4 columnes)
    const headerRow = document.createElement('tr');
    const th1 = document.createElement('th');
    th1.textContent = "Hora";
    headerRow.appendChild(th1);
    const th2 = document.createElement('th');
    th2.colSpan = 4;
    th2.textContent = "Resultats dels partits";
    headerRow.appendChild(th2);

    // Columna d'accions
    const thActions = document.createElement('th');
    thActions.textContent = 'Accions';
    headerRow.appendChild(thActions);
    thead.appendChild(headerRow);
    
    // Crear files (saltar la primera que són les pistes)
    for (let rowIndex = 1; rowIndex < resultatsData.table.rows.length; rowIndex++) {
        const row = resultatsData.table.rows[rowIndex];
        // Comprovar si la segona columna té dades
        const secondColumnCell = row.c[colIndex]; // colIndex és la segona columna (i=1)
        const secondColumnValue = secondColumnCell ? (secondColumnCell.f || secondColumnCell.v || '').toString().trim() : '';
    
    // Saltar aquesta fila si la segona columna està buida
    if (secondColumnValue === '') {
        continue;
    }
    
        
        const tr = document.createElement('tr');
        tr.dataset.rowIndex = rowIndex;
        tr.dataset.colStart = colIndex;
        
        for (let i = 0; i < 5; i++) {
            const td = document.createElement('td');
            if (i === 0) {
                const headerCell = row.c[0];
                td.textContent = headerCell ? (headerCell.f || headerCell.v || '') : '';
            } else {
                const cell = row.c[colIndex + i-1];
                td.textContent = cell ? (cell.f || cell.v || '') : '';
            }
            td.dataset.colIndex = colIndex + i;
            tr.appendChild(td);
        }
        
        // Columna d'accions
        const tdActions = document.createElement('td');
        tdActions.innerHTML = createActionButtons(rowIndex);
        tr.appendChild(tdActions);
        
        tbody.appendChild(tr);
    }
}

function loadTempsView() {
    const rowIndex = parseInt(currentSelection);
    const thead = document.getElementById('tableHeadActes');
    const tbody = document.getElementById('tableBodyActes');
    
    const row = resultatsData.table.rows[rowIndex];
    
    // Crear capçalera (4 columnes)
    const headerRow = document.createElement('tr');
    const th1 = document.createElement('th');
    th1.textContent = "Pista";
    headerRow.appendChild(th1);    
    const th2 = document.createElement('th');
    th2.colSpan = 4;
    th2.textContent = "Resultats dels partits";
    headerRow.appendChild(th2);
    // Columna d'accions
    const thActions = document.createElement('th');
    thActions.textContent = 'Accions';
    headerRow.appendChild(thActions);
    thead.appendChild(headerRow);
    
    // Crear files (grups de 4 columnes)
    let colIndex = 1;
    let groupIndex = 0;
    while (colIndex < row.c.length) {
        // Comprovar si hi ha contingut en aquest grup
        let hasContent = false;
        for (let i = 0; i < 4 && colIndex + i < row.c.length; i++) {
            const cell = row.c[colIndex + i];
            if (cell && (cell.v || cell.f)) {
                const value = (cell.f || cell.v || '').toString().trim();
                if (value !== '') {
                    hasContent = true;
                    break;
                }
            }
        }
        
        if (hasContent) {
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = rowIndex;
            tr.dataset.colStart = colIndex;
            for (let i = 0; i < 5; i++) {
                const td = document.createElement('td');
                if (i === 0) {
                    const headerCell = resultatsData.table.rows[0].c[colIndex];
                    td.textContent = headerCell ? (headerCell.f || headerCell.v || '') : '';
                } else {
                    const cell = row.c[colIndex + i-1];
                    td.textContent = cell ? (cell.f || cell.v || '') : '';
                }
            
                td.dataset.colIndex = colIndex + i;
                tr.appendChild(td);
            }
            
            // Columna d'accions
            const tdActions = document.createElement('td');
            tdActions.innerHTML = createActionButtons(rowIndex, colIndex);
            tr.appendChild(tdActions);
            
            tbody.appendChild(tr);
        }
        
        colIndex += 4;
        groupIndex++;
    }
}

function createActionButtons(rowIndex, colStart) {
    return `
        <div class="action-icons">
            <button class="icon-button icon-edit" onclick="startEdit(this)" title="Editar">
                ✏️
            </button>
        </div>
    `;
}

// ============================================
// EDICIÓ
// ============================================

function startEdit(button) {
    const tr = button.closest('tr');
    const tds = tr.querySelectorAll('td');
    
    // Fer editables les columnes 3 i 4 (índexs 2 i 3)
    for (let i = 3; i < 5; i++) {
        const td = tds[i];
        const currentValue = td.textContent;
        td.classList.add('editable-cell');
        td.innerHTML = `<input type="text" value="${currentValue}" maxlength="2" pattern="[0-9]{1,2}|NP">`;
    }
    
    // Canviar icones
    const actionsDiv = tr.querySelector('.action-icons');
    actionsDiv.innerHTML = `
        <button class="icon-button icon-camera" onclick="openCamera(this)" title="Fer foto">
            📷
        </button>
        <button class="icon-button icon-save" onclick="saveEdit(this)" title="Desar">
            💾
        </button>
        <button class="icon-button icon-cancel" onclick="cancelEdit(this)" title="Cancel·lar">
            ❌
        </button>
    `;
}

function cancelEdit(button) {
    loadActesTable(); // Recarregar la taula per cancel·lar canvis
}

async function saveEdit(button) {
    const tr = button.closest('tr');
    const rowIndex = parseInt(tr.dataset.rowIndex);
    const colStart = parseInt(tr.dataset.colStart);
    const tds = tr.querySelectorAll('td');
    
    // Obtenir valors editatsconst values = [];
    const updates = [];
    
    for (let i = 2; i < 4; i++) {
        const input = tds[i].querySelector('input');
        const value = input.value.trim().toUpperCase();
        
        // Validar
        if (value !== '' && value !== 'NP' && !/^[0-9]{1,2}$/.test(value)) {
            showStatus('Els valors han de ser números d\'1 o 2 xifres, o "NP"', 'error');
            return;
        }
        
        const colIndex = parseInt(tds[i].dataset.colIndex);
        updates.push({
            row: rowIndex + 2, // +2 perquè A2 és l'inici
            col: colIndex,
            value: value
        });
    }
    
    // Desar a Google Sheets
    try {
        showLoading(true);
        
        const requests = updates.map(update => {
            const colLetter = getColumnLetter(update.col);
            return {
                range: `Resultats dels partits!${colLetter}${update.row}`,
                values: [[update.value]]
            };
        });
        
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: requests
            }
        });
        
        showStatus('Dades desades correctament!', 'success');
        setTimeout(() => {
            hideStatus();
            loadResultatsData(); // Recarregar dades
        }, 2000);
        
    } catch (error) {
        console.error('Error desant dades:', error);
        showStatus('Error al desar les dades', 'error');
    } finally {
        showLoading(false);
    }
}

function getColumnLetter(columnNumber) {
    let letter = '';
    while (columnNumber >= 0) {
        letter = String.fromCharCode((columnNumber % 26) + 65) + letter;
        columnNumber = Math.floor(columnNumber / 26) - 1;
    }
    return letter;
}

// ============================================
// CÀMERA I DRIVE
// ============================================

let currentPhotoRow = null;
let videoStream = null;

function openCamera(button) {
    currentPhotoRow = button.closest('tr');
    
    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'camera-modal active';
    modal.innerHTML = `
        <div class="camera-content">
            <h3>📷 Capturar Foto</h3>
            <video id="cameraVideo" autoplay playsinline></video>
            <canvas id="cameraCanvas" style="display:none;"></canvas>
            <div class="camera-buttons">
                <button class="btn" onclick="capturePhoto()">Capturar</button>
                <button class="btn" onclick="closeCamera()">Cancel·lar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Iniciar càmera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            videoStream = stream;
            document.getElementById('cameraVideo').srcObject = stream;
        })
        .catch(error => {
            console.error('Error accedint a la càmera:', error);
            showStatus('No s\'ha pogut accedir a la càmera', 'error');
            closeCamera();
        });
}

function closeCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    const modal = document.querySelector('.camera-modal');
    if (modal) modal.remove();
}

async function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    // Convertir a blob
    canvas.toBlob(async (blob) => {
        closeCamera();
        await uploadToDrive(blob);
    }, 'image/jpeg', 0.9);
}

async function uploadToDrive(blob) {
    try {
        showLoading(true);
        
        // Generar nom del fitxer
        const rowIndex = parseInt(currentPhotoRow.dataset.rowIndex);
        const colStart = parseInt(currentPhotoRow.dataset.colStart);
        
        let pistaName = '';
        let tempsName = '';
        
        if (currentViewType === 'pistes') {
            // Obtenir nom de la pista
            pistaName = resultatsData.table.rows[0].c[colStart].v || 'Pista';
            // Obtenir el temps (columna A de la fila actual)
            tempsName = resultatsData.table.rows[rowIndex].c[0].v || 'Temps';
        } else {
            // Obtenir nom de la pista (primera cel·la del grup)
            pistaName = resultatsData.table.rows[0].c[colStart].v || 'Pista';
            // Obtenir el temps (columna A)
            tempsName = resultatsData.table.rows[rowIndex].c[0].v || 'Temps';
        }
        
        const fileName = `2025_${pistaName}_${tempsName}.jpg`.replace(/[^a-zA-Z0-9_.-]/g, '_');
        
        // Pujar a Drive
        const metadata = {
            name: fileName,
            mimeType: 'image/jpeg',
            parents: [DRIVE_FOLDER_ID]
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
            body: form
        });
        
        if (response.ok) {
            showStatus('Foto desada correctament a Drive!', 'success');
            setTimeout(hideStatus, 3000);
        } else {
            throw new Error('Error pujant la foto');
        }
        
    } catch (error) {
        console.error('Error pujant foto:', error);
        showStatus('Error al desar la foto', 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// UTILITATS
// ============================================

function showLoading(show) {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"><p>Processant...</p></div>';
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('active', show);
}