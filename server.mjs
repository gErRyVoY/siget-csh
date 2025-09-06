import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler as astroHandler } from './dist/server/entry.mjs';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer);

const users = {};

io.on('connection', (socket) => {
  console.log(`[Socket.IO] User connected: ${socket.id}`);

  socket.on('register', (userId) => {
    console.log(`[Socket.IO] Registering user ${userId} with socket ${socket.id}`);
    users[userId] = socket.id;
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
  });
});

app.use((req, res, next) => {
  req.io = io;
  req.users = users;
  next();
});

app.use(astroHandler);

const PORT = process.env.PORT || 4321;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});