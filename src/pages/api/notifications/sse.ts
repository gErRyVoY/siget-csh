import type { APIRoute } from 'astro';

interface Client {
  id: number;
  userId: number;
  controller: ReadableStreamDefaultController;
}

let clients: Client[] = [];

export const GET: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get('userId');

  if (!userIdParam) {
    return new Response('Missing userId', { status: 400 });
  }

  const userId = parseInt(userIdParam, 10);
  if (isNaN(userId)) {
    return new Response('Invalid userId', { status: 400 });
  }

  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  };

  const body = new ReadableStream({
    start(controller) {
      const clientId = Date.now();
      const newClient: Client = {
        id: clientId,
        userId,
        controller,
      };
      clients.push(newClient);
      console.log(`[SSE] Client connected: ${clientId} (User: ${userId}). Total clients: ${clients.length}`);

      // Send initial connection message
      const initMessage = `data: ${JSON.stringify({ type: 'connected', message: 'Connected to notification stream' })}\n\n`;
      controller.enqueue(initMessage);

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(': heartbeat\n\n');
        } catch (e) {
          console.log(`[SSE] Heartbeat failed for client ${clientId}, clearing interval.`);
          clearInterval(heartbeat);
        }
      }, 30000); // 30 seconds

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clients = clients.filter((client) => client.id !== clientId);
        console.log(`[SSE] Client disconnected: ${clientId} (User: ${userId}). Total clients: ${clients.length}`);
        try {
          controller.close();
        } catch (e) {
          // Controller might be already closed
        }
      });
    },
  });

  return new Response(body, { headers });
};

export interface NotificationPayload {
  type: 'ticket_created' | 'ticket_updated' | 'ticket_assigned' | 'general';
  message: string;
  ticketId?: number;
  originatorId?: string;
  [key: string]: any;
}

export function sendNotification(data: NotificationPayload, targetUserIds?: number[]) {
  const message = `data: ${JSON.stringify(data)}\n\n`;

  let targetClients = clients;

  // Filter by target users if specified
  if (targetUserIds && targetUserIds.length > 0) {
    targetClients = clients.filter(client => targetUserIds.includes(client.userId));
    console.log(`[SSE] Sending notification to specific users: ${targetUserIds.join(', ')}. Matches found: ${targetClients.length}`);
  } else {
    console.log(`[SSE] Sending broadcast notification to ${clients.length} clients.`);
  }

  // Don't send back to originator if possible (optional logic, can be handled by client too)
  if (data.originatorId) {
    const originatorIdNum = parseInt(data.originatorId, 10);
    // Uncomment to filter out originator
    // targetClients = targetClients.filter(client => client.userId !== originatorIdNum);
  }

  const clientsToRemove: number[] = [];

  targetClients.forEach((client) => {
    try {
      client.controller.enqueue(message);
    } catch (error) {
      console.log(`[SSE] Failed to send to client ${client.id} (User: ${client.userId}), marking for removal.`);
      clientsToRemove.push(client.id);
    }
  });

  if (clientsToRemove.length > 0) {
    clients = clients.filter(client => !clientsToRemove.includes(client.id));
    console.log(`[SSE] Pruned ${clientsToRemove.length} dead clients. Total clients: ${clients.length}`);
  }
}