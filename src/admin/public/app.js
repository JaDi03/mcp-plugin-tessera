// Mount Tessera initCreatorEarnings (MetaMask withdraw). Do not call a custom withdraw API.
const elWallet = document.getElementById("wallet-address");
const elRate = document.getElementById("stat-rate");
const elFeedback = document.getElementById("claim-feedback");

function formatAddress(addr) {
  if (!addr || addr.length < 10) return "Not configured";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function loadPaywallBundle(apiBase) {
  return new Promise((resolve, reject) => {
    if (window.ArcCashier && typeof window.ArcCashier.initCreatorEarnings === "function") {
      resolve();
      return;
    }
    const existing = document.getElementById("tessera-paywall-bundle");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load paywall.bundle.js")));
      return;
    }
    const script = document.createElement("script");
    script.id = "tessera-paywall-bundle";
    script.src = `${apiBase}/assets/paywall.bundle.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load paywall.bundle.js"));
    document.head.appendChild(script);
  });
}

async function loadConfigAndMount() {
  try {
    const res = await fetch("./api/config");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (elWallet) elWallet.textContent = formatAddress(data.payoutWallet);
    if (elRate && data.defaultRatePerSecond) {
      elRate.textContent = `$${Number(data.defaultRatePerSecond).toFixed(4)}/s`;
    }

    const wallet = (data.payoutWallet || "").trim();
    const apiBase = String(data.tesseraPublicUrl || data.sidecarUrl || "").replace(/\/$/, "");
    const host = document.getElementById("tessera-creator-host");
    if (!host) return;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      host.innerHTML = "<p class=\"balance-desc\">Set TESSERA_PAYOUT_WALLET to load earnings.</p>";
      return;
    }
    if (!apiBase) {
      host.innerHTML = "<p class=\"balance-desc\">Set TESSERA_URL so the Tessera bundle can load.</p>";
      return;
    }

    await loadPaywallBundle(apiBase);
    if (!window.ArcCashier || typeof window.ArcCashier.initCreatorEarnings !== "function") {
      host.innerHTML = "<p class=\"balance-desc\">Paywall bundle loaded but initCreatorEarnings is missing.</p>";
      return;
    }
    window.ArcCashier.initCreatorEarnings({
      wallet,
      apiBase,
      mount: host,
      title: "Creator Earnings",
    });
  } catch (err) {
    console.warn("Failed to mount Tessera creator widget", err);
    if (elFeedback) {
      elFeedback.innerHTML = `<span class="claim-error">${err.message}</span>`;
    }
  }
}

loadConfigAndMount();

