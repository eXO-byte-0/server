// ============================================
// SERVEUR MULTI-JOUEUR PLAYCANVAS
// Compatible Render.com - VERSION CORRIGÉE
// ============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Configuration Express
const app = express();
const server = http.createServer(app);

// Configuration Socket.io OPTIMISÉE pour PlayCanvas
const io = socketIo(server, {
    cors: {
        origin: "*", // Accepte toutes les origines (PlayCanvas, localhost, etc.)
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Support WebSocket + fallback HTTP
    pingTimeout: 60000, // Important pour Render (plan gratuit)
    pingInterval: 25000,
    allowEIO3: true // Compatibilité avec anciennes versions Socket.io
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

// Route principale - Dashboard de test
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>PlayCanvas Multiplayer Server</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                    max-width: 900px;
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
                .connected-players {
                    margin-top: 20px;
                    max-height: 300px;
                    overflow-y: auto;
                    text-align: left;
                }
                .player-item {
                    background: rgba(255, 255, 255, 0.05);
                    margin: 5px 0;
                    padding: 15px;
                    border-radius: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-left: 3px solid #3498db;
                }
                .player-name {
                    font-weight: bold;
                    font-size: 1.1rem;
                }
                .player-id {
                    font-family: monospace;
                    opacity: 0.7;
                    font-size: 0.9rem;
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
                    line-height: 1.6;
                }
                footer {
                    margin-top: 30px;
                    font-size: 0.9rem;
                    opacity: 0.8;
                }
                .badge {
                    display: inline-block;
                    background: rgba(52, 152, 219, 0.3);
                    padding: 5px 10px;
                    border-radius: 5px;
                    font-size: 0.85rem;
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>
                    🎮 PlayCanvas Multiplayer Server
                </h1>
                
                <div class="status">
                    ✅ SERVER STATUS: <span id="serverStatus">ONLINE</span>
                </div>
                
                <div class="player-count">
                    <span id="liveCount">${playerCount}</span>
                    <div style="font-size: 1rem;">JOUEURS CONNECTÉS</div>
                </div>
                
                <div class="info-box">
                    <h3>📡 Informations Serveur</h3>
                    <p><strong>URL du serveur:</strong></p>
                    <code id="serverUrl">${req.protocol}://${req.get('host')}</code>
                    
                    <p style="margin-top:15px;"><strong>Pour connecter PlayCanvas:</strong></p>
                    <code>var socket = io.connect('${req.protocol}://${req.get('host')}');</code>
                    
                    <p style="margin-top:15px;"><strong>Port:</strong> ${PORT} | <strong>Uptime:</strong> <span id="uptime">Démarrage...</span></p>
                </div>
                
                <div class="connected-players" id="playersList">
                    <h3>👥 Joueurs Connectés <span class="badge" id="playerBadge">${playerCount}</span></h3>
                    <div id="playersContainer">
                        ${Object.keys(players).length > 0 ? Object.keys(players).map(id => `
                            <div class="player-item">
                                <span class="player-name">👤 ${players[id].username || 'Player'}</span>
                                <span class="player-id">${id.substring(0, 12)}...</span>
                            </div>
                        `).join('') : '<p style="text-align:center;opacity:0.7;padding:20px;">Aucun joueur connecté</p>'}
                    </div>
                </div>
                
                <div class="instructions">
                    <h3>🚀 Configuration PlayCanvas:</h3>
                    <ol>
                        <li><strong>Ajouter Socket.io:</strong> Project Settings → External Scripts → 
                            <code style="display:inline;padding:2px 6px;">https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js</code>
                        </li>
                        <li><strong>Dans votre script Network:</strong> Utilisez l'URL ci-dessus pour la connexion</li>
                        <li><strong>Events supportés:</strong> create, spawn, transform, anim, onsendmsg</li>
                        <li><strong>Test:</strong> Ouvrez 2 onglets avec votre jeu PlayCanvas</li>
                    </ol>
                </div>
                
                <footer>
                    Render.com + PlayCanvas | Version 2.1 Corrigée
                </footer>
            </div>
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js"></script>
            <script>
                const socket = io('${req.protocol}://${req.get('host')}', {
                    transports: ['websocket', 'polling']
                });
                
                let startTime = Date.now();
                
                socket.on('playerCountUpdate', (count) => {
                    document.getElementById('liveCount').textContent = count;
                    document.getElementById('playerBadge').textContent = count;
                });
                
                socket.on('playerListUpdate', (playersList) => {
                    const container = document.getElementById('playersContainer');
                    if (Object.keys(playersList).length === 0) {
                        container.innerHTML = '<p style="text-align:center;opacity:0.7;padding:20px;">Aucun joueur connecté</p>';
                    } else {
                        container.innerHTML = Object.keys(playersList).map(id => `
                            <div class="player-item">
                                <span class="player-name">👤 ${playersList[id].username || 'Player'}</span>
                                <span class="player-id">${id.substring(0, 12)}...</span>
                            </div>
                        `).join('');
                    }
                });
                
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
                    console.log('✅ Connecté au dashboard serveur');
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

// Route de santé pour Render (obligatoire pour le monitoring)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        players: playerCount,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        connectedPlayers: Object.keys(players).map(id => ({
            id: id.substring(0, 8),
            username: players[id].username
        }))
    });
});

// ============================================
// GESTION SOCKET.IO - LOGIQUE MULTI-JOUEUR
// ============================================

io.on('connection', (socket) => {
    console.log(`🟢 [${new Date().toLocaleTimeString()}] Nouvelle connexion: ${socket.id}`);
    
    // ========================================
    // EVENT: 'create' - Création initiale du joueur
    // ========================================
    socket.on('create', () => {
        const playerId = socket.id;
        
        // Position de spawn aléatoire
        const spawnX = Math.random() * 20 - 10;
        const spawnZ = Math.random() * 20 - 10;
        
        // Création du joueur dans la base
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
        
        console.log(`👤 [CREATE] Joueur ${playerId} créé à (${spawnX.toFixed(1)}, 1, ${spawnZ.toFixed(1)})`);
        
        // 1️⃣ Envoie l'ID et la liste complète au nouveau joueur
        socket.emit('register', {
            id: playerId,
            players: players
        });
        
        // 2️⃣ Met à jour les compteurs pour tous
        io.emit('playerCountUpdate', playerCount);
        io.emit('playerListUpdate', players);
        
        console.log(`✅ [REGISTER] Envoyé à ${playerId} | Total joueurs: ${playerCount}`);
    });
    
 // ========================================
// EVENT: 'spawn' - VERSION CORRIGÉE
// ========================================
socket.on('spawn', (data) => {
    const playerId = data.id || socket.id;
    const username = data.name || data.username || `Player_${playerCount}`;
    
    console.log(`🎮 [SPAWN] Demande de spawn pour ${playerId} (${username})`);
    
    // CAS 1: Le joueur existe déjà (après 'create')
    if (players[playerId]) {
        // Met à jour le nom
        players[playerId].username = username;
        
        console.log(`📝 [SPAWN] Nom mis à jour: ${username}`);
        
        // ✅ CRUCIAL: Envoie TOUS les joueurs existants au NOUVEAU joueur
        for (let id in players) {
            if (id !== playerId && players[id].connected) {
                // Envoie UN SEUL événement 'playerJoined' (comme ton ancien serveur)
                socket.emit('playerJoined', {
                    id: id,
                    username: players[id].username,
                    x: players[id].x,
                    y: players[id].y,
                    z: players[id].z
                });
                console.log(`   📤 Envoyé joueur existant ${id} au nouveau ${playerId}`);
            }
        }
        
        // ✅ CRUCIAL: Annonce le NOUVEAU joueur à TOUS les autres
        socket.broadcast.emit('playerJoined', {
            id: playerId,
            username: username,
            x: players[playerId].x,
            y: players[playerId].y,
            z: players[playerId].z
        });
        
        console.log(`📢 [SPAWN] ${username} annoncé aux autres joueurs`);
        
    } else {
        // CAS 2: Le joueur n'existe pas encore (fallback)
        console.warn(`⚠️ [SPAWN] Joueur ${playerId} introuvable, création auto`);
        
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
        
        // Envoie l'ID au client (register)
        socket.emit('register', { 
            id: playerId, 
            players: players 
        });
        
        // Annonce aux autres
        socket.broadcast.emit('playerJoined', {
            id: playerId,
            username: username,
            x: 0,
            y: 1,
            z: 0
        });
    }
    
    // Met à jour la liste
    io.emit('playerCountUpdate', playerCount);
    io.emit('playerListUpdate', players);
});
    
    // ========================================
    // EVENT: 'transform' - Position + Rotation
    // ========================================
    socket.on('transform', (data) => {
        if (players[data.id]) {
            // Met à jour la position du joueur
            players[data.id].x = data.pos.x;
            players[data.id].y = data.pos.y;
            players[data.id].z = data.pos.z;
            players[data.id].rotation = data.rot;
            
            // Broadcast aux autres joueurs
            socket.broadcast.emit('transform', {
                id: data.id,
                pos: data.pos,
                rot: data.rot
            });
        }
    });
    
    // ========================================
    // EVENT: 'anim' - Animation du joueur
    // ========================================
    socket.on('anim', (data) => {
        if (players[data.id]) {
            players[data.id].direction = data.direction;
            
            // Broadcast l'animation aux autres
            socket.broadcast.emit('anim', {
                id: data.id,
                direction: data.direction
            });
            
            // Logs optionnels (commentez si trop verbeux)
            // console.log(`🏃 [ANIM] ${players[data.id].username} direction: ${data.direction}`);
        }
    });
    
    // ========================================
    // EVENT: 'onsendmsg' - Message de chat
    // ========================================
    socket.on('onsendmsg', (data) => {
        const username = data.username || players[socket.id]?.username || 'Anonyme';
        const message = data.chatText || data.text || '';
        
        console.log(`💬 [CHAT] ${username}: ${message}`);
        
        // Broadcast le message à TOUS les joueurs (y compris l'émetteur)
        io.emit('recmsg', {
            username: username,
            text: message,
            timestamp: new Date().toLocaleTimeString()
        });
    });
    
    // ========================================
    // EVENT: 'ping' - Keep-alive pour Render.com
    // ========================================
    socket.on('ping', () => {
        socket.emit('pong');
    });
    
    // ========================================
    // EVENT: 'disconnect' - Déconnexion du joueur
    // ========================================
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            const username = players[socket.id].username;
            
            console.log(`🔴 [${new Date().toLocaleTimeString()}] Déconnexion: ${socket.id} (${username})`);
            
            // Informe les autres joueurs
            socket.broadcast.emit('killPlayer', socket.id);
            socket.broadcast.emit('disconnected', { id: socket.id });
            
            // Supprime le joueur
            delete players[socket.id];
            playerCount = Math.max(0, playerCount - 1);
            
            // Met à jour les compteurs
            io.emit('playerCountUpdate', playerCount);
            io.emit('playerListUpdate', players);
            
            console.log(`📊 Joueurs restants: ${playerCount}`);
        }
    });
    
    // ========================================
    // EVENT: 'forceDisconnect' - Déconnexion forcée
    // ========================================
    socket.on('forceDisconnect', (data) => {
        if (players[data.id]) {
            console.log(`⚠️ [FORCE DISCONNECT] ${data.id}`);
            delete players[data.id];
            playerCount = Math.max(0, playerCount - 1);
            io.emit('playerCountUpdate', playerCount);
            io.emit('playerListUpdate', players);
        }
    });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    const startTime = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎮 PLAYCANVAS MULTIPLAYER SERVER - RENDER.COM          ║
║   📍 Version 2.1 - CORRIGÉE & OPTIMISÉE                   ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   🌐 HTTP Server:    http://0.0.0.0:${PORT}                  ║
║   📡 WebSocket:      ws://0.0.0.0:${PORT}/socket.io/         ║
║   ⏰ Démarré:        ${startTime}                         ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   ✅ Health Check:   GET /health                          ║
║   📊 Dashboard:      GET /                                ║
║   🔌 Events:         create, spawn, transform, anim       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    
    console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎮 En attente de connexions PlayCanvas...`);
    console.log(`📝 Logs détaillés activés\n`);
});

// ============================================
// GESTION DES ERREURS
// ============================================

process.on('uncaughtException', (err) => {
    console.error('❌ ERREUR NON GÉRÉE:', err);
    console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ PROMESSE REJETÉE:', reason);
    console.error('Promise:', promise);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM reçu, arrêt propre du serveur...');
    server.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n⚠️ SIGINT reçu (Ctrl+C), arrêt du serveur...');
    server.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
    });
});
