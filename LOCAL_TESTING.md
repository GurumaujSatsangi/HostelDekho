# Local Testing Guide (Optional)

If you want to test the Redis functionality **before deploying to AWS**, here's how to run it locally.

## Option 1: Connect to AWS ElastiCache from Local Machine

### Requirements
- VPN or SSH tunnel to access ElastiCache
- Security group allows your IP

### Setup SSH Tunnel (Recommended)

```bash
# Create tunnel through EC2 to ElastiCache
ssh -i your-key.pem -L 6379:master.hosteldekho-cache.7f9fcu.aps1.cache.amazonaws.com:6379 ec2-user@your-ec2-ip
```

### Update .env for Local Testing

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Run Application

```bash
npm start
```

---

## Option 2: Use Local Redis (Quick Testing)

For testing without AWS connection:

### Install Redis Locally

**Windows (using Chocolatey):**
```bash
choco install redis-64
redis-server
```

**Windows (WSL/Ubuntu):**
```bash
sudo apt-get install redis-server
redis-server --port 6379
```

**macOS:**
```bash
brew install redis
redis-server
```

### Update .env

```env
# Comment out AWS configuration
# REDIS_HOST=master.hosteldekho-cache.7f9fcu.aps1.cache.amazonaws.com
# REDIS_PORT=6379

# Use local Redis (no TLS needed)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Update app.js (Temporarily)

For local Redis, **disable TLS**:

```javascript
// Find this section in app.js (around line 26)
const redisClient = createRedisClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    // tls: true,  // COMMENT THIS OUT for local testing
    // rejectUnauthorized: false
  },
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: Max reconnection attempts reached');
        return new Error('Max reconnection attempts reached');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});
```

**⚠️ Remember to re-enable TLS before deploying to AWS!**

### Run Application

```bash
npm start
```

---

## Testing Steps

### 1. Start the Application

```bash
npm start
```

Expected output:
```
✅ Redis connected successfully
✅ Redis client ready
Running on Port 3000!
```

### 2. Visit Pages

Open browser and visit:
```
http://localhost:3000/
http://localhost:3000/hostel/1
http://localhost:3000/hostel/2
```

### 3. Check Redis Data

Open a new terminal:

```bash
redis-cli

127.0.0.1:6379> ZREVRANGE pageViews 0 -1 WITHSCORES
```

Expected output:
```
1) "/hostel/1"
2) "5"
3) "/"
4) "3"
5) "/hostel/2"
6) "2"
```

### 4. Verify Trending Banner

Visit the most-viewed page (e.g., `/hostel/1` if it has highest count).

You should see:
```
🔥 This Hostel is being viewed the most right now!
```

---

## Debugging Tips

### Redis Not Connecting

**Check if Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

**Check Redis logs:**
```bash
# Windows (Chocolatey)
Get-Content "C:\ProgramData\Redis\redis-server.log" -Wait

# Linux/WSL
tail -f /var/log/redis/redis-server.log
```

### Application Errors

**Check console output:**
- ✅ "Redis connected successfully" = Working
- ❌ "Redis Client Error" = Connection issue

**Common errors:**

1. **ECONNREFUSED**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:6379
   ```
   **Fix:** Redis server not running. Start it with `redis-server`

2. **Authentication Required**
   ```
   Error: NOAUTH Authentication required
   ```
   **Fix:** Add password to Redis config

3. **TLS Error**
   ```
   Error: socket hang up
   ```
   **Fix:** Disable TLS for local Redis (see above)

---

## Test the Trending Logic

### Scenario 1: Multiple Pages

```bash
# Visit home page 3 times
curl http://localhost:3000/
curl http://localhost:3000/
curl http://localhost:3000/

# Visit hostel 1 page 5 times
curl http://localhost:3000/hostel/1
curl http://localhost:3000/hostel/1
curl http://localhost:3000/hostel/1
curl http://localhost:3000/hostel/1
curl http://localhost:3000/hostel/1

# Check which is trending
redis-cli ZREVRANGE pageViews 0 0 WITHSCORES
# Should return: /hostel/1 with score 5

# Now visit /hostel/1 in browser
# Should see trending banner!
```

### Scenario 2: Switch Trending Page

```bash
# Make hostel 2 more popular
for i in {1..10}; do curl http://localhost:3000/hostel/2; done

# Check trending
redis-cli ZREVRANGE pageViews 0 0 WITHSCORES
# Should return: /hostel/2 with score 10

# Visit /hostel/2 in browser
# Should see trending banner!
```

---

## Reset Data (Clean Start)

```bash
# Connect to Redis
redis-cli

# Delete all page view data
127.0.0.1:6379> DEL pageViews

# Verify it's gone
127.0.0.1:6379> EXISTS pageViews
# Should return: 0

# Exit
127.0.0.1:6379> EXIT
```

---

## Before Deploying to AWS

### ✅ Checklist

- [ ] Re-enable TLS in app.js
- [ ] Update .env with AWS ElastiCache endpoint
- [ ] Test Redis connection from EC2 (not local)
- [ ] Verify security group rules
- [ ] Push code to repository
- [ ] Deploy to EC2
- [ ] Monitor logs for "Redis client ready"

### Re-enable TLS

```javascript
const redisClient = createRedisClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: true,  // ✅ MUST BE ENABLED
    rejectUnauthorized: false
  },
  // ... rest of config
});
```

### Update .env

```env
REDIS_HOST=master.hosteldekho-cache.7f9fcu.aps1.cache.amazonaws.com
REDIS_PORT=6379
```

---

## Production Deployment

Once local testing is complete:

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add Redis page view tracking with TLS"
   git push
   ```

2. **Deploy to EC2:**
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-ip
   cd HostelDekho
   git pull
   npm install
   pm2 restart app
   ```

3. **Verify in production:**
   ```bash
   pm2 logs
   # Look for: ✅ Redis connected successfully
   ```

4. **Test live:**
   ```
   https://your-domain.com/hostel/1
   ```

---

## Useful Commands

```bash
# Check Redis memory usage
redis-cli INFO memory

# Count total page views
redis-cli ZCARD pageViews

# Get specific page views
redis-cli ZSCORE pageViews "/hostel/1"

# Increment manually (for testing)
redis-cli ZINCRBY pageViews 10 "/hostel/1"

# List all pages with views
redis-cli ZREVRANGE pageViews 0 -1 WITHSCORES
```

---

## Summary

You now have:
- ✅ Local Redis testing capability
- ✅ Debugging commands and tips
- ✅ Testing scenarios
- ✅ Pre-deployment checklist

**Next:** Deploy to AWS and test in production! 🚀
