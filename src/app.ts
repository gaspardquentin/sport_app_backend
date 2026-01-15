import express, { Application } from 'express';
import helmet from 'helmet';
import cors from "cors";
import routes from "./routes/index.js"

const app: Application = express();

app.use(helmet());

// CORS configuration
app.use(cors({
  origin: true, //process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());

app.use('/api/v1', routes);

export default app;
