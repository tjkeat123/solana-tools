import React, { useState } from 'react';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Enter wallet address or Solana SNS domain",
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Basic validation for wallet addresses and SNS domains
  const validateInput = (input: string): boolean => {
    const trimmedInput = input.trim();
    
    // Check if it's a Solana SNS domain (.sol)
    if (trimmedInput.endsWith('.sol')) {
      return trimmedInput.length > 4 && /^[a-zA-Z0-9-_.]+\.sol$/.test(trimmedInput);
    }
    
    // Check if it's a Solana wallet address (base58, typically 44 characters)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedInput)) {
      return true;
    }
    
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Please enter a wallet address or SNS domain');
      return;
    }

    if (!validateInput(trimmedQuery)) {
      setError('Please enter a valid Solana wallet address or SNS domain');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      // Call the backend API
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} ${response.statusText}${errorData.error ? ` - ${errorData.error}` : ''}`);
      }

      const data = await response.json();
      
      // Display success message if available
      if (data.success && data.message) {
        setSuccessMessage(data.message);
      }
      
      // Call the optional onSearch callback
      if (onSearch) {
        onSearch(trimmedQuery);
      }

      console.log('Search results:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    // Clear error and success messages when user starts typing
    if (error) {
      setError(null);
    }
    if (successMessage) {
      setSuccessMessage(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col">
                 <form onSubmit={handleSubmit} className="relative">
           <div className="relative">
             <input
               type="text"
               value={query}
               onChange={handleInputChange}
               placeholder={placeholder}
               className="w-full px-4 py-3 pr-12 text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
               disabled={isLoading}
             />
             <button
               type="submit"
               disabled={isLoading || !query.trim()}
               className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
             >
               {isLoading ? (
                 <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                   <circle
                     className="opacity-25"
                     cx="12"
                     cy="12"
                     r="10"
                     stroke="currentColor"
                     strokeWidth="4"
                   />
                   <path
                     className="opacity-75"
                     fill="currentColor"
                     d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                   />
                 </svg>
               ) : (
                 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     strokeWidth={2}
                     d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                   />
                 </svg>
               )}
             </button>
           </div>
         </form>
         
         {/* Reserved space for messages - prevents layout shift */}
         <div className="mt-2 min-h-[2.5rem]">
           {error ? (
             <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
               {error}
             </div>
           ) : successMessage ? (
             <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-2">
               {successMessage}
             </div>
           ) : (
             <div className="text-xs text-gray-500">
               Supports Solana wallet addresses and SNS domains (e.g., god.sol)
             </div>
           )}
         </div>

      </div>
    </div>
  );
};

export default SearchBar;

