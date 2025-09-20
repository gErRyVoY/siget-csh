import type { APIRoute } from 'astro';

let clients = [];

export const GET: APIRoute = ({ request }) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  };

  const body = new ReadableStream({
    start(controller) {
      const clientId = Date.now();
      const newClient = {
        id: clientId,
        controller,
      };
      clients.push(newClient);
      console.log(`[SSE] Client connected: ${clientId}. Total clients: ${clients.length}`);

      request.signal.addEventListener('abort', () => {
        clients = clients.filter((client) => client.id !== clientId);
        console.log(`[SSE] Client disconnected: ${clientId}. Total clients: ${clients.length}`);
        controller.close();
      });
    },
  });

  return new Response(body, { headers });
};

export function sendNotification(data: any) {
  const message = `data: ${JSON.stringify(data)}

`;
  console.log(`[SSE] Sending notification to ${clients.length} clients: ${JSON.stringify(data)}`);

  const clientsToRemove: number[] = [];

  clients.forEach((client) => {
    try {
      client.controller.enqueue(message);
    } catch (error) {
      console.log(`[SSE] Failed to send to client ${client.id}, marking for removal.`);
      clientsToRemove.push(client.id);
    }
  });

  if (clientsToRemove.length > 0) {
    clients = clients.filter(client => !clientsToRemove.includes(client.id));
    console.log(`[SSE] Pruned ${clientsToRemove.length} dead clients. Total clients: ${clients.length}`);
  }
}