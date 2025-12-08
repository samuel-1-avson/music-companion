import React from 'react';
import { ICONS } from '../constants';
import { AppView, SpotifyProfile } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  spotifyProfile?: SpotifyProfile | null;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, spotifyProfile }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: ICONS.Dashboard },
    { id: AppView.CHAT, label: 'Chat Assistant', icon: ICONS.MessageSquare },
    { id: AppView.LIVE, label: 'Live Mode', icon: ICONS.Live },
    { id: AppView.SETTINGS, label: 'Settings', icon: ICONS.Settings },
  ];

  return (
    <div className="w-64 bg-white border-r-2 border-black flex flex-col h-screen fixed left-0 top-0 z-10">
      <div className="p-6 flex items-center space-x-3 border-b-2 border-black">
        <div className="w-10 h-10 bg-black rounded-none flex items-center justify-center shadow-retro-sm border-2 border-black">
          <ICONS.Music className="text-white w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight font-mono">Music<span className="text-orange-500">Comp</span></h1>
      </div>

      <nav className="flex-1 px-4 space-y-3 mt-6">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 border-2 transition-all duration-200 ${
              currentView === item.id 
                ? 'bg-orange-400 text-black border-black shadow-retro-sm translate-x-[-2px] translate-y-[-2px]' 
                : 'bg-white text-gray-600 border-transparent hover:border-black hover:shadow-retro-sm hover:text-black'
            }`}
          >
            <item.icon size={20} strokeWidth={2.5} />
            <span className="font-bold font-mono">{item.label}</span>
          </button>
        ))}
        
        {/* Focus Mode Button */}
        <button
            onClick={() => onChangeView(AppView.FOCUS)}
            className={`w-full flex items-center space-x-3 px-4 py-3 border-2 transition-all duration-200 mt-8 ${
              currentView === AppView.FOCUS
                ? 'bg-black text-white border-black shadow-retro-sm' 
                : 'bg-gray-100 text-gray-600 border-transparent hover:border-gray-400 hover:text-black'
            }`}
          >
            <div className="relative">
                <ICONS.Play size={20} strokeWidth={2.5} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
            </div>
            <span className="font-bold font-mono">Focus Mode</span>
        </button>
      </nav>

      <div className="p-4 border-t-2 border-black bg-[#f3f0e8] space-y-4">
        {spotifyProfile ? (
           <div className="bg-white p-3 border-2 border-black shadow-retro-sm flex items-center space-x-3">
             <div className="w-10 h-10 bg-gray-200 border border-black overflow-hidden flex-shrink-0">
               {spotifyProfile.images?.[0]?.url ? (
                 <img src={spotifyProfile.images[0].url} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-gray-300">
                    <ICONS.User size={20} className="text-gray-500" />
                 </div>
               )}
             </div>
             <div className="overflow-hidden">
               <p className="text-[10px] font-bold text-gray-500 font-mono uppercase">CONNECTED_AS</p>
               <p className="text-sm font-bold truncate">{spotifyProfile.display_name}</p>
             </div>
           </div>
        ) : (
          <div className="bg-white p-4 border-2 border-black shadow-retro-sm">
            <p className="text-xs text-gray-500 font-bold font-mono mb-2 uppercase tracking-wider">Status</p>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 border-2 border-black bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-bold">System Online</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
