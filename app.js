// Initialize Supabase Client
const supabaseClient = supabase.createClient(
    'https://kbscngpwmvmtsuxfbkhq.supabase.co', // Replace with your Supabase URL
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtic2NuZ3B3bXZtdHN1eGZia2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2Mzk5NTAsImV4cCI6MjA0OTIxNTk1MH0.1D_jUKk2g88leiZqTrTr6tQMBvddX5dbqsr-BwuJpY0' // Replace with your Supabase anon key
);

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}
// User Authentication
document.getElementById('login-btn').addEventListener('click', async () => {
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
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('main-section').style.display = 'block';
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


// Fetch Ledger Summary
async function fetchLedgerSummary() {
    const { data, error } = await supabaseClient
        .from('entries')
        .select('name, contact_no, SUM(debit - credit) AS balance')
        .group('name, contact_no');

    if (error) {
        console.error('Error fetching ledger summary:', error.message);
        return;
    }
    renderLedgerSummary(data);
}

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

    // Populate Party Names in Add Entry Form
    const partyNames = document.getElementById('party-names');
    partyNames.innerHTML = data
        .map((party) => `<option value="${party.name}">`)
        .join('');
}


// Add Entry
document.getElementById('add-entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();

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

    const { error } = await supabaseClient.from('entries').insert({
        name,
        date,
        particulars,
        debit,
        credit,
        photo_url: photoURL,
        entered_by: supabaseClient.auth.user().email,
    });

    if (error) {
        alert('Failed to add entry: ' + error.message);
    } else {
        alert('Entry added successfully!');
        fetchLedgerSummary();
    }
});

// Fetch and Render Party Ledger
async function fetchPartyLedger(partyName) {
    const { data, error } = await supabaseClient
        .from('entries')
        .select('*')
        .eq('name', partyName)
        .order('date', { ascending: true });

    if (error) {
        console.error('Error fetching party ledger:', error.message);
        return;
    }
    renderPartyLedger(data);
}

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

// Create Party
document.getElementById('create-party-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('party-name').value;
    const contactNo = document.getElementById('contact-no').value;

    const { data, error } = await supabaseClient
        .from('entries')
        .select('name')
        .eq('name', name);

    if (data && data.length > 0) {
        alert('Party name already exists. Please choose another name.');
        return;
    }

    const { error: insertError } = await supabaseClient.from('entries').insert({
        name,
        contact_no: contactNo,
    });

    if (insertError) {
        alert('Failed to create party: ' + insertError.message);
    } else {
        alert('Party created successfully!');
        location.href = 'index.html'; // Redirect to main page
    }
});

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
