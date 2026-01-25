// server.js - VERSION SIMPLE ET FONCTIONNELLE
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
let players = {};
let playerCount = 0;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>PlayCanvas Server</title></head>
        <body>
            <h1>✅ Serveur PlayCanvas en ligne</h1>
            <p>Joueurs: ${playerCount}</p>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js"></script>
            <script>
                const socket = io();
                socket.on('playerCountUpdate', (count) => {
                    document.querySelector('p').textContent = 'Joueurs: ' + count;
                });
            </script>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', players: playerCount });
});

// ============ SOCKET.IO ============
io.on('connection', (socket) => {
    console.log(`🟢 Connexion: ${socket.id}`);
    
    // CREATE
    socket.on('create', () => {
        console.log(`📝 CREATE de ${socket.id}`);
        
        // Donner un ID au client
        socket.emit('register', {
            id: socket.id,
            players: players
        });
        
        console.log(`📤 REGISTER envoyé à ${socket.id}`);
    });
    
    // SPAWN
    socket.on('spawn', (data) => {
        const playerId = data.id || socket.id;
        const username = data.name || data.username || `Player${playerCount}`;
        
        console.log(`🎮 SPAWN ${playerId} (${username})`);
        
        // Créer/MAJ joueur
        players[playerId] = {
            id: playerId,
            x: data.x || 0,
            y: data.y || 1,
            z: data.z || 0,
            username: username,
            connected: true
        };
        
        playerCount++;
        
        // 1. Confirmer au joueur
        socket.emit('spawn', {
            id: playerId,
            username: username,
            x: data.x || 0,
            y: data.y || 1,
            z: data.z || 0
        });
        
        // 2. Informer les AUTRES joueurs
        socket.broadcast.emit('playerJoined', {
            id: playerId,
            username: username,
            x: data.x || 0,
            y: data.y || 1,
            z: data.z || 0
        });
        
        // 3. Mettre à jour le compteur
        io.emit('playerCountUpdate', playerCount);
        
        console.log(`✅ ${username} spawné | Total: ${playerCount}`);
    });
    
    // TRANSFORM (position)
    socket.on('transform', (data) => {
        if (players[data.id]) {
            // MAJ position serveur
            players[data.id].x = data.pos.x;
            players[data.id].y = data.pos.y;
            players[data.id].z = data.pos.z;
            
            // Envoyer aux AUTRES joueurs
            socket.broadcast.emit('transform', {
                id: data.id,
                pos: data.pos,
                rot: data.rot
            });
        }
    });
    
    // ANIM
    socket.on('anim', (data) => {
        if (players[data.id]) {
            socket.broadcast.emit('anim', {
                id: data.id,
                direction: data.direction
            });
        }
    });
    
    // CHAT
    socket.on('onsendmsg', (data) => {
        console.log(`💬 ${data.username || 'Anonyme'}: ${data.chatText || data.text}`);
        
        io.emit('recmsg', {
            username: data.username || 'Joueur',
            text: data.chatText || data.text || ''
        });
    });
    
    // DISCONNECT
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`🔴 Déconnexion: ${socket.id} (${players[socket.id].username})`);
            
            // Informer les autres
            socket.broadcast.emit('killPlayer', socket.id);
            
            // Supprimer
            delete players[socket.id];
            playerCount = Math.max(0, playerCount - 1);
            
            // MAJ compteur
            io.emit('playerCountUpdate', playerCount);
        }
    });
});

// Démarrer
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 SERVEUR PLAYERCANVAS DÉMARRÉ
    📍 Port: ${PORT}
    🌐 URL: http://0.0.0.0:${PORT}
    ✅ Prêt pour les connexions
    `);
});
