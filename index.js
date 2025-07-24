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
app.use(express.static("public"));

app.get("/", async (req, res) => {
  const { data, error } = await supabase.from("hostels").select("*");

  res.render("home.ejs", { hosteldata: data });
});

app.get("/view/hostel/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("hostels")
    .select("*")
    .eq("hostel_id", req.params.id)
    .single();

  const { data: floorplan, error: floorplanerror } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("hostel_id", req.params.id);

  return res.render("hostel.ejs", { hosteldata: data, floorplan });
});

app.get("/view/hostel/:hostelid/floor-plan/:planid", async (req, res) => {
  const { data, error } = await supabase
    .from("hostels")
    .select("*")
    .eq("hostel_id", req.params.hostelid)
    .single();

  const { data: roomdata, error: roomerror } = await supabase
    .from("floor_plan")
    .select("*")
    .eq("hostel_id", req.params.hostelid)
    .eq("id", req.params.planid);

  const { data: floorplan, error: floorplanerror } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("hostel_id", req.params.hostelid)
    .eq("id", req.params.planid)
    .single();

  return res.render("floorplan.ejs", { hosteldata: data, floorplan, roomdata });
});

app.post("/fetch-room-details", async (req, res) => {
  const roomid = req.body.roomid;
  const hostelid = req.body.hostelid;
  const floorid = req.body.floorid;
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("hostel_id", hostelid)
    .eq("floor_id", floorid)
    .eq("room_id", roomid)
    .single();
});

app.listen(3000, () => {
  console.log("Running on Port 3000!");
});
