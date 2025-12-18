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

// Search Amazon and get product URLs from search results
export async function searchAmazonProducts(searchQuery: string, maxProducts: number = 20) {
  if(!searchQuery) return [];

  try {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}`;
    const options = getProxyConfig();

    const response = await axios.get(searchUrl, options);
    const $ = cheerio.load(response.data);

    const productUrls: string[] = [];
    
    // Find all product links in search results
    $('[data-component-type="s-search-result"]').each((_index: number, element: cheerio.Element) => {
      if (productUrls.length >= maxProducts) return false;
      
      const link = $(element).find('h2 a').attr('href');
      if (link) {
        const fullUrl = link.startsWith('http') ? link : `https://www.amazon.com${link}`;
        // Remove query parameters to get clean product URL
        const cleanUrl = fullUrl.split('?')[0];
        if (cleanUrl && !productUrls.includes(cleanUrl)) {
          productUrls.push(cleanUrl);
        }
      }
    });

    return productUrls;
  } catch (error: any) {
    console.log('Error searching Amazon:', error);
    return [];
  }
}

// Discover products from Amazon bestsellers, new releases, etc.
export async function discoverAmazonProducts(maxProducts: number = 50) {
  const productUrls: string[] = [];
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
    'bestsellers-toys-games'
  ];

  try {
    const options = getProxyConfig();

    // Get products from multiple category pages
    for (const category of categories) {
      if (productUrls.length >= maxProducts) break;

      try {
        const categoryUrl = `https://www.amazon.com/gp/bestsellers/${category}/ref=zg_bs_pg_1?ie=UTF8&pg=1`;
        const response = await axios.get(categoryUrl, options);
        const $ = cheerio.load(response.data);

        // Find product links in bestsellers
        $('[data-component-type="s-search-result"], .zg-item-immersion').each((_index: number, element: cheerio.Element) => {
          if (productUrls.length >= maxProducts) return false;

          const link = $(element).find('a[href*="/dp/"], a[href*="/gp/product/"]').first().attr('href');
          if (link) {
            const fullUrl = link.startsWith('http') ? link : `https://www.amazon.com${link}`;
            const cleanUrl = fullUrl.split('/ref')[0].split('?')[0];
            
            // Extract product ID and create clean URL
            const dpMatch = cleanUrl.match(/\/dp\/([A-Z0-9]+)/);
            if (dpMatch) {
              const productUrl = `https://www.amazon.com/dp/${dpMatch[1]}`;
              if (!productUrls.includes(productUrl)) {
                productUrls.push(productUrl);
              }
            }
          }
        });

        // Add delay between category requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log(`Error fetching category ${category}:`, error);
      }
    }

    // Also get products from Amazon's "New Releases" and "Movers & Shakers"
    const discoveryPages = [
      'https://www.amazon.com/gp/new-releases/electronics/ref=zg_bsnr_nav_0',
      'https://www.amazon.com/gp/movers-and-shakers/electronics/ref=zg_bsms_nav_0',
      'https://www.amazon.com/Best-Sellers/zgbs/ref=zg_bs_pg_1'
    ];

    for (const pageUrl of discoveryPages) {
      if (productUrls.length >= maxProducts) break;

      try {
        const response = await axios.get(pageUrl, options);
        const $ = cheerio.load(response.data);

        $('a[href*="/dp/"], a[href*="/gp/product/"]').each((_index: number, element: cheerio.Element) => {
          if (productUrls.length >= maxProducts) return false;

          const link = $(element).attr('href');
          if (link) {
            const fullUrl = link.startsWith('http') ? link : `https://www.amazon.com${link}`;
            const cleanUrl = fullUrl.split('/ref')[0].split('?')[0];
            
            const dpMatch = cleanUrl.match(/\/dp\/([A-Z0-9]+)/);
            if (dpMatch) {
              const productUrl = `https://www.amazon.com/dp/${dpMatch[1]}`;
              if (!productUrls.includes(productUrl)) {
                productUrls.push(productUrl);
              }
            }
          }
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log(`Error fetching discovery page:`, error);
      }
    }

    return productUrls.slice(0, maxProducts);
  } catch (error: any) {
    console.log('Error discovering Amazon products:', error);
    return [];
  }
}

// Scrape multiple products from URLs
export async function scrapeMultipleProducts(urls: string[]) {
  const products = [];
  
  for (const url of urls) {
    try {
      const product = await scrapeAmazonProduct(url);
      if (product) {
        products.push(product);
      }
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`Error scraping ${url}:`, error);
    }
  }
  
  return products;
}

export async function scrapeAmazonProduct(url: string) {
  if(!url) return;

  const options = getProxyConfig();

  try {
    // Fetch the product page
    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    // Extract the product title
    const title = $('#productTitle').text().trim();
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

    const images = 
      $('#imgBlkFront').attr('data-a-dynamic-image') || 
      $('#landingImage').attr('data-a-dynamic-image') ||
      '{}'

    const imageUrls = Object.keys(JSON.parse(images));

    const currency = extractCurrency($('.a-price-symbol'))
    const discountRate = $('.savingsPercentage').text().replace(/[-%]/g, "");

    const description = extractDescription($)

    // Construct data object with scraped information
    const data = {
      url,
      currency: currency || '$',
      image: imageUrls[0],
      title,
      currentPrice: Number(currentPrice) || Number(originalPrice),
      originalPrice: Number(originalPrice) || Number(currentPrice),
      priceHistory: [],
      discountRate: Number(discountRate),
      category: 'category',
      reviewsCount:100,
      stars: 4.5,
      isOutOfStock: outOfStock,
      description,
      lowestPrice: Number(currentPrice) || Number(originalPrice),
      highestPrice: Number(originalPrice) || Number(currentPrice),
      averagePrice: Number(currentPrice) || Number(originalPrice),
    }

    return data;
  } catch (error: any) {
    console.log(error);
  }
}