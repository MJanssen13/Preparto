import React from 'react';
import { Activity, PlusCircle, Settings, Clock, BedDouble } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-medical-600' : 'text-slate-400';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Bar for Desktop/Mobile Branding */}
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-medical-500 p-1.5 rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Materno<span className="text-medical-500">Care</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className={`text-sm font-medium hover:text-medical-600 ${location.pathname === '/' ? 'text-medical-600 font-bold' : 'text-slate-500'}`}>Cronograma</Link>
            <Link to="/patients" className={`text-sm font-medium hover:text-medical-600 ${location.pathname === '/patients' ? 'text-medical-600 font-bold' : 'text-slate-500'}`}>Pacientes</Link>
            <div className="h-8 w-8 bg-medical-100 rounded-full flex items-center justify-center text-medical-700 font-bold ml-4">
              D
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 mb-20 md:mb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/')}`}>
          <Clock className="h-6 w-6" />
          <span className="text-[10px] font-medium">Cronograma</span>
        </Link>
        <Link to="/patients" className={`flex flex-col items-center gap-1 ${isActive('/patients')}`}>
          <BedDouble className="h-6 w-6" />
          <span className="text-[10px] font-medium">Pacientes</span>
        </Link>
        <Link to="/admission" className={`flex flex-col items-center gap-1 ${isActive('/admission')}`}>
          <div className="bg-medical-50 rounded-full p-1 -mt-4 border-4 border-slate-50 shadow-sm">
             <PlusCircle className="h-8 w-8 text-medical-600" />
          </div>
          <span className="text-[10px] font-medium text-medical-700">Admitir</span>
        </Link>
        <button className="flex flex-col items-center gap-1 text-slate-300">
          <Settings className="h-6 w-6" />
          <span className="text-[10px] font-medium">Config</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;