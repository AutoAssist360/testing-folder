import "dotenv/config";
import app from "./server";

const port = parseInt(process.env.PORT || "3000");

app.listen(port, () => {
  console.log(`Express is running on port ${port}`);
});