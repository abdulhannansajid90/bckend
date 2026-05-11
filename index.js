import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import classifyRouter from './routes/classify.js';

const app = express();

const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

app.use('/api/classify', classifyRouter);

app.get('/health', (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`EcoSort backend running on port ${PORT}`);
});
