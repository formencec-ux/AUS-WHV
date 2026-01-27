let state = {
    balance: { AUD: 0, TWD: 0, USD: 0 },
    investments: [],
    workDays: 0,
    workLogs: [],
    transactions: [],
    rates: { AUD_TWD: 21.0, AUD_USD: 0.65, USD_TWD: 32.2 },
    settings: { darkMode: false, weeklyBudget: 300 }
};

function init() {
    const saved = localStorage.getItem("aus_wh_state");
    if (saved) state = { ...state, ...JSON.parse(saved) };
    
    // 初始黑暗模式
    if (state.settings.darkMode) document.body.className = "dark-mode";
    
    updateUI();
    fetchRates();
}

function save() {
    localStorage.setItem("aus_wh_state", JSON.stringify(state));
}

// 匯率獲取
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

// 稅務計算
function calcTax() {
    const isIncome = document.getElementById("trans-type").value === "income";
    const applyTax = document.getElementById("apply-tax").checked;
    const amount = parseFloat(document.getElementById("trans-amount").value);
    const resultEl = document.getElementById("tax-result");

    if (isIncome && applyTax && !isNaN(amount)) {
        const net = amount * 0.85;
        resultEl.innerText = `稅後實領 (15% off): $${net.toFixed(2)}`;
    } else {
        resultEl.innerText = "";
    }
}

// 切換收支類型
function setType(type) {
    document.getElementById("trans-type").value = type;
    document.querySelectorAll("#type-container .type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.type === type));
    document.getElementById("tax-helper").style.display = type === "income" ? "block" : "none";
    calcTax();
}

function setCurrency(currency) {
    document.getElementById("trans-currency").value = currency;
    document.querySelectorAll("#currency-container .type-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.currency === currency));
}

// 新增收支
function addTransaction() {
    const type = document.getElementById("trans-type").value;
    const desc = document.getElementById("trans-desc").value.trim();
    let amount = parseFloat(document.getElementById("trans-amount").value);
    const currency = document.getElementById("trans-currency").value;
    const applyTax = document.getElementById("apply-tax").checked;

    if (!desc || isNaN(amount)) return;
    
    if (type === "income" && applyTax) amount = amount * 0.85; // 實際存入稅後金額

    state.transactions.unshift({
        id: Date.now(),
        type,
        desc,
        amount,
        currency,
        date: new Date().toLocaleDateString(),
        fullDate: new Date() 
    });

    state.balance[currency] += type === "income" ? amount : -amount;
    document.getElementById("trans-desc").value = "";
    document.getElementById("trans-amount").value = "";
    save(); updateUI();
}

// 簽證打卡
function addWorkDay() {
    state.workDays++;
    state.workLogs.unshift(new Date().toLocaleString());
    save(); updateUI();
}

// 黑暗模式
function toggleDarkMode() {
    state.settings.darkMode = !state.settings.darkMode;
    document.body.className = state.settings.darkMode ? "dark-mode" : "light-mode";
    save();
}

// 資料備份 (Export)
function exportData() {
    const dataStr = JSON.stringify(state);
    const el = document.createElement('textarea');
    el.value = dataStr;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("備份代碼已複製到剪貼簿！請貼到 Line 或記事本保存。");
}

// 資料還原 (Import)
function importData() {
    const code = prompt("請貼上之前的備份代碼：");
    if (code) {
        try {
            const parsed = JSON.parse(code);
            if (parsed.balance) {
                state = parsed;
                save();
                location.reload();
            }
        } catch (e) { alert("代碼錯誤，無法還原。"); }
    }
}

function resetAssets() {
    if (confirm("確定重置所有資料嗎？")) {
        localStorage.clear();
        location.reload();
    }
}

function updateUI() {
    const r = state.rates;
    // 餘額顯示
    document.getElementById("total-aud").innerText = `$ ${state.balance.AUD.toFixed(2)}`;
    document.getElementById("total-twd").innerText = `$ ${state.balance.TWD.toLocaleString()}`;
    document.getElementById("total-usd").innerText = `$ ${state.balance.USD.toFixed(2)}`;

    // 總資產換算
    const totalInAUD = state.balance.AUD + (state.balance.TWD / r.AUD_TWD) + (state.balance.USD / r.AUD_USD);
    const totalInTWD = (state.balance.AUD * r.AUD_TWD) + state.balance.TWD + (state.balance.USD * r.USD_TWD);
    const totalInUSD = (state.balance.AUD * r.AUD_USD) + (state.balance.TWD / r.USD_TWD) + state.balance.USD;

    document.getElementById("eval-aud").innerText = `$ ${totalInAUD.toFixed(2)}`;
    document.getElementById("eval-twd").innerText = `$ ${Math.round(totalInTWD).toLocaleString()}`;
    document.getElementById("eval-usd").innerText = `$ ${totalInUSD.toFixed(2)}`;

    // 週預算計算 (計算過去 7 天內 AUD 的支出)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyExpense = state.transactions
        .filter(t => t.type === 'expense' && t.currency === 'AUD' && new Date(t.id) > sevenDaysAgo)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const budgetLimit = state.settings.weeklyBudget;
    const budgetPct = Math.min((weeklyExpense / budgetLimit) * 100, 100);
    document.getElementById("budget-progress").style.width = `${budgetPct}%`;
    document.getElementById("budget-text").innerText = `$${weeklyExpense.toFixed(0)} / $${budgetLimit}`;
    document.getElementById("budget-progress").style.backgroundColor = budgetPct > 90 ? "#d63031" : "#FFCD00";

    // 簽證進度
    const wd = state.workDays;
    document.getElementById("progress-2nd").style.width = `${Math.min(wd/88*100, 100)}%`;
    document.getElementById("days-2nd-text").innerText = `${wd} / 88`;
    document.getElementById("progress-3rd").style.width = `${Math.min(Math.max(0,wd-88)/179*100, 100)}%`;
    document.getElementById("days-3rd-text").innerText = `${Math.max(0, wd - 88)} / 179`;

    // 歷史紀錄
    const list = document.getElementById("transaction-list");
    list.innerHTML = "";
    state.transactions.slice(0, 10).forEach(t => {
        const li = document.createElement("li");
        li.className = "transaction-item";
        li.innerHTML = `<span>${t.date} ${t.desc}</span><span class="${t.type}">${t.type==='income'?'+':'-'}${t.amount.toFixed(2)} ${t.currency}</span>`;
        list.appendChild(li);
    });

    document.getElementById("exchange-info").innerText = `1 AUD = ${r.AUD_TWD.toFixed(1)} TWD`;
}

init();
