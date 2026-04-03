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

    // 總資產與持倉計算
    const investSum = state.investments.reduce((acc, inv) => { 
        if(acc.hasOwnProperty(inv.curr)) acc[inv.curr] += inv.cost; 
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

    // 簽證進度邏輯：滿 88 才跑三簽
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
    const shares = document.getElementById("stock-shares").value;
    if(!name || !cost) return;
    state.investments.push({ id: Date.now(), name, curr, cost, shares });
    save(); updateUI();
    alert("投資紀錄成功");
}

function addWorkDay() { state.workDays++; state.workLogs.unshift(new Date().toLocaleString()); save(); updateUI(); }
function undoWorkDay() { if(state.workDays > 0) { state.workDays--; state.workLogs.shift(); save(); updateUI(); } }
function showWorkLogs() { alert(state.workLogs.slice(0,10).join('\n') || "尚無紀錄"); }

// 修正後的切換按鈕邏輯
function setType(t) { 
    document.getElementById("trans-type").value = t; 
    document.querySelectorAll("#type-container .type-btn").forEach(b => b.classList.toggle("active", b.dataset.type === t)); 
}
function setStockCurr(c) { 
    document.getElementById("stock-curr").value = c; 
    document.querySelectorAll("#stock-currency-container .type-btn").forEach(b => b.classList.toggle("active", b.dataset.curr === c)); 
}

function toggleAccountModal() { 
    const m = document.getElementById("account-modal"); 
    m.style.display = m.style.display === "block" ? "none" : "block"; 
    if(m.style.display === "block") renderAccountManage(); 
}
function addAccountUnit() {
    const name = document.getElementById("new-acc-name").value;
    const curr = document.getElementById("new-acc-curr").value;
    if(name) { 
        state.accounts.push({ id: 'acc-'+Date.now(), name, curr, balance: 0 }); 
        document.getElementById("new-acc-name").value = "";
        save(); updateUI(); renderAccountManage(); 
    }
}
function renderAccountManage() {
    const list = document.getElementById("account-manage-list");
    list.innerHTML = state.accounts.map(a => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span class="custom-text">${a.name} (${a.curr})</span><button onclick="deleteAcc('${a.id}')" style="color:red; border:none; background:none; cursor:pointer;">刪除</button></div>`).join('');
}
function deleteAcc(id) { 
    if(confirm("刪除帳戶會導致該帳戶餘額消失，確定嗎？")) {
        state.accounts = state.accounts.filter(a => a.id !== id); 
        save(); updateUI(); renderAccountManage(); 
    }
}

function toggleStockModal() { 
    const m = document.getElementById("stock-modal"); 
    m.style.display = m.style.display === "block" ? "none" : "block"; 
    if(m.style.display === "block") {
        const list = document.getElementById("stock-detail-list");
        list.innerHTML = state.investments.length ? state.investments.map((inv, idx) => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;">
                <span class="custom-text">${inv.name} (${inv.curr})</span>
                <div>
                    <span class="custom-text">${inv.cost.toLocaleString()}</span>
                    <button onclick="deleteStock(${inv.id})" style="color:red; border:none; background:none; margin-left:10px;">刪</button>
                </div>
            </div>
        `).join('') : '<p class="custom-text">尚無持倉</p>';
    }
}
function deleteStock(id) {
    state.investments = state.investments.filter(inv => inv.id !== id);
    save(); updateUI(); toggleStockModal(); toggleStockModal(); // 刷新
}

function toggleHistoryModal() { 
    const m = document.getElementById("history-modal"); 
    m.style.display = m.style.display === "block" ? "none" : "block"; 
    if(m.style.display === "block") renderFullHistory();
}
function renderFullHistory() {
    const list = document.getElementById("full-history-list");
    list.innerHTML = state.transactions.map((t, idx) => `
        <div class="transaction-item">
            <span class="custom-text"><b>[${t.accName}]</b> ${t.desc}</span>
            <div>
                <span class="${t.type}">${t.type==='income'?'+':'-'}${t.amount.toLocaleString()}</span>
                <button onclick="deleteTransaction(${idx})" style="color:red; border:none; background:none; margin-left:10px;">刪除</button>
            </div>
        </div>
    `).join('');
}
function deleteTransaction(idx) {
    if(confirm("確定刪除此紀錄？(注意：不會補回帳戶餘額)")) {
        state.transactions.splice(idx, 1);
        save(); updateUI(); renderFullHistory();
    }
}

init();
