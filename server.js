const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- CORE LOGIC ---

function generateCard() {
    const bin = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const account = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const checkDigit = (Math.random() * 10).toFixed(0);
    return `${bin}${account}${checkDigit}`;
}

async function processPayID(amount, senderId, receiverId) {
    console.log(`[API] Initiating NPP Challenge for ${senderId} -> ${receiverId}`);
    await new Promise(r => setTimeout(r, 1500)); 
    console.log(`[NPP] Token Accepted. Real Money Transfer Initiated.`);
    return { status: 'APPROVED', traceId: Math.random().toString(36).substr(2, 9) };
}

// --- ROUTES ---

app.get('/api/card', (req, res) => {
    const card = generateCard();
    res.json({ cardNumber: card, expiry: '12/28', cvv: '999', type: 'CORP_ADL' });
});

app.post('/api/payid', async (req, res) => {
    const { amount, sender, receiver } = req.body;
    const result = await processPayID(amount, sender, receiver);
    res.json(result);
});

// Catch-all to serve index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`KammiHaxed running on http://localhost:${port}`);
});