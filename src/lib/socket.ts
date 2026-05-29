import { Server } from 'socket.io';
import { createServer } from 'http';

let io: Server | null = null;

export function initIO(httpServer: ReturnType<typeof createServer>): Server {
    if (!io) {
        io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
            },
        });
    }
    return io;
}

export function getIO(): Server | null {
    return io;
}

export default { initIO, getIO };
