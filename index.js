import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import session from "express-session";
import { fileURLToPath } from "url";
import path from "path";
import { Profanity, CensorType } from '@2toad/profanity';
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
  import passport from "passport";
  import { Strategy as GoogleStrategy } from "passport-google-oauth20";
  import dotenv from "dotenv";
  import { createClient } from "@supabase/supabase-js";
  import SpeedTest from '@cloudflare/speedtest';
import axios from 'axios';
import crypto from 'crypto';
import Stream from 'stream';

  const app = express();

  dotenv.config();
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

const profanity = new Profanity({
    languages: ['en', 'hi'],
});

profanity.addWords(['chutiya', 'madarchod', 'bhosdike','maa ki chut','behanchod','behenchod']);

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

async function getUserRoom(uid){


  const { data, error } = await supabase
    .from("rooms")
    .select("*").eq("submitted_by",uid);

  if (error) {
    console.error("Error fetching room:", error);
    return null;
  }
  return data;

}

async function getRoom(id) {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("hostel_id", id);

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
  const reviews = await getRoom(req.params.id);
  return res.render("hostel.ejs", { hosteldata, floorplan, reviews });
});

app.get("/floor/:floorid", async (req, res) => {
  const roomdata = await getRoom(req.params.floorid);
  const floorplan = await getFloorPlan(req.params.floorid);
  return res.render("floorplan.ejs", { roomdata, floorplan });
});

app.get("/floor-plan", (req, res) => {
  res.render("mh-floor-plan.ejs");
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
    }else {
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
      submitted_by: req.user.uid,
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

app.get("/api/speedtest", async (req, res) => {
    // Ensure user is logged in to access this API
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    console.log("Running speed test via API...");
    const [downloadSpeed, uploadSpeed] = await Promise.all([
        testDownload(),
        testUpload()
    ]);
    console.log(`API Speeds found: ${downloadSpeed} Mbps Down, ${uploadSpeed} Mbps Up`);

    // Return results as JSON
    res.json({ downloadSpeed, uploadSpeed });
});


// ===============================================
// YOUR MODIFIED DASHBOARD ROUTE
// ===============================================
app.get("/dashboard", async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/");
    }

    // --- Speed test logic has been REMOVED from this route ---

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

    const allrooms = await getUserRoom(userdata.uid);

    const { data: hostels, error: hostelError } = await supabase
        .from("hostels")
        .select("hostel_id, hostel_name");

    if (hostelError) {
        console.error("Hostel fetch error:", hostelError);
    }

    const { data: userhosteldata, error: userhostelerror } = await supabase
        .from("hostels")
        .select("hostel_name")
        .eq("hostel_id", userdata.block)
        .single();

    // Note: downloadSpeed and uploadSpeed are no longer passed here
    return res.render("dashboard.ejs", {
        user: req.user,
        userdata,
        hostels,
        userhosteldata,
        message,
        allrooms
    });
});


app.get("/floors/:hostelId", async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { data: floors, error } = await supabase
      .from("floor_plans")
      .select("id, floor")
      .eq("hostel_id", hostelId);

    if (error) {
      console.error("Floor fetch error:", error);
      return res.status(500).json({ error: "Error fetching floors" });
    }

    res.json(floors);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Speed test API endpoint
app.get("/api/speedtest", async (req, res) => {
  try {
    console.log("Running speed test via API...");
    
    const downloadSpeed = await testDownload(25_000_000); // 25 MB
    const uploadSpeed = await testUpload(10_000_000); // 10 MB
    
    console.log(`Speed test completed - Download: ${downloadSpeed} Mbps, Upload: ${uploadSpeed} Mbps`);
    
    res.json({
      success: true,
      downloadSpeed: parseFloat(downloadSpeed),
      uploadSpeed: parseFloat(uploadSpeed),
      unit: "Mbps"
    });
  } catch (error) {
    console.error("Speed test failed:", error);
    res.status(500).json({
      success: false,
      error: "Speed test failed",
      downloadSpeed: 0,
      uploadSpeed: 0
    });
  }
});


const BASE_URL = 'https://speed.cloudflare.com';

/**
 * Calculates speed in Mbps.
 * @param {number} bytes - The number of bytes transferred.
 * @param {number} seconds - The duration of the transfer in seconds.
 * @returns {string} - The speed formatted to two decimal places.
 */
function calculateMbps(bytes, seconds) {
    if (seconds === 0) return '0.00';
    // Formula: (Bytes / seconds) * 8 = bits per second
    // Then divide by 1,000,000 for Mbps
    return ((bytes * 8) / seconds / 1_000_000).toFixed(2);
}

/**
 * Performs a download test.
 * @param {number} bytesToDownload - The size of the payload to download in bytes.
 * @returns {Promise<string>} - A promise that resolves with the download speed in Mbps.
 */
async function testDownload(bytesToDownload = 25_000_000) {
    console.log(`\nTesting download with ${bytesToDownload / 1_000_000} MB...`);
    const url = `${BASE_URL}/__down?bytes=${bytesToDownload}`;

    const startTime = process.hrtime.bigint();

    try {
        const response = await axios.get(url, { responseType: 'stream' });
        const stream = response.data;
        
        // Wait for the stream to finish downloading
        await new Promise((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('error', reject);
            // Consume the stream to ensure data is downloaded
            stream.pipe(new Stream.Writable({ write(chunk, encoding, callback) { callback(); } }));
        });

        const endTime = process.hrtime.bigint();
        const durationInSeconds = Number(endTime - startTime) / 1e9; // Convert nanoseconds to seconds

        console.log(`Download finished in ${durationInSeconds.toFixed(2)} seconds.`);
        return calculateMbps(bytesToDownload, durationInSeconds);

    } catch (error) {
        console.error('Download test failed:', error.message);
        return '0.00';
    }
}

/**
 * Performs an upload test.
 * @param {number} bytesToUpload - The size of the payload to upload in bytes.
 * @returns {Promise<string>} - A promise that resolves with the upload speed in Mbps.
 */
async function testUpload(bytesToUpload = 10_000_000) {
    console.log(`\nTesting upload with ${bytesToUpload / 1_000_000} MB...`);
    const url = `${BASE_URL}/__up`;
    const data = crypto.randomBytes(bytesToUpload); // Generate random data

    const startTime = process.hrtime.bigint();

    try {
        await axios.post(url, data, {
            headers: { 'Content-Type': 'application/octet-stream' }
        });

        const endTime = process.hrtime.bigint();
        const durationInSeconds = Number(endTime - startTime) / 1e9;

        console.log(`Upload finished in ${durationInSeconds.toFixed(2)} seconds.`);
        return calculateMbps(bytesToUpload, durationInSeconds);

    } catch (error) {
        console.error('Upload test failed:', error.message);
        return '0.00';
    }
}

/**
 * Main function to run the speed tests.
 */
async function runSpeedTest() {
    console.log('--- Starting Cloudflare Speed Test ---');

    const downloadSpeed = await testDownload(25_000_000); // 25 MB
    console.log(`➡️  Download Speed: ${downloadSpeed} Mbps`);

    const uploadSpeed = await testUpload(10_000_000); // 10 MB
    console.log(`⬆️  Upload Speed: ${uploadSpeed} Mbps`);
    
    console.log('\n--- Test Complete ---');
}





app.listen(3000, () => {
  console.log("Running on Port 3000!");
});

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});
