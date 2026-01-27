let state = {
    balance: { AUD: 0, TWD: 0, USD: 0 },
    investments: [],
    workDays: 0,
    rates: { AUD_TWD: 21.75, AUD_USD: 0.692, USD_TWD: 31.45 },
    transactions: []
};

function init() {
    const saved = localStorage.getItem("aus_wh_state");
    if (saved) state = JSON.parse(saved);
    updateUI();
}

function updateUI() {
    // 更新餘額
    document.getElementById("total-aud").innerText = `$ ${state.balance.AUD.toFixed(2)}`;
    document.getElementById("total-twd").innerText = `$ ${state.balance.TWD.toLocaleString()}`;
    document.getElementById("total-usd").innerText = `$ ${state.balance.USD.toFixed(2)}`;

    // 更新投資
    const investSum = state.investments.reduce((acc, inv) => {
        acc[inv.curr] += inv.cost;
        return acc;
    }, { AUD: 0, TWD: 0, USD: 0 });
    document.getElementById("invest-aud").innerText = investSum.AUD.toFixed(2);
    document.getElementById("invest-twd").innerText = investSum.TWD.toLocaleString();
    document.getElementById("invest-usd").innerText = investSum.USD.toFixed(2);

    // 更新總資產評估
    const r = state.rates;
    const totalInAUD = state.balance.AUD + investSum.AUD + (state.balance.TWD + investSum.TWD) / r.AUD_TWD + (state.balance.USD + investSum.USD) / r.AUD_USD;
    const totalInTWD = (state.balance.AUD + investSum.AUD) * r.AUD_TWD + (state.balance.TWD + investSum.TWD) + (state.balance.USD + investSum.USD) * r.USD_TWD;
    const totalInUSD = (state.balance.AUD + investSum.AUD) * r.AUD_USD + (state.balance.TWD + investSum.TWD) / r.USD_TWD + (state.balance.USD + investSum.USD);

    document.getElementById("eval-aud").innerText = `$ ${totalInAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(totalInTWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${totalInUSD.toFixed(2)}`;

    // 更新簽證進度
    const wd = state.workDays;
    document.getElementById("days-2nd-text").innerText = `${Math.min(wd, 88)} / 88`;
    document.getElementById("progress-2nd").style.width = `${Math.min((wd / 88) * 100, 100)}%`;
    document.getElementById("days-3rd-text").innerText = `${Math.max(0, Math.min(wd - 88, 179))} / 179`;
    document.getElementById("progress-3rd").style.width = `${Math.min((Math.max(0, wd - 88) / 179) * 100, 100)}%`;

    renderTransactions();
}

function renderTransactions() {
    const list = document.getElementById("transaction-list");
    list.innerHTML = "";
    state.transactions.slice(0, 10).forEach(t => {
        const li = document.createElement("li");
        li.className = "transaction-item";
        li.innerHTML = `<span>${t.desc}</span><span class="${t.type}">${t.type==='income'?'+':'-'}${t.amount} ${t.currency}</span>`;
        list.appendChild(li);
    });
}

function setStockCurr(curr) {
    document.getElementById("stock-curr").value = curr;
    document.querySelectorAll("#stock-currency-container .type-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.curr === curr);
    });
}

function addWorkDay() {
    state.workDays++;
    saveAndRefresh();
}

function saveAndRefresh() {
    localStorage.setItem("aus_wh_state", JSON.stringify(state));
    updateUI();
}

init();
