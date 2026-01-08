# 🚀 AWS Deployment Checklist

Complete this checklist to ensure successful deployment of your Redis page view tracking system.

---

## Pre-Deployment ✅

### 1. Local Code Review
- [x] Redis client configured with TLS
- [x] Environment variables set in `.env`
- [x] Middleware added for page tracking
- [x] Helper function `getMostViewedPage()` implemented
- [x] All routes updated with `isTrending` flag
- [x] EJS templates have trending banner
- [x] Error handling in place
- [x] No syntax errors

### 2. Dependencies
- [x] `redis@^5.10.0` installed (`npm install redis` already run)
- [x] All other dependencies up to date

### 3. Configuration Files
- [x] `.env` has `REDIS_HOST` and `REDIS_PORT`
- [x] `.gitignore` includes `.env` (don't commit secrets!)

---

## AWS ElastiCache Setup ☁️

### 1. Redis Cluster Configuration
- [ ] ElastiCache Redis cluster created
- [ ] **Cluster mode:** Disabled (for simple setup)
- [ ] **Node type:** cache.t3.micro or higher
- [ ] **Engine version:** 6.x or 7.x
- [ ] **In-transit encryption (TLS):** **ENABLED** ✅
- [ ] **At-rest encryption:** Enabled (recommended)
- [ ] **Automatic backups:** Enabled (recommended)

### 2. Network & Security
- [ ] Redis cluster in **same VPC as EC2**
- [ ] **Subnet group** configured
- [ ] **Security group** allows EC2 → ElastiCache:
  - Type: Custom TCP
  - Port: 6379
  - Source: EC2 security group ID

### 3. Endpoint Configuration
- [ ] Copy **Primary Endpoint**
  - Format: `master.xxx.xxx.cache.amazonaws.com`
  - Port: Usually 6379
- [ ] Add to `.env` file:
  ```env
  REDIS_HOST=master.your-cluster.xxx.cache.amazonaws.com
  REDIS_PORT=6379
  ```

---

## EC2 Instance Setup 💻

### 1. Network Connectivity
- [ ] EC2 instance in **same VPC as ElastiCache**
- [ ] EC2 security group allows:
  - [ ] Inbound: HTTP (80), HTTPS (443), SSH (22)
  - [ ] Outbound: All traffic (or at least port 6379 to ElastiCache)

### 2. Test Connection from EC2
```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Test Redis connection
nc -zv master.your-cluster.xxx.cache.amazonaws.com 6379
# Should output: Connection to ... 6379 port [tcp/*] succeeded!

# Or test with redis-cli (if installed)
redis-cli -h master.your-cluster.xxx.cache.amazonaws.com -p 6379 --tls PING
# Should output: PONG
```

---

## Code Deployment 📦

### 1. Prepare Repository
```bash
# On your local machine
cd HostelDekho

# Stage all changes
git add .

# Commit
git commit -m "Add Redis page view tracking with TLS support"

# Push to remote
git push origin main
```

### 2. Update EC2 Instance
```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Navigate to app directory
cd /path/to/HostelDekho

# Pull latest code
git pull origin main

# Install dependencies (redis package)
npm install

# Verify .env has correct values
cat .env | grep REDIS
# Should show:
# REDIS_HOST=master.xxx.cache.amazonaws.com
# REDIS_PORT=6379
```

### 3. Environment Variables on EC2
```bash
# Ensure .env file exists
ls -la .env

# Verify Redis configuration
cat .env

# If .env not present, create it:
nano .env
# Add all environment variables including:
# REDIS_HOST=...
# REDIS_PORT=...
```

---

## Application Startup 🎬

### Option 1: Using PM2 (Recommended)
```bash
# Install PM2 globally (if not installed)
sudo npm install -g pm2

# Start application
pm2 start app.js --name hosteldekho

# Save PM2 configuration
pm2 save

# Set PM2 to start on system boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status

# View logs
pm2 logs hosteldekho
```

### Option 2: Using Node Directly
```bash
# Start application
node app.js

# Or with nodemon for auto-restart
npm install -g nodemon
nodemon app.js
```

### Option 3: Using systemd Service
```bash
# Create service file
sudo nano /etc/systemd/system/hosteldekho.service

# Add configuration (example):
[Unit]
Description=HostelDekho Node.js App
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/path/to/HostelDekho
ExecStart=/usr/bin/node app.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable hosteldekho
sudo systemctl start hosteldekho
sudo systemctl status hosteldekho
```

---

## Verification & Testing ✅

### 1. Check Application Logs
```bash
# Using PM2
pm2 logs hosteldekho

# Using systemd
sudo journalctl -u hosteldekho -f

# Direct node
# Check console output
```

**Look for:**
```
✅ Redis connected successfully
✅ Redis client ready
Running on Port 3000!
```

**❌ Common errors:**
```
Error: connect ETIMEDOUT    → Security group issue
Error: getaddrinfo ENOTFOUND → Wrong REDIS_HOST
Error: socket hang up        → TLS configuration issue
```

### 2. Test Redis Connection
```bash
# On EC2, try connecting to Redis
redis-cli -h master.your-cluster.xxx.cache.amazonaws.com -p 6379 --tls

# Test commands
127.0.0.1:6379> PING
PONG

127.0.0.1:6379> INFO server
# Should show Redis version, uptime, etc.

127.0.0.1:6379> EXIT
```

### 3. Test Application Endpoints
```bash
# From EC2 or external
curl http://your-ec2-ip:3000/

# Should return HTML content
```

### 4. Generate Page Views
```bash
# Visit multiple pages
curl http://your-ec2-ip:3000/
curl http://your-ec2-ip:3000/hostel/1
curl http://your-ec2-ip:3000/hostel/1
curl http://your-ec2-ip:3000/hostel/1
curl http://your-ec2-ip:3000/hostel/2
```

### 5. Verify Redis Data
```bash
redis-cli -h master.your-cluster.xxx.cache.amazonaws.com -p 6379 --tls

127.0.0.1:6379> ZREVRANGE pageViews 0 -1 WITHSCORES
# Should show page paths and view counts
# Example:
# 1) "/hostel/1"
# 2) "3"
# 3) "/"
# 4) "1"
# 5) "/hostel/2"
# 6) "1"
```

### 6. Test Trending Banner
```bash
# Visit the most-viewed page in a browser
# Should see green banner with 🔥 emoji
```

---

## Post-Deployment Monitoring 📊

### 1. Application Health
- [ ] Application running without crashes
- [ ] Response times normal
- [ ] No error spikes in logs

### 2. Redis Health
```bash
# Check ElastiCache in AWS Console
# Verify:
- [ ] Status: Available
- [ ] CPU Utilization: < 80%
- [ ] Memory Usage: < 80%
- [ ] Network In/Out: Normal
```

### 3. Functional Testing
- [ ] Visit homepage - no errors
- [ ] Visit hostel pages - data loads correctly
- [ ] Submit room review - works properly
- [ ] Trending banner appears on most-viewed page
- [ ] Banner changes as different pages become popular

---

## Troubleshooting Common Issues 🔧

### Issue: Redis connection timeout
```
❌ Error: connect ETIMEDOUT
```
**Fix:**
1. Check security group on ElastiCache
2. Ensure EC2 → ElastiCache on port 6379
3. Verify VPC configuration
4. Check subnet routing

### Issue: Authentication error
```
❌ Error: NOAUTH Authentication required
```
**Fix:**
1. ElastiCache has AUTH enabled
2. Add AUTH token to Redis client config in app.js
3. Store token in .env as REDIS_PASSWORD

### Issue: TLS error
```
❌ Error: socket hang up
```
**Fix:**
1. Ensure TLS is enabled on ElastiCache
2. Verify `tls: true` in app.js Redis config
3. Check Node.js version (18+ recommended)

### Issue: Banner never shows
**Fix:**
1. Generate more page views (10+ visits)
2. Check Redis has data: `ZREVRANGE pageViews 0 -1`
3. Verify `isTrending` flag in route handlers
4. Check browser console for JS errors

### Issue: App works but Redis doesn't
**Fix:**
1. Check logs for "Redis Client Error"
2. App is designed to work without Redis
3. Fix Redis connection for full functionality

---

## Security Checklist 🔒

- [ ] `.env` file not committed to git
- [ ] ElastiCache in private subnet (not public)
- [ ] Security groups follow least privilege
- [ ] TLS enabled on ElastiCache
- [ ] Consider enabling AUTH on Redis
- [ ] Regular security patches on EC2
- [ ] Monitor CloudWatch for anomalies

---

## Performance Optimization 🚀

### Optional Enhancements
- [ ] Enable Redis connection pooling
- [ ] Add Redis key expiration for old data
- [ ] Implement caching for database queries
- [ ] Use CloudWatch for monitoring
- [ ] Set up alerts for high CPU/memory

### Monitoring Setup
```bash
# CloudWatch Metrics to monitor:
- ElastiCache: CPUUtilization, NetworkBytesIn/Out
- EC2: CPUUtilization, NetworkIn/Out
- Application: Custom metrics via CloudWatch agent
```

---

## Rollback Plan 🔄

If issues occur:

### 1. Quick Rollback
```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Revert to previous commit
cd /path/to/HostelDekho
git log --oneline
git revert <commit-hash>

# Restart application
pm2 restart hosteldekho
```

### 2. Disable Redis (Emergency)
```javascript
// In app.js, comment out Redis connection
// (async () => {
//   try {
//     await redisClient.connect();
//   } catch (err) {
//     console.error('Failed to connect to Redis:', err);
//   }
// })();

// Restart app
```

---

## Success Criteria ✨

### Deployment is successful when:
- [x] Application starts without errors
- [x] Redis connection established (check logs)
- [x] Pages load correctly
- [x] Page views tracked in Redis
- [x] Trending banner displays on most-viewed page
- [x] No increase in error rates
- [x] Response times remain normal

---

## Documentation Reference 📚

- **Full Technical Docs:** `REDIS_TRACKING_README.md`
- **Quick Start Guide:** `QUICK_START.md`
- **Local Testing:** `LOCAL_TESTING.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`

---

## Support Contacts 📞

### AWS Resources
- [ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [VPC Troubleshooting](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-troubleshooting.html)

### Redis Resources
- [Redis Commands](https://redis.io/commands/)
- [Node Redis Client](https://github.com/redis/node-redis)

---

## Final Checklist ✅

Before marking deployment complete:
- [ ] All tests passed
- [ ] Logs show no errors
- [ ] Redis connected
- [ ] Trending banner works
- [ ] Monitoring set up
- [ ] Documentation reviewed
- [ ] Team notified

**🎉 Deployment Complete!**

---

Last Updated: Deployment Day
Next Review: 24 hours after deployment
