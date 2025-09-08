# Al Cabone Sales Bot

Automated Twitter bot that posts when Al Cabone NFTs are sold, with gangster-themed messaging based on holder tier.

## Setup Instructions

### 1. Get API Keys

**Twitter Developer Account:**
1. Go to https://developer.twitter.com
2. Apply for developer account
3. Create new app
4. Get: API Key, API Secret, Access Token, Access Token Secret

**OpenSea API:**
1. Go to https://docs.opensea.io/reference/api-keys
2. Request free API key

### 2. Configure GitHub Secrets

In your GitHub repo, go to Settings > Secrets and variables > Actions

Add these secrets:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET` 
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`
- `OPENSEA_API_KEY`

### 3. Update Configuration

In `bot.js`, update:
- `AL_CABONE_CONTRACT` - The actual contract address
- `COLLECTION_SLUG` - The OpenSea collection slug

### 4. Test Locally

```bash
npm install
npm run test
```

### 5. Deploy

Push to GitHub - the bot will run automatically every 30 minutes!

## Customization

- Edit `messageTemplates` in `bot.js` for different messages
- Modify `createSaleImage()` for different image styles
- Adjust tier thresholds in `getHolderTier()`

## Manual Trigger

Go to Actions tab in GitHub > Al Cabone Sales Bot > Run workflow