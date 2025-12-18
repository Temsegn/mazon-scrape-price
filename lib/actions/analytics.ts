"use server"

import { connectToDB } from "../mongoose";
import Product from "../models/product.model";

export type PriceAnalysis = {
  totalProducts: number;
  averagePrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  priceRanges: {
    range: string;
    count: number;
    percentage: number;
  }[];
  priceTrend: {
    date: string;
    averagePrice: number;
  }[];
};

export type CategoryAnalysis = {
  categories: {
    category: string;
    count: number;
    averagePrice: number;
    totalProducts: number;
    percentage: number;
  }[];
  totalCategories: number;
};

export type GeneralAnalysis = {
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  averageDiscount: number;
  averageRating: number;
  totalReviews: number;
  totalTrackers: number;
  topDiscountedProducts: {
    title: string;
    discountRate: number;
    currentPrice: number;
    url: string;
  }[];
  topRatedProducts: {
    title: string;
    stars: number;
    reviewsCount: number;
    url: string;
  }[];
};

export async function getPriceAnalysis(): Promise<PriceAnalysis> {
  try {
    connectToDB();
    const products = await Product.find({});

    if (products.length === 0) {
      return {
        totalProducts: 0,
        averagePrice: 0,
        medianPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        priceRanges: [],
        priceTrend: []
      };
    }

    const prices = products.map(p => p.currentPrice).filter(p => p > 0);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    
    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const medianPrice = sortedPrices.length % 2 === 0
      ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
      : sortedPrices[Math.floor(sortedPrices.length / 2)];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Price ranges
    const ranges = [
      { min: 0, max: 25, label: '$0 - $25' },
      { min: 25, max: 50, label: '$25 - $50' },
      { min: 50, max: 100, label: '$50 - $100' },
      { min: 100, max: 250, label: '$100 - $250' },
      { min: 250, max: 500, label: '$250 - $500' },
      { min: 500, max: Infinity, label: '$500+' }
    ];

    const priceRanges = ranges.map(range => {
      const count = prices.filter(p => p >= range.min && p < range.max).length;
      return {
        range: range.label,
        count,
        percentage: (count / prices.length) * 100
      };
    });

    // Price trend (last 7 days from price history)
    const priceTrend: { date: string; averagePrice: number }[] = [];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    last7Days.forEach(date => {
      let totalPrice = 0;
      let count = 0;
      
      products.forEach(product => {
        const historyItem = product.priceHistory?.find((item: any) => {
          const itemDate = new Date(item.date || Date.now()).toISOString().split('T')[0];
          return itemDate === date;
        });
        
        if (historyItem) {
          totalPrice += historyItem.price;
          count++;
        } else if (product.currentPrice) {
          totalPrice += product.currentPrice;
          count++;
        }
      });
      
      priceTrend.push({
        date,
        averagePrice: count > 0 ? totalPrice / count : 0
      });
    });

    return {
      totalProducts: products.length,
      averagePrice: Math.round(averagePrice * 100) / 100,
      medianPrice: Math.round(medianPrice * 100) / 100,
      minPrice,
      maxPrice,
      priceRanges,
      priceTrend
    };
  } catch (error) {
    console.log('Error in getPriceAnalysis:', error);
    return {
      totalProducts: 0,
      averagePrice: 0,
      medianPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      priceRanges: [],
      priceTrend: []
    };
  }
}

export async function getCategoryAnalysis(): Promise<CategoryAnalysis> {
  try {
    connectToDB();
    const products = await Product.find({});

    if (products.length === 0) {
      return {
        categories: [],
        totalCategories: 0
      };
    }

    // Group by category
    const categoryMap = new Map<string, { prices: number[]; count: number }>();

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { prices: [], count: 0 });
      }
      const catData = categoryMap.get(category)!;
      if (product.currentPrice > 0) {
        catData.prices.push(product.currentPrice);
      }
      catData.count++;
    });

    const categories = Array.from(categoryMap.entries()).map(([category, data]) => {
      const averagePrice = data.prices.length > 0
        ? data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length
        : 0;

      return {
        category,
        count: data.count,
        averagePrice: Math.round(averagePrice * 100) / 100,
        totalProducts: data.count,
        percentage: (data.count / products.length) * 100
      };
    }).sort((a, b) => b.count - a.count);

    return {
      categories,
      totalCategories: categories.length
    };
  } catch (error) {
    console.log('Error in getCategoryAnalysis:', error);
    return {
      categories: [],
      totalCategories: 0
    };
  }
}

export async function getGeneralAnalysis(): Promise<GeneralAnalysis> {
  try {
    connectToDB();
    const products = await Product.find({});

    if (products.length === 0) {
      return {
        totalProducts: 0,
        inStock: 0,
        outOfStock: 0,
        averageDiscount: 0,
        averageRating: 0,
        totalReviews: 0,
        totalTrackers: 0,
        topDiscountedProducts: [],
        topRatedProducts: []
      };
    }

    const inStock = products.filter(p => !p.isOutOfStock).length;
    const outOfStock = products.filter(p => p.isOutOfStock).length;

    const discounts = products
      .map(p => p.discountRate || 0)
      .filter(d => d > 0);
    const averageDiscount = discounts.length > 0
      ? discounts.reduce((sum, d) => sum + d, 0) / discounts.length
      : 0;

    const ratings = products
      .map(p => p.stars || 0)
      .filter(r => r > 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    const totalReviews = products.reduce((sum, p) => sum + (p.reviewsCount || 0), 0);
    const totalTrackers = products.reduce((sum, p) => sum + (p.users?.length || 0), 0);

    // Top discounted products
    const topDiscountedProducts = products
      .filter(p => p.discountRate && p.discountRate > 0)
      .sort((a, b) => (b.discountRate || 0) - (a.discountRate || 0))
      .slice(0, 10)
      .map(p => ({
        title: p.title,
        discountRate: p.discountRate || 0,
        currentPrice: p.currentPrice,
        url: p.url
      }));

    // Top rated products
    const topRatedProducts = products
      .filter(p => p.stars && p.stars > 0)
      .sort((a, b) => (b.stars || 0) - (a.stars || 0))
      .slice(0, 10)
      .map(p => ({
        title: p.title,
        stars: p.stars || 0,
        reviewsCount: p.reviewsCount || 0,
        url: p.url
      }));

    return {
      totalProducts: products.length,
      inStock,
      outOfStock,
      averageDiscount: Math.round(averageDiscount * 100) / 100,
      averageRating: Math.round(averageRating * 100) / 100,
      totalReviews,
      totalTrackers,
      topDiscountedProducts,
      topRatedProducts
    };
  } catch (error) {
    console.log('Error in getGeneralAnalysis:', error);
    return {
      totalProducts: 0,
      inStock: 0,
      outOfStock: 0,
      averageDiscount: 0,
      averageRating: 0,
      totalReviews: 0,
      totalTrackers: 0,
      topDiscountedProducts: [],
      topRatedProducts: []
    };
  }
}

