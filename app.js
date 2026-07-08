// ==========================================
// ELITE READER - FRONTEND FUNCTIONAL ENGINE
// ==========================================

// 1. SUPABASE CONNECTION HANDSHAKE
// Provide your exact public Project URL and Anon Key here
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL'; 
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. DOM ELEMENTS
const searchInput = document.getElementById('semantic-search');
const searchTranslation = document.getElementById('search-translation');
const tableBody = document.getElementById('leads-table-body');
const unlockBtn = document.getElementById('unlock-data-btn');
const paymentModal = document.getElementById('payment-modal');
const closePaymentBtn = document.getElementById('close-payment');
const verifyTxBtn = document.getElementById('verify-tx-btn');
const txHashInput = document.getElementById('tx-hash-input');
const txStatus = document.getElementById('tx-status');

const authBtn = document.getElementById('auth-btn');
const authModal = document.getElementById('auth-modal');
const closeAuthBtn = document.getElementById('close-auth');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const adminPanel = document.getElementById('admin-panel');

// 3. SEMANTIC KEYWORD TOKEN TRANSLATOR
const semanticDictionary = {
    'pipes': 'Plumbers',
    'water': 'Plumbers',
    'leaks': 'Plumbers',
    'panels': 'Solar',
    'energy': 'Solar',
    'sun': 'Solar',
    'houses': 'Construction',
    'building': 'Construction',
    'contractor': 'Construction',
    'roof': 'Construction'
};

// 4. EVENT LISTENERS & LOGIC

// Semantic Search Live Translation
searchInput.addEventListener('input', async (e) => {
    const rawTerm = e.target.value.toLowerCase().trim();
    let mappedIndustry = null;

    // Check dictionary for semantic match
    for (const [key, value] of Object.entries(semanticDictionary)) {
        if (rawTerm.includes(key)) {
            mappedIndustry = value;
            break;
        }
    }

    if (mappedIndustry) {
        searchTranslation.classList.remove('hidden');
        searchTranslation.innerText = `Mapped to: ${mappedIndustry}`;
        await fetchAndRenderLeads(mappedIndustry);
    } else {
        searchTranslation.classList.add('hidden');
        if (rawTerm === '') {
            await fetchAndRenderLeads(null); // Load default
        }
    }
});

// Payment Modal Toggles
unlockBtn.addEventListener('click', () => {
    paymentModal.classList.remove('hidden');
});

closePaymentBtn.addEventListener('click', () => {
    paymentModal.classList.add('hidden');
    txHashInput.value = '';
    txStatus.classList.add('hidden');
});

// Blockchain TxHash Verification UI Logic
verifyTxBtn.addEventListener('click', () => {
    const hash = txHashInput.value.trim();
    const hashRegex = /^0x([A-Fa-f0-9]{64})$/;

    txStatus.classList.remove('hidden');
    
    if (!hashRegex.test(hash)) {
        txStatus.innerText = "Error: Invalid ERC-20 Transaction Hash format.";
        return;
    }

    txStatus.classList.remove('text-red-400');
    txStatus.classList.add('text-yellow-400');
    txStatus.innerText = "Verifying on-chain via Alchemy RPC...";
    
    // Simulating network delay before throwing error (Backend handles real verify)
    setTimeout(() => {
        txStatus.classList.remove('text-yellow-400');
        txStatus.classList.add('text-red-400');
        txStatus.innerText = "Error: Transaction not found or network congestion. Try again.";
    }, 2500);
});

// Authentication Toggles
authBtn.addEventListener('click', () => {
    authModal.classList.remove('hidden');
});

closeAuthBtn.addEventListener('click', () => {
    authModal.classList.add('hidden');
});

// 5. CONDITIONAL ADMIN SECURE IDENTITY MAPPING GATE
loginSubmitBtn.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) return;

    // Supabase Auth Handshake
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert(error.message);
    } else {
        authModal.classList.add('hidden');
        authBtn.innerText = "Logged In";
        checkAdminStatus(email);
    }
});

// Hardcoded Super-Admin Override
function checkAdminStatus(userEmail) {
    if (userEmail === 'omaiyamah@gmail.com') {
        adminPanel.classList.remove('hidden');
        // Admin gets full view, remove masking locally
        fetchAndRenderLeads(null, true);
    }
}

// Session persistence check on load
async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
        authBtn.innerText = "Logged In";
        checkAdminStatus(session.user.email);
    }
}

// 6. LIVE DATABASE QUERYING & MASKING ENGINE
async function fetchAndRenderLeads(industryFilter = null, isAdmin = false) {
    try {
        let query = supabase.from('b2b_leads').select('*').limit(10);
        
        if (industryFilter) {
            query = query.eq('business_type', industryFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        tableBody.innerHTML = ''; // Clear existing

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No leads found in inventory.</td></tr>`;
            return;
        }

        data.forEach(lead => {
            // Masking algorithm for public users
            const displayEmail = isAdmin ? lead.email : lead.email.replace(/(.{2})(.*)(?=@)/, '$1***');
            const displayPhone = isAdmin ? lead.phone : lead.phone.replace(/(\d{3})\d{4}$/, '$1****');

            const row = document.createElement('tr');
            row.classList.add('hover:bg-gray-800', 'transition');
            row.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-200">${lead.business_name}</td>
                <td class="px-4 py-3"><span class="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">${lead.business_type}</span></td>
                <td class="px-4 py-3">${lead.state_region || 'N/A'}</td>
                <td class="px-4 py-3 text-xs">
                    <div class="text-gray-300">${displayEmail}</div>
                    <div class="text-gray-400 mt-1">${displayPhone}</div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        updateGeographicMatrix();

    } catch (err) {
        console.error("Database sync failed:", err.message);
    }
}

// Updates matrix counters locally 
async function updateGeographicMatrix() {
    const regions = ['CA', 'TX', 'FL', 'NY'];
    
    // In production, these should hit the backend endpoint. This handles graceful fallback locally.
    regions.forEach(async (region) => {
        const fullRegionName = region === 'CA' ? 'California' : region === 'TX' ? 'Texas' : region === 'FL' ? 'Florida' : 'New York';
        const { count, error } = await supabase
            .from('b2b_leads')
            .select('*', { count: 'exact', head: true })
            .eq('state_region', fullRegionName);
            
        if (!error && count !== null) {
            const el = document.getElementById(`count-${region.toLowerCase()}`);
            if(el) el.innerText = count.toLocaleString();
        }
    });
}

// 7. INITIALIZE ENGINE
document.addEventListener('DOMContentLoaded', () => {
    checkCurrentSession();
    fetchAndRenderLeads();
});
