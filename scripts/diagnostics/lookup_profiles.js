const WebSocket = require('ws');

const pubkeys = [
  '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2'
];

const relays = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
const found = {};

relays.forEach(relay => {
  const ws = new WebSocket(relay);
  ws.on('open', () => {
    const req = JSON.stringify(['REQ', 'profiles', { kinds: [0], authors: pubkeys, limit: 10 }]);
    ws.send(req);
  });
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg[0] === 'EVENT') {
      const pubkey = msg[2].pubkey;
      if (!found[pubkey]) {
        const content = JSON.parse(msg[2].content);
        found[pubkey] = { name: content.name || content.display_name, picture: content.picture };
        console.log('Relay:', relay);
        console.log('Pubkey:', pubkey.substring(0,8));
        console.log('Name:', found[pubkey].name);
        console.log('Picture:', found[pubkey].picture);
        console.log('---');
      }
    }
  });
});

setTimeout(() => { process.exit(0); }, 5000);
