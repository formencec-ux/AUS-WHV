let state = {
    balance: { AUD: 0, TWD: 0, USD: 0 },
    investments: [],
    workDays: 0,
    workLogs: [],
    transactions: [],
    rates: { AUD_TWD: 21.0, AUD_USD: 0.65, USD_TWD: 32.2 },
    darkMode: false
};

function init() {
    const saved = localStorage.getItem("aus_wh_state");
    if (saved) state = { ...state, ...JSON.parse(saved) };
    
    // 關鍵：初始化時檢查並應用黑暗模式
    if (state.darkMode) {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById("dark-mode-toggle");
        if(btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    updateUI();
    fetchRates();
    setInterval(fetchRates, 600000);
}

function save() { 
    localStorage.setItem("aus_wh_state", JSON.stringify(state)); 
}

function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    const isDark = document.body.classList.toggle('dark-mode');
    const btn = document.getElementById("dark-mode-toggle");
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    save();
}

// 其餘收支與股票功能保持不變...
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

function setType(type) {
    document.getElementById("trans-type").value = type;
    document.querySelectorAll("#type-container .type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.type === type));
}

function setCurrency(currency) {
    document.getElementById("trans-currency").value = currency;
    document.querySelectorAll("#currency-container .type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.currency === currency));
}

function setStockCurr(curr) {
    document.getElementById("stock-curr").value = curr;
    document.querySelectorAll("#stock-currency-container .type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.curr === curr));
}

function updatePreview() {
    const fromCurr = document.getElementById("ex-from").value;
    const toCurr = document.getElementById("ex-to").value;
    const amount = parseFloat(document.getElementById("ex-amount").value);
    const previewEl = document.getElementById("ex-preview");
    if (isNaN(amount) || amount <= 0) { previewEl.innerText = ""; return; }
    if (fromCurr === toCurr) { previewEl.innerText = "來源與目標幣別相同"; return; }
    let rate;
    if (fromCurr === "AUD") rate = state.rates[`AUD_${toCurr}`];
    else if (toCurr === "AUD") rate = 1 / state.rates[`AUD_${fromCurr}`];
    else rate = (1 / state.rates[`AUD_${fromCurr}`]) * state.rates[`AUD_${toCurr}`];
    const result = (amount * rate).toFixed(toCurr === "TWD" ? 0 : 2);
    previewEl.innerText = `預計轉換後：${Number(result).toLocaleString()} ${toCurr}`;
}

function executeExchange() {
    const fromCurr = document.getElementById("ex-from").value;
    const toCurr = document.getElementById("ex-to").value;
    const amount = parseFloat(document.getElementById("ex-amount").value);
    if (isNaN(amount) || amount <= 0 || state.balance[fromCurr] < amount || fromCurr === toCurr) {
        alert("請確認餘額足夠且幣別不同"); return;
    }
    let rate;
    if (fromCurr === "AUD") rate = state.rates[`AUD_${toCurr}`];
    else if (toCurr === "AUD") rate = 1 / state.rates[`AUD_${fromCurr}`];
    else rate = (1 / state.rates[`AUD_${fromCurr}`]) * state.rates[`AUD_${toCurr}`];
    state.balance[fromCurr] -= amount;
    state.balance[toCurr] += amount * rate;
    state.transactions.unshift({ id: Date.now(), type: 'expense', desc: `轉換: ${fromCurr}→${toCurr}`, amount: amount, currency: fromCurr, date: new Date().toLocaleDateString() });
    document.getElementById("ex-amount").value = "";
    document.getElementById("ex-preview").innerText = "";
    save(); updateUI();
}

function addTransaction() {
    const type = document.getElementById("trans-type").value;
    const desc = document.getElementById("trans-desc").value.trim();
    const amount = parseFloat(document.getElementById("trans-amount").value);
    const currency = document.getElementById("trans-currency").value;
    if (!desc || isNaN(amount)) return;
    state.transactions.unshift({ id: Date.now(), type, desc, amount, currency, date: new Date().toLocaleDateString() });
    state.balance[currency] += type === "income" ? amount : -amount;
    document.getElementById("trans-desc").value = "";
    document.getElementById("trans-amount").value = "";
    save(); updateUI();
}

function addInvestment() {
    const name = document.getElementById("stock-name").value.trim();
    const shares = parseFloat(document.getElementById("stock-shares").value);
    const cost = parseFloat(document.getElementById("stock-cost").value);
    const curr = document.getElementById("stock-curr").value;
    if (!name || isNaN(shares) || isNaN(cost)) return;
    state.investments.unshift({ id: Date.now(), name, shares, cost, curr, date: new Date().toLocaleDateString() });
    state.balance[curr] -= cost;
    document.getElementById("stock-name").value = "";
    document.getElementById("stock-shares").value = "";
    document.getElementById("stock-cost").value = "";
    save(); updateUI();
}

function deleteTransaction(id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
        const t = state.transactions[idx];
        state.balance[t.currency] -= t.type === "income" ? t.amount : -t.amount;
        state.transactions.splice(idx, 1);
    } else {
        const invIdx = state.investments.findIndex(i => i.id === id);
        if (invIdx !== -1) {
            const i = state.investments[invIdx];
            state.balance[i.curr] += i.cost;
            state.investments.splice(invIdx, 1);
        }
    }
    save(); updateUI();
}

function toggleStockModal() {
    const modal = document.getElementById("stock-modal");
    modal.style.display = modal.style.display === "block" ? "none" : "block";
    if (modal.style.display === "block") renderStockDetails();
}

function renderStockDetails() {
    const container = document.getElementById("stock-detail-list");
    if (state.investments.length === 0) { container.innerHTML = "<p>尚未有投資</p>"; return; }
    const stats = state.investments.reduce((acc, inv) => {
        if (!acc[inv.name]) acc[inv.name] = { totalShares: 0, totalCost: 0, curr: inv.curr, logs: [] };
        acc[inv.name].totalShares += inv.shares;
        acc[inv.name].totalCost += inv.cost;
        acc[inv.name].logs.push(`${inv.date}: ${inv.shares}股 / $${inv.cost.toFixed(2)}`);
        return acc;
    }, {});
    let html = "";
    for (const name in stats) {
        const s = stats[name];
        html += `<div class="stock-detail-card"><strong>${name} (${s.curr})</strong><br>持有: ${s.totalShares}股 | 均價: ${(s.totalCost/s.totalShares).toFixed(2)}<br><small>${s.logs.join('<br>')}</small></div>`;
    }
    container.innerHTML = html;
}

function addWorkDay() {
    const now = new Date();
    state.workDays++;
    state.workLogs.unshift(`${now.toLocaleDateString()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
    save(); updateUI();
}

function undoWorkDay() {
    if (state.workDays > 0) { state.workDays--; state.workLogs.shift(); save(); updateUI(); }
}

function showWorkLogs() { alert("紀錄:\n" + state.workLogs.join('\n')); }

function exportCSV() {
    let csv = "\ufeff日期,項目,金額,幣別\n";
    state.transactions.forEach(t => csv += `${t.date},${t.desc},${t.amount},${t.currency}\n`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = "澳洲紀錄.csv";
    link.click();
}

function resetAssets() { if (confirm("確定重置嗎？")) { localStorage.clear(); location.reload(); } }

function updateUI() {
    const investSum = state.investments.reduce((acc, inv) => { acc[inv.curr] += inv.cost; return acc; }, { AUD: 0, TWD: 0, USD: 0 });
    const r = state.rates;
    document.getElementById("total-aud").innerText = `$ ${state.balance.AUD.toFixed(2)}`;
    document.getElementById("total-twd").innerText = `$ ${state.balance.TWD.toLocaleString()}`;
    document.getElementById("total-usd").innerText = `$ ${state.balance.USD.toFixed(2)}`;
    document.getElementById("invest-aud").innerText = investSum.AUD.toFixed(2);
    document.getElementById("invest-twd").innerText = investSum.TWD.toLocaleString();
    document.getElementById("invest-usd").innerText = investSum.USD.toFixed(2);
    document.getElementById("exchange-info").innerHTML = `<div class="rate-badge">1 AUD=${r.AUD_TWD.toFixed(2)}TWD</div>`;
    
    const totalInAUD = (state.balance.AUD + investSum.AUD) + ((state.balance.TWD + investSum.TWD) / r.AUD_TWD) + ((state.balance.USD + investSum.USD) / r.AUD_USD);
    const totalInTWD = ((state.balance.AUD + investSum.AUD) * r.AUD_TWD) + (state.balance.TWD + investSum.TWD) + ((state.balance.USD + investSum.USD) * r.USD_TWD);
    const totalInUSD = ((state.balance.AUD + investSum.AUD) * r.AUD_USD) + ((state.balance.TWD + investSum.TWD) / r.USD_TWD) + (state.balance.USD + investSum.USD);
    
    document.getElementById("eval-aud").innerText = `$ ${totalInAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(totalInTWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${totalInUSD.toFixed(2)}`;
    
    const wd = state.workDays;
    document.getElementById("progress-2nd").style.width = `${Math.min(wd/88*100, 100)}%`;
    document.getElementById("days-2nd-text").innerText = `${Math.min(wd, 88)} / 88`;
    document.getElementById("progress-3rd").style.width = `${Math.min(Math.max(0,wd-88)/179*100, 100)}%`;
    document.getElementById("days-3rd-text").innerText = `${Math.max(0, wd - 88)} / 179`;
    
    const list = document.getElementById("transaction-list");
    list.innerHTML = "";
    const combined = [...state.transactions.map(t=>({...t, icon:'wallet', val: t.amount})), ...state.investments.map(i=>({...i, type:'expense', desc:`買入 ${i.name}`, icon:'chart-line', val: i.cost, currency: i.curr}))].sort((a,b)=>b.id-a.id).slice(0,10);
    combined.forEach(t => {
        const li = document.createElement("li"); li.className = "transaction-item";
        li.innerHTML = `<span><i class="fas fa-${t.icon}"></i> ${t.date} ${t.desc}</span><div><span class="${t.type}">${t.type==='income'?'+':'-'}${t.val.toLocaleString()} ${t.currency}</span><i class="fas fa-trash delete-icon" onclick="deleteTransaction(${t.id})"></i></div>`;
        list.appendChild(li);
    });
}
init();
