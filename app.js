// Initialize Supabase Client
const supabaseClient = supabase.createClient(
    'https://kbscngpwmvmtsuxfbkhq.supabase.co', // Replace with your Supabase URL
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtic2NuZ3B3bXZtdHN1eGZia2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2Mzk5NTAsImV4cCI6MjA0OTIxNTk1MH0.1D_jUKk2g88leiZqTrTr6tQMBvddX5dbqsr-BwuJpY0' // Replace with your Supabase anon key
);


// Utility Function to Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// DOMContentLoaded: Initialize on Page Load
document.addEventListener('DOMContentLoaded', async () => {
    const authSection = document.getElementById('auth-section');
    const mainSection = document.getElementById('main-section');
    const loginButton = document.getElementById('login-btn');

    // Check user session
    const { data: session } = await supabaseClient.auth.getSession();

    if (session?.session) {
        // User is logged in
        if (authSection) authSection.style.display = 'none';
        if (mainSection) mainSection.style.display = 'block';
        fetchLedgerSummary(); // Load ledger data
    } else {
        // User is not logged in
        if (authSection) authSection.style.display = 'block';
        if (mainSection) mainSection.style.display = 'none';
    }

    // Add event listener to login button
    if (loginButton) {
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
                if (authSection) authSection.style.display = 'none';
                if (mainSection) mainSection.style.display = 'block';
                fetchLedgerSummary(); // Load ledger data
            }
        });
    } else {
        console.error('Login button not found in the DOM.');
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

// Fetch Ledger Summary
async function fetchLedgerSummary() {
    try {
        const { data, error } = await supabaseClient.rpc('fetch_ledger_summary');

        if (error) throw error;

        // Calculate the balance for each party
        const summary = data.map((entry) => ({
            name: entry.name,
            contact_no: entry.contact_no,
            balance: (entry.total_credit || 0) - (entry.total_debit || 0),
        }));

        renderLedgerSummary(summary); // Render the summary
        populatePartyNames(summary); // Populate the datalist for party selection
    } catch (err) {
        console.error('Error fetching ledger summary:', err.message);
        alert('Failed to fetch ledger summary.');
    }
}


// Render Ledger Summary in the Main Page
function renderLedgerSummary(data) {
    const tableBody = document.querySelector('#ledger-summary-table tbody');
    tableBody.innerHTML = ''; // Clear existing rows

    data.forEach((party) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><a href="ledger.html?name=${encodeURIComponent(party.name)}">${party.name}</a></td>
            <td>${party.contact_no || 'N/A'}</td>
            <td>${party.balance.toFixed(2)}</td>
            <td><button onclick="openAddEntryModal('${party.name}')">Add Entry</button></td>
        `;
        tableBody.appendChild(row);
    });
}

// Populate Party Names in the Datalist
function populatePartyNames(summary) {
    const partyNamesDatalist = document.getElementById('party-names');
    if (partyNamesDatalist) {
        partyNamesDatalist.innerHTML = ''; // Clear existing options
        summary.forEach((party) => {
            const option = document.createElement('option');
            option.value = party.name;
            partyNamesDatalist.appendChild(option);
        });
    }
}

// Add Entry
document.getElementById('add-entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const session = await supabaseClient.auth.getSession();
    if (!session?.data?.session) {
        alert('You must be logged in to add an entry.');
        return;
    }

    const userEmail = session.data.session.user.email;
    const name = document.getElementById('party-name').value;
    const date = document.getElementById('date').value;
    const particulars = document.getElementById('particulars').value;
    const debit = parseFloat(document.getElementById('debit').value || 0);
    const credit = parseFloat(document.getElementById('credit').value || 0);
    const photoFile = document.getElementById('photo').files[0];

    let photoURL = '';
    if (photoFile) {
        const fileName = `ledger-${Date.now()}-${photoFile.name}`;
        const { data, error } = await supabaseClient.storage
            .from('photos')
            .upload(fileName, photoFile);
        if (error) {
            alert('Photo upload failed: ' + error.message);
            return;
        }
        photoURL = supabaseClient.storage
            .from('photos')
            .getPublicUrl(fileName)
            .data.publicUrl;
    }

    try {
        const { error } = await supabaseClient.from('entries').insert({
            name,
            date,
            particulars,
            debit,
            credit,
            photo_url: photoURL,
            entered_by: userEmail,
        });

        if (error) throw error;

        alert('Entry added successfully!');
        fetchLedgerSummary(); // Refresh the summary
    } catch (err) {
        console.error('Error adding entry:', err.message);
        alert('Failed to add entry.');
    }
});

// Fetch and Render Party Ledger
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
        alert('Failed to fetch party ledger.');
    }
}

// Render Party Ledger Page
function renderPartyLedger(data) {
    const tableBody = document.querySelector('#party-ledger-table tbody');
    tableBody.innerHTML = '';

    let runningBalance = 0;

    data.forEach((entry) => {
        runningBalance += (entry.credit || 0) - (entry.debit || 0);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td>${entry.particulars}</td>
            <td><img src="${entry.photo_url}" class="zoomable" style="width:50px; cursor:pointer;" alt="Entry Image"></td>
            <td>${entry.debit || 0}</td>
            <td>${entry.credit || 0}</td>
            <td>${runningBalance.toFixed(2)}</td>
            <td>${entry.entered_by || 'Unknown'}</td>
        `;
        tableBody.appendChild(row);
    });

    initializeLightbox(); // Reapply lightbox logic for images
}

// Lightbox Logic
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
