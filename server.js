const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

let clients = [];
// Stockage des joueurs connectés
const players = new Map();

console.log(`🚀 Serveur multijoueur démarré sur le port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('Nouvelle connexion !');
    clients.push(ws);
    // Générer un ID unique pour le joueur
    const playerId = generateId();
    players.set(playerId, {
        ws: ws,
        id: playerId,
        lastUpdate: null
    });

    console.log(`✅ Nouveau joueur connecté: ${playerId} (Total: ${players.size})`);

    // Envoyer l'ID au joueur
    ws.send(JSON.stringify({
        type: 'init',
        id: playerId
    }));

    // Envoyer la liste des autres joueurs déjà connectés
    const otherPlayerIds = Array.from(players.keys()).filter(id => id !== playerId);
    ws.send(JSON.stringify({
        type: 'allPlayers',
        players: otherPlayerIds
    }));

    // Informer les autres joueurs qu'un nouveau joueur a rejoint
    broadcast({
        type: 'playerJoined',
        id: playerId
    }, playerId);

    // Gestion des messages reçus
    ws.on('message', (message) => {
        console.log('Message reçu:', message);
        try {
            const data = JSON.parse(message);
            handlePlayerMessage(playerId, data);
        } catch (err) {
            console.error('❌ Erreur parsing message:', err);
        }
    });

    // Gestion de la déconnexion
    ws.on('close', () => {
        console.log(`👋 Joueur déconnecté: ${playerId} (Restants: ${players.size - 1})`);
        players.delete(playerId);

        // Broadcast à tous les clients sauf l'envoyeur
        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        // Informer les autres de la déconnexion
        broadcast({
            type: 'playerLeft',
            id: playerId
        });
    });

    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
        console.log('Client déconnecté');
    // Gestion des erreurs
    ws.on('error', (error) => {
        console.error(`❌ Erreur WebSocket pour ${playerId}:`, error);
    });
});

console.log('Serveur WebSocket lancé sur le port 8080');
// =====================
// GESTION DES MESSAGES
// =====================
function handlePlayerMessage(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    switch(data.type) {
        case 'playerUpdate':
            // Stocker la dernière position
            player.lastUpdate = {
                x: data.x,
                y: data.y,
                z: data.z,
                rotX: data.rotX,
                rotY: data.rotY,
                rotZ: data.rotZ,
                state: data.state
            };

            // Broadcaster à tous les autres joueurs
            broadcast({
                type: 'playerUpdate',
                id: playerId,
                x: data.x,
                y: data.y,
                z: data.z,
                rotX: data.rotX,
                rotY: data.rotY,
                rotZ: data.rotZ,
                state: data.state
            }, playerId);
            break;

        // Vous pouvez ajouter d'autres types de messages ici
        case 'chat':
            broadcast({
                type: 'chat',
                id: playerId,
                message: data.message
            }, playerId);
            break;
    }
}

// =====================
// BROADCAST
// =====================
function broadcast(data, excludeId = null) {
    const message = JSON.stringify(data);
    
    players.forEach((player, id) => {
        if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    });
}

// =====================
// GÉNÉRATION D'ID
// =====================
function generateId() {
    return 'player_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// =====================
// HEARTBEAT (optionnel)
// =====================
// Envoyer un ping toutes les 30 secondes pour maintenir la connexion active
setInterval(() => {
    players.forEach((player, id) => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.ping();
        } else {
            // Nettoyer les connexions mortes
            players.delete(id);
            console.log(`🧹 Nettoyage joueur mort: ${id}`);
        }
    });
}, 30000);

// Gestion de l'arrêt propre du serveur
process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...');
    wss.clients.forEach((ws) => {
        ws.close();
    });
    wss.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});
