import { Router } from "express";
import { InvitationController } from "../controllers/invitation.controller.js";

const router = Router();

router.get("/", InvitationController.getInvitations);
router.post("/", InvitationController.sendInvitation);
router.put("/:id/respond", InvitationController.respondToInvitation);
router.delete("/:id", InvitationController.deleteInvitation);

export const invitationRoutes = router;
