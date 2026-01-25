// ============================================
// SERVEUR MULTI-JOUEUR PLAYCANVAS - VERSION FINALE
// ============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 3000;
let players = {};
let playerCount = 0;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>PlayCanvas Server</title></head>
        <body>
            <h1>✅ Serveur PlayCanvas</h1>
            <p>Joueurs connectés: <span id="count">${playerCount}</span></p>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js"></script>
            <script>
                const socket = io();
                socket.on('playerCountUpdate', (count) => {
                    document.getElementById('count').textContent = count;
                });
            </script>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', players: playerCount });
});

// ============================================
// SOCKET.IO - VERSION SIMPLIFIÉE
// ============================================

io.on('connection', (socket) => {
    console.log(`🟢 Connexion: ${socket.id}`);
    
    // ========================================
    // CREATE - Version simplifiée
    // ========================================
    socket.on('create', () => {
        console.log(`📝 CREATE de ${socket.id}`);
        
        // 1. Créer le joueur dans la mémoire serveur
        const username = `Player_${playerCount + 1}`;
        
        players[socket.id] = {
            id: socket.id,
            x: Math.random() * 10 - 5,
            y: 1,
            z: Math.random() * 10 - 5,
            username: username,
            connected: true
        };
        
        playerCount++;
        
        console.log(`👤 Joueur créé: ${username} (${socket.id})`);
        
        // 2. ENVOYER TOUS les joueurs existants AU NOUVEAU CLIENT
        // D'abord, envoyer la liste complète via 'register'
        socket.emit('register', {
            id: socket.id,
            players: players
        });
        
        console.log(`📤 REGISTER envoyé à ${socket.id}`);
        
        // 3. POUR CHAQUE joueur existant, envoyer un 'playerJoined' au nouveau
        for (let existingId in players) {
            if (existingId !== socket.id) {
                socket.emit('playerJoined', {
                    id: existingId,
                    username: players[existingId].username,
                    x: players[existingId].x,
                    y: players[existingId].y,
                    z: players[existingId].z
                });
                console.log(`   → Envoyé ${players[existingId].username} à ${socket.id}`);
            }
        }
        
        // 4. Annoncer le nouveau joueur à TOUS les autres
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            username: username,
            x: players[socket.id].x,
            y: players[socket.id].y,
            z: players[socket.id].z
        });
        
        // 5. Mettre à jour le compteur
        io.emit('playerCountUpdate', playerCount);
        
        console.log(`✅ ${username} prêt | Total: ${playerCount}`);
    });
    
    // ========================================
    // TRANSFORM - Position + Rotation
    // ========================================
    socket.on('transform', (data) => {
        if (players[data.id]) {
            // Mettre à jour position serveur
            players[data.id].x = data.pos.x;
            players[data.id].y = data.pos.y;
            players[data.id].z = data.pos.z;
            
            // Broadcast aux AUTRES joueurs
            socket.broadcast.emit('transform', {
                id: data.id,
                pos: data.pos,
                rot: data.rot
            });
        }
    });
    
    // ========================================
    // ANIM - Animation
    // ========================================
    socket.on('anim', (data) => {
        if (players[data.id]) {
            socket.broadcast.emit('anim', {
                id: data.id,
                direction: data.direction
            });
        }
    });
    
    // ========================================
    // CHAT
    // ========================================
    socket.on('onsendmsg', (data) => {
        const username = data.username || players[socket.id]?.username || 'Joueur';
        const message = data.chatText || data.text || '';
        
        console.log(`💬 ${username}: ${message}`);
        
        io.emit('recmsg', {
            username: username,
            text: message,
            timestamp: new Date().toLocaleTimeString()
        });
    });
    
    // ========================================
    // DISCONNECT
    // ========================================
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            const username = players[socket.id].username;
            
            console.log(`🔴 Déconnexion: ${socket.id} (${username})`);
            
            // Informer les autres
            socket.broadcast.emit('killPlayer', socket.id);
            
            // Supprimer
            delete players[socket.id];
            playerCount = Math.max(0, playerCount - 1);
            
            // Mettre à jour compteur
            io.emit('playerCountUpdate', playerCount);
            
            console.log(`📊 Joueurs restants: ${playerCount}`);
        }
    });
});

// ============================================
// DÉMARRAGE
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║                                          ║
║   🚀 SERVEUR PLAYCANVAS - SIMPLIFIÉ     ║
║                                          ║
╠══════════════════════════════════════════╣
║                                          ║
║   🌐 Port: ${PORT}                          ║
║   ⏰ Démarrage: ${new Date().toLocaleTimeString()}     ║
║                                          ║
╚══════════════════════════════════════════╝
    `);
});
