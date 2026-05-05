import { createServer } from "node:http";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3000);
const app = await createApp();

createServer(app).listen(port, () => {
  console.log(`sku-management server listening on http://localhost:${port}`);
});
