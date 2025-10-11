import React from 'react';
import SearchBar from '../components/SearchBar';

const SearchPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <div className="w-full max-w-2xl">
        <SearchBar />
      </div>
    </div>
  );
};

export default SearchPage;
