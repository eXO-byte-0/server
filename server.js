// ============================================
// SERVEUR MULTI-JOUEUR PLAYCANVAS - AVEC GESTION D'ÉTAT DES ATTAQUES
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
let projectiles = {};
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
// SOCKET.IO
// ============================================

io.on('connection', (socket) => {
    console.log(`🟢 Connexion: ${socket.id}`);
    
    // ========================================
    // CREATE - Joueur
    // ========================================
    socket.on('create', () => {
        console.log(`📝 CREATE de ${socket.id}`);
        
        const username = `Player_${playerCount + 1}`;
        
        players[socket.id] = {
            id: socket.id,
            x: Math.random() * 10 - 5,
            y: 1,
            z: Math.random() * 10 - 5,
            username: username,
            connected: true,
            lastAttack: 0,
            isAttacking: false // ⭐ NOUVEAU: État d'attaque
        };
        
        playerCount++;
        
        console.log(`👤 Joueur créé: ${username} (${socket.id})`);
        
        // Envoyer REGISTER au nouveau joueur
        socket.emit('register', {
            id: socket.id,
            players: players
        });
        
        console.log(`📤 REGISTER envoyé à ${socket.id}`);
        
        // Envoyer CHAQUE joueur existant au nouveau
        for (let existingId in players) {
            if (existingId !== socket.id) {
                socket.emit('playerJoined', {
                    id: existingId,
                    username: players[existingId].username,
                    x: players[existingId].x,
                    y: players[existingId].y,
                    z: players[existingId].z,
                    isAttacking: players[existingId].isAttacking // ⭐ ENVOYER L'ÉTAT
                });
                console.log(`   → Envoyé ${players[existingId].username} à ${socket.id}`);
            }
        }
        
        // Envoyer TOUS les projectiles existants au nouveau
        for (let projectileId in projectiles) {
            const projectile = projectiles[projectileId];
            socket.emit('projectileCreated', {
                id: projectileId,
                ownerId: projectile.ownerId,
                type: projectile.type,
                position: projectile.position,
                velocity: projectile.velocity,
                rotation: projectile.rotation
            });
            console.log(`   → Envoyé projectile ${projectileId} à ${socket.id}`);
        }
        
        // Annoncer le nouveau joueur aux AUTRES
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            username: username,
            x: players[socket.id].x,
            y: players[socket.id].y,
            z: players[socket.id].z,
            isAttacking: false
        });
        
        // Mettre à jour les compteurs
        io.emit('playerCountUpdate', playerCount);
        
        console.log(`✅ ${username} prêt | Total: ${playerCount}`);
    });
    
    // ========================================
    // PLAYER ATTACK STATE - NOUVEAU ÉVÉNEMENT POUR LA SYNCHRO
    // ========================================
    socket.on('playerAttackState', (data) => {
        console.log(`⚔️ PLAYER ATTACK STATE: ${data.playerId} (${players[data.playerId]?.username || 'Inconnu'})`);
        
        // Vérifier que le joueur existe
        if (!players[data.playerId]) {
            console.log(`⚠️ Joueur ${data.playerId} non trouvé`);
            return;
        }
        
        // Vérifier le cooldown d'attaque (ex: 500ms)
        const now = Date.now();
        if (data.isAttacking && now - players[data.playerId].lastAttack < 500) {
            console.log(`⏳ Cooldown d'attaque pour ${players[data.playerId].username}`);
            return;
        }
        
        // Mettre à jour l'état serveur
        players[data.playerId].isAttacking = data.isAttacking;
        if (data.isAttacking) {
            players[data.playerId].lastAttack = now;
        }
        
        // Broadcast à TOUS les autres joueurs
        socket.broadcast.emit('playerAttackState', {
            playerId: data.playerId,
            isAttacking: data.isAttacking,
            direction: data.direction,
            timestamp: data.timestamp || now
        });
        
        console.log(`✅ État d'attaque diffusé: ${players[data.playerId].username} (attaque: ${data.isAttacking})`);
    });
    
    // ========================================
    // PLAYER ATTACK (ancien événement - gardé pour compatibilité)
    // ========================================
    socket.on('playerAttack', (data) => {
        console.log(`⚔️ PLAYER ATTACK (legacy): ${data.playerId} (${players[data.playerId]?.username || 'Inconnu'})`);
        
        if (!players[data.playerId]) {
            console.log(`⚠️ Joueur ${data.playerId} non trouvé`);
            return;
        }
        
        const now = Date.now();
        if (now - players[data.playerId].lastAttack < 500) {
            console.log(`⏳ Cooldown d'attaque pour ${players[data.playerId].username}`);
            return;
        }
        
        players[data.playerId].lastAttack = now;
        players[data.playerId].isAttacking = true;
        
        // Envoyer l'ancien événement pour compatibilité
        socket.broadcast.emit('playerAttack', {
            playerId: data.playerId,
            timestamp: data.timestamp || now,
            position: data.position,
            rotation: data.rotation
        });
        
        // Envoyer aussi le nouvel événement
        socket.broadcast.emit('playerAttackState', {
            playerId: data.playerId,
            isAttacking: true,
            direction: data.direction || 'Idle',
            timestamp: data.timestamp || now
        });
        
        console.log(`✅ Attaque diffusée (legacy) pour ${players[data.playerId].username}`);
    });
    
    // ========================================
    // PROJECTILE CREATE
    // ========================================
    socket.on('projectileCreate', (data) => {
        console.log(`🎯 PROJECTILE CREATE par ${data.ownerId}: ${data.id}`);
        
        if (!players[data.ownerId]) {
            console.log(`⚠️ Propriétaire ${data.ownerId} non trouvé`);
            return;
        }
        
        if (projectiles[data.id]) {
            console.log(`⚠️ Projectile ${data.id} existe déjà, ignoré`);
            return;
        }
        
        projectiles[data.id] = {
            id: data.id,
            ownerId: data.ownerId,
            type: data.type,
            position: data.position,
            velocity: data.velocity,
            rotation: data.rotation,
            createdAt: Date.now()
        };
        
        socket.broadcast.emit('projectileCreated', {
            id: data.id,
            ownerId: data.ownerId,
            type: data.type,
            position: data.position,
            velocity: data.velocity,
            rotation: data.rotation
        });
        
        console.log(`✅ Projectile ${data.id} créé par ${players[data.ownerId].username}`);
        console.log(`   → Diffusé à tous SAUF ${data.ownerId}`);
        
        io.emit('projectileCountUpdate', Object.keys(projectiles).length);
    });
    
    // ========================================
    // PROJECTILE DESTROY
    // ========================================
    socket.on('projectileDestroy', (data) => {
        console.log(`🗑️ PROJECTILE DESTROY: ${data.id}`);
        
        if (!projectiles[data.id]) {
            console.log(`⚠️ Projectile ${data.id} non trouvé`);
            return;
        }
        
        delete projectiles[data.id];
        
        socket.broadcast.emit('projectileDestroyed', {
            id: data.id
        });
        
        io.emit('projectileCountUpdate', Object.keys(projectiles).length);
        
        console.log(`✅ Projectile ${data.id} détruit`);
    });
    
    // ========================================
    // PROJECTILE COLLISION
    // ========================================
    socket.on('projectileCollision', (data) => {
        console.log(`💥 PROJECTILE COLLISION: ${data.id1} vs ${data.id2}`);
        
        if (!projectiles[data.id1] || !projectiles[data.id2]) {
            console.log(`⚠️ Un des projectiles n'existe pas`);
            return;
        }
        
        io.emit('projectileCollision', {
            id1: data.id1,
            id2: data.id2
        });
        
        console.log(`✅ Collision diffusée`);
    });
    
    // ========================================
    // PLAYER SHOOT
    // ========================================
    socket.on('playerShoot', (data) => {
        console.log(`🔫 PLAYER SHOOT: ${data.playerId}`);
        
        if (!players[data.playerId]) {
            console.log(`⚠️ Joueur ${data.playerId} non trouvé`);
            return;
        }
        
        socket.broadcast.emit('playerShoot', {
            playerId: data.playerId
        });
        
        console.log(`✅ Tir diffusé pour ${players[data.playerId].username}`);
    });
    
    // ========================================
    // TRANSFORM - Position + Rotation
    // ========================================
    socket.on('transform', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.pos.x;
            players[data.id].y = data.pos.y;
            players[data.id].z = data.pos.z;
            
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
            let removedCount = 0;
            for (let projectileId in projectiles) {
                if (projectiles[projectileId].ownerId === socket.id) {
                    delete projectiles[projectileId];
                    io.emit('projectileDestroyed', { id: projectileId });
                    removedCount++;
                }
            }
            
            if (removedCount > 0) {
                console.log(`   → ${removedCount} projectile(s) supprimé(s)`);
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
    // NETWORK PING
    // ========================================
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

// ============================================
// NETTOYAGE DES PROJECTILES EXPIRÉS
// ============================================

function cleanupExpiredProjectiles() {
    const now = Date.now();
    const expirationTime = 10000;
    
    let cleanedCount = 0;
    
    for (let projectileId in projectiles) {
        const projectile = projectiles[projectileId];
        
        if (now - projectile.createdAt > expirationTime) {
            console.log(`🧹 Nettoyage projectile expiré: ${projectileId}`);
            delete projectiles[projectileId];
            io.emit('projectileDestroyed', { id: projectileId });
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 ${cleanedCount} projectile(s) expiré(s) nettoyé(s)`);
        io.emit('projectileCountUpdate', Object.keys(projectiles).length);
    }
}

// Nettoyage toutes les 30 secondes
setInterval(cleanupExpiredProjectiles, 30000);

// ============================================
// DÉMARRAGE
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🚀 SERVEUR PLAYCANVAS - SYNC ÉTAT ATTAQUES    ║
║                                                  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║   🌐 Port: ${PORT.toString().padEnd(39)} ║
║   ⏰ Démarrage: ${new Date().toLocaleTimeString().padEnd(33)} ║
║   🔫 Système de projectiles: ACTIVÉ             ║
║   ⚔️  Sync état attaques: ACTIVÉ                ║
║   📡 Événements: playerAttackState + legacy     ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `);
});
