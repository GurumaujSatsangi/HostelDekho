import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import session from "express-session";
import { fileURLToPath } from "url";
import path from "path";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());
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

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/dashboard",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await supabase
          .from("users")
          .select("*")
          .eq("uid", profile.id)
          .single();
        let user;
        if (!result.data) {
          const { error } = await supabase.from("users").insert([
            {
              uid: profile.id,
              name: profile.displayName,
              email: profile.emails[0].value,
              profile_picture: profile.photos[0].value,
            },
          ]);
          if (error) {
            console.error("Error inserting user:", error);
            return cb(error);
          }
          const { data: newUser, error: fetchError } = await supabase
            .from("users")
            .select("*")
            .eq("uid", profile.id)
            .single();
          if (fetchError) {
            console.error("Fetch after insert failed:", fetchError);
            return cb(fetchError);
          }
          user = newUser;
        } else {
          user = result.data;
        }

        return cb(null, user);
      } catch (err) {
        return cb(err);
      }
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.post("/update-profile", async (req, res) => {
  const block = req.body.block;
  await supabase.from("users").update({ block: block }).eq("uid", req.user.uid);
  res.redirect("/dashboard");
});

app.get("/update-profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }
  const { data, error } = await supabase.from("hostels").select("hostel_name");
  const { data: profiledata, error: profileerror } = await supabase
    .from("users")
    .select("*")
    .eq("email", req.user.email)
    .single();
  if (!profiledata || !profiledata.block || profiledata.block.length === 0) {
    res.render("profile.ejs", { data, user: req.user });
  } else {
    res.render("dashboard.ejs", { data, user: req.user });
  }
});
app.get(
  "/auth/google/dashboard",
  passport.authenticate("google", {
    failureRedirect: "/",
    successRedirect: "/dashboard",
  }),
  async (req, res) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", req.user.email)
      .single();
    if (!req.isAuthenticated()) {
      return res.redirect("/");
    } else if (data.block == "") {
      res.render("profile.ejs", {
        user: req.user,
      });
    } else {
      res.render("dashboard.ejs", {
        user: req.user,
      });
    }
  }
);

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.post("/submit-room-details", async (req, res) => {
  const { block, floor, remarks, roomnumber, speedtest } = req.body;

  try {
    const { data, error } = await supabase.from("rooms").insert({
      block: block,
      floor: floor,
      room_number: roomnumber,
      remarks: remarks,
    });

    if (error) {
      console.error("Insert error:", error);
      return res
        .status(500)
        .json({ error: "Database insert failed", details: error.message });
    }

    res.redirect(
      "/dashboard?message=Room Details have beed added successfully!"
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
});

app.get("/admin/dashboard",async(req,res)=>{

  const{data:hosteldata,error:hostelerror}=await supabase.from("hostels").select("*");
  
  res.render("admin/dashboard.ejs",{hosteldata});
})

app.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const message = req.query.message || null;

  const { data: userdata, error: usererror } = await supabase
    .from("users")
    .select("*")
    .eq("uid", req.user.uid)
    .single();

  if (usererror || !userdata) {
    console.error("User error:", usererror);
    return res.status(500).send("User data fetch failed.");
  }

  const { data: data, error: error } = await supabase
    .from("hostels")
    .select("hostel_name");

  const { data: floordata, error: floorerror } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("hostel_id", userdata.block);

    const { data: userhosteldata, error: userhostelrerror } = await supabase
    .from("hostels")
    .select("hostel_name")
    .eq("hostel_id", userdata.block).single();

  if (floorerror) {
    console.error("Floor data error:", floorerror);
  }


  return res.render("dashboard.ejs", {
    user: req.user,
    floordata,
    userhosteldata,
    message,
    data,
  });
});

app.listen(3000, () => {
  console.log("Running on Port 3000!");
});

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});
