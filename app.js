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
  try {
    const data = await getAllHostel();
    if (!data) {
      console.error("Error: Failed to fetch hostels");
      return res.status(404).render("error.ejs", { message: "Hostels not found" });
    }
    
    // Check if this is the most viewed page
    const mostViewed = await getMostViewedPage();
    const isTrending = mostViewed && mostViewed.path === req.path;
    
    res.render("home.ejs", { hosteldata: data, isTrending });
  } catch (err) {
    console.error("Error rendering home page:", err);
    return res.status(500).render("error.ejs", { message: "Internal Server Error: Unable to load hostels" });
  }
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
  try {
    const hosteldata = await getHostel(req.params.id);
    if (!hosteldata) {
      console.error("Error: Hostel not found for ID:", req.params.id);
      return res.status(404).render("error.ejs", { message: "Hostel not found" });
    }

    const floorplan = await getFloor(req.params.id);
    const reviews = await getRoom(req.params.id);
    const roomdetails = await getRoomDetails(req.params.id);
    const similarhostels = await similarHostels(hosteldata.bed_type, hosteldata.hostel_type, hosteldata.chota_dhobi_facility);

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
  } catch (err) {
    console.error("Error rendering hostel page:", err);
    return res.status(500).render("error.ejs", { message: "Internal Server Error: Unable to load hostel details" });
  }
});

app.get("/floor/:floorid", async (req, res) => {
  try {
    const floorplan = await getFloorPlan(req.params.floorid);
    if (!floorplan) {
      console.error("Error: Floor plan not found for ID:", req.params.floorid);
      return res.status(404).render("error.ejs", { message: "Floor plan not found" });
    }

    const roomdata = await getRoom(req.params.floorid);
    const hostel = await getHostel(floorplan.hostel_id);
    if (!hostel) {
      console.error("Error: Hostel not found for floor ID:", req.params.floorid);
      return res.status(404).render("error.ejs", { message: "Associated hostel not found" });
    }

    // Check if this is the most viewed page
    const mostViewed = await getMostViewedPage();
    const isTrending = mostViewed && mostViewed.path === req.path;

    return res.render("floorplan.ejs", { roomdata, floorplan, hostel, isTrending });
  } catch (err) {
    console.error("Error rendering floor plan page:", err);
    return res.status(500).render("error.ejs", { message: "Internal Server Error: Unable to load floor plan" });
  }
});

app.get("/review/:floorId", async (req, res) => {
  try {
    const floorplan = await getFloorPlan(req.params.floorId);
    if (!floorplan) {
      console.error("Error: Floor plan not found for ID:", req.params.floorId);
      return res.status(404).render("error.ejs", { message: "Floor plan not found" });
    }

    const hostel = await getHostel(floorplan.hostel_id);
    if (!hostel) {
      console.error("Error: Hostel not found for floor ID:", req.params.floorId);
      return res.status(404).render("error.ejs", { message: "Associated hostel not found" });
    }

    // Check if this is the most viewed page
    const mostViewed = await getMostViewedPage();
    const isTrending = mostViewed && mostViewed.path === req.path;

    return res.render("review.ejs", { hostel, floorplan, isTrending });
  } catch (err) {
    console.error("Error rendering review page:", err);
    return res.status(500).render("error.ejs", { message: "Internal Server Error: Unable to load review page" });
  }
});











app.post("/submit-room-details", async (req, res) => {
  const { hostelid, floorid, remarks, roomnumber, jio, airtel, vit, cleanliness } = req.body;

  try {
    // Validate required fields
    if (!hostelid || !floorid || !roomnumber) {
      console.error("Error: Missing required fields - hostelid, floorid, or roomnumber");
      return res.status(400).render("error.ejs", { message: "Missing required fields" });
    }

    // Check if a review already exists for this hostel + room number combination
    const { data: existingReview, error: checkError } = await supabase
      .from("reviews")
      .select("*")
      .eq("hostel_id", hostelid)
      .eq("room_number", roomnumber)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error("Check error:", checkError);
      return res.status(500).render("error.ejs", { message: "Database check failed: " + checkError.message });
    }

    // If a review already exists for this room in this hostel
    if (existingReview) {
      console.warn("Warning: Duplicate review attempt for hostel:", hostelid, "room:", roomnumber);
      return res.redirect("/floor/" + floorid + "?error=A review already exists for room " + roomnumber + " in this hostel. Only one review per room is allowed.");
    }

    // Proceed with insert if no existing review
    const { data, error } = await supabase.from("reviews").insert({
      hostel_id: hostelid,
      floor_id: floorid,
      airtel_speed: airtel,
      jio_speed: jio,
      vit_wifi_speed: vit,
      cleaniless_score: cleanliness,
      room_number: roomnumber,
      remarks: remarks,
    });

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).render("error.ejs", { message: "Failed to submit room details: " + error.message });
    }

    return res.redirect("/floor/" + floorid + "?message=Room Details have been added successfully!");
  } catch (err) {
    console.error("Unexpected error in submit-room-details:", err);
    return res.status(500).render("error.ejs", { message: "Internal Server Error: Unable to submit room details" });
  }
});







app.get("/floors/:hostelId", async (req, res) => {
  try {
    const { hostelId } = req.params;
    
    // Validate hostelId
    if (!hostelId) {
      console.error("Error: Missing hostelId parameter");
      return res.status(400).json({ error: "Hostel ID is required" });
    }

    const { data: floors, error } = await supabase
      .from("floor_plans")
      .select("id, floor")
      .eq("hostel_id", hostelId);

    if (error) {
      console.error("Floor fetch error:", error);
      return res.status(500).json({ error: "Database error: " + error.message });
    }

    // If no floors found, return empty array or 404 based on requirements
    if (!floors || floors.length === 0) {
      console.warn("Warning: No floors found for hostel ID:", hostelId);
      return res.json([]);
    }

    res.json(floors);
  } catch (err) {
    console.error("Server error in /floors/:hostelId:", err);
    return res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});


app.use(async(req,res,next)=>{
return res.status(404).render("error.ejs");
})

app.listen(3000, "0.0.0.0")
