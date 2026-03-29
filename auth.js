import admin from "firebase-admin";
import { logError } from "./utils/logger.js";
// firebase-admin is initialised in firebase.js, which is loaded first via
// the transitive dependency chain in index.js → userService.js → firebase.js.
// All module-level code runs before any route handler, so admin is ready here.

export async function verifyUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const decoded = await admin.auth().verifyIdToken(token);
    req.userId = decoded.uid;
    next();
  } catch (err) {
    logError({ action: "auth", error: err.message });
    return res.status(401).json({ error: "Unauthorized" });
  }
}
