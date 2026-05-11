import express from 'express';
import { classifyWasteItem } from '../lib/ecoEngine.js';

const router = express.Router();

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60000;

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  } else {
    const data = rateLimitMap.get(ip);
    if (now > data.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else {
      data.count++;
      if (data.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
    }
  }
  next();
};

router.post('/', rateLimiter, async (req, res) => {
  try {
    const { description, imageBase64 } = req.body;

    if (!description && !imageBase64) {
      return res.status(400).json({ error: "Provide either a description or an image." });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ error: "Description too long. Max 500 characters." });
    }

    const result = await classifyWasteItem(description, imageBase64);
    res.status(200).json(result);
  } catch (error) {
    console.error("Classification error:", error);
    res.status(500).json({ error: "Classification failed. Try again." });
  }
});

export default router;
