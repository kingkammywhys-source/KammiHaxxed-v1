const statusText = document.getElementById('status-text');
const logBox = document.getElementById('log-box');
const cardArea = document.getElementById('card-area');

function log(msg) {
    logBox.innerHTML += `> ${msg}<br>`;
    logBox.scrollTop = logBox.scrollHeight;
}

async function refreshCard() {
    try {
        const res = await fetch('/api/card');
        const data = await res.json();
        cardArea.innerText = `CARD: ${data.cardNumber} | EXP: ${data.expiry} | CVV: ${data.cvv}`;
        log(`New Corp Card Generated: ${data.cardNumber}`);
    } catch (e) {
        log("Error fetching card.");
    }
}

async function startNFC() {
    if (!('NDEFReader' in window)) {
        alert("NFC not supported on this device/browser. Use Android Chrome.");
        return;
    }

    const nfc = new NDEFReader();
    
    await nfc.scan().catch(error => {
        log(`NFC Scan Error: ${error}`);
    });

    nfc.addEventListener("reading", ({ serialNumber, message }) => {
        log(`Terminal detected: ${serialNumber}`);
    });

    try {
        statusText.innerText = "Scanning for Terminal...";
        
        const payload = [
            new NDEFRecord({ 
                recordType: "absoluteURI", 
                id: "kammi-haxed", 
                payload: new TextEncoder().encode("https://notrack.ai/haxed") 
            }),
            new NDEFRecord({
                recordType: "wellKnown",
                id: "token",
                payload: new TextEncoder().encode(generateToken())
            })
        ];

        await nfc.connect().then(() => {
            log("Connected to NFC Controller");
            statusText.innerText = "Transmitting Payment Data...";
            
            return nfc.write(payload);
        }).then(() => {
            statusText.innerText = "Data Transmitted! Wait for Approval...";
            
            setTimeout(() => {
                statusText.innerText = "STATUS: APPROVED / PAID";
                statusText.style.color = "#00ff00"; 
                log("POS Terminal Response: APPROVAL CODE 10");
                refreshCard(); 
            }, 2000);
        }).catch(error => {
            log(`Write Error: ${error}`);
        });

    } catch (error) {
        log(`NFC Error: ${error}`);
    }
}

async function initiatePayID() {
    statusText.innerText = "Contacting NPP Gateway...";
    const amount = prompt("Enter Amount (AUD):", "100.00");
    if(!amount) return;

    const sender = "payid@adelaidecorp.com.au";
    const receiver = "payid@pos-terminal.com.au";

    try {
        const res = await fetch('/api/payid', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ amount, sender, receiver })
        });
        
        const result = await res.json();
        statusText.innerText = `PAYID SUCCESS: ${result.status}`;
        log(`Transaction Complete. Trace: ${result.traceId}`);
    } catch (e) {
        log("NPP Gateway Timeout");
    }
}

function generateToken() {
    return Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

refreshCard();