import { PriceHistoryItem, Product } from "@/types";

const Notification = {
  WELCOME: 'WELCOME',
  CHANGE_OF_STOCK: 'CHANGE_OF_STOCK',
  LOWEST_PRICE: 'LOWEST_PRICE',
  THRESHOLD_MET: 'THRESHOLD_MET',
}

const THRESHOLD_PERCENTAGE = 40;

// Extracts and returns the price from a list of possible elements.
export function extractPrice(...elements: any) {
  try {
    for (const element of elements) {
      if (!element || typeof element.text !== 'function') continue;
      
      try {
        const priceText = element.text().trim();
        
        // Safety check: limit string length to prevent stack overflow
        if (!priceText || priceText.length > 1000) continue;

        // Safe manual filtering (no regex replace to avoid stack overflow)
        let cleanPrice = '';
        try {
          // Manual character filtering - safer than regex replace
          const chars = priceText.split('');
          const allowedChars: string[] = [];
          for (let i = 0; i < Math.min(chars.length, 100); i++) {
            const char = chars[i];
            if ((char >= '0' && char <= '9') || char === '.') {
              allowedChars.push(char);
              if (allowedChars.length >= 50) break; // Limit length
            }
          }
          cleanPrice = allowedChars.join('');
        } catch (filterError) {
          // Fallback: return empty if filtering fails
          cleanPrice = '';
        }

        if (cleanPrice) {
          // Manual parsing instead of regex match to avoid stack issues
          // Find first decimal number pattern
          let decimalMatch = '';
          let currentNum = '';
          let hasDecimal = false;
          
          for (let i = 0; i < cleanPrice.length && decimalMatch.length < 20; i++) {
            const char = cleanPrice[i];
            if (char >= '0' && char <= '9') {
              currentNum += char;
            } else if (char === '.' && currentNum.length > 0 && !hasDecimal) {
              currentNum += char;
              hasDecimal = true;
            } else if (currentNum.length > 0) {
              // End of number sequence
              if (hasDecimal && currentNum.includes('.')) {
                decimalMatch = currentNum;
                break;
              }
              currentNum = '';
              hasDecimal = false;
            }
          }
          
          if (decimalMatch) {
            return decimalMatch;
          }
          
          // Fallback: return current number sequence
          if (currentNum) {
            return currentNum;
          }
          
          // Last resort: return first 10 characters if they're numbers
          const firstNumbers = cleanPrice.substring(0, 10);
          if (firstNumbers) {
            return firstNumbers;
          }
        }
      } catch (elementError) {
        // Continue to next element
        continue;
      }
    }
  } catch (error) {
    console.log('[extractPrice] Error:', error);
  }

  return '';
}

// Extracts and returns the currency symbol from an element.
export function extractCurrency(element: any) {
  const currencyText = element.text().trim().slice(0, 1);
  return currencyText ? currencyText : "";
}

// Extracts description from two possible elements from amazon
export function extractDescription($: any) {
  try {
    // these are possible elements holding description of the product
    const selectors = [
      ".a-unordered-list .a-list-item",
      ".a-expander-content p",
      // Add more selectors here if needed
    ];

    for (const selector of selectors) {
      try {
        const elements = $(selector);
        if (elements && elements.length > 0) {
          const textParts: string[] = [];
          elements.each((index: number, element: any) => {
            try {
              if (index < 50) { // Limit to prevent infinite loops
                const text = $(element).text().trim();
                if (text && text.length > 0 && text.length < 10000) { // Sanity check
                  textParts.push(text);
                }
              }
            } catch (err) {
              // Skip this element if there's an error
            }
          });
          
          if (textParts.length > 0) {
            return textParts.join("\n").substring(0, 5000); // Limit total length
          }
        }
      } catch (err) {
        // Try next selector
        continue;
      }
    }
  } catch (error) {
    console.log('[extractDescription] Error:', error);
  }

  // If no matching elements were found, return an empty string
  return "";
}

export function getHighestPrice(priceList: PriceHistoryItem[]) {
  let highestPrice = priceList[0];

  for (let i = 0; i < priceList.length; i++) {
    if (priceList[i].price > highestPrice.price) {
      highestPrice = priceList[i];
    }
  }

  return highestPrice.price;
}

export function getLowestPrice(priceList: PriceHistoryItem[]) {
  let lowestPrice = priceList[0];

  for (let i = 0; i < priceList.length; i++) {
    if (priceList[i].price < lowestPrice.price) {
      lowestPrice = priceList[i];
    }
  }

  return lowestPrice.price;
}

export function getAveragePrice(priceList: PriceHistoryItem[]) {
  const sumOfPrices = priceList.reduce((acc, curr) => acc + curr.price, 0);
  const averagePrice = sumOfPrices / priceList.length || 0;

  return averagePrice;
}

export const getEmailNotifType = (
  scrapedProduct: Product,
  currentProduct: Product
) => {
  const lowestPrice = getLowestPrice(currentProduct.priceHistory);

  if (scrapedProduct.currentPrice < lowestPrice) {
    return Notification.LOWEST_PRICE as keyof typeof Notification;
  }
  if (!scrapedProduct.isOutOfStock && currentProduct.isOutOfStock) {
    return Notification.CHANGE_OF_STOCK as keyof typeof Notification;
  }
  if (scrapedProduct.discountRate >= THRESHOLD_PERCENTAGE) {
    return Notification.THRESHOLD_MET as keyof typeof Notification;
  }

  return null;
};

export const formatNumber = (num: number = 0) => {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};
