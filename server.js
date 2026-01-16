import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import admin from "firebase-admin";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Firebase Admin dari ENV (AMAN)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
});

const db = admin.firestore();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt, studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: "studentId wajib" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const docId = `${studentId}_${today}`;
    const ref = db.collection("ai_usage").doc(docId);

    if ((await ref.get()).exists) {
      return res.status(429).json({
        error: "Siswa ini sudah mendapat analisis hari ini."
      });
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const text =
      result.text ||
      result.candidates?.[0]?.content?.parts?.[0]?.text;

    await ref.set({
      studentId,
      date: today,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Gemini failed" });
  }
});

app.get("/health", (_, res) => res.send("OK"));

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Gemini API running");
});
