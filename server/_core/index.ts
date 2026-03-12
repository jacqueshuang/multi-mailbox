import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { WebSocketServer, WebSocket } from "ws";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import restApiRouter from "../api/restApi";
import inboundTempMailRouter from "../api/inboundTempMail";
import { 
  registerWsConnection, 
  unregisterWsConnection, 
  startPolling 
} from "../services/emailPollingService";
import { sdk } from "./sdk";
import { mockAuthRouter } from "./mockAuth";
import * as db from "../db";
import { initializeDefaultAdminFromEnv } from "../services/adminSeedService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  app.get("/runtime-config.json", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      VITE_APP_ID: process.env.VITE_APP_ID,
      VITE_PUBLIC_BASE_URL: process.env.VITE_PUBLIC_BASE_URL,
      VITE_OAUTH_PORTAL_URL: process.env.VITE_OAUTH_PORTAL_URL,
      VITE_FRONTEND_FORGE_API_URL: process.env.VITE_FRONTEND_FORGE_API_URL,
      VITE_FRONTEND_FORGE_API_KEY: process.env.VITE_FRONTEND_FORGE_API_KEY,
    });
  });

  // Mock OAuth Routes (for self-contained environment)
  app.use(mockAuthRouter);

  // REST API routes (v1)
  app.use("/api/v1", restApiRouter);
  app.use("/api/inbound", inboundTempMailRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // WebSocket server for real-time notifications
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    if (url.pathname === "/api/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  wss.on("connection", async (ws: WebSocket, req) => {
    console.log("[WebSocket] New connection attempt");
    
    // Extract session token from query string or cookie
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    
    // Also try to get from cookie
    const cookies = req.headers.cookie?.split(";").reduce((acc: Record<string, string>, cookie: string) => {
      const [key, value] = cookie.trim().split("=");
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>) || {};
    
    const sessionToken = token || cookies["app_session_id"];
    
    if (!sessionToken) {
      console.log("[WebSocket] No session token provided");
      ws.close(4001, "Authentication required");
      return;
    }
    
    try {
      // Verify the session via shared SDK auth token format
      const session = await sdk.verifySession(sessionToken);

      if (!session?.openId) {
        console.log("[WebSocket] Invalid session");
        ws.close(4001, "Invalid session");
        return;
      }

      const user = await db.getUserByOpenId(session.openId);
      if (!user) {
        console.log("[WebSocket] User not found for session");
        ws.close(4001, "Invalid session");
        return;
      }

      const userId = user.id;
      console.log(`[WebSocket] User ${userId} authenticated`);
      
      // Register connection
      registerWsConnection(userId, ws);
      
      // Send welcome message
      ws.send(JSON.stringify({
        event: "connected",
        data: { message: "Connected to notification service" },
        timestamp: Date.now(),
      }));
      
      // Handle ping/pong for keep-alive
      ws.on("pong", () => {
        (ws as any).isAlive = true;
      });
      
      // Handle messages from client
      ws.on("message", (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Handle ping
          if (data.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          }
        } catch (e) {
          // Ignore invalid messages
        }
      });
      
      // Handle disconnection
      ws.on("close", () => {
        unregisterWsConnection(userId, ws);
      });
      
      ws.on("error", (error: Error) => {
        console.error("[WebSocket] Error:", error);
        unregisterWsConnection(userId, ws);
      });
      
    } catch (error) {
      console.error("[WebSocket] Authentication error:", error);
      ws.close(4001, "Authentication failed");
    }
  });
  
  // Heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      if ((ws as any).isAlive === false) {
        return ws.terminate();
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30000);
  
  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });
  
  // Development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  await initializeDefaultAdminFromEnv();

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`LAN access enabled on 0.0.0.0:${port}`);
    
    // Start email polling service
    startPolling();
  });
}

startServer().catch(console.error);
