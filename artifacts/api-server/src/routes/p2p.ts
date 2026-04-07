import { Router, type Request, type Response } from "express";

const router = Router();

// Map of profileId → active SSE response
const sseClients = new Map<string, Response>();

/**
 * GET /api/p2p/events/:profileId
 *
 * Long-lived SSE stream. The frontend subscribes once per profile/tab.
 * The server sends events whenever another profile broadcasts to this profileId.
 */
router.get("/events/:profileId", (req: Request, res: Response) => {
  const { profileId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Allow cross-origin requests from any frontend origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Confirm connection to the client
  res.write(`data: ${JSON.stringify({ type: "connected", profileId })}\n\n`);

  // Register this connection
  sseClients.set(profileId, res);

  // Periodic heartbeat to prevent proxy/browser idle timeouts (every 25s)
  const heartbeat = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 25000);

  // Clean up when the client disconnects
  res.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(profileId);
  });
});

/**
 * POST /api/p2p/broadcast
 *
 * Body: { toProfileId: string, ...eventPayload }
 * Routes the event to the SSE stream of `toProfileId`.
 * Returns { delivered: true } if the target is connected, { delivered: false } otherwise.
 */
router.post("/broadcast", (req: Request, res: Response) => {
  const { toProfileId, ...payload } = req.body as { toProfileId: string; [key: string]: unknown };

  if (!toProfileId) {
    res.status(400).json({ error: "toProfileId is required" });
    return;
  }

  const client = sseClients.get(toProfileId);
  if (client) {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.json({ delivered: true });
  } else {
    res.json({ delivered: false });
  }
});

export default router;
