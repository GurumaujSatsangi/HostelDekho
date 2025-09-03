import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import session from "express-session";
import { fileURLToPath } from "url";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const app = express();

dotenv.config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const upload = multer({ storage: multer.memoryStorage() });
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

async function getAllHostel() {
  const { data, error } = await supabase.from("hostels").select("*");

  if (error) {
    console.error("Error fetching hostel:", error);
    return null;
  }
  return data;
}

async function getHostel(id) {
  const { data, error } = await supabase
    .from("hostels")
    .select("*")
    .eq("hostel_id", id)
    .single();

  if (error) {
    console.error("Error fetching hostel:", error);
    return null;
  }
  return data;
}

async function getRoom(id) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("floor_id", id);

  if (error) {
    console.error("Error fetching room:", error);
    return null;
  }
  return data;
}

async function getFloorPlan(id) {
  const { data, error } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching floor plan:", error);
    return null;
  }
  return data;
}

async function getFloor(id) {
  const { data, error } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("hostel_id", id);

  if (error) {
    console.error("Error fetching floor plan:", error);
    return null;
  }
  return data;
}

app.get("/", async (req, res) => {
  const data = await getAllHostel();
  res.render("home.ejs", { hosteldata: data });
});

app.get("/hostel/:id", async (req, res) => {
  const hosteldata = await getHostel(req.params.id);
  const floorplan = await getFloor(req.params.id);
  return res.render("hostel.ejs", { hosteldata, floorplan });
});

app.get("/floor/:floorid", async (req, res) => {
  const roomdata = await getRoom(req.params.floorid);
  const floorplan = await getFloorPlan(req.params.floorid);
  return res.render("floorplan.ejs", { roomdata, floorplan });
});

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://hosteldekho.onrender.com/auth/google/dashboard",
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
  const { hostelid, floorid, remarks, roomnumber } = req.body;
  const image = req.file;

  try {
    const { data, error } = await supabase.from("rooms").insert({
      hostel_id: hostelid,
      floor_id: floorid,
      submitted_by: req.user.name,
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
    .eq("hostel_id", userdata.block)
    .single();

  if (floorerror) {
    console.error("Floor data error:", floorerror);
  }

  return res.render("dashboard.ejs", {
    user: req.user,
    floordata,
    userdata,
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
