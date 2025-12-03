'use client';

import { useState, useEffect } from 'react';
import { fetchEvents, Event } from '../lib/api';
import EventDetailsModal from './EventDetailsModal';

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventTicker, setSelectedEventTicker] = useState<string | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch events with nested markets and filter by active status
        const data = await fetchEvents(200, {
          status: 'active',
          withNestedMarkets: true,
        });
        // Additional client-side filtering for safety
        const activeEvents = data.filter((event) => {
          // Check if event has markets and filter by market status
          if (event.markets && event.markets.length > 0) {
            // Keep event if it has at least one active market
            return event.markets.some(
              (market: any) =>
                market.status !== 'finalized' &&
                market.status !== 'resolved' &&
                market.status !== 'closed' &&
                market.status === 'active'
            );
          }
          // If no markets info, include the event (will be filtered when details load)
          return true;
        });
        setEvents(activeEvents);
      } catch (err: any) {
        setError(err.message || 'Failed to load events');
        console.error('Error loading events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const handleEventClick = (eventTicker: string) => {
    setSelectedEventTicker(eventTicker);
  };

  const handleCloseModal = () => {
    setSelectedEventTicker(null);
  };

  if (loading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-6 text-white">
          Events
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-36 bg-gray-800/50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-6 text-white">
          Events
        </h2>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            Events
          </h2>
          <span className="px-3 py-1 bg-fuchsia-500/20 text-fuchsia-400 text-sm font-medium rounded-lg border border-fuchsia-500/30">
            {events.length} active
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No events found</p>
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={event.ticker || index}
                onClick={() => handleEventClick(event.ticker)}
                className="group p-5 bg-gray-800/30 border border-gray-800 rounded-xl hover:border-violet-500/50 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer"
              >
                <div className="mb-3">
                  <p className="text-xs font-mono text-gray-500 mb-2">
                    {event.ticker}
                  </p>
                  <h3 className="font-semibold text-lg text-white mb-2 group-hover:text-violet-300 transition-colors">
                    {event.title || 'Untitled Event'}
                  </h3>
                  {event.subtitle && (
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {event.subtitle}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                  <span className="text-xs text-gray-500 group-hover:text-violet-400 transition-colors">
                    Click to view details
                  </span>
                  <svg className="w-4 h-4 text-gray-500 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedEventTicker && (
        <EventDetailsModal
          eventTicker={selectedEventTicker}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
