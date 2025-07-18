"use client";

import React, { useState, useEffect } from 'react';
import { GlassCard } from '../ui/enhanced-card';
import { EnhancedButton } from '../ui/enhanced-button';
import { api } from '~/trpc/react';

export default function SecureComms() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  
  // Fetch real data from intelligence feed and crises
  const { data: intelligenceData } = api.sdi.getIntelligenceFeed.useQuery({ limit: 3 });
  const { data: activeCrises } = api.sdi.getActiveCrises.useQuery();
  const { data: systemStatus } = api.sdi.getSystemStatus.useQuery();
  
  useEffect(() => {
    const realMessages = [];
    
    // Add system status message
    if (systemStatus) {
      realMessages.push({
        id: 'system-status',
        sender: 'SDI Command',
        content: `System operational. ${systemStatus.activeCrises} active crises, ${systemStatus.intelligenceItems} intelligence items monitored.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
    
    // Add recent intelligence as messages
    if (intelligenceData?.data) {
      intelligenceData.data.slice(0, 2).forEach((item, index) => {
        realMessages.push({
          id: `intel-${item.id}`,
          sender: item.category === 'crisis' ? 'Crisis Management' : 
                  item.category === 'diplomatic' ? 'Diplomatic Matrix' : 
                  'Intelligence Center',
          content: `${item.category.toUpperCase()}: ${item.title}`,
          timestamp: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      });
    }
    
    // Add crisis alerts
    if (activeCrises) {
      activeCrises.slice(0, 1).forEach((crisis) => {
        realMessages.push({
          id: `crisis-${crisis.id}`,
          sender: 'Crisis Management',
          content: `${crisis.severity.toUpperCase()} ALERT: ${crisis.title}. Status: ${crisis.responseStatus}`,
          timestamp: new Date(crisis.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      });
    }
    
    setMessages(realMessages);
  }, [intelligenceData, activeCrises, systemStatus]);

  function handleSend() {
    if (!input.trim()) return;
    setMessages([
      ...messages,
      {
        id: messages.length + 1,
        sender: 'You',
        content: input,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
  }

  return (
    <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-6 flex flex-col h-full min-h-[350px] animate-fade-in">
      <h2 className="text-2xl font-bold mb-4 text-blue-100 diplomatic-header">Secure Communications</h2>
      <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-3 py-2 ${msg.sender === 'You' ? 'glass-card bg-blue-500/30 text-blue-100 self-end ml-auto' : 'glass-card-diplomatic bg-blue-800/40 text-blue-100'}`}
            style={{ maxWidth: '80%', alignSelf: msg.sender === 'You' ? 'flex-end' : 'flex-start' }}
          >
            <div className="text-xs font-semibold mb-1 flex items-center gap-2 text-blue-200">
              {msg.sender}
              <span className="text-blue-300 font-normal">{msg.timestamp}</span>
            </div>
            <div className="text-sm text-blue-100">{msg.content}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-auto">
        <input
          type="text"
          className="flex-1 rounded-lg glass-input px-3 py-2 text-sm text-blue-100 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-700"
          placeholder="Type a secure message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
        />
        <EnhancedButton glass glow onClick={handleSend} className="rounded-lg px-4 py-2 text-blue-100 font-semibold border border-blue-500 shadow">
          Send
        </EnhancedButton>
      </div>
    </GlassCard>
  );
} 