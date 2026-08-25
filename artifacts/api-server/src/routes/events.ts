import { Router, type IRouter } from "express";
import { subscribeToPoppolActions } from "../lib/action-events";

const router: IRouter = Router();

router.get("/events", (req, res): void => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: Parameters<Parameters<typeof subscribeToPoppolActions>[0]>[0]) => {
    res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const unsubscribe = subscribeToPoppolActions(send);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;