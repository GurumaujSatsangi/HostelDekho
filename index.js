import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.listen(3000, () => {
  console.log("Running on Port 3000!");
});
