// ============================================
// SERVEUR MULTI-JOUEUR PLAYCANVAS - VERSION CORRIGÉE
// J2 VOIT J1 ✅
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
// SOCKET.IO - CORRIGÉ POUR J2 VOIT J1
// ============================================

io.on('connection', (socket) => {
    console.log(`🟢 Connexion: ${socket.id}`);
    
    // ========================================
    // CREATE - Quand client clique "Connect"
    // ========================================
    socket.on('create', () => {
        console.log(`📝 CREATE de ${socket.id}`);
        
        // Créer le joueur
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
        
        // 1️⃣ ENVOYER REGISTER AU CLIENT
        socket.emit('register', {
            id: socket.id,
            players: players
        });
        
        // ⭐⭐⭐ CORRECTION CRUCIALE ⭐⭐⭐
        // 2️⃣ ENVOYER TOUS LES JOUEURS EXISTANTS AU NOUVEAU JOUEUR
        let existingCount = 0;
        for (let existingId in players) {
            if (existingId !== socket.id && players[existingId].connected) {
                socket.emit('playerJoined', {
                    id: existingId,
                    username: players[existingId].username,
                    x: players[existingId].x,
                    y: players[existingId].y,
                    z: players[existingId].z
                });
                existingCount++;
                console.log(`   📤 Envoyé ${players[existingId].username} (${existingId}) au nouveau joueur`);
            }
        }
        console.log(`📊 ${existingCount} joueur(s) existant(s) envoyé(s) à ${socket.id}`);
        
        // 3️⃣ SPAWN LE JOUEUR POUR LUI-MÊME
        socket.emit('spawn', {
            id: socket.id,
            username: username,
            x: players[socket.id].x,
            y: players[socket.id].y,
            z: players[socket.id].z
        });
        
        // 4️⃣ ANNONCER LE NOUVEAU JOUEUR AUX AUTRES
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            username: username,
            x: players[socket.id].x,
            y: players[socket.id].y,
            z: players[socket.id].z
        });
        
        console.log(`📢 ${username} annoncé aux autres joueurs`);
        
        // 5️⃣ METTRE À JOUR LE COMPTEUR
        io.emit('playerCountUpdate', playerCount);
        
        console.log(`✅ ${username} prêt | Total: ${playerCount}`);
    });
    
    // ========================================
    // SPAWN - Quand client confirme (optionnel)
    // ========================================
    socket.on('spawn', (data) => {
        const playerId = data.id || socket.id;
        const username = data.name || data.username || players[playerId]?.username || `Player`;
        
        console.log(`🎮 SPAWN reçu de ${playerId} (${username})`);
        
        // Si le joueur n'existe pas (fallback)
        if (!players[playerId]) {
            players[playerId] = {
                id: playerId,
                x: data.x || 0,
                y: data.y || 1,
                z: data.z || 0,
                username: username,
                connected: true
            };
            playerCount++;
        }
        
        // Mettre à jour le nom
        players[playerId].username = username;
        
        // Confirmer au client
        socket.emit('spawn', {
            id: playerId,
            username: username,
            x: players[playerId].x,
            y: players[playerId].y,
            z: players[playerId].z
        });
        
        console.log(`✅ ${username} spawn confirmé`);
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
            
            // Log (optionnel)
            // console.log(`📍 ${players[data.id].username} → (${data.pos.x.toFixed(1)}, ${data.pos.y.toFixed(1)}, ${data.pos.z.toFixed(1)})`);
        }
    });
    
    // ========================================
    // ANIM - Animation du joueur
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
║   🚀 SERVEUR PLAYCANVAS - CORRIGÉ       ║
║   ✅ J2 VOIT J1                          ║
║                                          ║
╠══════════════════════════════════════════╣
║                                          ║
║   🌐 Port: ${PORT}                          ║
║   ⏰ Démarrage: ${new Date().toLocaleTimeString()}     ║
║                                          ║
╚══════════════════════════════════════════╝
    `);
    
    console.log(`🎮 En attente de connexions...`);
});

// Gestion des erreurs
process.on('uncaughtException', (err) => {
    console.error('❌ Erreur:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Promesse rejetée:', reason);
});
