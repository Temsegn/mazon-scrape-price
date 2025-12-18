"use client"

import { useState, useEffect } from 'react'
import { getPriceAnalysis, getCategoryAnalysis, getGeneralAnalysis } from '@/lib/actions/analytics'
import PriceAnalysisTab from '@/components/dashboard/PriceAnalysisTab'
import CategoryAnalysisTab from '@/components/dashboard/CategoryAnalysisTab'
import GeneralAnalysisTab from '@/components/dashboard/GeneralAnalysisTab'

type TabType = 'price' | 'category' | 'general'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('price')
  const [loading, setLoading] = useState(true)
  const [priceData, setPriceData] = useState<any>(null)
  const [categoryData, setCategoryData] = useState<any>(null)
  const [generalData, setGeneralData] = useState<any>(null)

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [price, category, general] = await Promise.all([
        getPriceAnalysis(),
        getCategoryAnalysis(),
        getGeneralAnalysis()
      ])
      setPriceData(price)
      setCategoryData(category)
      setGeneralData(general)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'price' as TabType, label: 'Price Analysis', icon: '💰' },
    { id: 'category' as TabType, label: 'Category Analysis', icon: '📊' },
    { id: 'general' as TabType, label: 'General Stats', icon: '📈' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-20">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive analysis of your product data</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {activeTab === 'price' && priceData && (
                  <PriceAnalysisTab data={priceData} />
                )}
                {activeTab === 'category' && categoryData && (
                  <CategoryAnalysisTab data={categoryData} />
                )}
                {activeTab === 'general' && generalData && (
                  <GeneralAnalysisTab data={generalData} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

