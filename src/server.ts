import "dotenv/config";
import app from "./app";
import { createServer } from "http";

const port = process.env.PORT || 3000;

const server = createServer(app);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
