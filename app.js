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

        document.addEventListener('DOMContentLoaded', () => {
            const editButtons = document.querySelectorAll('.edit-entry-btn');
            editButtons.forEach((button) => {
                button.addEventListener('click', (e) => {
                    const entryId = e.target.dataset.entryId;
                    const partyId = e.target.dataset.partyId;
                    editEntry(entryId, partyId);
                });
            });
        });

        document.addEventListener('DOMContentLoaded', () => {
            const cancelEditButton = document.getElementById('cancel-edit-btn');
            if (cancelEditButton) {
                cancelEditButton.addEventListener('click', resetAddEntryForm);
            } else {
                console.error('Cancel Edit button not found.');
            }
        });
        
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
            fetchPartySummary();
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
            fetchPartySummary();
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
async function fetchPartySummary() {
    const tableBody = document.querySelector('#party-summary-table tbody');
    const searchInput = document.getElementById('party-search');

    if (!tableBody) {
        console.error('Party summary table not found in the DOM.');
        return;
    }

    try {
        //const { data: parties, error } = await supabaseClient.from('parties').select('*');
        const { data: parties, error } = await supabaseClient.rpc('fetch_party_balances');
        if (error) throw error;

        let filteredParties = parties; // Initialize filtered parties

        // Function to render parties in the table
        function renderParties() {
            tableBody.innerHTML = ''; // Clear existing rows
            filteredParties.forEach((party) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><a href="ledger.html?party_id=${party.id}">${party.name}</a></td>
                    <td>${party.contact_no || 'N/A'}</td>
                    <td>${party.balance ? party.balance.toFixed(2) : '0.00'}</td>
                    <td><button onclick="editParty(${party.id})">Edit</button>
                    <button onclick="deleteParty(${party.id})">Delete</button>
                     </td>
                `;
                tableBody.appendChild(row);
            });
        }

        // Wild search functionality
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            filteredParties = parties.filter(
                (party) =>
                    party.name.toLowerCase().includes(query) ||
                    (party.contact_no && party.contact_no.toLowerCase().includes(query))
            );
            renderParties();
        });

        // Render all parties initially
        renderParties();
    } catch (err) {
        console.error('Error fetching party summary:', err.message);
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

    // Fetch the party ID from the URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const partyId = urlParams.get('party_id'); // Get the party_id from the URL

    if (!partyId) {
        alert('No party selected.');
        partyNameElement.textContent = 'No Party Selected';
        return;
    }

    // Fetch the party details and ledger
    fetchPartyDetails(partyId).then((party) => {
        if (party) {
            partyNameElement.textContent = `Ledger for ${party.name}`;
        } else {
            partyNameElement.textContent = 'Party not found.';
        }
    });

    fetchPartyLedger(partyId); // Fetch the ledger entries for the party
    initializeAddEntryForm(partyId); // Pass the partyId to the Add Entry form
}


async function fetchPartyDetails(partyId) {
    try {
        const { data: party, error } = await supabaseClient
            .from('parties')
            .select('name')
            .eq('id', partyId)
            .single();

        if (error) throw error;
        return party;
    } catch (err) {
        console.error('Error fetching party details:', err.message);
        alert('Failed to fetch party details.');
        return null;
    }
}


async function fetchPartyLedger(partyId) {
    try {
        const { data: entries, error } = await supabaseClient
            .from('entries')
            .select('*')
            .eq('party_id', partyId)
            .order('date', { ascending: true });

        if (error) throw error;

        renderPartyLedger(entries, partyId);
    } catch (err) {
        console.error('Error fetching party ledger:', err.message);
    }
}

function initializeAddEntryForm(partyId) {
    const addEntryForm = document.getElementById('add-entry-form');
    if (!addEntryForm) {
        console.error('Add entry form not found on the page.');
        return;
    }

    addEntryForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Fetch the currently logged-in user's email
        const { data: session, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session?.session?.user) {
            alert('Unable to fetch user session. Please log in again.');
            return;
        }

        const enteredBy = session.session.user.email;
        const date = document.getElementById('date').value;
        const particulars = document.getElementById('particulars').value.trim();
        const debit = parseFloat(document.getElementById('debit').value || 0);
        const credit = parseFloat(document.getElementById('credit').value || 0);
        const photoFile = document.getElementById('photo').files[0];

        let photoURL = '';
        if (photoFile) {
            try {
                const sanitizedFileName = photoFile.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
                const uniqueFileName = `entry-${Date.now()}-${sanitizedFileName}`;
                const { data, error } = await supabaseClient.storage
                    .from('photos')
                    .upload(uniqueFileName, photoFile);

                if (error) {
                    console.error('Photo upload failed:', error.message);
                    alert('Failed to upload photo.');
                    return;
                }

                photoURL = supabaseClient.storage
                    .from('photos')
                    .getPublicUrl(uniqueFileName)
                    .data.publicUrl;
            } catch (photoError) {
                console.error('Error during photo upload:', photoError.message);
                alert('Failed to upload photo.');
                return;
            }
        }

        try {
            if (currentEditEntryId) {
                console.log('Edit mode triggered for entry ID:', currentEditEntryId);

                const { error } = await supabaseClient.from('entries').update({
                    date,
                    particulars,
                    debit,
                    credit,
                    photo_url: photoURL || undefined,
                    entered_by: enteredBy || undefined,
                }).eq('id', currentEditEntryId);

                if (error) {
                    console.error('Error during update:', error.message);
                    throw error;
                }

                alert('Entry updated successfully!');
                console.log('Entry updated.');
            } else {
                console.log('Add mode triggered for party ID:', partyId);

                const { error } = await supabaseClient.from('entries').insert({
                    party_id: partyId,
                    date,
                    particulars,
                    debit,
                    credit,
                    photo_url: photoURL,
                    entered_by: enteredBy,
                });

                if (error) {
                    console.error('Error during insert:', error.message);
                    throw error;
                }

                alert('Entry added successfully!');
                console.log('Entry added.');
            }

            // Reset the form and fetch updated ledger data
            resetAddEntryForm();
            try {
                fetchPartyLedger(partyId);
            } catch (fetchError) {
                console.error('Error refreshing ledger:', fetchError.message);
            }
        } catch (err) {
            console.error('Error saving entry:', err.message);
            fetchPartyLedger(partyId);
            alert(' save entry.');
        }
    });
}





// Render Party Ledger on Ledger Page
function renderPartyLedger(entries, partyId) {
    const tableBody = document.querySelector('#party-ledger-table tbody');
    if (!tableBody) {
        console.error('Ledger table body not found in the DOM.');
        return;
    }

    tableBody.innerHTML = ''; // Clear existing rows

    let runningBalance = 0;

    entries.forEach((entry) => {
        const debit = entry.debit || 0;
        const credit = entry.credit || 0;
        runningBalance += debit- credit;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td>${entry.particulars || 'N/A'}</td>
            <td>
                ${
                    entry.photo_url
                        ? `<img src="${entry.photo_url}" alt="Entry Image" style="width:50px; height:50px; object-fit:cover;" class="zoomable">`
                        : 'No Image'
                }
            </td>
            <td>${debit.toFixed(2)}</td>
            <td>${credit.toFixed(2)}</td>
            <td>${runningBalance.toFixed(2)}</td>
            <td>${entry.entered_by || 'Unknown'}</td>
            <td>
            <button onclick="editEntry(${entry.id}, ${partyId})">Edit</button>
            <button onclick="deleteEntry(${entry.id}, ${partyId})">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    initializeLightbox(); // Reinitialize lightbox for zoomable images
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

        const partyName = document.getElementById('party-name')?.value.trim();
        const contactNo = document.getElementById('contact-no')?.value.trim();

        if (!partyName) {
            alert('Party Name is required.');
            return;
        }

        try {
            // Check if the party already exists
            const { data: existingParty, error: fetchError } = await supabaseClient
                .from('parties')
                .select('name')
                .eq('name', partyName);

            if (fetchError) throw fetchError;

            if (existingParty && existingParty.length > 0) {
                alert('A party with this name already exists. Please choose another name.');
                return;
            }

            // Insert new party
            const { error: insertError } = await supabaseClient.from('parties').insert({
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

async function editParty(partyId) {
    const newName = prompt('Enter new party name:');
    const newContact = prompt('Enter new contact number:');

    if (!newName) {
        alert('Party name is required.');
        return;
    }

    try {
        const { error } = await supabaseClient.from('parties').update({
            name: newName,
            contact_no: newContact || null,
        }).eq('id', partyId);

        if (error) throw error;

        alert('Party updated successfully!');
        fetchPartySummary(); // Refresh the party list
    } catch (err) {
        console.error('Error updating party:', err.message);
        alert('Failed to update party.');
    }
}

async function deleteParty(partyId) {
    const confirmDelete = confirm('Are you sure you want to delete this party and all related entries?');
    if (!confirmDelete) return;

    try {
        // Delete all entries for the party
        const { error: deleteEntriesError } = await supabaseClient.from('entries').delete().eq('party_id', partyId);
        if (deleteEntriesError) throw deleteEntriesError;

        // Delete the party itself
        const { error: deletePartyError } = await supabaseClient.from('parties').delete().eq('id', partyId);
        if (deletePartyError) throw deletePartyError;

        alert('Party and related entries deleted successfully!');
        fetchPartySummary(); // Refresh the party list
    } catch (err) {
        console.error('Error deleting party:', err.message);
        alert('Failed to delete party.');
    }
}
async function deleteEntry(entryId, partyId) {
    const confirmDelete = confirm('Are you sure you want to delete this entry?');
    if (!confirmDelete) return;

    try {
        const { error } = await supabaseClient.from('entries').delete().eq('id', entryId);
        if (error) throw error;

        alert('Entry deleted successfully!');
        fetchPartyLedger(partyId); // Refresh the ledger after deleting
    } catch (err) {
        console.error('Error deleting entry:', err.message);
        alert('Failed to delete entry.');
    }
}



let currentEditEntryId = null; // To track the entry being edited

async function editEntry(entryId, partyId) {
    try {
        // Fetch the existing entry data
        const { data: entry, error } = await supabaseClient
            .from('entries')
            .select('*')
            .eq('id', entryId)
            .single();

        if (error) throw error;

        // Populate the form fields with the entry data
        document.getElementById('date').value = entry.date.split('T')[0]; // Format for date input
        document.getElementById('particulars').value = entry.particulars || '';
        document.getElementById('debit').value = entry.debit || 0;
        document.getElementById('credit').value = entry.credit || 0;

        // Display the current photo if available
        const currentPhoto = document.getElementById('current-photo');
        if (currentPhoto) {
            if (entry.photo_url) {
                currentPhoto.src = entry.photo_url;
                currentPhoto.style.display = 'block';
            } else {
                currentPhoto.style.display = 'none';
            }
        } else {
            console.error('Current photo element not found in the DOM.');
        }

        // Set the current edit state
        currentEditEntryId = entryId;

        // Show the Cancel Edit button
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';
        document.getElementById('save-entry-btn').textContent = 'Save Changes';
    } catch (err) {
        console.error('Error fetching entry for editing:', err.message);
        alert('Failed to fetch entry for editing.');
    }
}



function resetAddEntryForm() {
    // Clear form fields
    document.getElementById('date').value = '';
    document.getElementById('particulars').value = '';
    document.getElementById('debit').value = '';
    document.getElementById('credit').value = '';
    document.getElementById('photo').value = '';
    document.getElementById('current-photo').style.display = 'none';

    // Reset to add mode
    currentEditEntryId = null;

    // Hide the Cancel Edit button and reset the Save button text
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('save-entry-btn').textContent = 'Add Entry';
}

// Attach the reset function to the Cancel Edit button




async function filterPartyLedger(partyId) {
    const fromDate = document.getElementById('from-date').value;
    const toDate = document.getElementById('to-date').value;

    try {
        // Fetch ledger entries
        let query = supabaseClient
            .from('entries')
            .select('*')
            .eq('party_id', partyId)
            .order('date', { ascending: true });

        // Apply date filters if provided
        if (fromDate) query = query.gte('date', fromDate);
        if (toDate) query = query.lte('date', toDate);

        const { data: entries, error } = await query;

        if (error) throw error;

        // Render the filtered entries
        renderPartyLedger(entries, partyId);
    } catch (err) {
        console.error('Error filtering party ledger:', err.message);
        alert('Failed to filter ledger entries.');
    }
}

function printLedger() {
    const ledgerTable = document.getElementById('party-ledger-table');
    if (!ledgerTable) {
        console.error('Ledger table not found.');
        return;
    }

    // Clone the table to manipulate it without affecting the original table
    const clonedTable = ledgerTable.cloneNode(true);

    // Remove the "Entered By" and "Edit/Delete" columns
    Array.from(clonedTable.querySelectorAll('tr')).forEach((row) => {
        // Remove the last column (Edit/Delete)
        if (row.cells.length > 6) {
            row.deleteCell(-1);
        }
        // Remove the second-to-last column (Entered By)
        if (row.cells.length > 5) {
            row.deleteCell(-1);
        }
    });

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Party Ledger</title>
            <style>
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f4f4f4;
                }
            </style>
        </head>
        <body>
            <h1>Party Ledger</h1>
            ${clonedTable.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}



document.getElementById('filter-ledger-btn').addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const partyId = urlParams.get('party_id');
    if (partyId) {
        filterPartyLedger(partyId);
    } else {
        alert('No party selected.');
    }
});

document.getElementById('print-ledger-btn').addEventListener('click', printLedger);


document.getElementById('photo').addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default click behavior

    const useCamera = confirm('Would you like to take a photo using your camera?');
    const photoInput = document.getElementById('photo');

    if (useCamera) {
        photoInput.setAttribute('capture', 'environment'); // Set camera as default
    } else {
        photoInput.removeAttribute('capture'); // Allow gallery
    }

    photoInput.click(); // Open the file picker
});

