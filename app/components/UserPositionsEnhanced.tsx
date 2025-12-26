'use client';

import { useState, useEffect } from 'react';
import PositionCard from './PositionCard';
import type { AggregatedPosition } from '../lib/positionService';

interface UserPositionsEnhancedProps {
  userId: string;
}

interface PositionsData {
  active: AggregatedPosition[];
  previous: AggregatedPosition[];
}

interface PositionStats {
  totalProfitLoss: number;
  totalPositions: number;
  activePositions: number;
  winningPositions: number;
  losingPositions: number;
  winRate: number;
}

export default function UserPositionsEnhanced({ userId }: UserPositionsEnhancedProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'previous'>('active');
  const [positions, setPositions] = useState<PositionsData>({ active: [], previous: [] });
  const [stats, setStats] = useState<PositionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPositions();
  }, [userId]);

  const loadPositions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/positions?userId=${userId}&includeStats=true`);
      
      if (!response.ok) {
        throw new Error('Failed to load positions');
      }

      const data = await response.json();
      setPositions(data.positions);
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load positions');
      console.error('Error loading positions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Get P&L color class
  const getPLColorClass = (value: number) => {
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-[var(--text-secondary)]';
  };

  const activePositions = positions.active || [];
  const previousPositions = positions.previous || [];
  const displayedPositions = activeTab === 'active' ? activePositions : previousPositions;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Loading positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30">
        <p className="text-red-400 text-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Total P&L</div>
            <div className={`text-lg font-bold ${getPLColorClass(stats.totalProfitLoss)}`}>
              {formatCurrency(stats.totalProfitLoss)}
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Active Positions</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {stats.activePositions}
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Win Rate</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {stats.winRate.toFixed(1)}%
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Total Positions</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {stats.totalPositions}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'active'
              ? 'text-cyan-400'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Active Positions
          {activePositions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">
              {activePositions.length}
            </span>
          )}
          {activeTab === 'active' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('previous')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'previous'
              ? 'text-cyan-400'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Previous Positions
          {previousPositions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--border-color)] text-[var(--text-secondary)] text-xs">
              {previousPositions.length}
            </span>
          )}
          {activeTab === 'previous' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
          )}
        </button>
      </div>

      {/* Positions List */}
      {displayedPositions.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-[var(--text-secondary)] text-sm">
            {activeTab === 'active' 
              ? 'No active positions yet. Start trading to see your positions here!'
              : 'No previous positions to display.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayedPositions.map((position, index) => (
            <PositionCard key={`${position.marketTicker}-${position.side}-${index}`} position={position} />
          ))}
        </div>
      )}
    </div>
  );
}

