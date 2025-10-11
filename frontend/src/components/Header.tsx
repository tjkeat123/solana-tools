import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Search', href: '/', current: location.pathname === '/' },
    { name: 'Data Explorer', href: '/data', current: location.pathname === '/data' },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-gray-900">Solana Tracer</h1>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  item.current
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right side - could add user menu, settings, etc. */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Connected to Solana</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
