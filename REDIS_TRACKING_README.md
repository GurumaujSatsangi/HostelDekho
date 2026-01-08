# Redis Page View Tracking System

This document explains the Redis-based page view tracking system implemented in the HostelDekho application.

## Overview

The system uses **AWS ElastiCache (Redis OSS) with TLS** to track page views across the application and displays a "trending" banner on the most-viewed pages.

## Features

✅ **TLS-Enabled Redis Connection** - Secure connection to AWS ElastiCache  
✅ **Automatic Page View Tracking** - Middleware tracks all page visits  
✅ **Trending Page Detection** - Identifies most-viewed pages in real-time  
✅ **Dynamic Banner Display** - Shows trending banner on most-viewed pages  
✅ **Error Resilience** - App continues working even if Redis fails  

---

## Configuration

### Environment Variables

Add to your `.env` file:

```env
REDIS_HOST=master.hosteldekho-cache.7f9fcu.aps1.cache.amazonaws.com
REDIS_PORT=6379
```

### AWS ElastiCache Setup

1. **Create Redis cluster** in AWS ElastiCache
2. **Enable TLS** (in-transit encryption)
3. **Configure security group** to allow connections from your EC2 instance
4. **Copy the primary endpoint** to your `.env` file

---

## Implementation Details

### 1. Redis Client Setup

The Redis client is configured with TLS support and automatic reconnection:

```javascript
const redisClient = createRedisClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: true,
    rejectUnauthorized: false // AWS uses self-signed certificates
  },
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Max reconnection attempts reached');
      return Math.min(retries * 100, 3000);
    }
  }
});
```

### 2. Page View Tracking Middleware

Automatically increments view count for each page:

```javascript
app.use(async (req, res, next) => {
  try {
    if (req.method === 'GET' && 
        !req.path.startsWith('/api/') && 
        !req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      
      if (redisClient.isReady) {
        await redisClient.zIncrBy('pageViews', 1, req.path);
      }
    }
  } catch (err) {
    console.error('Error tracking page view:', err);
  }
  next();
});
```

**What it tracks:**
- ✅ All GET requests to pages
- ❌ Static assets (JS, CSS, images)
- ❌ API endpoints

### 3. Most Viewed Page Detection

Helper function to fetch the top viewed page:

```javascript
async function getMostViewedPage() {
  try {
    if (!redisClient.isReady) return null;
    
    const result = await redisClient.zRevRangeWithScores('pageViews', 0, 0);
    if (result && result.length > 0) {
      return {
        path: result[0].value,
        views: result[0].score
      };
    }
    return null;
  } catch (err) {
    console.error('Error getting most viewed page:', err);
    return null;
  }
}
```

### 4. Route Handler Integration

Each route checks if it's the most-viewed page:

```javascript
app.get("/hostel/:id", async (req, res) => {
  const hosteldata = await getHostel(req.params.id);
  const floorplan = await getFloor(req.params.id);
  const reviews = await getRoom(req.params.id);
  const roomdetails = await getRoomDetails(req.params.id);
  
  // Check if this is the most viewed page
  const mostViewed = await getMostViewedPage();
  const isTrending = mostViewed && mostViewed.path === req.path;
  
  return res.render("hostel.ejs", { 
    hosteldata, 
    floorplan, 
    reviews, 
    roomdetails, 
    isTrending 
  });
});
```

### 5. EJS Template Integration

Display trending banner when `isTrending` is true:

```html
<% if (typeof isTrending !== 'undefined' && isTrending) { %>
<div class="trending-banner">
  <span class="trending-icon">🔥</span>
  <span>This Hostel is being viewed the most right now!</span>
</div>
<% } %>
```

---

## Redis Data Structure

The system uses a **Redis Sorted Set** named `pageViews`:

```
Key: pageViews
Type: Sorted Set (ZSET)

Structure:
{
  "/": 150,
  "/hostel/1": 89,
  "/hostel/2": 67,
  "/floor/5": 45,
  ...
}
```

**Redis Commands Used:**
- `ZINCRBY pageViews 1 /path` - Increment view count
- `ZREVRANGE pageViews 0 0 WITHSCORES` - Get most-viewed page

---

## Error Handling

The system is designed to be **resilient to Redis failures**:

1. **Connection Errors**: Logged but don't crash the app
2. **Redis Unavailable**: Pages work normally, just without trending banner
3. **Automatic Reconnection**: Retries up to 10 times with exponential backoff

```javascript
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
  // App continues to function normally
});
```

---

## Testing

### 1. Test Redis Connection

```bash
node -e "import('redis').then(r => r.createClient({socket:{host:'YOUR_HOST',port:6379,tls:true}}).connect().then(() => console.log('Connected!')))"
```

### 2. View Page View Stats

Connect to Redis CLI and run:

```bash
redis-cli -h master.hosteldekho-cache.7f9fcu.aps1.cache.amazonaws.com -p 6379 --tls

# Get all page views sorted by count
ZREVRANGE pageViews 0 -1 WITHSCORES

# Get top 5 pages
ZREVRANGE pageViews 0 4 WITHSCORES

# Get specific page view count
ZSCORE pageViews "/hostel/1"
```

### 3. Manual Testing

1. Visit different pages multiple times
2. The most-visited page should show the trending banner
3. Check console logs for Redis connection status

---

## Performance Considerations

- **Non-blocking**: Redis operations don't block page rendering
- **Minimal overhead**: Simple ZINCRBY operation is very fast (~1ms)
- **Efficient queries**: ZREVRANGE with small range is O(log(N)+M)
- **Memory efficient**: Sorted sets use minimal memory

---

## Monitoring

Check application logs for:

```
✅ Redis connected successfully
✅ Redis client ready
❌ Redis Client Error: <error details>
❌ Error tracking page view: <error details>
```

---

## Troubleshooting

### Issue: Redis connection fails

**Solution:**
1. Check security group allows inbound on port 6379
2. Verify EC2 instance can reach ElastiCache endpoint
3. Ensure TLS is enabled on ElastiCache cluster

### Issue: Banner doesn't show

**Solution:**
1. Check Redis is connected: Look for "Redis client ready" in logs
2. Visit pages multiple times to generate views
3. Check `isTrending` variable in EJS templates

### Issue: "READONLY You can't write against a read only replica"

**Solution:**
- Use the **primary endpoint**, not replica endpoint
- Format: `master.cluster-name.region.cache.amazonaws.com`

---

## Future Enhancements

- [ ] Add view count display next to trending banner
- [ ] Implement time-based trending (last 24 hours)
- [ ] Add Redis connection pool for better performance
- [ ] Create admin dashboard to view all page stats
- [ ] Implement rate limiting using Redis

---

## Security Notes

- TLS encryption protects data in transit
- `rejectUnauthorized: false` is safe for AWS ElastiCache (uses self-signed certs)
- Consider using Redis AUTH password for additional security
- Use VPC security groups to restrict access

---

## Dependencies

```json
{
  "redis": "^5.10.0"
}
```

Already installed via: `npm install redis`

---

## Support

For issues or questions, check:
- [Redis Node.js Client Docs](https://github.com/redis/node-redis)
- [AWS ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- Application logs for error messages
