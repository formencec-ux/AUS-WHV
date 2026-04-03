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

function init() {
    const saved = localStorage.getItem("aus_wh_v5");
    if (saved) state = JSON.parse(saved);
    const dateEl = document.getElementById('trans-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById("work-wage").value = state.weeklyWage || "";
    fetchRates();
    updateUI();
}

function save() { localStorage.setItem("aus_wh_v5", JSON.stringify(state)); }

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
    // 渲染資產
    const accList = document.getElementById("account-display-list");
    accList.innerHTML = state.accounts.map(a => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span class="label" style="color:white !important; opacity:0.8;">${a.name}</span>
            <span style="font-size:0.75rem; font-weight:bold; color:white;">${a.curr} ${a.balance.toLocaleString()}</span>
        </div>
    `).join('');

    const accSelect = document.getElementById("trans-account-select");
    accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${a.name} (${a.curr})</option>`).join('');

    // 總資產計算
    const investSum = state.investments.reduce((acc, inv) => { acc[inv.curr] += inv.cost; return acc; }, { AUD: 0, TWD: 0, USD: 0 });
    let cash = { AUD: 0, TWD: 0, USD: 0 };
    state.accounts.forEach(a => cash[a.curr] += a.balance);

    const r = state.rates;
    const totalAUD = (cash.AUD + investSum.AUD) + ((cash.TWD + investSum.TWD) / r.AUD_TWD) + ((cash.USD + investSum.USD) / r.AUD_USD);
    
    document.getElementById("eval-aud").innerText = `$ ${totalAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(totalAUD * r.AUD_TWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${(totalAUD * r.AUD_USD).toFixed(2)}`;

    // 持倉摘要
    document.getElementById("invest-twd").innerText = Math.round(investSum.TWD).toLocaleString();
    document.getElementById("invest-usd").innerText = investSum.USD.toFixed(2);
    document.getElementById("invest-aud").innerText = investSum.AUD.toFixed(2);

    // 簽證與薪資
    document.getElementById("days-2nd-text").innerText = `${state.workDays} / 88`;
    document.getElementById("progress-2nd").style.width = `${Math.min(state.workDays / 88 * 100, 100)}%`;
    document.getElementById("days-3rd-text").innerText = `${state.workDays} / 179`;
    document.getElementById("progress-3rd").style.width = `${Math.min(state.workDays / 179 * 100, 100)}%`;
    
    document.getElementById("total-hours-display").innerText = (state.weeklyHours || 0).toFixed(1);
    document.getElementById("append-count-display").innerText = state.appendCount || 0;
    document.getElementById("weekly-salary-display").innerText = ((state.weeklyHours || 0) * (state.weeklyWage || 0)).toFixed(2);

    // 最近紀錄
    const transList = document.getElementById("transaction-list");
    transList.innerHTML = state.transactions.slice(0, 5).map(t => `
        <div class="transaction-item">
            <span class="custom-text"><b>[${t.accName}]</b> ${t.desc}</span>
            <span class="${t.type}" style="font-size:0.75rem;">${t.type==='income'?'+':'-'}${t.amount.toLocaleString()}</span>
        </div>
    `).join('');
}

function appendHours() {
    const val = parseFloat(document.getElementById("work-hours-today").value) || 0;
    if(val > 0) {
        state.weeklyHours = (state.weeklyHours || 0) + val;
        state.appendCount = (state.appendCount || 0) + 1;
        document.getElementById("work-hours-today").value = "";
        save(); updateUI();
    }
}

function saveSalaryBase() {
    state.weeklyWage = parseFloat(document.getElementById("work-wage").value) || 0;
    save(); updateUI();
}

function resetWeeklySalary() {
    if(confirm("確定重置累計時數與次數？")) {
        state.weeklyHours = 0; state.appendCount = 0; save(); updateUI();
    }
}

function addTransaction() {
    const type = document.getElementById("trans-type").value;
    const amount = parseFloat(document.getElementById("trans-amount").value);
    const desc = document.getElementById("trans-desc").value || "未分類";
    const accId = document.getElementById("trans-account-select").value;
    if(!amount || !accId) return;

    const acc = state.accounts.find(a => a.id === accId);
    acc.balance += (type === 'income' ? amount : -amount);
    state.transactions.unshift({ id: Date.now(), type, amount, desc, accId, accName: acc.name });
    document.getElementById("trans-amount").value = "";
    document.getElementById("trans-desc").value = "";
    save(); updateUI();
}

function addInvestment() {
    const curr = document.getElementById("stock-curr").value;
    const name = document.getElementById("stock-name").value;
    const cost = parseFloat(document.getElementById("stock-cost").value);
    if(!name || !cost) return;
    state.investments.push({ name, curr, cost, shares: document.getElementById("stock-shares").value });
    save(); updateUI();
    alert("投資紀錄成功");
}

function addWorkDay() { state.workDays++; state.workLogs.unshift(new Date().toLocaleString()); save(); updateUI(); }
function undoWorkDay() { if(state.workDays > 0) { state.workDays--; state.workLogs.shift(); save(); updateUI(); } }
function showWorkLogs() { alert(state.workLogs.slice(0,10).join('\n') || "尚無紀錄"); }

function setType(t) { document.getElementById("trans-type").value = t; document.querySelectorAll("#type-container .type-btn").forEach(b => b.classList.toggle("active", b.dataset.type === t)); }
function setStockCurr(c) { document.getElementById("stock-curr").value = c; document.querySelectorAll("#stock-currency-container .type-btn").forEach(b => b.classList.toggle("active", b.dataset.curr === c)); }
function toggleAccountModal() { const m = document.getElementById("account-modal"); m.style.display = m.style.display === "block" ? "none" : "block"; if(m.style.display === "block") renderAccountManage(); }
function addAccountUnit() {
    const name = document.getElementById("new-acc-name").value;
    const curr = document.getElementById("new-acc-curr").value;
    if(name) { state.accounts.push({ id: 'acc-'+Date.now(), name, curr, balance: 0 }); save(); updateUI(); renderAccountManage(); }
}
function renderAccountManage() {
    const list = document.getElementById("account-manage-list");
    list.innerHTML = state.accounts.map(a => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span class="custom-text">${a.name} (${a.curr})</span><button onclick="deleteAcc('${a.id}')" style="color:red; border:none; background:none; cursor:pointer;">刪除</button></div>`).join('');
}
function deleteAcc(id) { state.accounts = state.accounts.filter(a => a.id !== id); save(); updateUI(); renderAccountManage(); }
function toggleHistoryModal() { const m = document.getElementById("history-modal"); m.style.display = m.style.display === "block" ? "none" : "block"; }
function toggleStockModal() { const m = document.getElementById("stock-modal"); m.style.display = m.style.display === "block" ? "none" : "block"; }

init();
