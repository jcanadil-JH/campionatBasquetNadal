// ID de Google Sheets
const SHEET_ID = '1gTU3SjgvWw89CPRR9VzveiB5rqh9ZNzuGgR0ryk19F0';  //ID full de càlcul
const rangTaula1Classificacio="A2:J6"; //rang que conté el primer bloc d'informació de la pestanya Classificació
const rangTaula2Classificacio="A8:H16"; //rang que conté el segon bloc d'informació de la pestanya Classificació
const rangTaulaDistribucioPerEquips="A1:U22"; //rang que conté les dades de la pestanya Distribució per equips

// Variable per emmagatzemar dades de partits
let partitsData = null;
let currentTab = 'classificacio';
let selectedPartitIndex = ''; // Emmagatzemar la selecció del desplegable

// Funcions d'utilitat
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
}

function hideStatus() {
    document.getElementById('status').style.display = 'none';
}

function updateLastUpdate() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ca-ES');
    const dateString = now.toLocaleDateString('ca-ES');
    document.getElementById('lastUpdate').textContent = `Última actualització: ${dateString} a les ${timeString}`;
}

// Gestió de pestanyes
function showTab(tabName) {
    currentTab = tabName;
    
    // Amagar tots els continguts
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    // Desactivar tots els botons
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => button.classList.remove('active'));
    
    // Activar la pestanya seleccionada
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Carregar dades si encara no s'han carregat
    if (tabName === 'classificacio') {
        loadClassificacio();
    } else if (tabName === 'pistes') {
        loadPistes();
    } else if (tabName === 'partits') {
        // Només carregar si no hi ha dades carregades
        if (!partitsData) {
            loadPartits();
        } else {
            // Restaurar la selecció del desplegable i aplicar el filtre
            document.getElementById('partitSelect').value = selectedPartitIndex;
            if (selectedPartitIndex !== '') {
                filterPartit();
            }
        }
    }
}

function refreshCurrentTab() {
    if (currentTab === 'classificacio') {
        loadClassificacio();
    } else if (currentTab === 'pistes') {
        loadPistes();
    } else if (currentTab === 'partits') {
        loadPartits();
    }
}

// Funció per mostrar una taula
function displayTable(data, theadId, tbodyId, hideColumns = []) {
    const thead = document.getElementById(theadId);
    const tbody = document.getElementById(tbodyId);

    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (!data.table || !data.table.rows || data.table.rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px; color: #6c757d;">No hi ha dades disponibles</td></tr>';
        return;
    }

    // Crear capçalera
    const headerRow = document.createElement('tr');
    const cols = data.table.cols;
    cols.forEach((col, index) => {
        if (!hideColumns.includes(index)) {
            const th = document.createElement('th');
            th.textContent = col.label || '';
            headerRow.appendChild(th);
        }
    });
    thead.appendChild(headerRow);

    // Crear files
    data.table.rows.forEach(row => {
        const tr = document.createElement('tr');
        row.c.forEach((cell, index) => {
            if (!hideColumns.includes(index)) {
                const td = document.createElement('td');
                td.textContent = cell ? (cell.f || cell.v || '') : '';
                tr.appendChild(td);
            }
        });
        tbody.appendChild(tr);
    });
}

// Carregar Classificació
async function loadClassificacio() {
    showStatus('Carregant classificació...', 'loading');

    try {
        // Carregar primera taula (A2:J6)
        const url1 = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Classificació&range=${rangTaula1Classificacio}&headers=1`;
        const response1 = await fetch(url1);
        const text1 = await response1.text();
        const jsonText1 = text1.substring(47).slice(0, -2);
        const data1 = JSON.parse(jsonText1);
        
        // Carregar segona taula (A7:H fins al final)
        const url2 = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Classificació&range=${rangTaula2Classificacio}&headers=1`;
        const response2 = await fetch(url2);
        const text2 = await response2.text();
        const jsonText2 = text2.substring(47).slice(0, -2);
        const data2 = JSON.parse(jsonText2);
        
        displayTable(data1, 'tableHead1', 'tableBody1', [3, 4]); // Ocultar columnes 5 i 6 (índex 4 i 5)
        displayTable(data2, 'tableHead2', 'tableBody2');
        updateLastUpdate();
        showStatus('Classificació actualitzada!', 'success');
        setTimeout(hideStatus, 3000);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al carregar la classificació', 'error');
    }
}

// Carregar Pistes
async function loadPistes() {
    showStatus('Carregant pistes...', 'loading');

    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Pistes&range=A2:D&headers=1`;
        const response = await fetch(url);
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonText);
        
        displayTable(data, 'tableHeadPistes', 'tableBodyPistes');
        
        // Carregar la imatge des de la carpeta actius
        const imageContainer = document.getElementById('pistesImage');
        imageContainer.innerHTML = '<img src="actius/pistes.png" alt="Pistes">';
        
        updateLastUpdate();
        showStatus('Pistes actualitzades!', 'success');
        setTimeout(hideStatus, 3000);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al carregar les pistes', 'error');
    }
}

// Carregar Distribució per Equips
async function loadPartits() {
    showStatus('Carregant distribució per partits...', 'loading');

    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Distribució per partits&range=${rangTaulaDistribucioPerEquips}&headers=1`;
        const response = await fetch(url);
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonText);
        console.log('Dades carregades:', data.table.rows);
        partitsData = data;
        
        // Omplir el desplegable amb els partits (columna A)
        const select = document.getElementById('partitSelect');
        select.innerHTML = '<option value="">-- Tots els equips --</option>';
        
        if (data.table && data.table.rows) {
            data.table.rows.forEach((row, index) => {
                if (row.c[0]) {
                    const partitName = row.c[0].f || row.c[0].v || '';
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = partitName;
                    select.appendChild(option);
                }
            });
        }
        
        // Mostrar totes les dades inicialment o restaurar filtre
        if (selectedPartitIndex === '') {
            displayTable(data, 'tableHeadPartits', 'tableBodyPartits');
        } else {
            filterPartit(); // Aplicar el filtre guardat
        }
        
        updateLastUpdate();
        showStatus('Distribució per partits actualitzada!', 'success');
        setTimeout(hideStatus, 3000);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al carregar la distribució per partits', 'error');
    }
}

// Filtrar per partit (amb transposició)
function filterPartit() {
    const select = document.getElementById('partitSelect');
    selectedPartitIndex = select.value; // Guardar la selecció
    
    if (!partitsData) return;
    
    const thead = document.getElementById('tableHeadPartits');
    const tbody = document.getElementById('tableBodyPartits');
    
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    if (selectedPartitIndex === '') {
        // Mostrar tots els equips (sense transposar)
        displayTable(partitsData, 'tableHeadPartits', 'tableBodyPartits');
    } else {
        // Mostrar només el partit seleccionat TRANSPOSAT
        const selectedRow = partitsData.table.rows[parseInt(selectedPartitIndex)];
        
        // Crear capçalera amb dues columnes: "Camp" i "Valor"
        const headerRow = document.createElement('tr');
        const th1 = document.createElement('th');
        th1.textContent = 'Hora';
        const th2 = document.createElement('th');
        th2.textContent = 'Pista i equip contrari';
        headerRow.appendChild(th1);
        headerRow.appendChild(th2);
        thead.appendChild(headerRow);
        
        // Crear una fila per cada columna del partit original
        partitsData.table.cols.forEach((col, index) => {
            if (index === 0) return;
            
            const tr = document.createElement('tr');
            
            // Primera columna: nom del camp (capçalera original)
            const td1 = document.createElement('td');
            td1.textContent = col.label || '';
            td1.style.fontWeight = '600';
            td1.style.background = '#f8f9fa';
            tr.appendChild(td1);
            
            // Segona columna: valor del camp
            const td2 = document.createElement('td');
            const cell = selectedRow.c[index];
            td2.textContent = cell ? (cell.f || cell.v || '') : '';
            tr.appendChild(td2);
            
            tbody.appendChild(tr);
        });
    }
}

// Carregar automàticament quan es carrega la pàgina
window.addEventListener('load', () => {
    loadClassificacio();
});








