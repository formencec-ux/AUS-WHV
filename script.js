let state = {
    accounts: [
        { id: 'acc-1', name: '現金', curr: 'AUD', balance: 0 },
        { id: 'acc-2', name: '台灣帳戶', curr: 'TWD', balance: 0 }
    ],
    investments: [],
    workDays: 0,
    workLogs: [],
    transactions: [],
    rates: { AUD_TWD: 21.0, AUD_USD: 0.65, USD_TWD: 32.2 },
    weeklyHours: 0,
    appendCount: 0,
    weeklyWage: 0
};

const DEFAULT_STATE = JSON.parse(JSON.stringify(state));

function init() {
    const saved = localStorage.getItem("aus_wh_final_v1");
    if (saved) state = JSON.parse(saved);
    const dateEl = document.getElementById('trans-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById("work-wage").value = state.weeklyWage || "";
    fetchRates();
    updateUI();
}

function save() { localStorage.setItem("aus_wh_final_v1", JSON.stringify(state)); }

async function fetchRates() {
    try {
        const res = await fetch("https://open.er-api.com/v6/latest/AUD");
        const data = await res.json();
        if (data.result === "success") {
            state.rates.AUD_TWD = data.rates.TWD;
            state.rates.AUD_USD = data.rates.USD;
            state.rates.USD_TWD = data.rates.TWD / data.rates.USD;
            updateUI();
        }
    } catch (e) { console.log("Rates Update Failed"); }
}

function updateUI() {
    // 渲染資產清單
    const accList = document.getElementById("account-display-list");
    accList.innerHTML = state.accounts.map(a => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span class="custom-text" style="color:rgba(255,255,255,0.8) !important;">${a.name}</span>
            <span style="font-size:0.75rem; font-weight:bold; color:white;">${a.curr} ${a.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
    `).join('');

    const accSelect = document.getElementById("trans-account-select");
    accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${a.name} (${a.curr})</option>`).join('');

    // 計算投資摘要
    const investSum = state.investments.reduce((acc, inv) => { 
        if(acc.hasOwnProperty(inv.curr)) acc[inv.curr] += parseFloat(inv.cost); 
        return acc; 
    }, { AUD: 0, TWD: 0, USD: 0 });

    let cash = { AUD: 0, TWD: 0, USD: 0 };
    state.accounts.forEach(a => cash[a.curr] += a.balance);

    const r = state.rates;
    const totalAUD = (cash.AUD + investSum.AUD) + ((cash.TWD + investSum.TWD) / r.AUD_TWD) + ((cash.USD + investSum.USD) / r.AUD_USD);
    
    document.getElementById("eval-aud").innerText = `$ ${totalAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(totalAUD * r.AUD_TWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${(totalAUD * r.AUD_USD).toFixed(2)}`;

    document.getElementById("invest-twd").innerText = Math.round(investSum.TWD).toLocaleString();
    document.getElementById("invest-usd").innerText = investSum.USD.toFixed(2);
    document.getElementById("invest-aud").innerText = investSum.AUD.toFixed(2);

    // 簽證進度
    const secondDays = Math.min(state.workDays, 88);
    const thirdDays = state.workDays > 88 ? Math.min(state.workDays - 88, 179) : 0;
    document.getElementById("days-2nd-text").innerText = `${secondDays} / 88`;
    document.getElementById("progress-2nd").style.width = `${(secondDays / 88 * 100)}%`;
    document.getElementById("days-3rd-text").innerText = `${thirdDays} / 179`;
    document.getElementById("progress-3rd").style.width = `${(thirdDays / 179 * 100)}%`;
    
    document.getElementById("total-hours-display").innerText = (state.weeklyHours || 0).toFixed(1);
    document.getElementById("append-count-display").innerText = state.appendCount || 0;
    document.getElementById("weekly-salary-display").innerText = ((state.weeklyHours || 0) * (state.weeklyWage || 0)).toFixed(2);

    // 最近紀錄
    const transList = document.getElementById("transaction-list");
    transList.innerHTML = state.transactions.slice(0, 5).map(t => `
        <div class="transaction-item">
            <span class="custom-text"><b>[${t.accName}]</b> ${t.desc}</span>
            <span class="${t.type}" style="font-size:0.75rem;">${t.type==='income'?'+':'-'}${t.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
    `).join('');
}

// 重置邏輯 (雙重警告)
function doubleConfirmReset(type) {
    if (confirm("你確定要重置嗎？")) {
        if (confirm("資料即將全部刪除")) {
            if (type === 'all') {
                state = JSON.parse(JSON.stringify(DEFAULT_STATE));
                localStorage.removeItem("aus_wh_final_v1");
            } else if (type === 'investments') {
                state.investments = [];
            } else if (type === 'transactions') {
                state.transactions = [];
            }
            save(); updateUI();
            alert("重置成功");
        }
    }
}

// 收支操作
function addTransaction() {
    const type = document.getElementById("trans-type").value;
    const amount = parseFloat(document.getElementById("trans-amount").value);
    const desc = document.getElementById("trans-desc").value || "未分類";
    const date = document.getElementById("trans-date").value;
    const accId = document.getElementById("trans-account-select").value;
    if(!amount || !accId) return;

    const acc = state.accounts.find(a => a.id === accId);
    acc.balance += (type === 'income' ? amount : -amount);
    state.transactions.unshift({ id: Date.now(), type, amount, desc, date, accId, accName: acc.name });
    
    document.getElementById("trans-amount").value = "";
    document.getElementById("trans-desc").value = "";
    save(); updateUI();
}

// 交易編輯與刪除 (包含餘額回補)
function openEditTrans(idx) {
    const t = state.transactions[idx];
    document.getElementById("edit-t-idx").value = idx;
    document.getElementById("edit-t-date").value = t.date || "";
    document.getElementById("edit-t-desc").value = t.desc;
    document.getElementById("edit-t-amount").value = t.amount;
    toggleModal('edit-trans-modal');
}

function updateTransaction() {
    const idx = document.getElementById("edit-t-idx").value;
    const t = state.transactions[idx];
    const acc = state.accounts.find(a => a.id === t.accId);
    const newAmount = parseFloat(document.getElementById("edit-t-amount").value);

    if (acc) {
        // 先撤銷舊金額，再加上新金額
        acc.balance += (t.type === 'income' ? -t.amount : t.amount);
        acc.balance += (t.type === 'income' ? newAmount : -newAmount);
    }

    t.date = document.getElementById("edit-t-date").value;
    t.desc = document.getElementById("edit-t-desc").value;
    t.amount = newAmount;

    save(); updateUI();
    toggleModal('edit-trans-modal');
    renderFullHistory();
}

function deleteTransaction(idx) {
    if(confirm("確定刪除？帳戶餘額將會自動補回。")) {
        const t = state.transactions[idx];
        const acc = state.accounts.find(a => a.id === t.accId);
        if (acc) acc.balance += (t.type === 'income' ? -t.amount : t.amount);
        state.transactions.splice(idx, 1);
        save(); updateUI(); renderFullHistory();
    }
}

// 投資操作
function addInvestment() {
    const curr = document.getElementById("stock-curr").value;
    const name = document.getElementById("stock-name").value;
    const cost = parseFloat(document.getElementById("stock-cost").value);
    const shares = parseFloat(document.getElementById("stock-shares").value) || 0;
    if(!name || !cost) return;

    const existing = state.investments.find(inv => inv.name === name && inv.curr === curr);
    if (existing) {
        existing.cost += cost;
        existing.shares += shares;
    } else {
        state.investments.push({ id: Date.now(), name, curr, cost, shares });
    }
    
    document.getElementById("stock-name").value = "";
    document.getElementById("stock-cost").value = "";
    document.getElementById("stock-shares").value = "";
    save(); updateUI(); alert("投資紀錄成功");
}

function openEditStock(id) {
    const inv = state.investments.find(i => i.id === id);
    if(!inv) return;
    document.getElementById("edit-stock-id").value = inv.id;
    document.getElementById("edit-stock-name").value = inv.name;
    document.getElementById("edit-stock-shares").value = inv.shares;
    document.getElementById("edit-stock-cost").value = inv.cost;
    toggleModal('edit-stock-modal');
}

function updateStock() {
    const id = parseInt(document.getElementById("edit-stock-id").value);
    const inv = state.investments.find(i => i.id === id);
    if(inv) {
        inv.name = document.getElementById("edit-stock-name").value;
        inv.shares = parseFloat(document.getElementById("edit-stock-shares").value);
        inv.cost = parseFloat(document.getElementById("edit-stock-cost").value);
        save(); updateUI(); toggleModal('edit-stock-modal'); renderStockManage();
    }
}

// 單位/帳戶管理
function addAccountUnit() {
    const name = document.getElementById("new-acc-name").value;
    const curr = document.getElementById("new-acc-curr").value;
    if(name) { 
        state.accounts.push({ id: 'acc-'+Date.now(), name, curr, balance: 0 }); 
        document.getElementById("new-acc-name").value = "";
        save(); updateUI(); renderAccountManage(); 
    }
}

function openEditAcc(id) {
    const acc = state.accounts.find(a => a.id === id);
    document.getElementById("edit-acc-id").value = id;
    document.getElementById("edit-acc-name").value = acc.name;
    toggleModal('edit-acc-modal');
}

function updateAccountName() {
    const id = document.getElementById("edit-acc-id").value;
    const newName = document.getElementById("edit-acc-name").value;
    const acc = state.accounts.find(a => a.id === id);
    if(acc && newName) {
        acc.name = newName;
        state.transactions.forEach(t => { if(t.accId === id) t.accName = newName; });
        save(); updateUI(); toggleModal('edit-acc-modal'); renderAccountManage();
    }
}

// 渲染 Modal 清單
function renderAccountManage() {
    const list = document.getElementById("account-manage-list");
    list.innerHTML = state.accounts.map(a => `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
            <span class="custom-text">${a.name} (${a.curr})</span>
            <div>
                <button onclick="openEditAcc('${a.id}')" style="color:blue; border:none; background:none;">更名</button>
                <button onclick="deleteAcc('${a.id}')" style="color:red; border:none; background:none; margin-left:10px;">刪除</button>
            </div>
        </div>
    `).join('');
}

function renderStockManage() {
    const list = document.getElementById("stock-detail-list");
    list.innerHTML = state.investments.map(inv => `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #eee;">
            <div><b class="custom-text">${inv.name}</b><br><small class="custom-text">股數: ${inv.shares}</small></div>
            <div style="text-align:right;">
                <span class="custom-text">${inv.cost.toLocaleString()}</span><br>
                <button onclick="openEditStock(${inv.id})" style="color:blue; border:none; background:none;">修</button>
                <button onclick="deleteStock(${inv.id})" style="color:red; border:none; background:none; margin-left:5px;">刪</button>
            </div>
        </div>
    `).join('');
}

function renderFullHistory() {
    const list = document.getElementById("full-history-list");
    list.innerHTML = state.transactions.map((t, idx) => `
        <div class="transaction-item">
            <div style="flex:2;">
                <small class="custom-text">${t.date || ''}</small><br>
                <span class="custom-text"><b>[${t.accName}]</b> ${t.desc}</span>
            </div>
            <div style="flex:1; text-align:right;">
                <span class="${t.type}">${t.type==='income'?'+':'-'}${t.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span><br>
                <button onclick="openEditTrans(${idx})" style="color:blue; border:none; background:none; font-size:0.7rem;">編</button>
                <button onclick="deleteTransaction(${idx})" style="color:red; border:none; background:none; font-size:0.7rem; margin-left:5px;">刪</button>
            </div>
        </div>
    `).join('');
}

// 其他輔助
function appendHours() {
    const val = parseFloat(document.getElementById("work-hours-today").value) || 0;
    if(val > 0) {
        state.weeklyHours = (state.weeklyHours || 0) + val;
        state.appendCount = (state.appendCount || 0) + 1;
        document.getElementById("work-hours-today").value = "";
        save(); updateUI();
    }
}
function saveSalaryBase() { state.weeklyWage = parseFloat(document.getElementById("work-wage").value) || 0; save(); updateUI(); }
function resetWeeklySalary() { if(confirm("重置累計？")) { state.weeklyHours = 0; state.appendCount = 0; save(); updateUI(); } }
function addWorkDay() { state.workDays++; state.workLogs.unshift(new Date().toLocaleString()); save(); updateUI(); }
function undoWorkDay() { if(state.workDays > 0) { state.workDays--; state.workLogs.shift(); save(); updateUI(); } }
function showWorkLogs() { alert(state.workLogs.slice(0,10).join('\n') || "無紀錄"); }
function setType(t) { 
    document.getElementById("trans-type").value = t; 
    document.querySelectorAll("#type-container .type-btn").forEach(b => b.classList.toggle("active", b.dataset.type === t)); 
}
function setStockCurr(c) { 
    document.getElementById("stock-curr").value = c; 
    document.querySelectorAll("#stock-currency-container .type-btn").forEach(b => b.classList.toggle("active", b.dataset.curr === c)); 
}
function toggleModal(id) { 
    const m = document.getElementById(id); 
    m.style.display = m.style.display === "block" ? "none" : "block"; 
    if(m.style.display === "block") {
        if(id === 'account-modal') renderAccountManage();
        if(id === 'stock-modal') renderStockManage();
        if(id === 'history-modal') renderFullHistory();
    }
}
function deleteAcc(id) { if(confirm("刪除帳戶？")) { state.accounts = state.accounts.filter(a => a.id !== id); save(); updateUI(); renderAccountManage(); } }
function deleteStock(id) { if(confirm("刪除投資？")) { state.investments = state.investments.filter(inv => inv.id !== id); save(); updateUI(); renderStockManage(); } }

init();
