// ==========================================
// FILE: bot.js
// ==========================================
require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const { TwitterApi } = require('twitter-api-v2');

// Try to load canvas, fallback for environments where it's not available
let createCanvas, loadImage, registerFont;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
  registerFont = canvas.registerFont;
} catch (error) {
  console.log('Canvas not available - image generation will be skipped');
}

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

// Fetch recent sales from OpenSea with retry logic
async function fetchRecentSales() {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    const response = await axios.get(`https://api.opensea.io/api/v2/events/collection/${COLLECTION_SLUG}`, {
      params: {
        event_type: 'sale',
        limit: 10 // Smaller limit for testing
      },
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    });
    
    // Debug logging removed for production
    
    const events = response.data.asset_events || response.data.events || [];
    // Filter for valid single sales only
    return events.filter(isValidSaleEvent);
  }).catch(error => {
    console.error('Failed to fetch sales after retries:', error.message);
    return [];
  });
}

// Get holder's total NFT count with pagination for accuracy
async function getHolderNFTCount(walletAddress) {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    let totalCount = 0;
    let cursor = null;
    let hasMore = true;
    
    while (hasMore && totalCount < 1000) { // Safety limit
      const params = {
        owner: walletAddress,
        collection: COLLECTION_SLUG,
        limit: 200
      };
      
      if (cursor) params.cursor = cursor;
      
      const response = await axios.get(`https://api.opensea.io/api/v1/assets`, {
        params,
        headers: {
          'X-API-KEY': process.env.OPENSEA_API_KEY
        }
      });
      
      const assets = response.data.assets || [];
      totalCount += assets.length;
      
      // Check if there are more results
      cursor = response.data.next;
      hasMore = !!cursor && assets.length === 200;
      
      if (hasMore) await sleep(OPENSEA_DELAY); // Rate limiting between pagination calls
    }
    
    return Math.max(totalCount, 1); // Minimum 1 for new buyers
  }).catch(error => {
    console.error('Error fetching holder count:', error.message);
    return 1;
  });
}

// Get seller's NFT count (current holdings, not historical)
async function getSellerNFTCount(walletAddress) {
  return await apiCallWithRetry(async () => {
    await sleep(OPENSEA_DELAY);
    
    const response = await axios.get(`https://api.opensea.io/api/v1/assets`, {
      params: {
        owner: walletAddress,
        collection: COLLECTION_SLUG,
        limit: 200 // Most sellers won't have more than 200
      },
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    });
    
    return response.data.assets?.length || 0;
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

// Create FBI investigation-style image for tweet
async function createSaleImage(sale, buyerTier, buyerCount, sellerTier, sellerCount) {
  if (!createCanvas) {
    console.log('⚠️ Image generation skipped - Canvas not available');
    return null;
  }
  
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');
  
  // FBI-style dark background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 800, 600);
  
  // Red "TOP SECRET" stamp background
  ctx.fillStyle = '#8b0000';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.rotate(-0.3);
  ctx.fillText('TOP SECRET', 200, 100);
  ctx.restore();
  
  // FBI Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FEDERAL BUREAU OF INVESTIGATION', 400, 50);
  
  // Case number
  const caseNum = generateCaseNumber();
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(`CASE #${caseNum}`, 400, 80);
  
  // Alert line
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('New connection detected in Al Cabone network', 400, 110);
  
  // Suspect info box
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 140, 700, 100);
  
  // Suspect header
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('SUSPECT:', 70, 160);
  
  // Suspect details
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  const shortBuyer = `${sale.winner_account.address.slice(0, 8)}...${sale.winner_account.address.slice(-4)}`;
  ctx.fillText(`Address: ${shortBuyer}`, 70, 180);
  ctx.fillText(`Rank: ${buyerTier.toUpperCase()} (${buyerCount} NFTs owned)`, 70, 200);
  ctx.fillText(`Status: ACTIVE INVESTIGATION`, 70, 220);
  
  // Acquisition details box
  ctx.strokeRect(50, 260, 700, 120);
  
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('TRANSACTION DETAILS:', 70, 280);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.fillText(`Acquired: "${sale.asset.name}"`, 70, 300);
  
  if (sale.total_price) {
    const ethPrice = (sale.total_price / 1e18).toFixed(3);
    ctx.fillText(`Value: ${ethPrice} ETH`, 70, 320);
  }
  
  // Seller info
  const shortSeller = sale.seller ? `${sale.seller.address?.slice(0, 8)}...${sale.seller.address?.slice(-4)}` : 'Unknown';
  ctx.fillText(`Source: ${sellerTier ? sellerTier.toUpperCase() : 'UNKNOWN'} (${sellerCount || 0} NFTs)`, 70, 340);
  ctx.fillText(`Seller: ${shortSeller}`, 70, 360);
  
  // Evidence stamp
  ctx.fillStyle = '#8b0000';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.rotate(0.2);
  ctx.fillText('EVIDENCE', 600, 400);
  ctx.restore();
  
  // Classification footer
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CLASSIFIED - FOR OFFICIAL USE ONLY', 400, 580);
  
  // Timestamp
  const date = new Date(sale.created_date).toLocaleString();
  ctx.fillStyle = '#888888';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`Logged: ${date}`, 750, 560);
  
  return canvas.toBuffer('image/png');
}

// Create FBI-style floor price alert image
async function createFloorAlertImage(floorNFT, floorPrice, nftImageUrl = null) {
  if (!createCanvas) {
    console.log('⚠️ Floor image generation skipped - Canvas not available');
    return null;
  }
  
  const canvas = createCanvas(800, 700); // Increased height for NFT image
  const ctx = canvas.getContext('2d');
  
  // FBI-style dark background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 800, 700);
  
  // Red stamp background
  ctx.fillStyle = '#8b0000';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.rotate(-0.2);
  ctx.fillText('MOST WANTED', 150, 120);
  ctx.restore();
  
  // FBI Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FEDERAL BUREAU OF INVESTIGATION', 400, 50);
  
  // Case number
  const caseNum = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(`CASE FILE #${caseNum}`, 400, 80);
  
  // Subject line
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Subject: Al Cabone spotted lurking in the marketplace', 400, 110);
  
  // Most wanted box
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 140, 700, 300);
  
  // Status header
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('STATUS:', 70, 170);
  
  // Status details
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Arial';
  ctx.fillText('MOST WANTED ON THE FLOOR', 70, 200);
  
  // NFT details
  ctx.font = 'bold 20px Arial';
  ctx.fillText(`Target: "${floorNFT.name}"`, 70, 240);
  
  // Price
  ctx.fillStyle = '#f4d03f';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`Price: ${floorPrice}`, 70, 280);
  
  // Location
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.fillText('Location: OpenSea Marketplace', 70, 320);
  
  // Token ID
  if (floorNFT.token_id) {
    ctx.fillText(`Token ID: #${floorNFT.token_id}`, 70, 350);
  }
  
  // Investigation note
  ctx.fillStyle = '#888888';
  ctx.font = 'italic 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('"Cheap entry into the family. Question is — who\'ll recruit him?"', 400, 400);
  
  // Load and display NFT image if available
  if (nftImageUrl) {
    try {
      const nftImage = await loadImage(nftImageUrl);
      
      // Draw NFT image in center with border
      const imgSize = 150;
      const imgX = (800 - imgSize) / 2;
      const imgY = 420;
      
      // Image border
      ctx.strokeStyle = '#f4d03f';
      ctx.lineWidth = 3;
      ctx.strokeRect(imgX - 3, imgY - 3, imgSize + 6, imgSize + 6);
      
      // Draw NFT image
      ctx.drawImage(nftImage, imgX, imgY, imgSize, imgSize);
      
      // Evidence label
      ctx.fillStyle = '#f4d03f';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('EVIDENCE PHOTO', 400, 590);
      
    } catch (imageError) {
      console.error('Error loading NFT image into floor card:', imageError.message);
    }
  }
  
  // Warning stamp
  ctx.fillStyle = '#8b0000';
  ctx.font = 'bold 14px Arial';
  ctx.save();
  ctx.rotate(0.15);
  ctx.fillText('APPROACH WITH CAUTION', 550, 350);
  ctx.restore();
  
  // Classification footer
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CLASSIFIED - FOR OFFICIAL USE ONLY', 400, 680);
  
  // Timestamp
  const date = new Date().toLocaleString();
  ctx.fillStyle = '#888888';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`Filed: ${date}`, 750, 660);
  
  return canvas.toBuffer('image/png');
}

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
    
    // Check if we should post daily floor alert
    const shouldAlert = await shouldPostFloorAlert();
    
    if (sales.length === 0 && !shouldAlert) {
      console.log('No new sales found and no floor alert needed');
      await updateLastCheckTime();
      return;
    }
    
    // Post floor alert if needed (when no sales or as daily update)
    if (shouldAlert) {
      console.log('🔍 Posting daily floor price alert...');
      try {
        const floorNFT = await getFloorPriceNFT();
        if (floorNFT) {
          const floorPrice = formatPrice(floorNFT);
          const opensealink = `https://opensea.io/assets/ethereum/${AL_CABONE_CONTRACT}/${floorNFT.token_id}`;
          
          // Get NFT image for embedding in card
          const nftImageUrl = await getNFTImageUrl(AL_CABONE_CONTRACT, floorNFT.token_id);
          
          const floorMessage = `🚨 DAILY SURVEILLANCE REPORT
Case File #${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}

Subject: Al Cabone spotted lurking in the marketplace
Status: MOST WANTED ON THE FLOOR
Price: ${floorPrice}
Location: ${opensealink}

Note: "Cheap entry into the family. Question is — who'll recruit him?"

🔍 #AlCabone #FBI #FloorWatch #Investigation`;

          const floorImage = await createFloorAlertImage(floorNFT, floorPrice, nftImageUrl);
          
          // Upload floor alert card (NFT image is now embedded in the card)
          const cardUpload = await twitterClient.v1.uploadMedia(floorImage, { mimeType: 'image/png' });
          
          await twitterClient.v2.tweet({
            text: floorMessage,
            media: { media_ids: [cardUpload] }
          });
          
          console.log(`✅ Posted floor alert for ${floorNFT.name} at ${floorPrice}`);
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
      
      console.log(`Processing sale: ${sale.nft.name}`);
      
      // Get buyer and seller information  
      const buyerCount = await getHolderNFTCount(sale.buyer);
      const buyerTier = getHolderTier(buyerCount);
      
      // Get seller information if available
      let sellerCount = 0;
      let sellerTier = 'unknown';
      if (sale.seller) {
        sellerCount = await getSellerNFTCount(sale.seller);
        sellerTier = getHolderTier(sellerCount);
      }
      
      // Generate FBI-style message
      const caseNum = Math.floor(Math.random() * 99999) + 10000;
      const shortBuyer = `${sale.buyer.slice(0, 6)}...${sale.buyer.slice(-4)}`;
      
      const message = `🚨 FBI ALERT: CASE #AC-${caseNum}
New connection detected in Al Cabone network

Suspect: ${shortBuyer} (${buyerTier.toUpperCase()} - ${buyerCount} NFTs)
Acquired: "${sale.nft.name}" from ${sellerTier.toUpperCase()} (${sellerCount} NFTs)
Status: ACTIVE INVESTIGATION

💰 Value: ${formatPrice(sale)}
🔍 #AlCabone #FBI #Investigation`;
      
      // Get NFT image URL
      const nftImageUrl = await getNFTImageUrl(AL_CABONE_CONTRACT, sale.nft.identifier);
      
      // Create FBI-style investigation card
      const investigationCardBuffer = await createSaleImage(sale, buyerTier, buyerCount, sellerTier, sellerCount);
      
      // Post to Twitter with both images
      try {
        const mediaIds = [];
        
        // Upload investigation card
        const cardUpload = await twitterClient.v1.uploadMedia(investigationCardBuffer, { mimeType: 'image/png' });
        mediaIds.push(cardUpload);
        
        // Upload NFT image if available
        if (nftImageUrl) {
          try {
            const nftImageResponse = await axios.get(nftImageUrl, { responseType: 'arraybuffer' });
            const nftImageBuffer = Buffer.from(nftImageResponse.data);
            const nftUpload = await twitterClient.v1.uploadMedia(nftImageBuffer, { mimeType: 'image/png' });
            mediaIds.push(nftUpload);
            console.log(`📸 Added NFT image from: ${nftImageUrl}`);
          } catch (imageError) {
            console.error('Error fetching NFT image:', imageError.message);
          }
        }
        
        await twitterClient.v2.tweet({
          text: message,
          media: { media_ids: mediaIds }
        });
        
        console.log(`✅ Posted tweet for ${sale.asset.name}`);
        
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
    
    // Test image generation (if canvas available)
    try {
      const canvas = require('canvas');
      console.log('3. Testing image generation...');
      console.log('✅ Canvas available - Image generation will work');
    } catch (error) {
      console.log('⚠️ Canvas not available - Image generation will be skipped in this environment');
      console.log('   (This is normal on Windows - will work in GitHub Actions)');
    }
    
    console.log('\n🧪 Test completed!');
  }
  
  runTests();
} else {
  runBot();
}