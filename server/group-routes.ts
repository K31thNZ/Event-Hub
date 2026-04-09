import { Router, Request, Response } from 'express';
import { getUser, getMembership } from './storage'; // static import

const router = Router();

// ✅ Safe authentication middleware
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// ✅ Apply middleware to all protected routes
router.get("/groups/my", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId; // guaranteed by middleware
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // ... rest of your logic (e.g., fetch user's groups)
    res.json(user.groups); // adjust to your actual data
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/groups", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // ... fetch all groups logic
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Example for member update route
router.patch("/groups/:id/members/:userId", requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.session!.userId;
    const groupId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    
    const currentUser = await getUser(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: "Current user not found" });
    }
    
    const membership = await getMembership(groupId, targetUserId);
    if (!membership) {
      return res.status(404).json({ error: "Membership not found" });
    }
    
    // ... update logic
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ... add similar fixes for all other group routes (moderators, bans, etc.)

export default router;
