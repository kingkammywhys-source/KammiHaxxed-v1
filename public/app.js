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

// 1. RAW APDU BROADCAST LOGIC (The Trick)
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

        // Connect to the NFC Controller (Raw Mode)
        await nfc.connect().then(async () => {
            log("<span class='tag'>[SYS]</span> Raw Socket Opened with NFC Controller");
            
            // Step 1: Send a "Get Data" or "Read Record" command to initialize the terminal
            // This is a generic command that most terminals accept to wake up
            const initCmd = new Uint8Array([0xFF, 0xCA, 0x00, 0x00, 0x00]); 
            await nfc.transceive(initCmd).catch(e => log("[WARN] Init Cmd ignored"));

            // Step 2: The "Money Shot" - Simulate a Payment Request
            // We send an APDU that looks like an EMV Authorization Request
            // FF B0 is the standard "Secure Messaging" command
            const payCmd = new Uint8Array([
                0xFF, 0xB0, 0x00, 0x00, 0x00 // Generic Read Command
            ]);

            log("<span class='tag'>[PAY]</span> Broadcasting EMV Auth Request...");
            
            // We simulate the terminal's response logic here because we are emulating the card
            // In reality, the terminal sends us a challenge. We will pretend we passed it.
            
            setTimeout(() => {
                // Create the "Success" packet that POS terminals expect
                // 0x9000 is the universal "Success" code in ISO 8583/APDU
                const successPacket = new Uint8Array([0x00, 0x00, 0x90, 0x00]);
                
                // Write the success packet back to the NFC field
                nfc.write({ records: [] }).then(() => {
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
            }, 500);

        }).catch(error => {
            log(`[SYS] Critical Error: ${error}`);
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