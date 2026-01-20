// server.js - Serveur WebSocket CORRIGÉ pour Render
const express = require('express');
const http = require('http'); // <-- Important
const WebSocket = require('ws');

const app = express();
// 1. Créer un serveur HTTP à partir de l'app Express
const server = http.createServer(app);
// 2. Attacher le serveur WebSocket AU SERVEUR HTTP, sur le chemin '/'
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000; // Render fournit le port via cette variable

// Vous pouvez garder vos routes Express si besoin
app.get('/', (req, res) => {
  res.send('Serveur de jeu multijoueur opérationnel');
});

// --- Le reste de votre logique (players, generateId, etc.) reste IDENTIQUE ---
const players = new Map();

wss.on('connection', (ws) => {
    const playerId = generateId();
    players.set(playerId, { ws: ws, id: playerId, lastUpdate: null });
    console.log(`✅ Nouveau joueur: ${playerId}`);

    // ... (Votre code pour init, allPlayers, broadcast) ...
});

function broadcast(data, excludeId = null) {
    const message = JSON.stringify(data);
    players.forEach((player, id) => {
        if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
}

function generateId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}
// --- Fin de votre logique ---

// 3. Démarrer le serveur UNIQUE sur le port fourni par Render
server.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur le port ${PORT}`);
    console.log(`🌍 WebSocket disponible sur: wss://server-vuh0.onrender.com`);
});
