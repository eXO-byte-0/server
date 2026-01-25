// ============================================
// SERVEUR MULTI-JOUEUR PLAYER-SERVER
// Compatible Render.com + PlayCanvas
// ============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Configuration Express
const app = express();
const server = http.createServer(app);

// Configuration Socket.io CRITIQUE pour PlayCanvas
const io = socketIo(server, {
    cors: {
        origin: "*", // Accepte toutes les origines (PlayCanvas, localhost, etc.)
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Support WebSocket + fallback HTTP
    pingTimeout: 60000, // Important pour Render (plan gratuit)
    pingInterval: 25000
});

// Variables serveur
const PORT = process.env.PORT || 3000;
let players = {};
let playerCount = 0;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ============================================
// ROUTES EXPRESS
// ============================================

// Route principale - Page de test
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Player Server - PlayCanvas Multiplayer</title>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 800px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
                h1 {
                    font-size: 2.5rem;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                }
                h1 .icon { font-size: 2.8rem; }
                .status {
                    background: rgba(46, 204, 113, 0.2);
                    border: 2px solid #2ecc71;
                    border-radius: 10px;
                    padding: 15px;
                    margin: 20px 0;
                    font-size: 1.2rem;
                    font-weight: bold;
                }
                .info-box {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                    padding: 20px;
                    margin: 15px 0;
                    text-align: left;
                }
                code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 8px 15px;
                    border-radius: 6px;
                    font-family: 'Courier New', monospace;
                    display: block;
                    margin: 10px 0;
                    word-break: break-all;
                }
                .player-count {
                    font-size: 4rem;
                    font-weight: bold;
                    color: #f1c40f;
                    margin: 20px 0;
                }
                .instructions {
                    text-align: left;
                    margin-top: 30px;
                    background: rgba(0, 0, 0, 0.2);
                    padding: 20px;
                    border-radius: 10px;
                }
                .instructions ol {
                    margin-left: 20px;
                    margin-top: 10px;
                }
                .instructions li {
                    margin-bottom: 10px;
                }
                footer {
                    margin-top: 30px;
                    font-size: 0.9rem;
                    opacity: 0.8;
                }
                .connected-players {
                    margin-top: 20px;
                    max-height: 200px;
                    overflow-y: auto;
                    text-align: left;
                }
                .player-item {
                    background: rgba(255, 255, 255, 0.05);
                    margin: 5px 0;
                    padding: 10px;
                    border-radius: 5px;
                    display: flex;
                    justify-content: space-between;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>
                    <span class="icon">🎮</span>
                    Player Server for PlayCanvas
                    <span class="icon">⚡</span>
                </h1>
                
                <div class="status">
                    ✅ SERVER STATUS: <span id="serverStatus">ONLINE</span>
                </div>
                
                <div class="player-count">
                    <span id="liveCount">${playerCount}</span>
                    <div style="font-size: 1rem;">PLAYERS CONNECTED</div>
                </div>
                
                <div class="info-box">
                    <h3>📡 Server Information</h3>
                    <p><strong>Server URL:</strong></p>
                    <code id="serverUrl">${req.protocol}://${req.get('host')}</code>
                    
                    <p><strong>WebSocket Endpoint:</strong></p>
                    <code>ws://${req.get('host')}/socket.io/</code>
                    
                    <p><strong>Port:</strong> ${PORT}</p>
                    <p><strong>Uptime:</strong> <span id="uptime">Just started</span></p>
                </div>
                
                <div class="connected-players" id="playersList">
                    <h3>👥 Connected Players</h3>
                    <div id="playersContainer">
                        ${Object.keys(players).map(id => `
                            <div class="player-item">
                                <span>${players[id].username || 'Player'}</span>
                                <span>${id.substring(0, 8)}...</span>
                            </div>
                        `).join('') || '<p style="text-align:center;opacity:0.7;">No players connected</p>'}
                    </div>
                </div>
                
                <div class="instructions">
                    <h3>🚀 How to Use in PlayCanvas:</h3>
                    <ol>
                        <li>In PlayCanvas Editor, go to <strong>Project Settings → External Scripts</strong></li>
                        <li>Add: <code>https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js</code></li>
                        <li>In your Network script, connect to: <code id="connectionUrl">${req.protocol}://${req.get('host')}</code></li>
                        <li>Use: <code>var socket = io.connect('${req.protocol}://${req.get('host')}');</code></li>
                    </ol>
                </div>
                
                <footer>
                    Render.com + PlayCanvas Multiplayer Server | Version 2.0
                </footer>
            </div>
            
            <!-- Socket.io client pour la page web -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js"></script>
            <script>
                // Connexion au serveur
                const socket = io('${req.protocol}://${req.get('host')}', {
                    transports: ['websocket', 'polling']
                });
                
                let startTime = Date.now();
                
                // Mise à jour du compte de joueurs en temps réel
                socket.on('playerCountUpdate', (count) => {
                    document.getElementById('liveCount').textContent = count;
                });
                
                // Mise à jour de la liste des joueurs
                socket.on('playerListUpdate', (playersList) => {
                    const container = document.getElementById('playersContainer');
                    if (Object.keys(playersList).length === 0) {
                        container.innerHTML = '<p style="text-align:center;opacity:0.7;">No players connected</p>';
                    } else {
                        container.innerHTML = Object.keys(playersList).map(id => `
                            <div class="player-item">
                                <span>${playersList[id].username || 'Player'}</span>
                                <span>${id.substring(0, 8)}...</span>
                            </div>
                        `).join('');
                    }
                });
                
                // Mise à jour de l'uptime
                function updateUptime() {
                    const uptime = Date.now() - startTime;
                    const hours = Math.floor(uptime / (1000 * 60 * 60));
                    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
                    
                    document.getElementById('uptime').textContent = 
                        `${hours}h ${minutes}m ${seconds}s`;
                }
                
                setInterval(updateUptime, 1000);
                
                socket.on('connect', () => {
                    console.log('Connected to server dashboard');
                    document.getElementById('serverStatus').textContent = 'ONLINE';
                    document.getElementById('serverStatus').style.color = '#2ecc71';
                });
                
                socket.on('disconnect', () => {
                    document.getElementById('serverStatus').textContent = 'OFFLINE';
                    document.getElementById('serverStatus').style.color = '#e74c3c';
                });
            </script>
        </body>
        </html>
    `);
});

// Route de santé pour Render (obligatoire)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        players: playerCount,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ============================================
// GESTION SOCKET.IO - LOGIQUE MULTI-JOUEUR
// ============================================

io.on('connection', (socket) => {
    console.log(`🟢 [${new Date().toLocaleTimeString()}] Connexion: ${socket.id}`);
    
    // Événement 'create' - Ton ancien serveur Glitch
    socket.on('create', () => {
        const playerId = socket.id;
        
        // Position aléatoire
        const spawnX = Math.random() * 20 - 10;
        const spawnZ = Math.random() * 20 - 10;
        
        players[playerId] = {
            id: playerId,
            x: spawnX,
            y: 1,
            z: spawnZ,
            username: `Player_${playerCount + 1}`,
            connected: true,
            joinedAt: new Date().toISOString()
        };
        
        playerCount++;
        
        console.log(`👤 [${playerId}] Joueur créé: ${players[playerId].username}`);
        
        // 1. Envoie l'ID au client (comme ton ancien serveur)
        socket.emit('register', {
            id: playerId,
            players: players
        });
        
        // 2. Informe les autres joueurs
        socket.broadcast.emit('playerJoined', players[playerId]);
        
        // 3. Met à jour tout le monde
        io.emit('playerCountUpdate', playerCount);
        io.emit('playerListUpdate', players);
    });
    
    // Événement 'spawn' - Pour ton deuxième script
    socket.on('spawn', (data) => {
        const playerId = data.id || socket.id;
        const username = data.name || data.username || `Player_${playerCount + 1}`;
        
        if (!players[playerId]) {
            players[playerId] = {
                id: playerId,
                x: 0,
                y: 1,
                z: 0,
                username: username,
                connected: true,
                joinedAt: new Date().toISOString()
            };
            
            playerCount++;
            
            // Informe le nouveau joueur de tous les joueurs existants
            socket.emit('playerData', {
                id: playerId,
                players: players
            });
            
            // Informe les autres
            socket.broadcast.emit('spawn', {
                id: playerId,
                username: username
            });
            
            io.emit('playerCountUpdate', playerCount);
            io.emit('playerListUpdate', players);
            
            console.log(`👥 [${playerId}] Spawn: ${username}`);
        }
    });
    
    // Mise à jour de position
    socket.on('positionUpdate', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            players[data.id].z = data.z;
            
            socket.broadcast.emit('playerMoved', {
                id: data.id,
                x: data.x,
                y: data.y,
                z: data.z
            });
        }
    });
    
    // Transform (position + rotation)
    socket.on('transform', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.pos.x;
            players[data.id].y = data.pos.y;
            players[data.id].z = data.pos.z;
            players[data.id].rotation = data.rot;
            
            socket.broadcast.emit('transform', {
                id: data.id,
                pos: data.pos,
                rot: data.rot
            });
        }
    });
    
    // Animation
    socket.on('anim', (data) => {
        if (players[data.id]) {
            players[data.id].direction = data.direction;
            socket.broadcast.emit('anim', {
                id: data.id,
                direction: data.direction
            });
        }
    });
    
    // Chat
    socket.on('onsendmsg', (data) => {
        console.log(`💬 [${data.username || 'Unknown'}]: ${data.chatText || data.text}`);
        
        io.emit('recmsg', {
            username: data.username || 'Player',
            text: data.chatText || data.text,
            timestamp: new Date().toLocaleTimeString()
        });
    });
    
    // Ping/Pong pour garder la connexion active sur Render
    socket.on('ping', () => {
        socket.emit('pong');
    });
    
    // Déconnexion
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`🔴 [${new Date().toLocaleTimeString()}] Déconnexion: ${socket.id} (${players[socket.id].username})`);
            
            // Informe les autres joueurs
            socket.broadcast.emit('killPlayer', socket.id);
            socket.broadcast.emit('disconnected', { id: socket.id });
            
            // Supprime le joueur
            delete players[socket.id];
            playerCount = Math.max(0, playerCount - 1);
            
            // Met à jour tout le monde
            io.emit('playerCountUpdate', playerCount);
            io.emit('playerListUpdate', players);
            
            console.log(`📊 Joueurs restants: ${playerCount}`);
        }
    });
    
    // Force disconnect
    socket.on('forceDisconnect', (data) => {
        if (players[data.id]) {
            delete players[data.id];
            playerCount--;
            io.emit('playerCountUpdate', playerCount);
            io.emit('playerListUpdate', players);
        }
    });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   🚀 PLAYER SERVER FOR PLAYCANVAS - MULTIPLAYER      ║
    ║   📍 Render.com Edition v2.0                          ║
    ║                                                       ║
    ╠═══════════════════════════════════════════════════════╣
    ║                                                       ║
    ║   🌐 HTTP Server:  http://0.0.0.0:${PORT}                ║
    ║   📡 WebSocket:    ws://0.0.0.0:${PORT}/socket.io/     ║
    ║   ⏰ Started:      ${new Date().toLocaleString()}     ║
    ║                                                       ║
    ╠═══════════════════════════════════════════════════════╣
    ║                                                       ║
    ║   ✅ Health Check:  http://0.0.0.0:${PORT}/health      ║
    ║   📊 Dashboard:     http://0.0.0.0:${PORT}/           ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
    `);
    
    console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎮 En attente de connexions PlayCanvas...`);
});

// Gestion des erreurs
process.on('uncaughtException', (err) => {
    console.error('❌ ERREUR NON GÉRÉE:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ PROMESSE REJETÉE:', reason);
});
