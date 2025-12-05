'use client';

import { useState } from 'react';
import { Market } from '../lib/api';
import { createMarketBlinkUrl, createBlinkUrlWithAction } from '../lib/blinkUtils';

interface ShareBlinkProps {
  market: Market;
}

export default function ShareBlink({ market }: ShareBlinkProps) {
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const blinkUrl = createMarketBlinkUrl(market.ticker);
  const dialBlinkUrl = createBlinkUrlWithAction(market.ticker);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!showShare) {
    return (
      <button
        onClick={() => setShowShare(true)}
        className="w-full px-4 py-2 bg-gray-800/50 hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium border border-gray-700 hover:border-gray-600 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share Blink
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">Share Market Blink</h4>
        <button
          onClick={() => setShowShare(false)}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Blink URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={blinkUrl}
              className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-gray-300 font-mono"
            />
            <button
              onClick={() => copyToClipboard(blinkUrl)}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Dial.to Blink</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={dialBlinkUrl}
              className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-gray-300 font-mono"
            />
            <button
              onClick={() => copyToClipboard(dialBlinkUrl)}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Share this link to let others place orders on this market directly from any wallet or app that supports Solana Actions.
          </p>
        </div>
      </div>
    </div>
  );
}

