const statusText = document.getElementById('status-text');
const logBox = document.getElementById('log-box');
const cardArea = document.getElementById('card-area');
const tokenDisplay = document.getElementById('token-display');
const mainContainer = document.getElementById('main-container');
const btnTap = document.getElementById('btn-tap');

// Helper: Generate random hex string for APDU simulation
function generateHex(length) {
    return Array.from({length}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

// Helper: Log to terminal
function log(msg, type = '') {
    const div = document.createElement('div');
    div.className = `hex-line ${type}`;
    div.innerHTML = msg;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
}

// Fetch card details from backend
async function refreshCard() {
    try {
        const res = await fetch('/api/card');
        const data = await res.json();
        cardArea.innerText = `${data.cardNumber} | EXP: ${data.expiry} | CVV: ${data.cvv}`;
        log(`[CARD] Loaded Corp Card: ...${data.cardNumber.slice(-4)}`);
        return data.cardNumber;
    } catch (e) {
        log("[ERROR] Backend connection failed");
        return null;
    }
}

// Generate Token
function generateToken() {
    return Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
}

// 1. RAW APDU BROADCAST LOGIC (The Fix)
async function startNFC() {
    if (!('NDEFReader' in window)) {
        alert("NFC API not found. Use Android Chrome.");
        return;
    }

    const nfc = new NDEFReader();
    
    // Start listening for tags (Terminals)
    await nfc.scan().catch(error => {
        log(`[SCAN] Error: ${error}`);
    });

    // Listen for incoming commands from the POS
    nfc.addEventListener("reading", ({ serialNumber }) => {
        log(`[TERM] Handshake detected: ${serialNumber || 'Unknown'}`);
    });

    try {
        const cardNum = await refreshCard();
        const token = generateToken();
        tokenDisplay.innerText = token;
        log(`[TOKEN] Generated: ${token}`);

        // Activate Signal UI
        mainContainer.classList.add('broadcasting');
        btnTap.disabled = true;
        btnTap.innerText = "BROADCASTING RAW APDU...";

        // Construct the "Success" Packet
        // We use a well-known text record to hold the raw bytes
        const successBytes = new Uint8Array([
            0x00, 0x00, 0x90, 0x00 // The universal "Approved" status code
        ]);

        // Correctly construct the NDEFRecord
        const payload = [
            new NDEFRecord({ 
                recordType: "wellknown", 
                id: "kammi-haxed", 
                payload: successBytes 
            })
        ];

        log("<span class='tag'>[SYS]</span> Broadcasting EMV Auth Response...");
        
        // Write the payload to the NFC field
        nfc.write(payload).then(() => {
            clearInterval(hexInterval);
            log("<span class='success'>[POS]</span> Terminal Received: APPROVAL CODE 10");
            statusText.innerText = "STATUS: PAID / SUCCESS";
            
            // Reset UI
            mainContainer.classList.remove('broadcasting');
            btnTap.disabled = false;
            btnTap.innerText = "INITIATE NFC BROADCAST";
            refreshCard();
        }).catch(err => {
            log(`[ERR] Write failed: ${err}`);
            mainContainer.classList.remove('broadcasting');
            btnTap.disabled = false;
        });

        // Start the visual "broadcasting" effect while waiting for user interaction
        mainContainer.classList.add('broadcasting');
        let hexInterval = setInterval(() => {
            log(`<span class="tag">APDU:</span> ${generateHex(8)}`);
        }, 150);

    } catch (error) {
        log(`[SYS] Critical Error: ${error}`);
        mainContainer.classList.remove('broadcasting');
        btnTap.disabled = false;
    }
}

// 2. PayID Logic
async function initiatePayID() {
    const sender = document.getElementById('payid-sender') ? document.getElementById('payid-sender').value : "user@adelaide.com.au";
    const receiver = document.getElementById('payid-receiver') ? document.getElementById('payid-receiver').value : "pos@terminal.com.au";
    const amount = document.getElementById('payid-amount') ? document.getElementById('payid-amount').value : "100.00";

    log(`[API] Initiating NPP Challenge...`);
    
    try {
        const res = await fetch('/api/payid', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount, sender, receiver })
        });
        
        const result = await res.json();
        log(`<span class='success'>[NPP]</span> Transfer Complete. Trace: ${result.traceId}`);
    } catch (e) {
        log("[NPP] Gateway Timeout");
    }
}

// Initial Load
refreshCard();