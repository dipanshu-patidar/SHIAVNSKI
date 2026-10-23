import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const Layout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-[#090d16] text-slate-100 overflow-x-hidden">
      {/* Responsive Sidebar (Pinned on Desktop, Slide-over on Mobile/Tablet) */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar with Mobile Drawer Toggle */}
        <Navbar
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        {/* Scrollable Page Body with Responsive Padding */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
