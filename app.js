// Initialize Supabase Client
const supabaseClient = supabase.createClient(
    'https://kbscngpwmvmtsuxfbkhq.supabase.co', // Replace with your Supabase URL
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtic2NuZ3B3bXZtdHN1eGZia2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2Mzk5NTAsImV4cCI6MjA0OTIxNTk1MH0.1D_jUKk2g88leiZqTrTr6tQMBvddX5dbqsr-BwuJpY0' // Replace with your Supabase anon key
);



// Utility Function to Format Dates
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Initialize Page Based on Location
document.addEventListener('DOMContentLoaded', () => {
    const path = location.pathname;

    if (path.includes('index.html') || path === '/') {
        initializeMainPage();
    } else if (path.includes('ledger.html')) {
        initializeLedgerPage();
    } else {
        console.error('Unrecognized page. Ensure the correct script logic is applied.');
    }
});

/** 
 * MAIN PAGE LOGIC 
 */
function initializeMainPage() {
    const authSection = document.getElementById('auth-section');
    const mainSection = document.getElementById('main-section');
    const loginButton = document.getElementById('login-btn');

    if (!authSection || !mainSection || !loginButton) {
        console.error('Required DOM elements not found on the main page.');
        return;
    }

    // Check user session
    supabaseClient.auth.getSession().then(({ data: session }) => {
        if (session?.session) {
            authSection.style.display = 'none';
            mainSection.style.display = 'block';
            fetchLedgerSummary();
        } else {
            authSection.style.display = 'block';
            mainSection.style.display = 'none';
        }
    });

    // Login Functionality
    loginButton.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            alert('Login failed: ' + error.message);
        } else {
            alert('Login successful!');
            authSection.style.display = 'none';
            mainSection.style.display = 'block';
            fetchLedgerSummary();
        }
    });

    // Logout Functionality
    document.getElementById('logout-btn').addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert('Logout failed: ' + error.message);
        } else {
            alert('Logged out successfully!');
            location.reload();
        }
    });
}

// Fetch Ledger Summary for Main Page
async function fetchLedgerSummary() {
    const tableBody = document.querySelector('#ledger-summary-table tbody');
    if (!tableBody) {
        console.error('Ledger table body not found in the DOM.');
        return;
    }

    try {
        const { data, error } = await supabaseClient.rpc('fetch_ledger_summary');
        if (error) throw error;

        tableBody.innerHTML = ''; // Clear existing rows

        data.forEach((party) => {
            const totalDebit = party.total_debit || 0;
            const totalCredit = party.total_credit || 0;
            const balance = totalCredit - totalDebit;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><a href="ledger.html?name=${encodeURIComponent(party.name)}">${party.name}</a></td>
                <td>${party.contact_no || 'N/A'}</td>
                <td>${balance.toFixed(2)}</td>
                <td><button onclick="openAddEntryModal('${party.name}')">Add Entry</button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error('Error fetching ledger summary:', err.message);
    }
}

/**
 * LEDGER PAGE LOGIC
 */
function initializeLedgerPage() {
    const partyNameElement = document.getElementById('party-name');
    const ledgerTableBody = document.querySelector('#party-ledger-table tbody');

    if (!partyNameElement || !ledgerTableBody) {
        console.error('Required DOM elements not found on the ledger page.');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const partyName = urlParams.get('name');

    if (partyName) {
        partyNameElement.textContent = `Ledger for ${partyName}`;
        fetchPartyLedger(partyName);
    } else {
        partyNameElement.textContent = 'No Party Selected';
    }
}

// Fetch Party Ledger for Ledger Page
async function fetchPartyLedger(partyName) {
    try {
        const { data, error } = await supabaseClient
            .from('entries')
            .select('*')
            .eq('name', partyName)
            .order('date', { ascending: true });

        if (error) throw error;

        renderPartyLedger(data);
    } catch (err) {
        console.error('Error fetching party ledger:', err.message);
    }
}

// Render Party Ledger on Ledger Page
function renderPartyLedger(data) {
    const tableBody = document.querySelector('#party-ledger-table tbody');
    if (!tableBody) {
        console.error('Ledger table body not found in the DOM.');
        return;
    }

    tableBody.innerHTML = ''; // Clear existing rows

    let runningBalance = 0;

    data.forEach((entry) => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        runningBalance += credit - debit;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td>${entry.particulars}</td>
            <td>${debit.toFixed(2)}</td>
            <td>${credit.toFixed(2)}</td>
            <td>${runningBalance.toFixed(2)}</td>
            <td>${entry.entered_by || 'Unknown'}</td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * LIGHTBOX LOGIC
 */
function initializeLightbox() {
    const zoomableImages = document.querySelectorAll('.zoomable');
    zoomableImages.forEach((img) => {
        img.addEventListener('click', (e) => {
            const lightbox = document.getElementById('lightbox');
            const lightboxImg = document.getElementById('lightbox-img');
            lightboxImg.src = e.target.src;
            lightbox.style.display = 'flex';
        });
    });

    const lightbox = document.getElementById('lightbox');
    const lightboxClose = document.getElementById('lightbox-close');

    lightboxClose.addEventListener('click', () => {
        lightbox.style.display = 'none';
        document.getElementById('lightbox-img').src = '';
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.style.display = 'none';
            document.getElementById('lightbox-img').src = '';
        }
    });
}
