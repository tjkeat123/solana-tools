import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import { SearchPage, DataExplorerPage } from './pages';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/data" element={<DataExplorerPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
