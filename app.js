import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import session from "express-session";
import { fileURLToPath } from "url";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
  import dotenv from "dotenv";
  import { createClient } from "@supabase/supabase-js";
import axios from 'axios';
import crypto from 'crypto';
import Stream from 'stream';
import { createClient as createRedisClient } from 'redis';

  const app = express();

  dotenv.config();
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

// Redis client configuration with TLS for AWS ElastiCache
// Only initialize Redis if REDIS_HOST is configured (production environment)
let redisClient = null;

if (process.env.REDIS_HOST && process.env.REDIS_HOST.trim() !== '') {
  console.log('🔧 Redis configuration detected, initializing client...');
  
  redisClient = createRedisClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT) || 6379,
      tls: true,
      rejectUnauthorized: false, // AWS ElastiCache uses self-signed certs
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('❌ Redis: Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  // Redis error handling
  redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
  });

  // Connect to Redis
  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      console.error('❌ Failed to connect to Redis:', err.message);
      console.log('⚠️  App will continue without Redis (trending feature disabled)');
    }
  })();
} else {
  console.log('ℹ️  Redis not configured - running in local mode (trending feature disabled)');
}

// Helper function to get the most viewed page
async function getMostViewedPage() {
  try {
    if (!redisClient || !redisClient.isReady) return null;
    
    const result = await redisClient.zRevRangeWithScores('pageViews', 0, 0);
    if (result && result.length > 0) {
      return {
        path: result[0].value,
        views: result[0].score
      };
    }
    return null;
  } catch (err) {
    console.error('Error getting most viewed page:', err.message);
    return null;
  }
}

// Helper function to get the most viewed hostel
async function getMostViewedHostel() {
  try {
    if (!redisClient || !redisClient.isReady) return null;
    
    // Get all hostel view keys
    const keys = await redisClient.keys('hostel:*');
    if (!keys || keys.length === 0) return null;
    
    let maxViews = 0;
    let mostViewedHostelId = null;
    
    // Check each hostel's view count
    for (const key of keys) {
      const views = await redisClient.get(key);
      const viewCount = parseInt(views) || 0;
      if (viewCount > maxViews) {
        maxViews = viewCount;
        // Extract hostel ID from key (format: hostel:123)
        mostViewedHostelId = key.split(':')[1];
      }
    }
    
    if (mostViewedHostelId) {
      return {
        hostelId: mostViewedHostelId,
        views: maxViews
      };
    }
    return null;
  } catch (err) {
    console.error('Error getting most viewed hostel:', err.message);
    return null;
  }
}



const upload = multer({ storage: multer.memoryStorage() });



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

// Page view tracking middleware
app.use(async (req, res, next) => {
  try {
    // Only track GET requests to actual pages (not static assets or API endpoints)
    if (req.method === 'GET' && 
        !req.path.startsWith('/api/') && 
        !req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/)) {
      
      if (redisClient && redisClient.isReady) {
        // Increment page view count
        await redisClient.zIncrBy('pageViews', 1, req.path);
      }
    }
  } catch (err) {
    console.error('Error tracking page view:', err.message);
    // Don't crash the app on Redis errors
  }
  next();
});



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

async function getRoomDetails(id){
    const { data, error } = await supabase
    .from("room_details")
    .select("*")
    .eq("hostel_id", id);

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
  
  // Check if this is the most viewed page
  const mostViewed = await getMostViewedPage();
  const isTrending = mostViewed && mostViewed.path === req.path;
  
  res.render("home.ejs", { hosteldata: data, isTrending });
});

async function similarHostels(bed_type,hostel_type,chota_dhobi_facility){

  const {data,error}=await supabase.from("hostels").select("*").match({
    "hostel_type":hostel_type,
    "bed_type":bed_type,
    "chota_dhobi_facility":chota_dhobi_facility,
  
  
  });

  return data;
}

app.get("/hostel/:id", async (req, res) => {
  const hosteldata = await getHostel(req.params.id);
  const floorplan = await getFloor(req.params.id);
  const reviews = await getRoom(req.params.id);
  const roomdetails = await getRoomDetails(req.params.id);
  const similarhostels = await similarHostels(hosteldata.bed_type,hosteldata.hostel_type,hosteldata.chota_dhobi_facility);

  
  // Track this specific hostel view in Redis with individual key per hostel
  try {
    if (redisClient && redisClient.isReady) {
      const hostelKey = `hostel:${req.params.id}`;
      await redisClient.incr(hostelKey);
      const currentViews = await redisClient.get(hostelKey);
      console.log(`✅ Cached hostel view for hostel ID: ${req.params.id}, Total views: ${currentViews}`);
    }
  } catch (err) {
    console.error('Error caching hostel view:', err.message);
  }
  
  // Check if this is the most viewed hostel
  const mostViewedHostel = await getMostViewedHostel();
  const isHostelTrending = mostViewedHostel && mostViewedHostel.hostelId === req.params.id;
  
  if (isHostelTrending) {
    console.log(`🔥 Hostel ${req.params.id} is trending with ${mostViewedHostel.views} views!`);
  }
  
  return res.render("hostel.ejs", { 
    hosteldata, 
    floorplan, 
    reviews, 
    roomdetails, 
    isTrending: isHostelTrending,
    similarhostels,
    trendingViews: mostViewedHostel ? mostViewedHostel.views : 0
  });
});

app.get("/floor/:floorid", async (req, res) => {
  
  const roomdata = await getRoom(req.params.floorid);
  const floorplan = await getFloorPlan(req.params.floorid);
  const hostel = await getHostel(floorplan.hostel_id);
  
  // Check if this is the most viewed page
  const mostViewed = await getMostViewedPage();
  const isTrending = mostViewed && mostViewed.path === req.path;
  
  return res.render("floorplan.ejs", { roomdata, floorplan, hostel, isTrending });
});

app.get("/review/:floorId", async (req, res) => {
  const floorplan = await getFloorPlan(req.params.floorId);
  if (!floorplan) {
    return res.status(404).send("Floor plan not found");
  }

  const hostel = await getHostel(floorplan.hostel_id);
  if (!hostel) {
    return res.status(404).send("Hostel not found");
  }

  // Check if this is the most viewed page
  const mostViewed = await getMostViewedPage();
  const isTrending = mostViewed && mostViewed.path === req.path;

  res.render("review.ejs", { hostel, floorplan, isTrending });
});











app.post("/submit-room-details", async (req, res) => {
  const { hostelid, floorid, remarks, roomnumber,jio,airtel,vit,cleanliness } = req.body;

  try {
    // Check if a review already exists for this hostel + room number combination
    const { data: existingReview, error: checkError } = await supabase
      .from("reviews")
      .select("*")
      .eq("hostel_id", hostelid)
      .eq("room_number", roomnumber)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error("Check error:", checkError);
      return res
        .status(500)
        .json({ error: "Database check failed", details: checkError.message });
    }

    // If a review already exists for this room in this hostel
    if (existingReview) {
      return res.redirect("/floor/" + floorid + "?error=A review already exists for room " + roomnumber + " in this hostel. Only one review per room is allowed.");
    }

    // Proceed with insert if no existing review
    const { data, error } = await supabase.from("reviews").insert({
      hostel_id: hostelid,
      floor_id: floorid,
      airtel_speed:airtel,
      jio_speed:jio,
      vit_wifi_speed:vit,
      cleaniless_score:cleanliness,
      room_number: roomnumber,
      remarks: remarks,
    });

    if (error) {
      console.error("Insert error:", error);
      return res
        .status(500)
        .json({ error: "Database insert failed", details: error.message });
    }

   res.redirect("/floor/" + floorid + "?message=Room Details have been added successfully!");

  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
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

const PORT = process.env.PORT || 3001;



app.listen(PORT, () => {
  console.log("Running on Port 3000!");
});

