const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Generate a fake but "valid" looking corporate card number
function generateCard() {
    const bin = Math.floor(Math.random() * 100000000).toString().padStart(8, '0'); 
    const account = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const checkDigit = (Math.random() * 10).toFixed(0);
    return `${bin}${account}${checkDigit}`;
}

app.get('/api/card', (req, res) => {
    const card = generateCard();
    res.json({ cardNumber: card, expiry: '12/28', cvv: '999', type: 'CORP_ADL' });
});

app.post('/api/payid', async (req, res) => {
    const { amount, sender, receiver } = req.body;
    // Simulate NPP API latency
    await new Promise(r => setTimeout(r, 1500));
    res.json({ status: 'APPROVED', traceId: Math.random().toString(36).substr(2, 9) });
});

app.listen(port, () => {
    console.log(`KammiHaxed running on port ${port}`);
});