// ============================================
// SERVEUR MULTI-JOUEUR PLAYCANVAS - AVEC PROJECTILES
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
let projectiles = {}; // ← NOUVEAU: Stockage des projectiles
let playerCount = 0;
let projectileCount = 0;

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
            <p>Projectiles actifs: <span id="projectileCount">${Object.keys(projectiles).length}</span></p>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js"></script>
            <script>
                const socket = io();
                socket.on('playerCountUpdate', (count) => {
                    document.getElementById('count').textContent = count;
                });
                socket.on('projectileCountUpdate', (count) => {
                    document.getElementById('projectileCount').textContent = count;
                });
            </script>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        players: playerCount,
        projectiles: Object.keys(projectiles).length
    });
});

// ============================================
// SOCKET.IO - AVEC PROJECTILES
// ============================================

io.on('connection', (socket) => {
    console.log(`🟢 Connexion: ${socket.id}`);
    
    // ========================================
    // CREATE - Joueur
    // ========================================
    socket.on('create', () => {
        console.log(`📝 CREATE de ${socket.id}`);
        
        // 1. Créer le joueur
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
        
        // 2. Envoyer TOUS les joueurs existants
        socket.emit('register', {
            id: socket.id,
            players: players
        });
        
        console.log(`📤 REGISTER envoyé à ${socket.id}`);
        
        // 3. Envoyer CHAQUE joueur existant au nouveau
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
        
        // 4. Envoyer TOUS les projectiles existants au nouveau
        for (let projectileId in projectiles) {
            const projectile = projectiles[projectileId];
            socket.emit('projectileCreated', {
                id: projectileId,
                ownerId: projectile.ownerId,
                type: projectile.type,
                position: projectile.position,
                velocity: projectile.velocity
            });
            console.log(`   → Envoyé projectile ${projectileId} à ${socket.id}`);
        }
        
        // 5. Annoncer le nouveau joueur à TOUS les autres
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            username: username,
            x: players[socket.id].x,
            y: players[socket.id].y,
            z: players[socket.id].z
        });
        
        // 6. Mettre à jour les compteurs
        io.emit('playerCountUpdate', playerCount);
        
        console.log(`✅ ${username} prêt | Total: ${playerCount}`);
    });
    
    // ========================================
    // PROJECTILE CREATE
    // ========================================
    socket.on('projectileCreate', (data) => {
        console.log(`🎯 PROJECTILE CREATE par ${data.ownerId}: ${data.id}`);
        
        // Vérifier que le propriétaire existe
        if (!players[data.ownerId]) {
            console.log(`⚠️  Propriétaire ${data.ownerId} non trouvé`);
            return;
        }
        
        // Stocker le projectile
        projectiles[data.id] = {
            id: data.id,
            ownerId: data.ownerId,
            type: data.type,
            position: data.position,
            velocity: data.velocity,
            createdAt: Date.now()
        };
        
        projectileCount++;
        
        // Envoyer à TOUS les autres joueurs
        socket.broadcast.emit('projectileCreated', {
            id: data.id,
            ownerId: data.ownerId,
            type: data.type,
            position: data.position,
            velocity: data.velocity
        });
        
        // Mettre à jour le compteur
        io.emit('projectileCountUpdate', Object.keys(projectiles).length);
        
        console.log(`✅ Projectile ${data.id} créé par ${players[data.ownerId].username}`);
    });
    
    // ========================================
    // PROJECTILE DESTROY
    // ========================================
    socket.on('projectileDestroy', (data) => {
        console.log(`🗑️  PROJECTILE DESTROY: ${data.id}`);
        
        // Vérifier que le projectile existe
        if (!projectiles[data.id]) {
            console.log(`⚠️  Projectile ${data.id} non trouvé`);
            return;
        }
        
        // Supprimer le projectile
        delete projectiles[data.id];
        projectileCount = Math.max(0, projectileCount - 1);
        
        // Envoyer à TOUS les autres joueurs
        socket.broadcast.emit('projectileDestroyed', {
            id: data.id
        });
        
        // Mettre à jour le compteur
        io.emit('projectileCountUpdate', Object.keys(projectiles).length);
        
        console.log(`✅ Projectile ${data.id} détruit`);
    });
    
    // ========================================
    // PROJECTILE COLLISION
    // ========================================
    socket.on('projectileCollision', (data) => {
        console.log(`💥 PROJECTILE COLLISION: ${data.id1} vs ${data.id2}`);
        
        // Vérifier que les projectiles existent
        if (!projectiles[data.id1] || !projectiles[data.id2]) {
            console.log(`⚠️  Un des projectiles n'existe pas`);
            return;
        }
        
        // Envoyer à TOUS les joueurs (y compris l'émetteur)
        io.emit('projectileCollision', {
            id1: data.id1,
            id2: data.id2
        });
        
        console.log(`✅ Collision diffusée`);
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
            
            // Supprimer TOUS les projectiles de ce joueur
            for (let projectileId in projectiles) {
                if (projectiles[projectileId].ownerId === socket.id) {
                    delete projectiles[projectileId];
                    io.emit('projectileDestroyed', { id: projectileId });
                    console.log(`   → Projectile ${projectileId} supprimé`);
                }
            }
            
            // Informer les autres du départ du joueur
            socket.broadcast.emit('killPlayer', socket.id);
            
            // Supprimer le joueur
            delete players[socket.id];
            playerCount = Math.max(0, playerCount - 1);
            
            // Mettre à jour les compteurs
            io.emit('playerCountUpdate', playerCount);
            io.emit('projectileCountUpdate', Object.keys(projectiles).length);
            
            console.log(`📊 Joueurs restants: ${playerCount} | Projectiles: ${Object.keys(projectiles).length}`);
        }
    });
    
    // ========================================
    // NETWORK PING (optionnel)
    // ========================================
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

// ============================================
// NETTOYAGE DES PROJECTILES EXPIÉS
// ============================================

function cleanupExpiredProjectiles() {
    const now = Date.now();
    const expirationTime = 5000; // 5 secondes
    
    for (let projectileId in projectiles) {
        const projectile = projectiles[projectileId];
        
        if (now - projectile.createdAt > expirationTime) {
            console.log(`🧹 Nettoyage projectile expiré: ${projectileId}`);
            delete projectiles[projectileId];
            io.emit('projectileDestroyed', { id: projectileId });
        }
    }
    
    // Nettoyer toutes les 30 secondes
    setTimeout(cleanupExpiredProjectiles, 30000);
}

// Démarrer le nettoyage
setTimeout(cleanupExpiredProjectiles, 30000);

// ============================================
// DÉMARRAGE
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🚀 SERVEUR PLAYCANVAS - AVEC PROJECTILES      ║
║                                                  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║   🌐 Port: ${PORT}                                  ║
║   ⏰ Démarrage: ${new Date().toLocaleTimeString()}         ║
║   🔫 Système de projectiles: ACTIVÉ             ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `);
});
