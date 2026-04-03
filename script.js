// 初始化資料結構
let state = {
    // 修改點 2：將 balance 改為 accounts 陣列，支援多單位
    accounts: [
        { id: 'default-aud', name: '現金 (AUD)', curr: 'AUD', balance: 0 },
        { id: 'default-twd', name: '銀行 (TWD)', curr: 'TWD', balance: 0 }
    ],
    investments: [],
    workDays: 0,
    workLogs: [],
    transactions: [],
    rates: { AUD_TWD: 21.0, AUD_USD: 0.65, USD_TWD: 32.2 },
    weeklyHours: 0, // 修改點 3：累計時數
    weeklyWage: 0
};

function init() {
    const saved = localStorage.getItem("aus_wh_state_v2"); // 使用新版本 Key 避免資料衝突
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
    }
    
    // 初始化 UI 元件預設值
    const dateEl = document.getElementById('trans-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const wageEl = document.getElementById("work-wage");
    if (wageEl) wageEl.value = state.weeklyWage || "";

    updateUI();
    fetchRates();
    setInterval(fetchRates, 600000);
}

function save() { 
    localStorage.setItem("aus_wh_state_v2", JSON.stringify(state)); 
}

// ------------------- 修改點 2：自定義單位功能 -------------------
function toggleAccountModal() {
    const m = document.getElementById("account-modal");
    m.style.display = m.style.display === "block" ? "none" : "block";
    renderAccountManage();
}

function addAccountUnit() {
    const name = document.getElementById("new-acc-name").value.trim();
    const curr = document.getElementById("new-acc-curr").value;
    if(!name) return;
    state.accounts.push({
        id: 'acc-' + Date.now(),
        name: name,
        curr: curr,
        balance: 0
    });
    document.getElementById("new-acc-name").value = "";
    save(); updateUI(); renderAccountManage();
}

function deleteAccountUnit(id) {
    if(confirm("確定刪除此單位？該單位的餘額將一併移除且無法恢復！")) {
        state.accounts = state.accounts.filter(a => a.id !== id);
        save(); updateUI(); renderAccountManage();
    }
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

// ------------------- 修改點 3：薪資時數累加邏輯 -------------------
function saveSalaryBase() {
    state.weeklyWage = parseFloat(document.getElementById("work-wage").value) || 0;
    save(); updateUI();
}

function appendHours() {
    const todayHours = parseFloat(document.getElementById("work-hours-today").value) || 0;
    if(todayHours <= 0) return;
    state.weeklyHours = (state.weeklyHours || 0) + todayHours;
    document.getElementById("work-hours-today").value = ""; // 清空輸入框
    save(); updateUI();
}

function resetWeeklySalary() {
    if (confirm("確定要重置累計時數與時薪嗎？")) {
        state.weeklyHours = 0;
        state.weeklyWage = 0;
        document.getElementById("work-wage").value = "";
        save(); updateUI();
    }
}

// ------------------- 修改點 4：收支紀錄與單位連動 -------------------
function addTransaction() {
    const type = document.getElementById("trans-type").value;
    const desc = document.getElementById("trans-desc").value.trim();
    const amount = parseFloat(document.getElementById("trans-amount").value);
    const accId = document.getElementById("trans-account-select").value;
    const dateInput = document.getElementById("trans-date").value;
    
    if (!desc || isNaN(amount) || !accId) return;

    const acc = state.accounts.find(a => a.id === accId);
    state.transactions.unshift({
        id: Date.now(),
        type,
        desc,
        amount,
        accId: acc.id,
        accName: acc.name, // 修改點 5：儲存單位名稱用於顯示
        currency: acc.curr,
        date: dateInput ? dateInput.replace(/-/g, '/') : new Date().toLocaleDateString()
    });

    // 自動加減對應單位的餘額
    acc.balance += (type === "income" ? amount : -amount);

    document.getElementById("trans-desc").value = "";
    document.getElementById("trans-amount").value = "";
    save(); updateUI();
}

// ------------------- 修改點 1：最近紀錄編輯功能 -------------------
function editTransaction(id) {
    const t = state.transactions.find(item => item.id === id);
    if(!t) return;

    const newDesc = prompt("修改項目名稱:", t.desc);
    const newAmount = parseFloat(prompt("修改金額:", t.amount));
    const newDate = prompt("修改日期 (YYYY/MM/DD):", t.date);

    if (newDesc !== null && !isNaN(newAmount) && newDate !== null) {
        // 先回推舊金額
        const acc = state.accounts.find(a => a.id === t.accId);
        if(acc) acc.balance -= (t.type === "income" ? t.amount : -t.amount);

        // 更新資料
        t.desc = newDesc;
        t.amount = newAmount;
        t.date = newDate;

        // 套用新金額
        if(acc) acc.balance += (t.type === "income" ? t.amount : -t.amount);
        
        save(); updateUI(); renderHistoryDetails();
    }
}

// ------------------- 更新 UI 核心邏輯 -------------------
function updateUI() {
    // 渲染資產單位列表
    const accDisplay = document.getElementById("account-display-list");
    accDisplay.innerHTML = state.accounts.map(a => `
        <div class="currency-row">
            <span class="label">${a.name}</span>
            <span class="value">${a.curr} ${a.balance.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
        </div>
    `).join('');

    // 渲染下拉選單
    const accSelect = document.getElementById("trans-account-select");
    accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${a.name} (${a.curr})</option>`).join('');

    // 計算總資產估算 (加總所有單位的 balance)
    const r = state.rates;
    let sumAUD = 0, sumTWD = 0, sumUSD = 0;
    state.accounts.forEach(a => {
        if(a.curr === 'AUD') sumAUD += a.balance;
        else if(a.curr === 'TWD') sumTWD += a.balance;
        else if(a.curr === 'USD') sumUSD += a.balance;
    });

    const totalInAUD = sumAUD + (sumTWD / r.AUD_TWD) + (sumUSD / r.AUD_USD);
    const totalInTWD = (sumAUD * r.AUD_TWD) + sumTWD + (sumUSD * r.USD_TWD);
    const totalInUSD = (sumAUD * r.AUD_USD) + (sumTWD / r.USD_TWD) + sumUSD;

    document.getElementById("eval-aud").innerText = `$ ${totalInAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(totalInTWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${totalInUSD.toFixed(2)}`;

    // 薪資與簽證 UI
    document.getElementById("total-hours-text").innerText = (state.weeklyHours || 0).toFixed(1);
    document.getElementById("weekly-salary-display").innerText = ((state.weeklyHours || 0) * (state.weeklyWage || 0)).toFixed(2);
    
    const wd = state.workDays || 0;
    document.getElementById("progress-2nd").style.width = `${Math.min(wd/88*100, 100)}%`;
    document.getElementById("days-2nd-text").innerText = `${Math.min(wd, 88)} / 88`;

    // ------------------- 修改點 5：最近紀錄顯示格式 -------------------
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

// 其餘功能 (fetchRates, setType, deleteTransaction, renderHistoryDetails 等) 保留原本邏輯並調整對應 account 資料即可...
// (此處篇幅考量簡略，邏輯與上述 editTransaction 同理，需操作 state.accounts)

async function fetchRates() { /* 同原本 */ }
function setType(type) { /* 同原本 */ }
function toggleHistoryModal() { /* 同原本 */ }
function renderHistoryDetails() {
    const container = document.getElementById("full-history-list");
    container.innerHTML = state.transactions.map(t => `
        <div class="history-edit-item">
            <div class="info">
                <small>${t.date} [${t.accName}]</small><br>
                <b>${t.desc}</b>: <span class="${t.type}">${t.type==='income'?'+':'-'}${t.amount}</span>
            </div>
            <div class="actions">
                <button onclick="editTransaction(${t.id})">修改</button>
                <button onclick="deleteTransaction(${t.id})" style="color:red">刪除</button>
            </div>
        </div>
    `).join('');
}

function deleteTransaction(id) {
    if (confirm("確定刪除？餘額將回推。")) {
        const idx = state.transactions.findIndex(t => t.id === id);
        if (idx !== -1) {
            const t = state.transactions[idx];
            const acc = state.accounts.find(a => a.id === t.accId);
            if(acc) acc.balance -= (t.type === "income" ? t.amount : -t.amount);
            state.transactions.splice(idx, 1);
            save(); updateUI(); if(document.getElementById("history-modal").style.display === "block") renderHistoryDetails();
        }
    }
}

init();
