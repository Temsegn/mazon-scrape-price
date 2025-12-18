"use client"

import { useEffect, useState } from 'react'

const BackgroundJobStarter = () => {
  const [status, setStatus] = useState<'starting' | 'running' | 'stopped'>('stopped');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Automatically start the background scraper when component mounts
    startBackgroundJob();
  }, []);

  const startBackgroundJob = async () => {
    try {
      setStatus('starting');
      setMessage('Starting background scraper...');

      const response = await fetch('/api/start-scraper', {
        method: 'GET',
      });

      const data = await response.json();

      if (data.success) {
        setStatus('running');
        setMessage('✅ Background scraper is running! Discovering products every 3 minutes.');
      } else {
        setStatus('stopped');
        setMessage('❌ Failed to start background scraper');
      }
    } catch (error) {
      console.error('Error starting background job:', error);
      setStatus('stopped');
      setMessage('❌ Error starting background scraper');
    }
  };

  return (
    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          status === 'running' ? 'bg-green-500 animate-pulse' : 
          status === 'starting' ? 'bg-yellow-500' : 
          'bg-gray-400'
        }`}></div>
        <p className="text-sm text-gray-700">
          {message || 'Background scraper status: ' + status}
        </p>
      </div>
    </div>
  );
};

export default BackgroundJobStarter;

