"use client"

import { useState, useMemo, useEffect } from 'react'
import { Product } from '@/types'
import ProductCard from './ProductCard'

interface Props {
  products: Product[]
  initialSearch?: string
}

const ProductFilter = ({ products, initialSearch = '' }: Props) => {
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'name' | 'newest'>('newest');

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = products.filter(product =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort products
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.currentPrice - b.currentPrice;
        case 'price-desc':
          return b.currentPrice - a.currentPrice;
        case 'name':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return 0; // Keep original order (newest first from DB)
      }
    });

    return sorted;
  }, [products, searchQuery, sortBy]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full md:max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stored products..."
            className="searchbar-input w-full"
          />
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Showing {filteredAndSortedProducts.length} of {products.length} products</span>
      </div>

      {filteredAndSortedProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {searchQuery ? 'No products found matching your search.' : 'No products stored yet. Search Amazon to add products!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-8 gap-y-16">
          {filteredAndSortedProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ProductFilter

