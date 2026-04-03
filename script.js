let state = {
    accounts: [
        { id: 'default-aud', name: 'AUD 現金', curr: 'AUD', balance: 0 },
        { id: 'default-twd', name: 'TWD 銀行', curr: 'TWD', balance: 0 }
    ],
    investments: [],
    workDays: 0,
    workLogs: [],
    transactions: [],
    rates: { AUD_TWD: 21.0, AUD_USD: 0.65, USD_TWD: 32.2 },
    weeklyHours: 0,
    weeklyWage: 0
};

function init() {
    const saved = localStorage.getItem("aus_wh_state_pro");
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
    }
    
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    document.getElementById("work-wage").value = state.weeklyWage || "";
    
    updateUI();
    fetchRates();
    setInterval(fetchRates, 600000);
}

function save() { 
    localStorage.setItem("aus_wh_state_pro", JSON.stringify(state)); 
}

async function fetchRates() {
    try {
        const res = await fetch("https://open.er-api.com/v6/latest/AUD");
        const data = await res.json();
        if (data.result === "success") {
            state.rates.AUD_TWD = data.rates.TWD;
            state.rates.AUD_USD = data.rates.USD;
            state.rates.USD_TWD = data.rates.TWD / data.rates.USD;
            save(); updateUI();
        }
    } catch (e) { console.log("匯率更新失敗"); }
}

// 單位管理
function toggleAccountModal() {
    const m = document.getElementById("account-modal");
    m.style.display = m.style.display === "block" ? "none" : "block";
    renderAccountManage();
}

function addAccount() {
    const name = document.getElementById("new-acc-name").value.trim();
    const curr = document.getElementById("new-acc-curr").value;
    if(!name) return;
    state.accounts.push({ id: Date.now().toString(), name, curr, balance: 0 });
    document.getElementById("new-acc-name").value = "";
    save(); updateUI(); renderAccountManage();
}

function deleteAccount(id) {
    if(confirm("確定刪除此單位？該單位的餘額將會消失！")) {
        state.accounts = state.accounts.filter(a => a.id !== id);
        save(); updateUI(); renderAccountManage();
    }
}

function renderAccountManage() {
    const list = document.getElementById("account-manage-list");
    list.innerHTML = state.accounts.map(a => `
        <div class="history-edit-item">
            <span>${a.name} (${a.curr})</span>
            <button onclick="deleteAccount('${a.id}')" style="color:red">刪除</button>
        </div>
    `).join('');
}

// 薪資自動累加
function saveSalaryBase() {
    state.weeklyWage = parseFloat(document.getElementById("work-wage").value) || 0;
    save();
}

function appendHours() {
    const input = document.getElementById("work-hours-input");
    const val = parseFloat(input.value) || 0;
    if(val <= 0) return;
    state.weeklyHours = (state.weeklyHours || 0) + val;
    input.value = "";
    save(); updateUI();
}

function resetWeeklySalary() {
    if (confirm("確定要重置所有累計時數嗎？")) {
        state.weeklyHours = 0;
        save(); updateUI();
    }
}

// 收支紀錄
function setType(type) {
    document.querySelectorAll("#type-container .type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.type === type));
}

function addTransaction() {
    const type = document.querySelector("#type-container .active").dataset.type;
    const accId = document.getElementById("trans-account").value;
    const amount = parseFloat(document.getElementById("trans-amount").value);
    const desc = document.getElementById("trans-desc").value.trim();
    const date = document.getElementById("trans-date").value;

    if (!accId || isNaN(amount) || !desc) { alert("請填寫完整資訊"); return; }

    const acc = state.accounts.find(a => a.id === accId);
    state.transactions.unshift({
        id: Date.now(),
        type,
        accId,
        accName: acc.name,
        amount,
        currency: acc.curr,
        desc,
        date: date.replace(/-/g, '/')
    });

    acc.balance += (type === 'income' ? amount : -amount);
    document.getElementById("trans-amount").value = "";
    document.getElementById("trans-desc").value = "";
    save(); updateUI();
}

function updateUI() {
    // 渲染帳戶列表
    const accDisplay = document.getElementById("account-display-list");
    accDisplay.innerHTML = state.accounts.map(a => `
        <div class="currency-row">
            <span class="label">${a.name}</span>
            <span class="value">${a.curr} ${a.balance.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
        </div>
    `).join('');

    // 渲染下拉選單
    const accSelect = document.getElementById("trans-account");
    accSelect.innerHTML = state.accounts.map(a => `<option value="${a.id}">${a.name} (${a.curr})</option>`).join('');

    // 總資產計算
    let totalAUD = 0, totalTWD = 0, totalUSD = 0;
    state.accounts.forEach(a => {
        if(a.curr === 'AUD') totalAUD += a.balance;
        if(a.curr === 'TWD') totalTWD += a.balance;
        if(a.curr === 'USD') totalUSD += a.balance;
    });

    const r = state.rates;
    const finalAUD = totalAUD + (totalTWD / r.AUD_TWD) + (totalUSD / r.AUD_USD);
    const finalTWD = (totalAUD * r.AUD_TWD) + totalTWD + (totalUSD * r.USD_TWD);
    const finalUSD = (totalAUD * r.AUD_USD) + (totalTWD / r.USD_TWD) + totalUSD;

    document.getElementById("eval-aud").innerText = `$ ${finalAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(finalTWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${finalUSD.toFixed(2)}`;

    document.getElementById("exchange-info").innerHTML = `
        <div class="rate-badge">1 AUD=${r.AUD_TWD.toFixed(2)}TWD</div>
        <div class="rate-badge">1 AUD=${r.AUD_USD.toFixed(3)}USD</div>`;

    // 薪資顯示
    document.getElementById("total-hours-display").innerText = (state.weeklyHours || 0).toFixed(1);
    document.getElementById("weekly-salary-display").innerText = ((state.weeklyHours || 0) * (state.weeklyWage || 0)).toFixed(2);

    // 簽證進度
    const wd = state.workDays || 0;
    document.getElementById("progress-2nd").style.width = `${Math.min(wd/88*100, 100)}%`;
    document.getElementById("days-2nd-text").innerText = `${wd} / 88`;

    // 簡版紀錄
    const list = document.getElementById("transaction-list");
    list.innerHTML = state.transactions.slice(0, 5).map(t => `
        <li class="transaction-item">
            <span><small>${t.date}</small> [${t.accName}] ${t.desc}</span>
            <span class="${t.type}">${t.type==='income'?'+':'-'}${t.amount}</span>
        </li>
    `).join('');
}

// 歷史紀錄展開編輯
function toggleHistoryModal() {
    const m = document.getElementById("history-modal");
    m.style.display = m.style.display === "block" ? "none" : "block";
    if(m.style.display === "block") renderHistoryDetails();
}

function renderHistoryDetails() {
    const container = document.getElementById("full-history-list");
    container.innerHTML = state.transactions.map(t => `
        <div class="history-edit-item">
            <div style="flex:1">
                <small>${t.date}</small> <b>${t.desc}</b><br>
                <span class="${t.type}">${t.accName}: ${t.amount} ${t.currency}</span>
            </div>
            <button onclick="editTransaction(${t.id})">修改</button>
            <button onclick="deleteTransaction(${t.id})" style="color:red">刪除</button>
        </div>
    `).join('');
}

function editTransaction(id) {
    const t = state.transactions.find(x => x.id === id);
    const newDesc = prompt("項目名稱:", t.desc);
    const newAmount = parseFloat(prompt("金額:", t.amount));
    if(newDesc && !isNaN(newAmount)) {
        const acc = state.accounts.find(a => a.id === t.accId);
        // 回推舊金額
        acc.balance -= (t.type === 'income' ? t.amount : -t.amount);
        t.desc = newDesc;
        t.amount = newAmount;
        // 套用新金額
        acc.balance += (t.type === 'income' ? t.amount : -t.amount);
        save(); updateUI(); renderHistoryDetails();
    }
}

function deleteTransaction(id) {
    if(confirm("確定刪除？餘額將自動回推。")) {
        const idx = state.transactions.findIndex(x => x.id === id);
        const t = state.transactions[idx];
        const acc = state.accounts.find(a => a.id === t.accId);
        if(acc) acc.balance -= (t.type === 'income' ? t.amount : -t.amount);
        state.transactions.splice(idx, 1);
        save(); updateUI(); renderHistoryDetails();
    }
}

// 打卡
function addWorkDay() {
    state.workDays = (state.workDays || 0) + 1;
    state.workLogs.unshift(new Date().toLocaleString());
    save(); updateUI();
}
function undoWorkDay() { if(state.workDays > 0){ state.workDays--; state.workLogs.shift(); save(); updateUI(); }}
function showWorkLogs() { alert(state.workLogs.join('\n')); }

function resetAssets() {
    if(confirm("確定清空所有資料嗎？")) {
        localStorage.removeItem("aus_wh_state_pro");
        location.reload();
    }
}

init();
