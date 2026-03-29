import { db } from "./firebase.js";

export async function getUser(userId) {
  const ref = db.collection("users").doc(userId);
  const doc = await ref.get();

  if (!doc.exists) {
    const newUser = {
      pro: false,
      usage: 0,
      goal: "",
      history: [],
      createdAt: new Date(),
      lastActive: new Date()
    };
    await ref.set(newUser);
    return newUser;
  }

  return doc.data();
}

export async function updateUser(userId, data) {
  await db.collection("users").doc(userId).update(data);
}
