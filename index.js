import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import session from "express-session";
import { fileURLToPath } from "url";
import path from "path";
import {v2 as cloudinary} from "cloudinary";
import multer from "multer";
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

app.post("/submit-room-details", upload.single("image"), async (req, res) => {
  const { block, floor, remarks, roomnumber, speedtest } = req.body;
  const image = req.file;

  try {
    let imageUrl = null;

    if (image) {
      const fileName = `room-${Date.now()}-${image.originalname}`;

      const { data, error: uploadError } = await supabase.storage
        .from("images") 
        .upload(fileName, image.buffer, {
          contentType: image.mimetype,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(fileName);

      imageUrl = publicUrl;
    }

    const { error: insertError } = await supabase.from("rooms").insert({
      block,
      floor,
      room_number: roomnumber,
      remarks,
      speedtest,
      image_url: imageUrl,
    });

    if (insertError) {
      throw insertError;
    }

    res.redirect("/dashboard?message=Room Details have been added successfully!");
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});




















app.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const message = req.query.message || null;

  // Get user data
  const { data: userdata, error: usererror } = await supabase
    .from("users")
    .select("*")
    .eq("uid", req.user.uid)
    .single();

  if (usererror || !userdata) {
    console.error("User fetch error:", usererror);
    return res.status(500).send("User data fetch failed.");
  }

  // If no block is assigned, render profile page
  if (!userdata.block || userdata.block.trim() === "") {
    const { data: hostels, error: hostelError } = await supabase
      .from("hostels")
      .select("hostel_id, hostel_name");

    if (hostelError) {
      console.error("Hostel data fetch error:", hostelError);
      return res.status(500).send("Hostel data fetch failed.");
    }

    return res.render("profile.ejs", {
      user: req.user,
      data: hostels,
    });
  }

  // Fetch required dashboard data
  const { data: allHostels, error: hostelsError } = await supabase
    .from("hostels")
    .select("hostel_name");

  const { data: floordata, error: floorerror } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("hostel_id", userdata.block);

  const { data: userhosteldata, error: userhostelerror } = await supabase
    .from("hostels")
    .select("hostel_name")
    .eq("hostel_id", userdata.block)
    .single();

  if (hostelsError || floorerror || userhostelerror) {
    console.error("Dashboard data fetch error:", hostelsError || floorerror || userhostelerror);
    return res.status(500).send("Dashboard data fetch failed.");
  }

  // Render dashboard
  return res.render("dashboard.ejs", {
    user: req.user,
    floordata,
    userhosteldata,
    message,
    data: allHostels,
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
