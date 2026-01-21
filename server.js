// server.js - Serveur WebSocket pour jeu multijoueur Armory3D
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration
const PORT = process.env.PORT || 3000;
const POSITION_UPDATE_RATE = 50; // ms entre chaque broadcast de positions

// Stockage des joueurs connectés
const players = new Map();

// Génère un ID unique pour chaque joueur
function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

// Route de santé pour Render
app.get('/', (req, res) => {
    res.send('Serveur multijoueur Armory3D actif');
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        players: players.size,
        uptime: process.uptime()
    });
});

app.get('/stats', (req, res) => {
    const playersList = Array.from(players.values()).map(p => ({
        id: p.id,
        position: p.position,
        lastUpdate: p.lastUpdate
    }));
    
    res.json({
        totalPlayers: players.size,
        players: playersList
    });
});

// Gestion WebSocket
wss.on('connection', (ws) => {
    const playerId = generatePlayerId();
    
    // Initialiser le joueur
    const player = {
        id: playerId,
        ws: ws,
        position: { x: 0, y: 0, z: 0 },
        lastUpdate: Date.now()
    };
    
    players.set(playerId, player);
    
    console.log(`✅ Joueur connecté: ${playerId} (Total: ${players.size})`);
    
    // Envoyer l'ID au nouveau joueur
    ws.send(JSON.stringify({
        type: 'connected',
        id: playerId
    }));
    
    // Envoyer la liste des joueurs existants au nouveau joueur
    const existingPlayers = Array.from(players.values())
        .filter(p => p.id !== playerId)
        .map(p => ({
            id: p.id,
            x: p.position.x,
            y: p.position.y,
            z: p.position.z
        }));
    
    if(existingPlayers.length > 0) {
        ws.send(JSON.stringify({
            type: 'playersUpdate',
            players: existingPlayers
        }));
    }
    
    // Notifier tous les autres joueurs du nouveau joueur
    broadcast(JSON.stringify({
        type: 'playerJoined',
        player: {
            id: playerId,
            x: 0,
            y: 0,
            z: 0
        }
    }), playerId);
    
    // Gérer les messages du client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if(data.type === 'position') {
                // Mettre à jour la position du joueur
                player.position = {
                    x: data.x || 0,
                    y: data.y || 0,
                    z: data.z || 0
                };
                player.lastUpdate = Date.now();
                
                // Broadcaster la nouvelle position aux autres joueurs
                broadcast(JSON.stringify({
                    type: 'positionUpdate',
                    player: {
                        id: playerId,
                        x: player.position.x,
                        y: player.position.y,
                        z: player.position.z
                    }
                }), playerId);
            }
        } catch(e) {
            console.error('❌ Erreur parsing message:', e);
        }
    });
    
    // Gérer la déconnexion
    ws.on('close', () => {
        players.delete(playerId);
        console.log(`❌ Joueur déconnecté: ${playerId} (Total: ${players.size})`);
        
        // Notifier les autres joueurs
        broadcast(JSON.stringify({
            type: 'playerLeft',
            id: playerId
        }));
    });
    
    // Gérer les erreurs
    ws.on('error', (error) => {
        console.error(`❌ Erreur WebSocket pour ${playerId}:`, error);
    });
});

// Fonction pour broadcaster un message à tous sauf l'émetteur
function broadcast(message, excludePlayerId = null) {
    players.forEach((player, id) => {
        if(id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
}

// Nettoyage des joueurs inactifs (optionnel)
setInterval(() => {
    const now = Date.now();
    const timeout = 30000; // 30 secondes
    
    players.forEach((player, id) => {
        if(now - player.lastUpdate > timeout) {
            console.log(`⏱️ Timeout joueur: ${id}`);
            player.ws.close();
            players.delete(id);
        }
    });
}, 10000); // Vérifier toutes les 10 secondes

// Démarrer le serveur
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📡 WebSocket disponible sur ws://localhost:${PORT}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM reçu, fermeture du serveur...');
    
    // Notifier tous les joueurs
    players.forEach(player => {
        player.ws.close();
    });
    
    server.close(() => {
        console.log('✅ Serveur fermé proprement');
        process.exit(0);
    });
});
