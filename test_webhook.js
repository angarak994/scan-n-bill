async function test() {
  const payload = {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      from: { id: 1386320937, is_bot: false, first_name: "Test" },
      chat: { id: 1386320937, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: "/start"
    }
  };

  try {
    const res = await fetch('https://billiards-qr-sessions.vercel.app/api/telegram-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Fetch Error:", e.message);
  }
}
test();
