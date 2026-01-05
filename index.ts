import express from 'express';

const app = express();
const port = 3000;


const clients = [
  { "Gaspard": 21 },
  { "L'autre": 69 },
];

app.get('/', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send('Hello from Express with TypeScript!');
});

app.get('/clients', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  console.log(clients);
  res.send(clients);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
