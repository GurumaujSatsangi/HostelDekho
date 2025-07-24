import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import sql from "mssql";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const app = express();

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/view/hostel/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("hostels")
    .select("*")
    .eq("hostel_id", req.params.id)
    .single();

  const { floorplan, floorplanerror } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("hostel_id", req.params.id);

  return res.render("hostel.ejs", { hosteldata: data, floors: floorplan });
});

app.listen(3000, () => {
  console.log("Running on Port 3000!");
});
