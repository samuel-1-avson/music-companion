/**
 * Lab Module - Audio experiments and tools
 * 
 * This modular structure allows for easier maintenance and testing.
 * Individual components can be imported directly for reuse.
 */

import React, { useState } from 'react';
import { ICONS } from '../../constants';
import AmbientMixer from './AmbientMixer';
import Synthesizer from './Synthesizer';
import MasterEQ from './MasterEQ';

// Types and Constants from labTypes
export * from './labTypes';

// Individual Components
export { default as AudioVisualizer } from './AudioVisualizer';
export { default as AmbientMixer } from './AmbientMixer';
export { default as Synthesizer } from './Synthesizer';
export { default as MasterEQ } from './MasterEQ';

// Main TheLab Props
export interface TheLabProps {
  setEQBand?: (index: number, value: number) => void;
  eqValues?: number[];
  analyser?: AnalyserNode | null;
}

type TabId = 'MIXER' | 'SYNTH' | 'EQ';

const TABS: { id: TabId; icon: typeof ICONS.Sliders; label: string }[] = [
  { id: 'MIXER', icon: ICONS.Sliders, label: 'AMBIENT_MIXER' },
  { id: 'SYNTH', icon: ICONS.Piano, label: 'MONOSYNTH' },
  { id: 'EQ', icon: ICONS.Radio, label: 'MASTER_EQ' },
];

/**
 * TheLab - Main Container Component
 * Audio experiments and tools: Ambient Mixer, Synthesizer, EQ
 */
const TheLab: React.FC<TheLabProps> = ({ 
  setEQBand, 
  eqValues = [0, 0, 0, 0, 0], 
  analyser 
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('MIXER');

  return (
    <div className="p-8 space-y-8 pb-32 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end border-b-4 border-black pb-4">
        <div>
          <h2 className="text-4xl font-bold text-black mb-2 font-mono">THE_LAB</h2>
          <p className="text-gray-600 font-mono">AUDIO_EXPERIMENTS_&_TOOLS</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex space-x-2">
          {TABS.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-4 py-2 font-bold font-mono text-xs flex items-center gap-2 border-2 border-black transition-all ${
                activeTab === tab.id 
                  ? 'bg-black text-white shadow-retro-sm' 
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'MIXER' && <AmbientMixer />}
      {activeTab === 'SYNTH' && <Synthesizer />}
      {activeTab === 'EQ' && (
        <MasterEQ 
          eqValues={eqValues} 
          setEQBand={setEQBand} 
          analyser={analyser} 
        />
      )}
    </div>
  );
};

export default TheLab;
