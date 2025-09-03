# Al Cabone Sales Bot - Implementation Todo List

## 📋 Phase 1: Setup & Prerequisites

### API Accounts & Keys
- [x] Create Twitter Developer Account
  - [x] Apply at https://developer.twitter.com
  - [x] Create new app for Al Cabone Bot
  - [x] Generate API Key & Secret
  - [x] Generate Access Token & Secret
  - [x] Test API access with simple tweet

- [x] Get OpenSea API Key
  - [x] Request free API key at https://docs.opensea.io/reference/api-keys
  - [x] Test API access with collection query

### Repository Setup
- [x] Create new GitHub repository: `al-cabone-sales-bot`
- [x] Add all bot files from Claude's framework:
  - [x] `package.json`
  - [x] `bot.js` 
  - [x] `.github/workflows/sales-bot.yml`
  - [x] `last-check.json`
  - [x] `README.md`

### GitHub Secrets Configuration
- [x] Add GitHub repository secrets:
  - [x] `TWITTER_API_KEY`
  - [x] `TWITTER_API_SECRET`
  - [x] `TWITTER_ACCESS_TOKEN`
  - [x] `TWITTER_ACCESS_SECRET`
  - [x] `OPENSEA_API_KEY`

## 📋 Phase 2: Configuration & Customization

### Collection Data
- [x] Find Al Cabone contract address
- [x] Find Al Cabone OpenSea collection slug
- [x] Update configuration in `bot.js`:
  - [x] `AL_CABONE_CONTRACT` variable
  - [x] `COLLECTION_SLUG` variable

### Message Templates
- [ ] Review and customize `messageTemplates` object
- [ ] Add more gangster lore-specific phrases
- [ ] Test different message variations
- [ ] Adjust tier thresholds in `getHolderTier()` function

### Visual Styling
- [x] Customize `createSaleImage()` function
- [x] Add FBI investigation theme styling
- [x] Test different image layouts
- [x] Optimize image dimensions for Twitter

## 📋 Phase 3: Enhanced Features (Buyer/Seller Storytelling)

### Seller Tracking Implementation
- [x] Add `getSellerNFTCount()` function
- [x] Implement seller address extraction from OpenSea events
- [x] Add seller information to sale processing logic

### Dynamic Storytelling
- [x] Add `dynamicTemplates` object with buyer/seller scenarios
- [x] Implement `getTransactionStory()` function
- [x] Add `getTierRank()` helper function
- [x] Update message generation to use FBI investigation template

### Enhanced Image Generation
- [x] Add seller information to generated images
- [x] Create FBI investigation case file layout
- [x] Add classified document styling and evidence stamps
- [x] Test image readability with additional information

## 📋 Phase 4: FBI Investigation Theme Integration

### Evidence Card Style
- [ ] Create alternative image template using FBI aesthetic
- [ ] Design "FEDERAL BUREAU OF INVESTIGATION" header
- [ ] Add case file styling and evidence stamps
- [ ] Create suspect profile card layout

### Investigation Messaging
- [ ] Add FBI-themed message templates:
  - [ ] "INVESTIGATION UPDATE" alerts
  - [ ] "SUSPECT PROFILE" descriptions  
  - [ ] "CONNECTION DETECTED" notifications
- [ ] Create case number generation system
- [ ] Add investigation status indicators

## 📋 Phase 5: Testing & Deployment

### Local Testing
- [ ] Install dependencies: `npm install`
- [ ] Create test mode functionality
- [ ] Test with mock sale data
- [ ] Verify image generation works locally
- [ ] Test Twitter API posting (use test account)

### API Integration Testing
- [ ] Test OpenSea API calls with actual collection
- [ ] Verify holder count fetching works
- [ ] Test rate limiting and error handling
- [ ] Validate recent sales detection

### GitHub Actions Testing  
- [ ] Test manual workflow trigger
- [ ] Verify GitHub Actions environment setup
- [ ] Test automated commit of `last-check.json`
- [ ] Monitor first automated runs (every 30 minutes)

## 📋 Phase 6: Monitoring & Optimization

### Performance Monitoring
- [ ] Monitor GitHub Actions execution logs
- [ ] Track Twitter API rate limits
- [ ] Monitor OpenSea API usage
- [ ] Set up error alerting/notifications

### Content Optimization
- [ ] Track tweet engagement metrics
- [ ] A/B test different message styles
- [ ] Optimize image content for engagement
- [ ] Adjust posting frequency if needed

### Feature Enhancements
- [ ] Add webhook integration for real-time posting (future)
- [ ] Create manual override/control panel (future)
- [ ] Add analytics dashboard (future)
- [ ] Integrate with Discord notifications (future)

## 📋 Phase 7: Marketing & Community

### Launch Strategy
- [ ] Announce bot to Al Cabone community
- [ ] Create launch tweet thread explaining features
- [ ] Share bot account handle with holders
- [ ] Get community feedback on messaging

### Community Integration
- [ ] Monitor community response to bot posts
- [ ] Adjust messaging based on feedback
- [ ] Consider adding community-requested features
- [ ] Create engagement campaigns around bot posts

## 🚨 Critical Requirements Checklist

### Must-Have Before Launch
- [ ] All API keys working and tested
- [ ] Contract address and collection slug verified
- [ ] GitHub Actions successfully running
- [ ] Image generation working without errors
- [ ] Twitter posting functional
- [ ] Error handling for API failures
- [ ] Rate limiting properly implemented

### Security Considerations
- [ ] API keys stored securely in GitHub Secrets
- [ ] No sensitive data in repository code
- [ ] Proper error handling to avoid exposing credentials
- [ ] Rate limiting to avoid API bans

## 📅 Estimated Timeline

- **Phase 1-2:** 1-2 days (setup and basic config)
- **Phase 3:** 1 day (buyer/seller features)
- **Phase 4:** 1-2 days (FBI theme integration)  
- **Phase 5:** 1 day (testing and deployment)
- **Phase 6-7:** Ongoing (monitoring and optimization)

**Total Estimated Time:** 5-7 days for full implementation

---

## 🔧 Technical Notes

### Dependencies Required
```json
{
  "axios": "^1.6.0",
  "canvas": "^2.11.2", 
  "twitter-api-v2": "^1.15.0"
}
```

### Environment Variables Needed
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`
- `OPENSEA_API_KEY`

### Key Files to Customize
- `bot.js` - Main logic and messaging
- `sales-bot.yml` - GitHub Actions schedule
- Message templates and tier definitions
- Image generation styling

---

*✅ Check off items as completed. This bot will create unique, lore-driven content that stands out from typical NFT sales bots!*