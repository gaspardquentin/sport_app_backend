import { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Attach user/session to request
    (req as any).user = session.user;
    (req as any).session = session.session;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
