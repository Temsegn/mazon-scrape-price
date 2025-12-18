"use client"

import { CategoryAnalysis } from '@/lib/actions/analytics'
import { formatNumber } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  data: CategoryAnalysis
}

export default function CategoryAnalysisTab({ data }: Props) {
  const maxCount = Math.max(...data.categories.map(c => c.count), 1)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Categories</p>
            <p className="text-3xl font-bold text-gray-900">{data.totalCategories}</p>
          </div>
          <div className="text-4xl">📊</div>
        </div>
      </div>

      {/* Category List */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Products by Category</h3>
        <div className="space-y-4">
          {data.categories.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No category data available</p>
          ) : (
            data.categories.map((category, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900 capitalize">
                      {category.category || 'Uncategorized'}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {category.count} {category.count === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      ${formatNumber(category.averagePrice)}
                    </p>
                    <p className="text-xs text-gray-500">avg price</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-gradient-to-r from-primary to-primary/70 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${category.percentage}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{category.percentage.toFixed(1)}% of total products</span>
                  <span>{category.count} items</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Category Statistics Table */}
      {data.categories.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 overflow-x-auto">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Category Statistics</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Products</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Price</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((category, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 capitalize">
                    {category.category || 'Uncategorized'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 text-right">{category.count}</td>
                  <td className="py-3 px-4 text-sm text-gray-700 text-right">
                    ${formatNumber(category.averagePrice)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 text-right">
                    {category.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

