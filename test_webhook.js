const http = require('http');

const data = JSON.stringify({
  update_id: 12345,
  message: {
    message_id: 1,
    chat: { id: 123456789 },
    text: '/start'
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/telegram-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
