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

// Search Amazon and store multiple products
export async function searchAndStoreProducts(searchQuery: string, maxProducts: number = 20) {
  if(!searchQuery) return { success: false, message: 'Search query is required' };

  try {
    connectToDB();

    // Search Amazon for products
    const productUrls = await searchAmazonProducts(searchQuery, maxProducts);
    
    if(productUrls.length === 0) {
      return { success: false, message: 'No products found' };
    }

    // Scrape all products
    const scrapedProducts = await scrapeMultipleProducts(productUrls);
    
    if(scrapedProducts.length === 0) {
      return { success: false, message: 'Failed to scrape products' };
    }

    // Store all products
    let storedCount = 0;
    for (const scrapedProduct of scrapedProducts) {
      try {
        const existingProduct = await Product.findOne({ url: scrapedProduct.url });

        if(existingProduct) {
          const updatedPriceHistory: any = [
            ...existingProduct.priceHistory,
            { price: scrapedProduct.currentPrice }
          ]

          const product = {
            ...scrapedProduct,
            priceHistory: updatedPriceHistory,
            lowestPrice: getLowestPrice(updatedPriceHistory),
            highestPrice: getHighestPrice(updatedPriceHistory),
            averagePrice: getAveragePrice(updatedPriceHistory),
          }

          await Product.findOneAndUpdate(
            { url: scrapedProduct.url },
            product,
            { upsert: true, new: true }
          );
        } else {
          await Product.create(scrapedProduct);
        }
        storedCount++;
      } catch (error: any) {
        console.log(`Error storing product ${scrapedProduct.url}:`, error);
      }
    }

    revalidatePath('/');
    return { 
      success: true, 
      message: `Successfully stored ${storedCount} products`,
      count: storedCount 
    };
  } catch (error: any) {
    console.log('Error in searchAndStoreProducts:', error);
    return { success: false, message: error.message };
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

// Background job: Continuously discover and store Amazon products
export async function runBackgroundScrapingJob(batchSize: number = 50) {
  try {
    connectToDB();
    console.log(`[Background Job] Starting to discover products...`);

    // Discover new products from Amazon
    const productUrls = await discoverAmazonProducts(batchSize);
    
    if(productUrls.length === 0) {
      console.log('[Background Job] No products discovered');
      return { success: false, message: 'No products discovered', count: 0 };
    }

    console.log(`[Background Job] Found ${productUrls.length} product URLs, starting to scrape...`);

    // Check which products already exist in database
    const existingProducts = await Product.find({ url: { $in: productUrls } });
    const existingUrls = new Set(existingProducts.map(p => p.url));
    const newUrls = productUrls.filter(url => !existingUrls.has(url));

    console.log(`[Background Job] ${newUrls.length} new products to scrape, ${existingUrls.size} already exist`);

    if(newUrls.length === 0) {
      return { success: true, message: 'All products already exist', count: 0 };
    }

    // Scrape new products
    const scrapedProducts = await scrapeMultipleProducts(newUrls);
    
    if(scrapedProducts.length === 0) {
      return { success: false, message: 'Failed to scrape products', count: 0 };
    }

    // Store all new products
    let storedCount = 0;
    for (const scrapedProduct of scrapedProducts) {
      try {
        if (!scrapedProduct.title || !scrapedProduct.url) continue;

        const existingProduct = await Product.findOne({ url: scrapedProduct.url });

        if(!existingProduct) {
          await Product.create(scrapedProduct);
          storedCount++;
        }
      } catch (error: any) {
        console.log(`[Background Job] Error storing product:`, error.message);
      }
    }

    console.log(`[Background Job] Successfully stored ${storedCount} new products`);
    revalidatePath('/');
    
    return { 
      success: true, 
      message: `Stored ${storedCount} new products`,
      count: storedCount 
    };
  } catch (error: any) {
    console.log('[Background Job] Error:', error);
    return { success: false, message: error.message, count: 0 };
  }
}