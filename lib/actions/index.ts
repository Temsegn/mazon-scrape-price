"use server"

import { revalidatePath } from "next/cache";
import Product from "../models/product.model";
import { connectToDB } from "../mongoose";
import { scrapeAmazonProduct, searchAmazonProducts, scrapeMultipleProducts, discoverAmazonProducts } from "../scraper";
import { getAveragePrice, getHighestPrice, getLowestPrice } from "../utils";
import { User } from "@/types";
import { generateEmailBody, sendEmail } from "../nodemailer";

export async function scrapeAndStoreProduct(productUrl: string) {
  if(!productUrl) return;

  try {
    connectToDB();

    const scrapedProduct = await scrapeAmazonProduct(productUrl);

    if(!scrapedProduct) return;

    let product = scrapedProduct;

    const existingProduct = await Product.findOne({ url: scrapedProduct.url });

    if(existingProduct) {
      const updatedPriceHistory: any = [
        ...existingProduct.priceHistory,
        { price: scrapedProduct.currentPrice }
      ]

      product = {
        ...scrapedProduct,
        priceHistory: updatedPriceHistory,
        lowestPrice: getLowestPrice(updatedPriceHistory),
        highestPrice: getHighestPrice(updatedPriceHistory),
        averagePrice: getAveragePrice(updatedPriceHistory),
      }
    }

    const newProduct = await Product.findOneAndUpdate(
      { url: scrapedProduct.url },
      product,
      { upsert: true, new: true }
    );

    revalidatePath(`/products/${newProduct._id}`);
  } catch (error: any) {
    throw new Error(`Failed to create/update product: ${error.message}`)
  }
}

export async function getProductById(productId: string) {
  try {
    connectToDB();

    const product = await Product.findOne({ _id: productId });

    if(!product) return null;

    return product;
  } catch (error) {
    console.log(error);
  }
}

export async function getAllProducts() {
  try {
    connectToDB();

    const products = await Product.find();

    return products;
  } catch (error) {
    console.log(error);
  }
}

export async function getSimilarProducts(productId: string) {
  try {
    connectToDB();

    const currentProduct = await Product.findById(productId);

    if(!currentProduct) return null;

    const similarProducts = await Product.find({
      _id: { $ne: productId },
    }).limit(3);

    return similarProducts;
  } catch (error) {
    console.log(error);
  }
}

export async function addUserEmailToProduct(productId: string, userEmail: string) {
  try {
    const product = await Product.findById(productId);

    if(!product) return;

    const userExists = product.users.some((user: User) => user.email === userEmail);

    if(!userExists) {
      product.users.push({ email: userEmail });

      await product.save();

      const emailContent = await generateEmailBody(product, "WELCOME");

      await sendEmail(emailContent, [userEmail]);
    }
  } catch (error) {
    console.log(error);
  }
}

// Search Amazon and store multiple products (optimized for speed)
export async function searchAndStoreProducts(searchQuery: string, maxProducts: number = 50) {
  if(!searchQuery) return { success: false, message: 'Search query is required' };

  try {
    connectToDB();
    console.log(`[Search] Searching for: ${searchQuery}`);

    // Search Amazon for products using Bright Data
    const productUrls = await searchAmazonProducts(searchQuery, maxProducts);
    
    if(productUrls.length === 0) {
      return { success: false, message: 'No products found. Please try a different search term.' };
    }

    console.log(`[Search] Found ${productUrls.length} product URLs, checking for duplicates...`);

    // Check which products already exist (by URL and ASIN)
    const existingProducts = await Product.find({});
    const existingUrls = new Set(existingProducts.map(p => p.url));
    const existingASINs = new Set<string>();
    
    existingProducts.forEach(product => {
      const asin = extractASINFromUrl(product.url);
      if (asin) {
        existingASINs.add(asin);
      }
    });

    // Filter out existing products
    const newUrls: string[] = [];
    for (const url of productUrls) {
      if (existingUrls.has(url)) continue;
      const asin = extractASINFromUrl(url);
      if (asin && existingASINs.has(asin)) continue;
      newUrls.push(url);
    }

    console.log(`[Search] ${newUrls.length} new products to scrape, ${productUrls.length - newUrls.length} already exist`);

    if(newUrls.length === 0) {
      return { success: true, message: 'All found products already exist in database', count: 0 };
    }

    // Scrape only new products
    const scrapedProducts = await scrapeMultipleProducts(newUrls);
    
    if(scrapedProducts.length === 0) {
      return { success: false, message: 'Failed to scrape products. Please try again.' };
    }

    // Store only new products (optimized with bulk operations)
    let storedCount = 0;
    let updatedCount = 0;
    
    // Separate new products from existing ones
    const newProducts: any[] = [];
    const productsToUpdate: any[] = [];
    
    // Get all existing products for faster lookup
    const allExisting = await Product.find({}, { url: 1, priceHistory: 1 });
    const existingMap = new Map();
    allExisting.forEach(p => {
      existingMap.set(p.url, p);
      const asin = extractASINFromUrl(p.url);
      if (asin) {
        existingMap.set(asin, p);
      }
    });
    
    for (const scrapedProduct of scrapedProducts) {
      if (!scrapedProduct.title || !scrapedProduct.url) continue;

      const existingProduct = existingMap.get(scrapedProduct.url);
      const asin = extractASINFromUrl(scrapedProduct.url);
      const existingByASIN = asin ? existingMap.get(asin) : null;

      if(existingProduct || existingByASIN) {
        productsToUpdate.push({ scrapedProduct, existing: existingProduct || existingByASIN });
      } else {
        newProducts.push(scrapedProduct);
      }
    }
    
    // Bulk insert new products
    if (newProducts.length > 0) {
      try {
        await Product.insertMany(newProducts, { ordered: false });
        storedCount = newProducts.length;
        console.log(`[Search] Bulk inserted ${storedCount} new products`);
      } catch (error: any) {
        // Fallback to individual inserts if bulk fails
        for (const product of newProducts) {
          try {
            await Product.create(product);
            storedCount++;
          } catch (err: any) {
            console.log(`[Search] Error storing product:`, err.message);
          }
        }
      }
    }
    
    // Update existing products
    for (const { scrapedProduct, existing } of productsToUpdate) {
      try {
        const updatedPriceHistory: any = [
          ...existing.priceHistory,
          { price: scrapedProduct.currentPrice, date: new Date() }
        ]

        const updatedProduct = {
          ...scrapedProduct,
          priceHistory: updatedPriceHistory,
          lowestPrice: getLowestPrice(updatedPriceHistory),
          highestPrice: getHighestPrice(updatedPriceHistory),
          averagePrice: getAveragePrice(updatedPriceHistory),
        }

        await Product.findOneAndUpdate(
          { url: existing.url },
          updatedProduct,
          { new: true }
        );
        updatedCount++;
      } catch (error: any) {
        console.log(`[Search] Error updating product:`, error.message);
      }
    }

    revalidatePath('/');
    const message = storedCount > 0 
      ? `Successfully stored ${storedCount} NEW products${updatedCount > 0 ? ` and updated ${updatedCount} existing products` : ''}`
      : `Updated ${updatedCount} existing products (no new products found)`;
    
    return { 
      success: true, 
      message,
      count: storedCount 
    };
  } catch (error: any) {
    console.log('[Search] Error in searchAndStoreProducts:', error);
    return { success: false, message: error.message || 'Failed to search and store products' };
  }
}

// Search products in database
export async function searchProducts(query: string) {
  try {
    connectToDB();

    const products = await Product.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ]
    }).limit(50);

    return products;
  } catch (error) {
    console.log(error);
    return [];
  }
}

// Extract ASIN from URL for better matching
function extractASINFromUrl(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/product\/([A-Z0-9]{10})/,
    /ASIN[\/=]([A-Z0-9]{10})/i
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Background job: Continuously discover and store Amazon products (optimized for speed)
export async function runBackgroundScrapingJob(batchSize: number = 500) {
  try {
    connectToDB();
    console.log(`[Background Job] Starting to discover NEW products...`);

    // Discover new products from Amazon
    const productUrls = await discoverAmazonProducts(batchSize);
    
    if(productUrls.length === 0) {
      console.log('[Background Job] No products discovered');
      return { success: false, message: 'No products discovered', count: 0 };
    }

    console.log(`[Background Job] Found ${productUrls.length} product URLs`);

    // Get all existing URLs and ASINs from database for comparison
    const existingProducts = await Product.find({});
    const existingUrls = new Set(existingProducts.map(p => p.url));
    const existingASINs = new Set<string>();
    
    // Extract ASINs from existing products
    existingProducts.forEach(product => {
      const asin = extractASINFromUrl(product.url);
      if (asin) {
        existingASINs.add(asin);
      }
    });

    // Filter out products that already exist (by URL or ASIN)
    const newUrls: string[] = [];
    for (const url of productUrls) {
      // Check by URL
      if (existingUrls.has(url)) continue;
      
      // Check by ASIN
      const asin = extractASINFromUrl(url);
      if (asin && existingASINs.has(asin)) continue;
      
      newUrls.push(url);
    }

    console.log(`[Background Job] ${newUrls.length} NEW products to scrape, ${productUrls.length - newUrls.length} already exist`);

    if(newUrls.length === 0) {
      return { success: true, message: 'All discovered products already exist in database', count: 0 };
    }

    // Scrape new products
    const scrapedProducts = await scrapeMultipleProducts(newUrls);
    
    if(scrapedProducts.length === 0) {
      return { success: false, message: 'Failed to scrape products', count: 0 };
    }

    // Bulk store new products (optimized for speed)
    let storedCount = 0;
    let skippedCount = 0;
    
    // Filter valid products
    const validProducts = scrapedProducts.filter(p => p && p.title && p.url);
    
    if (validProducts.length === 0) {
      return { success: true, message: 'No valid products to store', count: 0 };
    }
    
    // Get all existing URLs and ASINs in one query for faster checking
    const allExistingProducts = await Product.find({}, { url: 1 });
    const existingUrlsSet = new Set(allExistingProducts.map(p => p.url));
    const existingASINsSet = new Set<string>();
    
    allExistingProducts.forEach(product => {
      const asin = extractASINFromUrl(product.url);
      if (asin) {
        existingASINsSet.add(asin);
      }
    });
    
    // Filter out existing products
    const newProductsToStore = validProducts.filter(product => {
      if (existingUrlsSet.has(product.url)) return false;
      const asin = extractASINFromUrl(product.url);
      if (asin && existingASINsSet.has(asin)) return false;
      return true;
    });
    
    skippedCount = validProducts.length - newProductsToStore.length;
    
    // Bulk insert new products (much faster than individual inserts)
    if (newProductsToStore.length > 0) {
      try {
        // Insert in batches of 100 for optimal performance
        const batchSize = 100;
        for (let i = 0; i < newProductsToStore.length; i += batchSize) {
          const batch = newProductsToStore.slice(i, i + batchSize);
          await Product.insertMany(batch, { ordered: false }).catch((error: any) => {
            // If batch insert fails, try individual inserts for that batch
            console.log(`[Background Job] Batch insert failed, trying individual inserts...`);
            batch.forEach(async (product) => {
              try {
                await Product.create(product);
                storedCount++;
              } catch (err: any) {
                skippedCount++;
              }
            });
          });
          storedCount += batch.length;
        }
        console.log(`[Background Job] Bulk inserted ${storedCount} products`);
      } catch (error: any) {
        console.log(`[Background Job] Bulk insert error, falling back to individual inserts:`, error.message);
        // Fallback to individual inserts
        for (const product of newProductsToStore) {
          try {
            await Product.create(product);
            storedCount++;
          } catch (err: any) {
            skippedCount++;
          }
        }
      }
    }

    console.log(`[Background Job] Successfully stored ${storedCount} NEW products, skipped ${skippedCount} duplicates`);
    revalidatePath('/');
    
    return { 
      success: true, 
      message: `Stored ${storedCount} NEW products (${skippedCount} duplicates skipped)`,
      count: storedCount 
    };
  } catch (error: any) {
    console.log('[Background Job] Error:', error);
    return { success: false, message: error.message, count: 0 };
  }
}