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
    } else if (path.includes('ledger.html') || path.includes('ledger')) {
        initializeLedgerPage();
    } else if (path.includes('create-party.html') || path.includes('create-party')) {
        initializeCreatePartyPage();
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
            <td>${entry.particulars || 'N/A'}</td>
            <td>
                ${
                    entry.photo_url
                        ? `<img src="${entry.photo_url}" alt="Entry Image" style="width:50px; height:50px; object-fit:cover; cursor:pointer;" class="zoomable">`
                        : 'No Image'
                }
            </td>
            <td>${debit.toFixed(2)}</td>
            <td>${credit.toFixed(2)}</td>
            <td>${runningBalance.toFixed(2)}</td>
            <td>${entry.entered_by || 'Unknown'}</td>
        `;
        tableBody.appendChild(row);
    });

    // Reinitialize Lightbox for Zoomable Images
    initializeLightbox();
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


function initializeCreatePartyPage() {
    const createPartyForm = document.getElementById('create-party-form');

    if (!createPartyForm) {
        console.error('Create Party form not found on the page.');
        return;
    }

    createPartyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const partyName = document.getElementById('party-name').value.trim();
        const contactNo = document.getElementById('contact-no').value.trim();

        if (!partyName) {
            alert('Party Name is required.');
            return;
        }

        try {
            const { data: existingParty, error: fetchError } = await supabaseClient
                .from('entries')
                .select('name')
                .eq('name', partyName);

            if (fetchError) throw fetchError;

            if (existingParty && existingParty.length > 0) {
                alert('A party with this name already exists. Please choose another name.');
                return;
            }

            const { error: insertError } = await supabaseClient.from('entries').insert({
                name: partyName,
                contact_no: contactNo,
            });

            if (insertError) throw insertError;

            alert('Party created successfully!');
            location.href = 'index.html'; // Redirect to the main page
        } catch (err) {
            console.error('Error creating party:', err.message);
            alert('Failed to create party. Please try again.');
        }
    });
}
