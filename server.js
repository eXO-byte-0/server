// server.js - Serveur Multi-joueur pour PlayCanvas (Render.com)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // IMPORTANT: Autoriser toutes les origines pour PlayCanvas
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Configuration pour Render
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Important pour Render

// Stockage des joueurs
let players = {};
let playerCount = 0;

// Configuration Express
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route principale pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Serveur Multi-joueur PlayCanvas</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .status { color: green; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>🎮 Serveur Multi-joueur PlayCanvas</h1>
            <p class="status">✅ Serveur en ligne</p>
            <p>Joueurs connectés: <span id="playerCount">${playerCount}</span></p>
            <p>URL à utiliser dans PlayCanvas: <code>${req.protocol}://${req.get('host')}</code></p>
            <script>
                const socket = io();
                socket.on('playerCountUpdate', (count) => {
                    document.getElementById('playerCount').textContent = count;
                });
            </script>
        </body>
        </html>
    `);
});

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
    console.log(`🟢 Nouvelle connexion: ${socket.id}`);
    
    // Création d'un nouveau joueur
    socket.on('create', () => {
        const playerId = socket.id;
        players[playerId] = {
            id: playerId,
            x: Math.random() * 10 - 5,
            y: 1,
            z: Math.random() * 10 - 5,
            username: `Player_${playerId.substring(0, 4)}`,
            connected: true
        };
        
        playerCount++;
        
        // Envoie l'ID au client
        socket.emit('register', {
            id: playerId,
            players: players
        });
        
        // Informe les autres joueurs
        socket.broadcast.emit('playerJoined', players[playerId]);
        
        // Met à jour le compte de joueurs pour tous
        io.emit('playerCountUpdate', playerCount);
        
        console.log(`👤 Joueur créé: ${playerId}, Total: ${playerCount}`);
    });
    
    // Mise à jour de position
    socket.on('positionUpdate', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            players[data.id].z = data.z;
            
            // Transmet la position à tous sauf l'émetteur
            socket.broadcast.emit('playerMoved', data);
        }
    });
    
    // Chat
    socket.on('onsendmsg', (data) => {
        console.log(`💬 Chat: ${data.username}: ${data.chatText}`);
        io.emit('recmsg', data);
    });
    
    // Animation
    socket.on('anim', (data) => {
        if (players[data.id]) {
            players[data.id].direction = data.direction;
            socket.broadcast.emit('anim', data);
        }
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`🔴 Déconnexion: ${socket.id}`);
            
            // Informe les autres joueurs
            socket.broadcast.emit('killPlayer', socket.id);
            
            // Supprime le joueur
            delete players[socket.id];
            playerCount--;
            
            // Met à jour le compte
            io.emit('playerCountUpdate', playerCount);
            console.log(`Total joueurs: ${playerCount}`);
        }
    });
});

// Démarrage du serveur
server.listen(PORT, HOST, () => {
    console.log(`
    ============================================
    🚀 Serveur Multi-joueur PlayCanvas lancé !
    ============================================
    🌐 URL: http://${HOST}:${PORT}
    📡 Socket.io: ws://${HOST}:${PORT}/socket.io/
    🕐 Heure: ${new Date().toLocaleString()}
    ============================================
    `);
});
