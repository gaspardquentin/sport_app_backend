import express, { Application } from 'express';
import helmet from 'helmet';
import cors from "cors";
import routes from "./routes"

const app: Application = express();

app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));


app.use('/api/v1', routes);

export default app;
