"use client"

import { PriceAnalysis } from '@/lib/actions/analytics'
import { formatNumber } from '@/lib/utils'

interface Props {
  data: PriceAnalysis
}

export default function PriceAnalysisTab({ data }: Props) {
  const maxCount = Math.max(...data.priceRanges.map(r => r.count), 1)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600 mb-1">Total Products</p>
          <p className="text-2xl font-bold text-blue-700">{data.totalProducts}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600 mb-1">Average Price</p>
          <p className="text-2xl font-bold text-green-700">${formatNumber(data.averagePrice)}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600 mb-1">Median Price</p>
          <p className="text-2xl font-bold text-purple-700">${formatNumber(data.medianPrice)}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <p className="text-sm text-gray-600 mb-1">Price Range</p>
          <p className="text-2xl font-bold text-orange-700">
            ${formatNumber(data.minPrice)} - ${formatNumber(data.maxPrice)}
          </p>
        </div>
      </div>

      {/* Price Distribution */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Price Distribution</h3>
        <div className="space-y-4">
          {data.priceRanges.map((range, index) => (
            <div key={index}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{range.range}</span>
                <span className="text-sm text-gray-600">
                  {range.count} products ({range.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-primary h-4 rounded-full transition-all duration-300"
                  style={{ width: `${(range.count / maxCount) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Price Trend */}
      {data.priceTrend.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">7-Day Price Trend</h3>
          <div className="flex items-end justify-between h-64 gap-2">
            {data.priceTrend.map((point, index) => {
              const maxPrice = Math.max(...data.priceTrend.map(p => p.averagePrice), 1)
              const height = (point.averagePrice / maxPrice) * 100
              const date = new Date(point.date)
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center">
                    <div
                      className="w-full bg-primary rounded-t transition-all duration-300 hover:bg-primary/80"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${dayName}: $${formatNumber(point.averagePrice)}`}
                    ></div>
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      ${formatNumber(point.averagePrice)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{dayName}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

