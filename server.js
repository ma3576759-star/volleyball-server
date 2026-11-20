const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const rooms = {};

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('volleyball server ok');
});

const wss = new WebSocket.Server({ server });

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

wss.on('connection', (ws) => {
  ws.room = null;

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }

    if (m.t === 'create') {
      let code;
      do { code = makeCode(); } while (rooms[code]);
      rooms[code] = { clients: [ws] };
      ws.room = code;
      send(ws, { t: 'created', code });
    }

    else if (m.t === 'join') {
      const r = rooms[m.code];
      if (!r || r.clients.length >= 2) {
        send(ws, { t: 'error', msg: 'الغرفة مش موجودة أو مليانة' });
        return;
      }
      r.clients.push(ws);
      ws.room = m.code;
      send(ws, { t: 'joined', code: m.code });
      send(r.clients[0], { t: 'peer_joined' });
    }

    else if (m.t === 'relay') {
      const r = rooms[ws.room];
      if (!r) return;
      for (const c of r.clients) {
        if (c !== ws) send(c, { t: 'relay', data: m.data });
      }
    }
  });

  ws.on('close', () => {
    const r = rooms[ws.room];
    if (!r) return;
    r.clients = r.clients.filter((c) => c !== ws);
    for (const c of r.clients) send(c, { t: 'peer_left' });
    if (r.clients.length === 0) delete rooms[ws.room];
  });
});

server.listen(PORT, () => console.log('listening on ' + PORT));
