"use client"

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

const Searchbar = () => {
  const [searchPrompt, setSearchPrompt] = useState('');
  const router = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if(!searchPrompt.trim()) return;

    // Navigate to homepage with search query
    // The ProductFilter component will handle the search
    router.push(`/?search=${encodeURIComponent(searchPrompt.trim())}`);
  }

  return (
    <form 
      className="flex flex-wrap gap-4 mt-12" 
      onSubmit={handleSubmit}
    >
      <input 
        type="text"
        value={searchPrompt}
        onChange={(e) => setSearchPrompt(e.target.value)}
        placeholder="Search stored products (e.g., laptop, phone, headphones)"
        className="searchbar-input"
      />

      <button 
        type="submit" 
        className="searchbar-btn"
        disabled={searchPrompt === ''}
      >
        Search Products
      </button>
    </form>
  )
}

export default Searchbar