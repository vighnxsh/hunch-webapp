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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Events
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Events
        </h2>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Events ({events.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.length === 0 ? (
            <div className="col-span-full">
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                No events found
              </p>
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={event.ticker || index}
                onClick={() => handleEventClick(event.ticker)}
                className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer hover:shadow-md"
              >
                <div className="mb-2">
                  <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-1">
                    {event.ticker}
                  </p>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                    {event.title || 'Untitled Event'}
                  </h3>
                  {event.subtitle && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {event.subtitle}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click to view details →
                  </p>
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

