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

// 1. FIXED NFC Broadcast Logic
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
        btnTap.innerText = "BROADCASTING...";

        // Simulate real-time APDU Hex Dump
        let hexInterval;
        
        // The actual NFC Write operation
        // We don't need .connect(), we just call .write()
        await nfc.write({
            records: [
                new NDEFRecord({ 
                    recordType: "absoluteURI", 
                    payload: new TextEncoder().encode("https://kammi-haxed.net/pay") 
                }),
                new NDEFRecord({
                    recordType: "wellKnown",
                    id: "auth",
                    payload: new TextEncoder().encode(token)
                })
            ]
        }).then(() => {
            clearInterval(hexInterval);
            log("<span class='success'>[PAY]</span> Payment Data Sent Successfully");
            
            setTimeout(() => {
                statusText.innerText = "STATUS: APPROVED";
                log("<span class='success'>[POS]</span> Response: 00 (Success)");
                
                // Reset UI
                mainContainer.classList.remove('broadcasting');
                btnTap.disabled = false;
                btnTap.innerText = "INITIATE NFC BROADCAST";
                refreshCard();
            }, 1500);
        }).catch(error => {
            clearInterval(hexInterval);
            log(`[ERR] Write failed: ${error}`);
            mainContainer.classList.remove('broadcasting');
            btnTap.disabled = false;
        });

        // Start the visual "broadcasting" effect while waiting for user interaction
        mainContainer.classList.add('broadcasting');
        hexInterval = setInterval(() => {
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
    const sender = document.getElementById('payid-sender').value;
    const receiver = document.getElementById('payid-receiver').value;
    const amount = document.getElementById('payid-amount').value;

    if(!sender || !receiver || !amount) {
        log("[WARN] Missing PayID parameters");
        return;
    }

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