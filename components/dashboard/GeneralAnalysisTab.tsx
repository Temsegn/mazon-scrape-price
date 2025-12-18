"use client"

import { GeneralAnalysis } from '@/lib/actions/analytics'
import { formatNumber } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'

interface Props {
  data: GeneralAnalysis
}

export default function GeneralAnalysisTab({ data }: Props) {
  const stockPercentage = data.totalProducts > 0 
    ? (data.inStock / data.totalProducts) * 100 
    : 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Total Products</p>
          <p className="text-2xl font-bold text-blue-700">{data.totalProducts}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600 mb-1">In Stock</p>
          <p className="text-2xl font-bold text-green-700">{data.inStock}</p>
          <p className="text-xs text-gray-500 mt-1">{stockPercentage.toFixed(1)}% available</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600 mb-1">Out of Stock</p>
          <p className="text-2xl font-bold text-red-700">{data.outOfStock}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Total Trackers</p>
          <p className="text-2xl font-bold text-purple-700">{data.totalTrackers}</p>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Discount</p>
              <p className="text-3xl font-bold text-primary">{data.averageDiscount}%</p>
            </div>
            <div className="text-4xl">🎯</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Rating</p>
              <p className="text-3xl font-bold text-yellow-600">{data.averageRating.toFixed(1)} ⭐</p>
            </div>
            <div className="text-4xl">⭐</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Reviews</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(data.totalReviews)}</p>
            </div>
            <div className="text-4xl">💬</div>
          </div>
        </div>
      </div>

      {/* Stock Status Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Stock Status</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">In Stock</span>
              <span className="text-sm font-medium text-gray-900">{data.inStock} products</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className="bg-green-500 h-6 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${stockPercentage}%` }}
              >
                {stockPercentage > 10 && (
                  <span className="text-xs text-white font-medium">{stockPercentage.toFixed(1)}%</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Out of Stock</span>
              <span className="text-sm font-medium text-gray-900">{data.outOfStock} products</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className="bg-red-500 h-6 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${100 - stockPercentage}%` }}
              >
                {100 - stockPercentage > 10 && (
                  <span className="text-xs text-white font-medium">{(100 - stockPercentage).toFixed(1)}%</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Discounted Products */}
      {data.topDiscountedProducts.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Discounted Products</h3>
          <div className="space-y-3">
            {data.topDiscountedProducts.map((product, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <span className="text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                      {product.discountRate}% OFF
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.title}</p>
                  <p className="text-sm text-gray-600 mt-1">${formatNumber(product.currentPrice)}</p>
                </div>
                <Link
                  href={product.url}
                  target="_blank"
                  className="ml-4 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Rated Products */}
      {data.topRatedProducts.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Rated Products</h3>
          <div className="space-y-3">
            {data.topRatedProducts.map((product, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="text-sm font-semibold text-gray-900">{product.stars}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      ({formatNumber(product.reviewsCount)} reviews)
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.title}</p>
                </div>
                <Link
                  href={product.url}
                  target="_blank"
                  className="ml-4 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

