// ==========================================
// FILE: bot.js
// ==========================================
require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const { TwitterApi } = require('twitter-api-v2');

// No Canvas needed - using simple text + image format

// Configuration
const AL_CABONE_CONTRACT = '0x8Ca5209d8CCe34b0de91C2C4b4B14F20AFf8BA23';
const COLLECTION_SLUG = 'thealcabones';

// Rate limiting delays (in milliseconds)
const OPENSEA_DELAY = 250; // 4 requests per second max
const TWITTER_DELAY = 5000; // 5 seconds between posts
const RETRY_DELAY = 2000; // 2 seconds between retries

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Utility function for API calls with retries
async function apiCallWithRetry(apiCall, maxRetries = 3, delay = RETRY_DELAY) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      console.error(`API call attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced price formatting with proper token handling
function formatPrice(sale) {
  // Handle OpenSea API v2 format
  const payment = sale.payment;
  if (!payment || !payment.quantity || payment.quantity === '0') {
    return 'Price undisclosed';
  }
  
  const decimals = payment.decimals || 18;
  const symbol = payment.symbol || 'ETH';
  const price = (payment.quantity / Math.pow(10, decimals)).toFixed(decimals === 18 ? 3 : 2);
  
  return `${price} ${symbol}`;
}

// Filter valid sales (exclude bundles, accept offers, handle sweeps)
function isValidSaleEvent(sale) {
  // Must be a sale event
  if (sale.event_type !== 'sale') return false;
  
  // Must have NFT and buyer information
  if (!sale.nft || !sale.buyer) return false;
  
  // Skip bundle sales (multiple assets)
  if (sale.quantity && parseInt(sale.quantity) > 1) return false;
  
  // Must have payment information for meaningful posts
  if (!sale.payment || !sale.payment.quantity) return false;
  
  return true;
}

// Message templates based on holder tier
const messageTemplates = {
  associate: [
    "🎩 Word spreads through the shadows... A new face joins the Al Cabone family",
    "🔫 The streets whisper of fresh blood entering our ranks",
    "📰 FAMILY BULLETIN: New Associate welcomed into the fold"
  ],
  
  soldier: [
    "⚡ The family grows stronger. A Soldier expands their territory",
    "🏛️ Respect earned on the streets. Another piece claimed",
    "💀 The empire expands as loyalty is rewarded"
  ],
  
  caporegime: [
    "👔 The Commission takes notice. A Caporegime builds their crew",
    "🗡️ Power consolidates. Another lieutenant strengthens their hold",
    "⚖️ Justice is served. Territory secured by a rising Capo"
  ],
  
  consigliere: [
    "🎭 Wisdom guides the family. The Consigliere's counsel grows",
    "📜 Ancient knowledge preserved. Another advisor ascends",
    "🕴️ The inner circle expands. Trust has been earned"
  ],
  
  underboss: [
    "👑 The hierarchy shifts. An Underboss extends their reach",
    "🏰 Loyalty rewarded at the highest levels of power",
    "⚔️ The old guard strengthens. Empire secured"
  ],
  
  godfather: [
    "🏛️ The Don expands the empire. Legendary power grows",
    "👑 BREAKING: Godfather secures another piece of the kingdom",
    "💎 Ultimate authority. The Commission's vault expands"
  ],
  
  commission: [
    "🔥 UNPRECEDENTED: The Commission itself grows stronger",
    "👑 THE ULTIMATE POWER MOVE: Commission adds to their legendary collection",
    "🏛️ HISTORY MADE: The ruling class expands their dominion"
  ]
};

const dynamicTemplates = {
  // When big seller → small buyer
  empire_falls: [
    "🚨 EMPIRE CRUMBLES: {sellerTier} liquidates assets, {buyerTier} claims the spoils",
    "📉 POWER VACUUM: {sellerTier}'s territory seized by rising {buyerTier}",
    "⚡ CHANGING GUARD: Old money exits, new blood enters"
  ],
  
  // When small seller → big buyer  
  consolidation: [
    "🏛️ ACQUISITION: {buyerTier} absorbs {sellerTier}'s operation",
    "💰 BUYOUT: {buyerTier} expands empire, {sellerTier} cashes out",
    "📈 MONOPOLY MOVE: {buyerTier} strengthens their stranglehold"
  ],
  
  // Similar tiers
  business_as_usual: [
    "🤝 FAMILY BUSINESS: {buyerTier} and {sellerTier} conduct trade",
    "⚖️ EQUAL EXCHANGE: Honor among {buyerTier}s",
    "🎭 THE GAME CONTINUES: Territory shifts between equals"
  ]
};


// Determine holder tier based on NFT count
function getHolderTier(nftCount) {
  if (nftCount >= 100) return 'commission';
  if (nftCount >= 25) return 'godfather';
  if (nftCount >= 20) return 'underboss';
  if (nftCount >= 15) return 'consigliere';
  if (nftCount >= 10) return 'caporegime';
  if (nftCount >= 5) return 'soldier';
  return 'associate';
}

// Get tier badge emoji
function getTierBadge(tier) {
  const badges = {
    commission: '👑',
    godfather: '🏛️',
    underboss: '⚔️',
    consigliere: '🎭',
    caporegime: '👔',
    soldier: '⚡',
    associate: '🎩'
  };
  return badges[tier] || '🎩';
}

// Fetch recent sales from OpenSea with timestamp filtering
async function fetchRecentSales() {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    // Get last check time to filter new sales
    const lastCheck = await getLastCheckTime();
    const lastCheckTimestamp = Math.floor(new Date(lastCheck).getTime() / 1000);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/events/collection/${COLLECTION_SLUG}`, {
      params: {
        event_type: 'sale',
        occurred_after: lastCheckTimestamp,
        limit: 20
      },
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    });
    
    const events = response.data.asset_events || response.data.events || [];
    console.log(`Found ${events.length} sales since last check (${new Date(lastCheck).toISOString()})`);
    
    // Filter for valid single sales only
    return events.filter(isValidSaleEvent);
  }).catch(error => {
    console.error('Failed to fetch sales after retries:', error.message);
    return [];
  });
}

// Get holder's total NFT count using OpenSea API v2
async function getHolderNFTCount(walletAddress) {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts`, {
      params: {
        collection: COLLECTION_SLUG,
        limit: 200
      },
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    });
    
    const nfts = response.data.nfts || [];
    return Math.max(nfts.length, 1); // Minimum 1 for new buyers
  }).catch(error => {
    console.error('Error fetching holder count:', error.message);
    return 1;
  });
}

// Get seller's NFT count using OpenSea API v2
async function getSellerNFTCount(walletAddress) {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts`, {
      params: {
        collection: COLLECTION_SLUG,
        limit: 200
      },
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    });
    
    const nfts = response.data.nfts || [];
    return nfts.length;
  }).catch(error => {
    console.error('Error fetching seller count:', error.message);
    return 0;
  });
}

function getTierRank(tier) {
  const ranks = {
    associate: 1,
    soldier: 2,
    caporegime: 3,
    consigliere: 4,
    underboss: 5,
    godfather: 6,
    commission: 7
  };
  return ranks[tier] || 1;
}

function getTransactionStory(buyerTier, sellerTier, buyerCount, sellerCount) {
  const buyerRank = getTierRank(buyerTier);
  const sellerRank = getTierRank(sellerTier);
  
  if (sellerRank > buyerRank + 1) return 'empire_falls';
  if (buyerRank > sellerRank + 1) return 'consolidation';
  return 'business_as_usual';
}

/*Example tweet
FBI ALERT: CASE #AC-72317
New connection detected in Al Cabone network
Suspect: 0x7a9b... (UNDERBOSS - 23 NFTs)
Acquired: "Skeleton #4521" from CAPO (12 NFTs)
Status: ACTIVE INVESTIGATION

<Image of the NFT sold>

*/
// Generate case number
function generateCaseNumber() {
  const prefix = 'AC';
  const number = Math.floor(Math.random() * 99999) + 10000;
  return `${prefix}-${number}`;
}

// Get NFT image URL from OpenSea API v2 with retry logic
async function getNFTImageUrl(contractAddress, tokenId) {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`, {
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    });
    
    return response.data.nft?.image_url || response.data.nft?.metadata?.image;
  }).catch(error => {
    console.error('Error fetching NFT image:', error.message);
    return null;
  });
}

// Get floor price NFT from OpenSea v2
async function getFloorPriceNFT() {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/listings/collection/${COLLECTION_SLUG}/all`, {
      params: {
        order_direction: 'asc',
        order_by: 'eth_price',
        limit: 1
      },
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    });
    
    const listings = response.data.listings || [];
    if (listings.length > 0) {
      const listing = listings[0];
      // Convert listing format to match what we expect
      return {
        name: listing.protocol_data?.parameters?.offer?.[0]?.token || `Al Cabone NFT`,
        identifier: listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria,
        token_id: listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria,
        payment: {
          quantity: listing.price?.current?.value,
          decimals: listing.price?.current?.decimals || 18,
          symbol: listing.price?.current?.currency || 'ETH'
        }
      };
    }
    return null;
  }).catch(error => {
    console.error('Error fetching floor price:', error.message);
    return null;
  });
}

// Check if we should post daily floor alert
async function shouldPostFloorAlert() {
  try {
    const data = await fs.readFile('last-check.json', 'utf8');
    const { lastFloorAlert } = JSON.parse(data);
    
    if (!lastFloorAlert) return true;
    
    const lastAlert = new Date(lastFloorAlert);
    const now = new Date();
    const hoursSinceLastAlert = (now - lastAlert) / (1000 * 60 * 60);
    
    // Post floor alert if it's been more than 20 hours
    return hoursSinceLastAlert >= 20;
  } catch (error) {
    return true; // If no record, post alert
  }
}

// Update last floor alert timestamp
async function updateLastFloorAlert() {
  try {
    let data = {};
    try {
      const fileData = await fs.readFile('last-check.json', 'utf8');
      data = JSON.parse(fileData);
    } catch (e) {
      // File doesn't exist, start fresh
    }
    
    data.lastFloorAlert = new Date().toISOString();
    await fs.writeFile('last-check.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error updating floor alert time:', error.message);
  }
}

// Simple function to get OpenSea link for NFT
function getNFTOpenSeaLink(contractAddress, tokenId) {
  return `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
}

// No floor alert image needed - using simple text format

// Get last check timestamp
async function getLastCheckTime() {
  try {
    const data = await fs.readFile('last-check.json', 'utf8');
    const { lastCheck } = JSON.parse(data);
    return lastCheck;
  } catch (error) {
    // If file doesn't exist, return timestamp from 1 hour ago
    return new Date(Date.now() - 60 * 60 * 1000).toISOString();
  }
}

// Update last check timestamp
async function updateLastCheckTime() {
  const data = {
    lastCheck: new Date().toISOString()
  };
  await fs.writeFile('last-check.json', JSON.stringify(data, null, 2));
}

// Main bot function
async function runBot() {
  console.log('🤖 Al Cabone Sales Bot starting...');
  
  try {
    const sales = await fetchRecentSales();
    console.log(`Found ${sales.length} valid sales to process`);
    
    // Only post floor alert if no recent sales (avoid spamming)
    const shouldAlert = await shouldPostFloorAlert();
    
    if (sales.length === 0 && !shouldAlert) {
      console.log('No new sales found and no floor alert needed');
      await updateLastCheckTime();
      return;
    }
    
    // Post floor alert only if no sales to process (prevent hitting rate limits)
    if (shouldAlert && sales.length === 0) {
      console.log('🔍 Posting daily floor price alert...');
      try {
        const floorNFT = await getFloorPriceNFT();
        if (floorNFT) {
          const floorPrice = formatPrice(floorNFT);
          const opensealink = `https://opensea.io/assets/ethereum/${AL_CABONE_CONTRACT}/${floorNFT.token_id}`;
          
          // Use floor NFT image if available (no additional API call needed)
          const nftImageUrl = null; // Skip images for floor alerts to avoid 403 errors
          
          const floorMessage = `🚨 DAILY SURVEILLANCE REPORT
Case File #${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}

Subject: Al Cabone spotted lurking in the marketplace
Status: MOST WANTED ON THE FLOOR
Price: ${floorPrice}
Location: ${opensealink}

Note: "Cheap entry into the family. Question is — who'll recruit him?"

🔍 #AlCabone #FBI #FloorWatch #Investigation`;

          // Simple tweet with NFT image if available
          const mediaIds = [];
          
          if (nftImageUrl) {
            try {
              const nftImageResponse = await axios.get(nftImageUrl, { responseType: 'arraybuffer' });
              const nftImageBuffer = Buffer.from(nftImageResponse.data);
              const nftUpload = await twitterClient.v1.uploadMedia(nftImageBuffer, { mimeType: 'image/png' });
              mediaIds.push(nftUpload);
            } catch (imageError) {
              console.error('Error fetching floor NFT image:', imageError.message);
            }
          }
          
          try {
            await twitterClient.v2.tweet({
              text: floorMessage,
              media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined
            });
            console.log(`✅ Posted floor alert for ${floorNFT.name} at ${floorPrice}`);
          } catch (tweetError) {
            console.error('Floor alert tweet error:', tweetError.message);
            // Try without media
            if (mediaIds.length > 0) {
              try {
                await twitterClient.v2.tweet({ text: floorMessage });
                console.log(`✅ Posted floor alert (no image) for ${floorNFT.name}`);
              } catch (fallbackError) {
                console.error('Floor alert fallback failed:', fallbackError.message);
              }
            }
          }
          await updateLastFloorAlert();
          await sleep(TWITTER_DELAY);
        }
      } catch (floorError) {
        console.error('Error posting floor alert:', floorError.message);
      }
    }
    
    if (sales.length === 0) {
      console.log('No new sales to process after floor alert');
      await updateLastCheckTime();
      return;
    }
    
    // Process up to 3 sales per run to avoid overwhelming Twitter
    const salesToProcess = sales.slice(0, 3);
    console.log(`Processing ${salesToProcess.length} sales...`);
    
    for (const sale of salesToProcess) {
      
      console.log(`Processing sale: ${sale.nft?.name || sale.asset?.name || 'Unknown NFT'}`);
      
      // Get buyer and seller addresses (they are direct strings in OpenSea API v2)
      let buyerAddress = sale.buyer;
      let sellerAddress = sale.seller;
      
      if (!buyerAddress) {
        console.error('No buyer address found in sale data');
        continue;
      }
      
      console.log(`🔍 Buyer: ${buyerAddress}, Seller: ${sellerAddress || 'Unknown'}`);
      
      const buyerCount = await getHolderNFTCount(buyerAddress);
      const buyerTier = getHolderTier(buyerCount);
      
      // Get seller information if available
      let sellerCount = 0;
      let sellerTier = 'unknown';
      if (sellerAddress) {
        sellerCount = await getSellerNFTCount(sellerAddress);
        sellerTier = getHolderTier(sellerCount);
      }
      
      // Generate FBI-style message
      const caseNum = Math.floor(Math.random() * 99999) + 10000;
      const shortBuyer = `${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`;
      
      const nftName = sale.nft?.name || sale.asset?.name || 'Unknown NFT';
      const message = `🎭 CASE #AC-${caseNum}
New connection detected in Al Cabone network

Suspect: ${shortBuyer} (${buyerTier.toUpperCase()} - ${buyerCount} NFTs)
Acquired: "${nftName}" from ${sellerTier.toUpperCase()} (${sellerCount} NFTs)
Status: FAMILY BUSINESS

💰 Value: ${formatPrice(sale)}
🔍 #AlCabone #Gangster #NFT`;
      
      // Get NFT image URL and use OpenSea URL from API response
      const tokenId = sale.nft.identifier;
      const nftImageUrl = sale.nft.image_url;
      const openseaLink = sale.nft.opensea_url || getNFTOpenSeaLink(AL_CABONE_CONTRACT, tokenId);
      
      // Add OpenSea link to message
      const messageWithLink = `${message}

🔗 View on OpenSea: ${openseaLink}`;
      
      // Post to Twitter with just NFT image
      try {
        const mediaIds = [];
        
        // Upload NFT image if available
        if (nftImageUrl) {
          try {
            console.log(`Attempting to fetch image: ${nftImageUrl}`);
            const nftImageResponse = await axios.get(nftImageUrl, { 
              responseType: 'arraybuffer',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
              },
              timeout: 10000
            });
            const nftImageBuffer = Buffer.from(nftImageResponse.data);
            const nftUpload = await twitterClient.v1.uploadMedia(nftImageBuffer, { mimeType: 'image/png' });
            mediaIds.push(nftUpload);
            console.log(`📸 Added NFT image from: ${nftImageUrl}`);
          } catch (imageError) {
            console.error('Error fetching NFT image:', imageError.message);
            console.error('Image URL that failed:', nftImageUrl);
            console.log('Continuing without image...');
          }
        } else {
          console.log('No NFT image URL available');
        }
        
        // Try posting tweet (with graceful fallback)
        try {
          await twitterClient.v2.tweet({
            text: messageWithLink,
            media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined
          });
          console.log(`✅ Posted tweet for ${nftName}`);
        } catch (tweetError) {
          console.error('Twitter posting error:', tweetError.message);
          console.error('Tweet content length:', messageWithLink.length);
          console.error('Tweet content preview:', messageWithLink.substring(0, 100) + '...');
          if (tweetError.data) {
            console.error('Twitter API error details:', JSON.stringify(tweetError.data, null, 2));
          }
          
          // Try posting without media as fallback
          if (mediaIds.length > 0) {
            console.log('Retrying without image...');
            try {
              await twitterClient.v2.tweet({ text: messageWithLink });
              console.log(`✅ Posted tweet (no image) for ${nftName}`);
            } catch (fallbackError) {
              console.error('Fallback tweet also failed:', fallbackError.message);
              if (fallbackError.data) {
                console.error('Fallback error details:', JSON.stringify(fallbackError.data, null, 2));
              }
            }
          }
        }
        
        // Wait between posts to avoid rate limiting
        await sleep(TWITTER_DELAY);
        
      } catch (twitterError) {
        console.error('Twitter error:', twitterError.message);
      }
    }
    
    await updateLastCheckTime();
    console.log('✅ Bot run completed');
    
  } catch (error) {
    console.error('Bot error:', error.message);
  }
}

// Test mode
if (process.argv.includes('--test')) {
  console.log('🧪 Running in test mode...');
  
  async function runTests() {
    console.log('Testing API connections...');
    
    // Test OpenSea API
    try {
      console.log('1. Testing OpenSea API...');
      const sales = await fetchRecentSales();
      console.log(`✅ OpenSea API working - Found ${sales.length} recent sales`);
      
      // Test floor price
      const floorNFT = await getFloorPriceNFT();
      if (floorNFT) {
        console.log(`✅ Floor price API working - Floor: ${formatPrice(floorNFT)}`);
      }
      
    } catch (error) {
      console.error('❌ OpenSea API error:', error.message);
    }
    
    // Test Twitter API (without posting)
    try {
      console.log('2. Testing Twitter API...');
      const me = await twitterClient.v2.me();
      console.log(`✅ Twitter API working - Authenticated as: @${me.data.username}`);
    } catch (error) {
      console.error('❌ Twitter API error:', error.message);
    }
    
    // Test NFT image fetching
    try {
      console.log('3. Testing NFT image fetching...');
      const testImageUrl = await getNFTImageUrl(AL_CABONE_CONTRACT, '1');
      if (testImageUrl) {
        console.log('✅ NFT image fetching works');
      } else {
        console.log('⚠️ NFT image fetching returned null - check API');
      }
    } catch (error) {
      console.error('❌ NFT image fetching error:', error.message);
    }
    
    console.log('\n🧪 Test completed!');
  }
  
  runTests();
} else {
  runBot();
}