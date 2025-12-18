"use server"

import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractCurrency, extractDescription, extractPrice } from '../utils';

// Get proxy configuration helper
function getProxyConfig() {
  const username="brd-customer-hl_012ffed1-zone-residential_proxy1";
  const password = "aan9g9zx41t0";
  const port = 22225;
  const session_id = (1000000 * Math.random()) | 0;

  return {
    auth: {
      username: `${username}-session-${session_id}`,
      password,
    },
    host: 'brd.superproxy.io',
    port,
    rejectUnauthorized: false,
  };
}

// Extract ASIN from URL (with safety limits)
function extractASIN(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  
  // Limit URL length to prevent regex issues
  const safeUrl = url.length > 500 ? url.substring(0, 500) : url;
  
  try {
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/,
      /\/gp\/product\/([A-Z0-9]{10})/,
      /\/product\/([A-Z0-9]{10})/,
      /ASIN[\/=]([A-Z0-9]{10})/i
    ];
    
    for (const pattern of patterns) {
      try {
        const match = safeUrl.match(pattern);
        if (match && match[1] && match[1].length === 10) {
          // Validate ASIN format (10 alphanumeric characters)
          if (/^[A-Z0-9]{10}$/.test(match[1])) {
            return match[1];
          }
        }
      } catch (patternError) {
        // Continue to next pattern
        continue;
      }
    }
  } catch (error) {
    console.log('[extractASIN] Error:', error);
  }
  return null;
}

// Normalize product URL using ASIN (with recursion protection)
const normalizationCache = new Map<string, string>();
const MAX_URL_LENGTH = 2000;
const MAX_CACHE_SIZE = 10000; // Limit cache size to prevent memory issues

function normalizeProductUrl(url: string): string {
  // Safety checks
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  // Limit URL length to prevent stack overflow
  if (url.length > MAX_URL_LENGTH) {
    url = url.substring(0, MAX_URL_LENGTH);
  }
  
  // Check cache to prevent re-processing
  if (normalizationCache.has(url)) {
    return normalizationCache.get(url)!;
  }
  
  // Limit cache size - remove oldest entries if cache is too large
  if (normalizationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = normalizationCache.keys().next().value;
    if (firstKey) {
      normalizationCache.delete(firstKey);
    }
  }

  try {
    // Quick check for already normalized URLs
    if (url.startsWith('https://www.amazon.com/dp/') && url.length < 60) {
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      if (asinMatch && asinMatch[1]) {
        const normalized = `https://www.amazon.com/dp/${asinMatch[1]}`;
        normalizationCache.set(url, normalized);
        return normalized;
      }
    }
    
    // Extract ASIN
    const asin = extractASIN(url);
    if (asin && asin.length === 10) {
      const normalized = `https://www.amazon.com/dp/${asin}`;
      normalizationCache.set(url, normalized);
      return normalized;
    }
    
    // Fallback: clean URL safely using substring instead of split
    let cleanUrl = url;
    
    // Use indexOf instead of split to avoid potential issues
    const queryIndex = cleanUrl.indexOf('?');
    if (queryIndex !== -1) {
      cleanUrl = cleanUrl.substring(0, queryIndex);
    }
    
    const refIndex = cleanUrl.indexOf('/ref');
    if (refIndex !== -1) {
      cleanUrl = cleanUrl.substring(0, refIndex);
    }
    
    // Limit length again after cleaning
    if (cleanUrl.length > MAX_URL_LENGTH) {
      cleanUrl = cleanUrl.substring(0, MAX_URL_LENGTH);
    }
    
    // Ensure we don't double-prefix
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      normalizationCache.set(url, cleanUrl);
      return cleanUrl;
    }
    
    // Only add prefix if it doesn't already have one
    if (!cleanUrl.startsWith('http')) {
      const normalized = cleanUrl.startsWith('/') 
        ? `https://www.amazon.com${cleanUrl}`
        : `https://www.amazon.com/${cleanUrl}`;
      normalizationCache.set(url, normalized);
      return normalized;
    }
    
    normalizationCache.set(url, cleanUrl);
    return cleanUrl;
  } catch (error) {
    console.log('[normalizeProductUrl] Error:', error);
    // Return a safe fallback
    const fallback = url.length > 100 ? url.substring(0, 100) : url;
    normalizationCache.set(url, fallback);
    return fallback;
  }
}

// Search Amazon and get product URLs from search results
export async function searchAmazonProducts(searchQuery: string, maxProducts: number = 20) {
  if(!searchQuery) return [];

  try {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}&page=1`;
    const options = getProxyConfig();

    console.log(`[Search] Searching Amazon for: ${searchQuery}`);
    const response = await axios.get(searchUrl, {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000
    });
    
    const $ = cheerio.load(response.data);
    const productUrls: string[] = [];
    const seenASINs = new Set<string>();
    
    // Find all product links in search results
    $('[data-component-type="s-search-result"]').each((_index: number, element: cheerio.Element) => {
      if (productUrls.length >= maxProducts) return false;
      
      const link = $(element).find('h2 a').attr('href');
      if (link) {
        const fullUrl = link.startsWith('http') ? link : `https://www.amazon.com${link}`;
        const normalizedUrl = normalizeProductUrl(fullUrl);
        const asin = extractASIN(normalizedUrl);
        
        if (asin && !seenASINs.has(asin)) {
          seenASINs.add(asin);
          productUrls.push(normalizedUrl);
        } else if (!asin && !productUrls.includes(normalizedUrl)) {
          productUrls.push(normalizedUrl);
        }
      }
    });

    console.log(`[Search] Found ${productUrls.length} product URLs`);
    return productUrls;
  } catch (error: any) {
    console.log('Error searching Amazon:', error.message);
    return [];
  }
}

// Discover products from Amazon bestsellers, new releases, etc.
// Uses pagination and random pages to find NEW products
// Optimized for finding millions of products
export async function discoverAmazonProducts(maxProducts: number = 500) {
  const productUrls: string[] = [];
  const seenASINs = new Set<string>();
  
  // Expanded category list for more product discovery
  const categories = [
    'bestsellers-electronics',
    'bestsellers-computers',
    'bestsellers-home-garden',
    'bestsellers-books',
    'bestsellers-clothing',
    'bestsellers-sports',
    'bestsellers-beauty',
    'bestsellers-home-improvement',
    'bestsellers-kitchen',
    'bestsellers-toys-games',
    'bestsellers-automotive',
    'bestsellers-pet-supplies',
    'bestsellers-health-personal-care',
    'bestsellers-baby-products',
    'bestsellers-office-products',
    'bestsellers-cell-phones-accessories',
    'bestsellers-musical-instruments',
    'bestsellers-industrial-scientific',
    'bestsellers-grocery-gourmet-food',
    'bestsellers-appliances'
  ];

  try {
    const options = getProxyConfig();

    // Get products from multiple category pages with pagination (parallel processing)
    const categoryPromises = categories.map(async (category) => {
      if (productUrls.length >= maxProducts) return [];
      
      const categoryUrls: string[] = [];
      // Fetch multiple pages per category (1-10) for more products
      const pagesToFetch = Math.min(10, Math.ceil((maxProducts - productUrls.length) / categories.length / 50));
      
      for (let page = 1; page <= pagesToFetch; page++) {
        if (productUrls.length + categoryUrls.length >= maxProducts) break;
        
        try {
          const categoryUrl = `https://www.amazon.com/gp/bestsellers/${category}/ref=zg_bs_pg_${page}?ie=UTF8&pg=${page}`;
          
          const response = await axios.get(categoryUrl, {
            ...options,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 30000
          });
          
          const $ = cheerio.load(response.data);

          // Find product links in bestsellers
          $('[data-component-type="s-search-result"], .zg-item-immersion, .p13n-sc-uncoverable-faceout, .p13n-sc-truncated').each((_index: number, element: cheerio.Element) => {
            if (categoryUrls.length >= 100) return false; // Limit per category

            const link = $(element).find('a[href*="/dp/"], a[href*="/gp/product/"]').first().attr('href');
            if (link) {
              const fullUrl = link.startsWith('http') ? link : `https://www.amazon.com${link}`;
              const normalizedUrl = normalizeProductUrl(fullUrl);
              const asin = extractASIN(normalizedUrl);
              
              if (asin && !seenASINs.has(asin)) {
                seenASINs.add(asin);
                categoryUrls.push(normalizedUrl);
              } else if (!asin && !categoryUrls.includes(normalizedUrl)) {
                categoryUrls.push(normalizedUrl);
              }
            }
          });

          // Small delay between pages
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.log(`[Discovery] Error fetching ${category} page ${page}:`, error.message);
        }
      }
      
      return categoryUrls;
    });
    
    // Process categories in parallel (5 at a time)
    const categoryResults = await Promise.all(categoryPromises);
    categoryResults.forEach(urls => {
      productUrls.push(...urls);
    });

    // Also get products from Amazon's "New Releases" and "Movers & Shakers" (multiple pages)
    if (productUrls.length < maxProducts) {
      const discoveryPageTypes = [
        { base: 'new-releases', category: 'electronics' },
        { base: 'movers-and-shakers', category: 'electronics' },
        { base: 'new-releases', category: 'computers' },
        { base: 'movers-and-shakers', category: 'computers' }
      ];
      
      const discoveryPromises = discoveryPageTypes.map(async ({ base, category }) => {
        if (productUrls.length >= maxProducts) return [];
        
        const pageUrls: string[] = [];
        // Fetch multiple pages
        for (let page = 1; page <= 5; page++) {
          if (productUrls.length + pageUrls.length >= maxProducts) break;
          
          try {
            const pageUrl = `https://www.amazon.com/gp/${base}/${category}/ref=zg_bsnr_pg_${page}?ie=UTF8&pg=${page}`;
            const response = await axios.get(pageUrl, {
              ...options,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              timeout: 30000
            });
            
            const $ = cheerio.load(response.data);

            $('a[href*="/dp/"], a[href*="/gp/product/"]').each((_index: number, element: cheerio.Element) => {
              if (pageUrls.length >= 50) return false;

              const link = $(element).attr('href');
              if (link) {
                const fullUrl = link.startsWith('http') ? link : `https://www.amazon.com${link}`;
                const normalizedUrl = normalizeProductUrl(fullUrl);
                const asin = extractASIN(normalizedUrl);
                
                if (asin && !seenASINs.has(asin)) {
                  seenASINs.add(asin);
                  pageUrls.push(normalizedUrl);
                } else if (!asin && !pageUrls.includes(normalizedUrl)) {
                  pageUrls.push(normalizedUrl);
                }
              }
            });

            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error: any) {
            // Continue to next page
          }
        }
        
        return pageUrls;
      });
      
      const discoveryResults = await Promise.all(discoveryPromises);
      discoveryResults.forEach(urls => {
        productUrls.push(...urls);
      });
    }

    console.log(`[Discovery] Found ${productUrls.length} unique product URLs`);
    return productUrls.slice(0, maxProducts);
  } catch (error: any) {
    console.log('[Discovery] Error discovering Amazon products:', error.message);
    return [];
  }
}

// Scrape multiple products from URLs in parallel (fast - optimized for millions)
export async function scrapeMultipleProducts(urls: string[], concurrency: number = 20) {
  const products: any[] = [];
  const errors: string[] = [];
  
  // Process URLs in batches for parallel scraping
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    
    // Scrape all URLs in batch concurrently
    const batchPromises = batch.map(async (url) => {
      try {
        const product = await scrapeAmazonProduct(url);
        return product;
      } catch (error: any) {
        console.log(`[Batch] Error scraping ${url}:`, error.message);
        errors.push(url);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Filter out null results and add to products array
    const validProducts = batchResults.filter(p => p !== null);
    products.push(...validProducts);
    
    // Log progress
    if ((i + concurrency) % 50 === 0 || i + concurrency >= urls.length) {
      console.log(`[Scrape] Progress: ${Math.min(i + concurrency, urls.length)}/${urls.length} products scraped`);
    }
    
    // Small delay between batches to avoid overwhelming the server
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[Scrape] Completed: ${products.length} products scraped, ${errors.length} errors`);
  return products;
}

export async function scrapeAmazonProduct(url: string) {
  if(!url) return;

  const options = getProxyConfig();

  try {
    // Fetch the product page using Bright Data proxy
    console.log(`[Scrape] Fetching product: ${url}`);
    const response = await axios.get(url, {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 30000
    });
    const $ = cheerio.load(response.data);

    // Extract the product title (with length limit to prevent serialization issues)
    let title = '';
    try {
      const titleText = $('#productTitle').text();
      if (titleText) {
        title = titleText.trim().substring(0, 500); // Limit title length
      }
    } catch (error) {
      console.log('[Scrape] Error extracting title:', error);
      title = 'Unknown Product';
    }
    
    const currentPrice = extractPrice(
      $('.priceToPay span.a-price-whole'),
      $('.a.size.base.a-color-price'),
      $('.a-button-selected .a-color-base'),
    );

    const originalPrice = extractPrice(
      $('#priceblock_ourprice'),
      $('.a-price.a-text-price span.a-offscreen'),
      $('#listPrice'),
      $('#priceblock_dealprice'),
      $('.a-size-base.a-color-price')
    );

    const outOfStock = $('#availability span').text().trim().toLowerCase() === 'currently unavailable';

    // Safely parse images
    let imageUrls: string[] = [];
    try {
      const imagesAttr = 
      $('#imgBlkFront').attr('data-a-dynamic-image') || 
      $('#landingImage').attr('data-a-dynamic-image') ||
        '{}';
      
      if (imagesAttr && imagesAttr !== '{}') {
        try {
          const imagesObj = JSON.parse(imagesAttr);
          if (imagesObj && typeof imagesObj === 'object') {
            imageUrls = Object.keys(imagesObj);
          }
        } catch (parseError) {
          console.log('[Scrape] Error parsing images JSON:', parseError);
        }
      }
    } catch (error) {
      console.log('[Scrape] Error extracting images:', error);
    }

    const currency = extractCurrency($('.a-price-symbol'))
    
    // Safely extract discount rate (manual filtering to avoid stack overflow)
    let discountRate = 0;
    try {
      const discountText = $('.savingsPercentage').text().trim();
      if (discountText && discountText.length < 100) {
        // Manual character filtering - safer than regex replace
        const chars = discountText.split('');
        const digits: string[] = [];
        for (let i = 0; i < Math.min(chars.length, 20); i++) {
          const char = chars[i];
          if (char >= '0' && char <= '9') {
            digits.push(char);
            if (digits.length >= 10) break; // Limit to 10 digits
          }
        }
        
        const cleaned = digits.join('');
        if (cleaned && cleaned.length <= 10) {
          discountRate = Number(cleaned) || 0;
        }
      }
    } catch (error) {
      console.log('[Scrape] Error extracting discount rate:', error);
    }

    // Extract description with length limit
    let description = '';
    try {
      description = extractDescription($);
      // Ensure description is not too long
      if (description && description.length > 2000) {
        description = description.substring(0, 2000);
      }
    } catch (error) {
      console.log('[Scrape] Error extracting description:', error);
      description = '';
    }

    // Construct data object with scraped information (ensure all values are serializable)
    const currentPriceNum = Number(currentPrice) || Number(originalPrice) || 0;
    const originalPriceNum = Number(originalPrice) || Number(currentPrice) || 0;
    
    // Sanitize and limit string lengths to prevent serialization issues (no regex replace)
    const sanitizeString = (str: string, maxLength: number = 5000): string => {
      if (!str || typeof str !== 'string') return '';
      // Limit length first
      const limited = str.length > maxLength ? str.substring(0, maxLength) : str;
      
      // Manual character filtering to remove control characters (no regex replace)
      const chars = limited.split('');
      const cleanChars: string[] = [];
      for (let i = 0; i < chars.length; i++) {
        const charCode = chars[i].charCodeAt(0);
        // Keep printable characters (32-126) and common unicode characters
        if (charCode >= 32 && charCode !== 127) {
          cleanChars.push(chars[i]);
        }
      }
      
      return cleanChars.join('').trim();
    };
    
    const normalizedUrl = normalizeProductUrl(url);
    const sanitizedTitle = sanitizeString(title || 'Unknown Product', 500);
    const sanitizedDescription = sanitizeString(description || '', 2000);
    const sanitizedImage = sanitizeString(imageUrls[0] || '', 500);
    const sanitizedCurrency = sanitizeString(currency || '$', 10);
    
    // Ensure all values are plain JavaScript types (no functions, no circular refs)
    const data = {
      url: sanitizeString(normalizedUrl, 500),
      currency: sanitizedCurrency,
      image: sanitizedImage,
      title: sanitizedTitle,
      currentPrice: isNaN(currentPriceNum) ? 0 : currentPriceNum,
      originalPrice: isNaN(originalPriceNum) ? 0 : originalPriceNum,
      priceHistory: [], // Empty array, will be populated later
      discountRate: isNaN(discountRate) ? 0 : discountRate,
      category: 'category',
      reviewsCount: 100,
      stars: 4.5,
      isOutOfStock: Boolean(outOfStock),
      description: sanitizedDescription,
      lowestPrice: isNaN(currentPriceNum) ? 0 : currentPriceNum,
      highestPrice: isNaN(originalPriceNum) ? 0 : originalPriceNum,
      averagePrice: isNaN(currentPriceNum) ? 0 : currentPriceNum,
    };

    // Final validation - ensure no undefined or null values that could cause issues
    const cleanData: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        cleanData[key] = value;
      } else {
        cleanData[key] = typeof value === 'string' ? '' : (typeof value === 'number' ? 0 : false);
      }
    }

    return cleanData;
  } catch (error: any) {
    console.log(error);
  }
}