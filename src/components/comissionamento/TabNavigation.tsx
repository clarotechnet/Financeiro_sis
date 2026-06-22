import React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export const TabNavigation: React.FC<Props> = ({ tabs, activeTab, onTabChange }) => (
  <div className="flex gap-1 p-1.5 rounded-xl bg-muted/40 border border-border">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
          activeTab === tab.id
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
