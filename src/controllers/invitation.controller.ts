import { Request, Response } from "express";
import { db } from "../db/index.js";
import { invitations, user, coachAthletes } from "../db/schema.js";
import { eq, and, or, desc, ne, like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export const InvitationController = {
  // Get all invitations for the current user (sent and received)
  getInvitations: async (req: Request, res: Response) => {
    try {
      const userId = req.headers["user-id"] as string; // Assumes auth middleware populates this

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const receivedInvites = await db
        .select({
          id: invitations.id,
          senderId: invitations.senderId,
          senderName: user.name,
          senderRole: user.role,
          status: invitations.status,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .leftJoin(user, eq(invitations.senderId, user.id))
        .where(and(eq(invitations.receiverId, userId), eq(invitations.status, "pending")))
        .orderBy(desc(invitations.createdAt));

        const sentInvites = await db
        .select({
          id: invitations.id,
          receiverId: invitations.receiverId,
          receiverName: user.name,
          receiverRole: user.role,
          status: invitations.status,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .leftJoin(user, eq(invitations.receiverId, user.id))
        .where(and(eq(invitations.senderId, userId), eq(invitations.status, "pending")))
        .orderBy(desc(invitations.createdAt));

      res.status(200).json({ received: receivedInvites, sent: sentInvites });
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // Send an invitation
  sendInvitation: async (req: Request, res: Response) => {
    try {
      const senderId = req.headers["user-id"] as string;
      const { receiverId } = req.body;

      if (!senderId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!receiverId) {
        res.status(400).json({ error: "Receiver ID is required" });
        return;
      }

      if (senderId === receiverId) {
        res.status(400).json({ error: "Cannot invite yourself" });
        return;
      }

      // Check if receiver exists and allows invites
      const receiver = await db.query.user.findFirst({
        where: eq(user.id, receiverId),
      });

      if (!receiver) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!receiver.allowInvites) {
        res.status(403).json({ error: "User is not accepting invitations" });
        return;
      }

      // Check if a relationship already exists
      // Logic depends on roles:
      // If Coach inviting Athlete: check coach_athletes(coach=sender, athlete=receiver)
      // If Athlete inviting Coach: check coach_athletes(coach=receiver, athlete=sender)
      
      const sender = await db.query.user.findFirst({ where: eq(user.id, senderId) });
      if (!sender) {
          res.status(404).json({ error: "Sender not found" });
          return;
      }

      let existingRelation;
      if (sender.role === 'coach' && receiver.role === 'athlete') {
           existingRelation = await db.query.coachAthletes.findFirst({
              where: and(eq(coachAthletes.coachId, senderId), eq(coachAthletes.athleteId, receiverId))
           });
      } else if (sender.role === 'athlete' && receiver.role === 'coach') {
          existingRelation = await db.query.coachAthletes.findFirst({
              where: and(eq(coachAthletes.coachId, receiverId), eq(coachAthletes.athleteId, senderId))
           });
      } else {
          // Coach-Coach or Athlete-Athlete invites not supported for this relationship type yet
           res.status(400).json({ error: "Invalid role combination for invitation" });
           return;
      }

      if (existingRelation) {
        res.status(400).json({ error: "Users are already connected" });
        return;
      }

      // Check for existing pending invitation (either direction)
      const existingInvite = await db.query.invitations.findFirst({
        where: or(
          and(eq(invitations.senderId, senderId), eq(invitations.receiverId, receiverId), eq(invitations.status, "pending")),
          and(eq(invitations.senderId, receiverId), eq(invitations.receiverId, senderId), eq(invitations.status, "pending"))
        ),
      });

      if (existingInvite) {
        res.status(400).json({ error: "A pending invitation already exists" });
        return;
      }

      const newInvite = await db
        .insert(invitations)
        .values({
          id: uuidv4(),
          senderId,
          receiverId,
          status: "pending",
        })
        .returning();

      res.status(201).json(newInvite[0]);
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // Respond to an invitation
  respondToInvitation: async (req: Request, res: Response) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;
      const { status } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!["accepted", "declined"].includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      const invite = await db.query.invitations.findFirst({
        where: eq(invitations.id, id),
      });

      if (!invite) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }

      if (invite.receiverId !== userId) {
        res.status(403).json({ error: "You are not the recipient of this invitation" });
        return;
      }

      if (invite.status !== "pending") {
        res.status(400).json({ error: "Invitation is already processed" });
        return;
      }

      // Update invite status
      await db
        .update(invitations)
        .set({ status, updatedAt: new Date() })
        .where(eq(invitations.id, id));

      if (status === "accepted") {
        // Create relationship in coach_athletes table
        // We need to know who is who.
        const sender = await db.query.user.findFirst({ where: eq(user.id, invite.senderId) });
        const receiver = await db.query.user.findFirst({ where: eq(user.id, invite.receiverId) });
        
        if(sender && receiver) {
            let coachId, athleteId;
            if (sender.role === 'coach' && receiver.role === 'athlete') {
                coachId = sender.id;
                athleteId = receiver.id;
            } else if (sender.role === 'athlete' && receiver.role === 'coach') {
                coachId = receiver.id;
                athleteId = sender.id;
            }

            if (coachId && athleteId) {
                 await db.insert(coachAthletes).values({
                    coachId,
                    athleteId,
                });
                
                // Legacy support: update athlete's coachId if null (optional, but good for backward compat for now)
                // However, since we support multiple coaches now, this field might become ambiguous. 
                // We'll leave it alone or set it to the most recent coach if it was null.
                 const athlete = await db.query.user.findFirst({where: eq(user.id, athleteId)});
                 if(athlete && !athlete.coachId) {
                      await db.update(user).set({ coachId: coachId }).where(eq(user.id, athleteId));
                 }
            }
        }
      }

      res.status(200).json({ message: `Invitation ${status}` });
    } catch (error) {
      console.error("Error responding to invitation:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // Cancel an invitation (Sender only)
  deleteInvitation: async (req: Request, res: Response) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const invite = await db.query.invitations.findFirst({
        where: eq(invitations.id, id),
      });

      if (!invite) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }

      if (invite.senderId !== userId) {
        res.status(403).json({ error: "You can only cancel your own invitations" });
        return;
      }

      if (invite.status !== "pending") {
        res.status(400).json({ error: "Cannot cancel a processed invitation" });
        return;
      }

      await db.delete(invitations).where(eq(invitations.id, id));

      res.status(200).json({ message: "Invitation cancelled" });
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};
