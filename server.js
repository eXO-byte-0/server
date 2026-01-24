const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Stockage des joueurs
const players = {};
let playerCount = 0;

// Configuration du serveur
const PORT = process.env.PORT || 3000;
const SERVER_FPS = 60;

io.on('connection', (socket) => {
  console.log('Nouveau joueur connecté:', socket.id);
  
  // Créer un nouveau joueur
  const playerId = socket.id;
  playerCount++;
  
  // Position aléatoire initiale
  players[playerId] = {
    id: playerId,
    x: Math.random() * 20 - 10,
    y: 1,
    z: Math.random() * 20 - 10,
    rotation: 0,
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
    score: 0
  };
  
  // Envoyer au nouveau joueur tous les joueurs existants
  socket.emit('currentPlayers', players);
  
  // Informer les autres joueurs
  socket.broadcast.emit('newPlayer', players[playerId]);
  
  // Gestion des mouvements
  socket.on('playerMovement', (movementData) => {
    if (players[playerId]) {
      players[playerId].x = movementData.x;
      players[playerId].y = movementData.y;
      players[playerId].z = movementData.z;
      players[playerId].rotation = movementData.rotation;
      
      // Diffusion à tous les autres joueurs
      socket.broadcast.emit('playerMoved', players[playerId]);
    }
  });
  
  // Gestion des collisions
  socket.on('collision', (data) => {
    if (players[data.playerId] && players[data.otherPlayerId]) {
      // Augmenter le score du joueur qui touche
      players[data.playerId].score += 1;
      
      // Réinitialiser les positions
      players[data.playerId].x = Math.random() * 20 - 10;
      players[data.playerId].z = Math.random() * 20 - 10;
      
      players[data.otherPlayerId].x = Math.random() * 20 - 10;
      players[otherPlayerId].z = Math.random() * 20 - 10;
      
      // Mettre à jour tout le monde
      io.emit('playerCollision', {
        playerId: data.playerId,
        otherPlayerId: data.otherPlayerId,
        players: players
      });
    }
  });
  
  // Déconnexion
  socket.on('disconnect', () => {
    console.log('Joueur déconnecté:', playerId);
    delete players[playerId];
    playerCount--;
    io.emit('playerDisconnected', playerId);
  });
});

// Mise à jour périodique du serveur
setInterval(() => {
  io.emit('heartbeat', players);
}, 1000 / SERVER_FPS);

server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
