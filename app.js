/**
 * UltraLeads Platform Core Client Engine
 * Handles Intent Search, Live Ingestion Displays, Anti-Freeloader Lockout, 
 * and Blockchain USDT Payment Verification Calls.
 */

// Configuration Options - Set Northflank Base API Endpoint
const CONFIG = {
    NORTHFLANK_API_URL: "https://api-ultraleads.northflank.app", // Updated automatically in production
    FALLBACK_RECEIVING_WALLET: "0x641c46b67c53b86d748af5a85137700fa893ba48",
    FREE_SAMPLES_MAX: 5
};

// Application State
const state = {
    userCredits: 0,
    offeredFreeSample: false,
    viewedSamplesCount: 0,
    selectedPackage: { credits: 1000, price: 25 },
    estimatedGasFee: 4.50,
    activeWalletAddress: CONFIG.FALLBACK_RECEIVING_WALLET,
    intentCategories: [
        { query: "pipes", vertical: "Plumbers & HVAC", count: 14200 },
        { query: "leaks", vertical: "Plumbers & HVAC", count: 14200 },
        { query: "solar", vertical: "Clean Energy / Solar", count: 8900 },
        { query: "clean energy", vertical: "Clean Energy / Solar", count: 8900 },
        { query: "legal", vertical: "Legal & Corporate Services", count: 6400 },
        { query: "lawyer", vertical: "Legal & Corporate Services", count: 6400 }
    ]
};

// DOM Initializer
document.addEventListener("DOMContentLoaded", () => {
    initLocalState();
    setupEventListeners();
    fetchLiveInventory();
    fetchProofStream();
    renderInitialResults();
    fetchActiveWallet();
});

// Load persistent Anti-Freeloader status from localStorage
function initLocalState() {
    state.offeredFreeSample = localStorage.getItem("ultraleads_offered_free_sample") === "true";
    state.viewedSamplesCount = parseInt(localStorage.getItem("ultraleads_viewed_samples") || "0", 10);
    state.userCredits = parseInt(localStorage.getItem("ultraleads_credits") || "0", 10);

    updateCreditsDisplay();
}

function updateCreditsDisplay() {
    const vaultDisplay = document.getElementById("vault-credits-display");
    if (vaultDisplay) {
        vaultDisplay.textContent = `${state.userCredits.toLocaleString()} Credits`;
    }
}

// Fetch Active Wallet from Northflank API Server
async function fetchActiveWallet() {
    try {
        const response = await fetch(`${CONFIG.NORTHFLANK_API_URL}/api/system/wallet`);
        if (response.ok) {
            const data = await response.json();
            if (data.active_wallet) {
                state.activeWalletAddress = data.active_wallet;
                document.getElementById("target-wallet-address").value = data.active_wallet;
            }
        }
    } catch (err) {
        // Fallback to static wallet baseline on network disconnect
        console.warn("Using fallback wallet address.");
    }
}

// Global Inventory Ticker
async function fetchLiveInventory() {
    const counterEl = document.getElementById("total-inventory-count");
    try {
        const response = await fetch(`${CONFIG.NORTHFLANK_API_URL}/api/leads/count`);
        if (response.ok) {
            const data = await response.json();
            animateCounter(counterEl, data.total_count);
            return;
        }
    } catch (e) {
        // Mock fallback baseline for standalone front-end rendering
        animateCounter(counterEl, 142850);
    }
}

function animateCounter(element, targetValue) {
    let start = 0;
    const duration = 1200;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = targetValue / steps;

    const timer = setInterval(() => {
        start += increment;
        if (start >= targetValue) {
            element.textContent = targetValue.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start).toLocaleString();
        }
    }, stepTime);
}

// Proof Stream Table Rendering
async function fetchProofStream() {
    const tbody = document.getElementById("proof-stream-table");
    tbody.innerHTML = "";

    const mockStream = [
        { time: "Just now", company: "Apex Plumbing LLC", niche: "Plumbers", location: "TX, USA" },
        { time: "2 mins ago", company: "SunRay Solar Inc", niche: "Solar", location: "CA, USA" },
        { time: "5 mins ago", company: "Vanguard Legal Group", niche: "Legal", location: "NY, USA" },
        { time: "8 mins ago", company: "Metro HVAC Solutions", niche: "Plumbers", location: "FL, USA" }
    ];

    mockStream.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHTML(row.time)}</td>
            <td><strong>${escapeHTML(row.company)}</strong></td>
            <td>${escapeHTML(row.location)}</td>
            <td><span class="badge-verified">✓ 100% Enriched</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    const searchInput = document.getElementById("search-input");
    const autocompleteBox = document.getElementById("autocomplete-dropdown");

    // Dynamic Intent Autocomplete
    searchInput.addEventListener("input", (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val.length < 2) {
            autocompleteBox.classList.add("hidden");
            return;
        }

        const matches = state.intentCategories.filter(cat => cat.query.includes(val));
        if (matches.length > 0) {
            autocompleteBox.innerHTML = "";
            matches.forEach(match => {
                const item = document.createElement("div");
                item.className = "autocomplete-item";
                item.innerHTML = `
                    <span>Vertical: <strong>${escapeHTML(match.vertical)}</strong></span>
                    <span class="autocomplete-count">${match.count.toLocaleString()} leads</span>
                `;
                item.addEventListener("click", () => {
                    searchInput.value = match.vertical;
                    autocompleteBox.classList.add("hidden");
                    renderSearchResults(match.vertical);
                });
                autocompleteBox.appendChild(item);
            });
            autocompleteBox.classList.remove("hidden");
        } else {
            autocompleteBox.classList.add("hidden");
        }
    });

    // Close autocomplete on external click
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-box-wrapper")) {
            autocompleteBox.classList.add("hidden");
        }
    });

    // Search Action
    document.getElementById("search-btn").addEventListener("click", () => {
        const term = searchInput.value.trim();
        renderSearchResults(term || "All");
    });

    // Modal Events
    const modal = document.getElementById("checkout-modal");
    document.getElementById("open-checkout-btn").addEventListener("click", () => modal.classList.remove("hidden"));
    document.getElementById("close-modal-btn").addEventListener("click", () => modal.classList.add("hidden"));

    // Copy Wallet Button
    document.getElementById("copy-wallet-btn").addEventListener("click", () => {
        const walletInput = document.getElementById("target-wallet-address");
        walletInput.select();
        navigator.clipboard.writeText(walletInput.value);
        alert("Wallet address copied to clipboard.");
    });

    // Package Selection Cards
    const packageCards = document.querySelectorAll(".package-card");
    packageCards.forEach(card => {
        card.addEventListener("click", () => {
            packageCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");

            const credits = parseInt(card.getAttribute("data-credits"), 10);
            const price = parseFloat(card.getAttribute("data-price"));

            state.selectedPackage = { credits, price };
            updateSettlementTotals();
        });
    });

    // Toggle Payment Input
    document.getElementById("toggle-hash-input-btn").addEventListener("click", () => {
        document.getElementById("hash-input-wrapper").classList.remove("hidden");
    });

    // Submit Transaction Hash
    document.getElementById("submit-hash-btn").addEventListener("click", submitTransactionHash);
}

function updateSettlementTotals() {
    const subtotal = state.selectedPackage.price;
    const total = subtotal + state.estimatedGasFee;

    document.getElementById("summary-subtotal").textContent = `$${subtotal.toFixed(2)} USDT`;
    document.getElementById("summary-gas-fee").textContent = `$${state.estimatedGasFee.toFixed(2)} USDT`;
    document.getElementById("summary-total-payable").textContent = `$${total.toFixed(2)} USDT`;
}

// Initial Sample Search Rendering
function renderInitialResults() {
    renderSearchResults("All");
}

function renderSearchResults(filter) {
    const tbody = document.getElementById("results-table-body");
    tbody.innerHTML = "";

    const sampleLeads = [
        { name: "Cascade Plumbing Services", niche: "Plumbers", location: "California, USA", email: "contact@cascadeplumb.com", phone: "+1 (555) 234-8901" },
        { name: "BrightWatt Solar Co", niche: "Solar", location: "Texas, USA", email: "info@brightwattsolar.io", phone: "+1 (555) 876-5432" },
        { name: "Apex Commercial Roofing", niche: "Roofing", location: "Florida, USA", email: "sales@apexroofingfl.com", phone: "+1 (555) 432-1098" },
        { name: "Sterling Law Partners", niche: "Legal", location: "New York, USA", email: "intake@sterlinglaw.com", phone: "+1 (555) 987-6543" },
        { name: "Pacific Clean Energy Inc", niche: "Solar", location: "Oregon, USA", email: "support@pacificclean.com", phone: "+1 (555) 345-6789" }
    ];

    sampleLeads.forEach((lead, index) => {
        const tr = document.createElement("tr");

        // Anti-Freeloader logic check
        const isLocked = state.offeredFreeSample || (index >= CONFIG.FREE_SAMPLES_MAX && state.userCredits <= 0);
        
        tr.innerHTML = `
            <td><strong>${escapeHTML(lead.name)}</strong></td>
            <td>${escapeHTML(lead.niche)}</td>
            <td>${escapeHTML(lead.location)}</td>
            <td>${isLocked ? '<span class="masked-data">user@domain.com</span>' : escapeHTML(lead.email)}</td>
            <td>${isLocked ? '<span class="masked-data">+1 (555) 000-0000</span>' : escapeHTML(lead.phone)}</td>
            <td>
                ${isLocked 
                    ? `<button class="btn btn-secondary-sm" onclick="openCheckoutModal()">Unlock Row</button>` 
                    : `<span class="badge-verified">Unlocked</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Permanent Anti-Freeloader lock escalation
    if (!state.offeredFreeSample) {
        state.viewedSamplesCount += 1;
        localStorage.setItem("ultraleads_viewed_samples", state.viewedSamplesCount.toString());
        if (state.viewedSamplesCount >= 5) {
            state.offeredFreeSample = true;
            localStorage.setItem("ultraleads_offered_free_sample", "true");
        }
    }
}

function openCheckoutModal() {
    document.getElementById("checkout-modal").classList.remove("hidden");
}

// Blockchain Transaction Verification API Submission
async function submitTransactionHash() {
    const hashInput = document.getElementById("tx-hash-input");
    const statusMsg = document.getElementById("verification-status");
    const txHash = hashInput.value.trim();

    if (!txHash.startsWith("0x") || txHash.length !== 66) {
        showStatus(statusMsg, "Error: Enter a valid 66-character Ethereum transaction hash.", "error");
        return;
    }

    showStatus(statusMsg, "Contacting Alchemy RPC... Verifying block confirmation.", "");

    try {
        const response = await fetch(`${CONFIG.NORTHFLANK_API_URL}/api/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tx_hash: txHash,
                expected_amount: state.selectedPackage.price + state.estimatedGasFee,
                requested_credits: state.selectedPackage.credits
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            state.userCredits += result.credited_amount;
            localStorage.setItem("ultraleads_credits", state.userCredits.toString());
            updateCreditsDisplay();
            showStatus(statusMsg, `Success! ${result.credited_amount.toLocaleString()} credits added to your vault.`, "success");
            setTimeout(() => {
                document.getElementById("checkout-modal").classList.add("hidden");
                renderSearchResults("All");
            }, 2000);
        } else {
            showStatus(statusMsg, `Verification Failed: ${result.message || "Transaction not found or unconfirmed."}`, "error");
        }
    } catch (e) {
        showStatus(statusMsg, "Network error: Connection to Northflank verification node failed.", "error");
    }
}

function showStatus(element, text, type) {
    element.textContent = text;
    element.className = "status-message " + type;
    element.classList.remove("hidden");
}

// XSS Sanitizer Helper
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
         }
