# claude.md - Al Cabone Sales Bot Development Guide

*Instructions for Claude Code to assist with Twitter sales bot development*

## 🎯 Project Overview

Building an automated Twitter bot that posts when Al Cabone NFTs are sold on OpenSea. The bot generates gangster-themed messages and images based on buyer's holder tier (Associate → Soldier → Capo → Godfather → Commission).

**Goal:** Working PoC in 3 days (~12-14 hours)
**Tech Stack:** Node.js, GitHub Actions, Twitter API v2, OpenSea API, Canvas (image generation)

## 📋 Task Management

### Current Task List Location
- **Primary:** `todo.md` - Contains all PoC tasks organized by day
- **Update Method:** Mark tasks complete with `- [x]` when finished
- **Progress Tracking:** Each completed task should be checked off immediately

### Task Completion Protocol
1. When starting a task, mention which task from `todo.md` you're working on
2. Upon completion, update the markdown file with `[x]` 
3. Commit the updated `todo.md` to track progress
4. Move to next logical task in sequence

## 🛠️ Development Best Practices

### API Management
- **Rate Limiting:** Always add delays between API calls (5-10 seconds)
- **Error Handling:** Wrap all API calls in try/catch blocks
- **Graceful Failures:** Bot should continue running even if one post fails
- **API Keys:** Never commit keys to repo, use environment variables only

### Testing Strategy (Lightweight)
- **Mock Data Testing:** Create sample sale objects for local testing
- **API Connectivity:** Simple ping tests to verify APIs work before full integration
- **Image Generation:** Test locally with one sample image before deploying
- **Manual Triggers:** Use GitHub Actions manual trigger for initial testing

### Code Structure
```
bot.js - Main bot logic
├── Configuration (API keys, collection info)
├── Helper Functions (tier detection, message generation) 
├── API Integrations (OpenSea, Twitter)
├── Image Generation
└── Main Execution Flow
```

### GitHub Actions Setup
- **Secrets Management:** Store all API keys in GitHub repository secrets
- **Scheduling:** Start with 30-minute intervals (can adjust later)
- **Logging:** Use console.log for debugging in Actions logs
- **Error Recovery:** Bot should handle failures and continue next cycle

## 🧪 Testing Approach (Minimal Viable)

### Local Development Testing
```bash
# Test dependencies install
npm install

# Test with mock data
node bot.js --test

# Test image generation only
node bot.js --test-images

# Test API connections
node bot.js --test-apis
```

### Integration Testing
1. **OpenSea API:** Verify collection slug returns data
2. **Twitter API:** Post one test tweet to confirm auth works
3. **GitHub Actions:** Manual trigger to test cloud environment
4. **End-to-End:** Let bot run one full cycle and verify tweet posted

### Debug Information to Log
```javascript
console.log('🤖 Bot starting...');
console.log(`Found ${sales.length} recent sales`);
console.log(`Processing sale: ${sale.asset.name}`);
console.log(`Holder tier: ${tier}, NFT count: ${holderCount}`);
console.log('✅ Tweet posted successfully');
console.log('❌ Error:', error.message);
```

## 📊 Success Criteria for PoC

### Core Functionality Must Work
- [ ] Bot detects Al Cabone sales from OpenSea API
- [ ] Generates appropriate gangster messages based on holder tier
- [ ] Creates and posts images to Twitter
- [ ] Runs automatically every 30 minutes via GitHub Actions
- [ ] Handles basic errors without crashing

### Quality Indicators
- **Message Variety:** Different messages for different tiers
- **Visual Appeal:** Images look decent on Twitter
- **Reliability:** Bot runs for 24+ hours without manual intervention
- **Performance:** Each run completes in under 5 minutes

## 🔧 Implementation Sequence

### Day 1 Focus
1. Get all APIs working and authenticated
2. Set up GitHub repository with proper secrets
3. Verify OpenSea data fetching works with Al Cabone collection
4. Simple "Hello World" tweet to test Twitter integration

### Day 2 Focus  
1. Implement tier detection logic based on holder count
2. Create message templates with gangster lore
3. Build basic image generation (dark theme, golden text, badges)
4. Test full message + image generation locally

### Day 3 Focus
1. Deploy to GitHub Actions and test automation
2. Add basic error handling for API failures
3. Monitor 1-2 automated runs to validate PoC
4. Document any issues for future iterations

## ⚠️ Common Pitfalls to Avoid

### API Issues
- **OpenSea Rate Limits:** Don't exceed 4 requests/second
- **Twitter Posting Limits:** Space out posts by at least 30 seconds
- **GitHub Actions Timeouts:** Keep bot execution under 10 minutes total
- **Image Size:** Ensure generated images are under 5MB for Twitter

### Development Mistakes
- **Hardcoded Values:** Always use environment variables for sensitive data
- **Memory Leaks:** Dispose of Canvas objects after image generation
- **Infinite Loops:** Always have exit conditions in API retry logic
- **Missing Dependencies:** Test all npm packages work in GitHub Actions environment

### Deployment Issues
- **Secret Names:** Ensure GitHub secret names match environment variable names exactly
- **File Permissions:** GitHub Actions may need specific file access patterns
- **Time Zones:** GitHub Actions runs in UTC, account for this in scheduling
- **Branch Protection:** Ensure bot can commit back updated `last-check.json`

## 🚀 Quick Start Commands

### Initial Setup
```bash
# Create new repository
gh repo create al-cabone-sales-bot --private

# Clone and setup
git clone [repo-url]
cd al-cabone-sales-bot

# Add framework files
# (Copy package.json, bot.js, workflow file from Claude's framework)

# Install dependencies locally
npm install
```

### Testing Commands
```bash
# Test with mock data
node bot.js --test

# Test specific functions
node -e "console.log(require('./bot.js').getHolderTier(25))"

# Manual GitHub Actions trigger
gh workflow run sales-bot.yml
```

### Monitoring Commands
```bash
# View recent GitHub Actions runs
gh run list --workflow=sales-bot.yml

# View specific run logs
gh run view [run-id] --log
```

## 📝 Progress Tracking

### Completion Criteria
Each task in `todo.md` should be marked complete `[x]` when:
- Code is written and tested locally
- Changes are committed to repository
- Functionality works as expected
- Any errors are handled gracefully

### Daily Checkpoints
- **End of Day 1:** APIs connected, repository setup complete
- **End of Day 2:** Core bot logic working locally with test data  
- **End of Day 3:** Bot deployed and running automatically on schedule

### Success Metrics
- ✅ Bot posts automatically without manual intervention
- ✅ Messages are appropriate for different holder tiers
- ✅ Images generate correctly and appear properly on Twitter
- ✅ No crashes or unhandled errors in logs
- ✅ Community can see bot posts and understand the theme

---

*This guide should be referenced throughout development to ensure consistent, reliable implementation of the Al Cabone sales bot PoC.*