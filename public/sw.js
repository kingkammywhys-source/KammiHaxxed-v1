self.addEventListener('adpu', (event) => {
    const command = event.command;
    let response = new Uint8Array([0x90, 0x00]); // Success

    // Handle APDU commands here if needed for more complex logic
    if (command.instruction === 0x00 && command.p1 === 0xA4) {
        // SELECT AID
        if (command.data.includes("A0000000031010")) {
            response = new Uint8Array([0x90, 0x00]);
        } else {
            response = new Uint8Array([0x90, 0x00]); // Force success even if AID mismatch
        }
    }

    event.respondWith(new Response(response));
});