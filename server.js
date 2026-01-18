// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let clients = [];

wss.on('connection', (ws) => {
    console.log('Nouvelle connexion !');
    clients.push(ws);

    ws.on('message', (message) => {
        console.log('Message reçu:', message);

        // Broadcast à tous les clients sauf l'envoyeur
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
        console.log('Client déconnecté');
    });
});

console.log('Serveur WebSocket lancé sur le port 8080');
