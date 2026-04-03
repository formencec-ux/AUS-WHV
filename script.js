// 初始化狀態：修改點 2 - 引入 accounts 陣列
let state = {
    accounts: [
        { id: 'acc-1', name: '現金', curr: 'AUD', balance: 0 },
        { id: 'acc-2', name: '台灣銀行', curr: 'TWD', balance: 0 }
    ],
    investments: [],
    workDays: 0,
    workLogs: [],
    transactions: [],
    rates: { AUD_TWD: 21.0, AUD_USD: 0.65, USD_TWD: 32.2 },
    weeklyHours: 0, // 修改點 3 - 總時數累加
    weeklyWage: 0
};

function init() {
    // 為了不弄亂你之前的存檔，建議新功能版本用新的 key，或者你會手動重置
    const saved = localStorage.getItem("aus_wh_state_v3");
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
    }
    
    // 預設日期
    const dateEl = document.getElementById('trans-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    
    // 時薪回填
    const wageEl = document.getElementById("work-wage");
    if (wageEl) wageEl.value = state.weeklyWage || "";

    updateUI();
    fetchRates();
    setInterval(fetchRates, 600000);
}

function save() { localStorage.setItem("aus_wh_state_v3", JSON.stringify(state)); }

// 修改點 2：單位管理邏輯
function toggleAccountModal() {
    const m = document.getElementById("account-modal");
    m.style.display = m.style.display === "block" ? "none" : "block";
    if(m.style.display === "block") renderAccountManage();
}

function addAccountUnit() {
    const name = document.getElementById("new-acc-name").value.trim();
    const curr = document.getElementById("new-acc-curr").value;
    if(!name) return;
    state.accounts.push({ id: 'acc-' + Date.now(), name, curr, balance: 0 });
    document.getElementById("new-acc-name").value = "";
    save(); updateUI(); renderAccountManage();
}

function renderAccountManage() {
    const list = document.getElementById("account-manage-list");
    list.innerHTML = state.accounts.map(a => `
        <div class="history-edit-item">
            <span>${a.name} (${a.curr})</span>
            <button onclick="deleteAccountUnit('${a.id}')" style="color:red">刪除</button>
        </div>
    `).join('');
}

function deleteAccountUnit(id) {
    if(confirm("確定刪除？餘額將消失。")) {
        state.accounts = state.accounts.filter(a => a.id !== id);
        save(); updateUI(); renderAccountManage();
    }
}

// 修改點 3：時數累加邏輯
function saveSalaryBase() {
    state.weeklyWage = parseFloat(document.getElementById("work-wage").value) || 0;
    save(); updateUI();
}

function appendHours() {
    const hours = parseFloat(document.getElementById("work-hours-today").value) || 0;
    if(hours <= 0) return;
    state.weeklyHours = (state.weeklyHours || 0) + hours;
    document.getElementById("work-hours-today").value = "";
    save(); updateUI();
}

function resetWeeklySalary() {
    if (confirm("確定重置時數？")) {
        state.weeklyHours = 0;
        save(); updateUI();
    }
}

// 修改點 4：收支紀錄與自定義單位連動
function addTransaction() {
    const type = document.getElementById("trans-type").value;
    const desc = document.getElementById("trans-desc").value.trim();
    const amount = parseFloat(document.getElementById("trans-amount").value);
    const accId = document.getElementById("trans-account-select").value;
    const dateInput = document.getElementById("trans-date").value;
    const dateStr = dateInput ? dateInput.replace(/-/g, '/') : new Date().toLocaleDateString();

    if (!desc || isNaN(amount) || !accId) return;

    const acc = state.accounts.find(a => a.id === accId);
    state.transactions.unshift({ 
        id: Date.now(), type, desc, amount, 
        accId: acc.id, accName: acc.name, currency: acc.curr, date: dateStr 
    });
    
    // 更新該單位餘額
    acc.balance += (type === "income" ? amount : -amount);
    
    document.getElementById("trans-desc").value = "";
    document.getElementById("trans-amount").value = "";
    save(); updateUI();
}

// 修改點 1：最近紀錄編輯 (保留收支屬性)
function editTransaction(id) {
    const t = state.transactions.find(item => item.id === id);
    if(!t) return;

    const newDesc = prompt("修改項目名稱:", t.desc);
    const newAmount = parseFloat(prompt("修改金額:", t.amount));
    const newDate = prompt("修改日期:", t.date);

    if (newDesc !== null && !isNaN(newAmount) && newDate !== null) {
        const acc = state.accounts.find(a => a.id === t.accId);
        // 回推舊餘額
        if(acc) acc.balance -= (t.type === "income" ? t.amount : -t.amount);
        
        t.desc = newDesc;
        t.amount = newAmount;
        t.date = newDate;

        // 加回新餘額
        if(acc) acc.balance += (t.type === "income" ? t.amount : -t.amount);
        
        save(); updateUI(); renderHistoryDetails();
    }
}

// 更新 UI：整合總資產與最近紀錄格式
function updateUI() {
    const r = state.rates;

    // 渲染資產單位清單 (修改點 2)
    const accDisplay = document.getElementById("account-display-list");
    accDisplay.innerHTML = state.accounts.map(a => `
        <div class="currency-row"><span class="label">${a.name}</span><span class="value">${a.curr} ${a.balance.toLocaleString()}</span></div>
    `).join('');

    // 更新單位下拉選單 (修改點 4)
    const accSelect = document.getElementById("trans-account-select");
    accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${a.name} (${a.curr})</option>`).join('');

    // 計算總資產 (包含股票與各單位餘額)
    const investSum = state.investments.reduce((acc, inv) => { acc[inv.curr] += inv.cost; return acc; }, { AUD: 0, TWD: 0, USD: 0 });
    let sumAUD = 0, sumTWD = 0, sumUSD = 0;
    state.accounts.forEach(a => {
        if(a.curr === 'AUD') sumAUD += a.balance;
        else if(a.curr === 'TWD') sumTWD += a.balance;
        else if(a.curr === 'USD') sumUSD += a.balance;
    });

    const totalInAUD = (sumAUD + investSum.AUD) + ((sumTWD + investSum.TWD) / r.AUD_TWD) + ((sumUSD + investSum.USD) / r.AUD_USD);
    const totalInTWD = ((sumAUD + investSum.AUD) * r.AUD_TWD) + (sumTWD + investSum.TWD) + ((sumUSD + investSum.USD) * r.USD_TWD);
    const totalInUSD = ((sumAUD + investSum.AUD) * r.AUD_USD) + ((sumTWD + investSum.TWD) / r.USD_TWD) + (sumUSD + investSum.USD);

    document.getElementById("eval-aud").innerText = `$ ${totalInAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(totalInTWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${totalInUSD.toFixed(2)}`;

    // 簽證與薪資 (修改點 3)
    document.getElementById("total-hours-display").innerText = (state.weeklyHours || 0).toFixed(1);
    document.getElementById("weekly-salary-display").innerText = ((state.weeklyHours || 0) * (state.weeklyWage || 0)).toFixed(2);
    
    const wd = state.workDays || 0;
    document.getElementById("progress-2nd").style.width = `${Math.min(wd/88*100, 100)}%`;
    document.getElementById("days-2nd-text").innerText = `${wd} / 88`;

    // 最近紀錄 (修改點 5：日期 單位 項目 金額)
    const list = document.getElementById("transaction-list");
    list.innerHTML = state.transactions.slice(0, 10).map(t => `
        <li class="transaction-item">
            <span>${t.date} <b>[${t.accName}]</b> ${t.desc}</span>
            <div>
                <span class="${t.type}">${t.type==='income'?'+':'-'}${t.amount.toLocaleString()}</span>
                <i class="fas fa-trash delete-icon" onclick="deleteTransaction(${t.id})"></i>
            </div>
        </li>
    `).join('');
}

// 其餘原本的函數 (fetchRates, setType, deleteTransaction 等) 直接沿用即可
async function fetchRates() { try { const res = await fetch("https://open.er-api.com/v6/latest/AUD"); const data = await res.json(); if (data.result === "success") { state.rates.AUD_TWD = data.rates.TWD; state.rates.AUD_USD = data.rates.USD; state.rates.USD_TWD = data.rates.TWD / data.rates.USD; save(); updateUI(); } } catch (e) {} }
function setType(type) { document.getElementById("trans-type").value = type; document.querySelectorAll("#type-container .type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.type === type)); }
function toggleHistoryModal() { const m = document.getElementById("history-modal"); m.style.display = m.style.display === "block" ? "none" : "block"; if(m.style.display === "block") renderHistoryDetails(); }
function renderHistoryDetails() {
    const container = document.getElementById("full-history-list");
    container.innerHTML = state.transactions.map(t => `
        <div class="history-edit-item">
            <div class="info"><small>${t.date} [${t.accName}]</small><br><b>${t.desc}</b>: <span class="${t.type}">${t.amount}</span></div>
            <div class="actions"><button onclick="editTransaction(${t.id})">修改</button><button onclick="deleteTransaction(${t.id})" style="color:red">刪除</button></div>
        </div>`).join('');
}
function addWorkDay() { state.workDays = (state.workDays || 0) + 1; state.workLogs.unshift(new Date().toLocaleString()); save(); updateUI(); }
function undoWorkDay() { if(state.workDays > 0){ state.workDays--; state.workLogs.shift(); save(); updateUI(); }}
function showWorkLogs() { alert(state.workLogs.join('\n')); }
function resetAssets() { if(confirm("確定重置？")){ localStorage.removeItem("aus_wh_state_v3"); location.reload(); }}

init();
