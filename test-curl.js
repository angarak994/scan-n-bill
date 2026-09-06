fetch('https://graph.facebook.com/v25.0/1343834088802858/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer EAAbz1HZAgZB44BSV3ZAoYjIsrPclZCh0Ui7cMMiUsHVXRs2cC8zugk8FOTnGZBZBa6xNLmPBNZCzPNNqEwO2ljTRevZBOYJOTJKz72wkfm8Y9jjL70QoAoADrEC9ZAKNcwAOgcPOZBhg9fZBXZBz5yBoIo9JlB4ua5hJHCAZAhkHyafM8zSi82W9wIUM7i7XBsSBU4PK2qZC7d0YAs63BsEgRv7Yfrgfxhe5TwsZBdsVld9ZC3fmPIojcD60VHj93goSkfTUZBLKwoZACCEZA8IrZCRJz6qyRuvoZC71U',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "messaging_product": "whatsapp",
    "to": "918208388320",
    "type": "template",
    "template": { "name": "hello_world", "language": { "code": "en_US" } }
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
