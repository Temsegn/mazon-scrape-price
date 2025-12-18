"use client"

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

const Searchbar = () => {
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if(!searchPrompt.trim()) return;

    // Navigate to homepage with search query
    // The ProductFilter component will handle the search
    router.push(`/?search=${encodeURIComponent(searchPrompt.trim())}`);
  }

  const handleScrape = async () => {
    if(!searchPrompt.trim()) {
      setMessage('Please enter a product name');
      return;
    }

    setIsScraping(true);
    setMessage('Scraping products from Amazon...');

    try {
      const response = await fetch('/api/scrape-by-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productName: searchPrompt.trim() }),
      });

      const data = await response.json();

      if(data.success) {
        setMessage(`✅ ${data.message}`);
        setSearchPrompt('');
        // Reload page after 2 seconds to show new products
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Error scraping:', error);
      setMessage('❌ An error occurred while scraping. Please try again.');
    } finally {
      setIsScraping(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form 
        className="flex flex-wrap gap-4 mt-12" 
        onSubmit={handleSearch}
      >
        <input 
          type="text"
          value={searchPrompt}
          onChange={(e) => {
            setSearchPrompt(e.target.value);
            setMessage('');
          }}
          placeholder="Enter product name (e.g., laptop, phone, headphones)"
          className="searchbar-input flex-1 min-w-[200px]"
        />

        <button 
          type="button"
          onClick={handleScrape}
          disabled={searchPrompt === '' || isScraping}
          className="searchbar-btn bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
        >
          {isScraping ? 'Scraping...' : 'Scrape from Amazon'}
        </button>

        <button 
          type="submit" 
          className="searchbar-btn"
          disabled={searchPrompt === ''}
        >
          Search Stored
        </button>
      </form>
      {message && (
        <p className={`text-sm mt-2 ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

export default Searchbar