// Creator Portal App logic
const elBalance = document.getElementById("balance-amount");
const elWallet = document.getElementById("wallet-address");
const elSessions = document.getElementById("stat-sessions");
const elDuration = document.getElementById("stat-duration");
const elRate = document.getElementById("stat-rate");
const elClaimBtn = document.getElementById("btn-claim");
const elRefreshBtn = document.getElementById("btn-refresh");
const elFeedback = document.getElementById("claim-feedback");

let currentBalance = 0;

function formatAddress(addr) {
  if (!addr || addr.length < 10) return "Not configured";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function loadConfig() {
  try {
    const res = await fetch("./api/config");
    if (res.ok) {
      const data = await res.json();
      if (elWallet) elWallet.textContent = formatAddress(data.payoutWallet);
      if (elRate && data.defaultRatePerSecond) {
        elRate.textContent = `$${data.defaultRatePerSecond.toFixed(4)}/s`;
      }
    }
  } catch (err) {
    console.warn("Failed to load config", err);
  }
}

async function loadBalance() {
  try {
    const res = await fetch("./api/balance");
    if (res.ok) {
      const data = await res.json();
      currentBalance = data.accumulatedBalanceUsdc || 0;
      if (elBalance) elBalance.textContent = currentBalance.toFixed(4);
      if (elSessions) elSessions.textContent = data.totalSessionsServed || 0;
      if (elDuration) elDuration.textContent = `${(data.totalDurationSeconds || 0).toFixed(1)}s`;
    }
  } catch (err) {
    console.warn("Failed to load balance", err);
  }
}

async function handleClaim() {
  if (currentBalance <= 0) {
    elFeedback.innerHTML = `<span class="claim-error">No earnings available to claim at this time.</span>`;
    return;
  }

  elClaimBtn.disabled = true;
  elClaimBtn.textContent = "Processing Claim...";
  elFeedback.textContent = "";

  try {
    const res = await fetch("./api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: currentBalance }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      elFeedback.innerHTML = `<span class="claim-success">? Claim successful! Tx: ${data.transactionHash || "Confirmed"}</span>`;
      await loadBalance();
    } else {
      elFeedback.innerHTML = `<span class="claim-error">Claim failed: ${data.error || "Unknown error"}</span>`;
    }
  } catch (err) {
    elFeedback.innerHTML = `<span class="claim-error">Network error: ${err.message}</span>`;
  } finally {
    elClaimBtn.disabled = false;
    elClaimBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Claim & Withdraw to Wallet
    `;
  }
}

// Initial setup
loadConfig();
loadBalance();
setInterval(loadBalance, 5000);

if (elClaimBtn) elClaimBtn.addEventListener("click", handleClaim);
if (elRefreshBtn) elRefreshBtn.addEventListener("click", loadBalance);
