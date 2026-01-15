'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NewsMatch {
  id: string;
  eventTicker: string | null;
  marketTicker: string | null;
  relevanceScore: number;
  matchedAt: Date;
}

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  description: string | null;
  matches?: NewsMatch[];
}

interface NewsArticleCardProps {
  article: NewsArticle;
  showMatches?: boolean;
  compact?: boolean;
}

export default function NewsArticleCard({ 
  article, 
  showMatches = true,
  compact = false 
}: NewsArticleCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (date: Date | string) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d);
    } catch {
      return '';
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.85) return 'text-green-500';
    if (score >= 0.75) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const contentPreview = article.description || article.content.substring(0, 200);
  const hasMoreContent = article.content.length > 200;

  return (
    <div className="bg-[var(--card-background)] rounded-lg border border-[var(--border)] hover:border-yellow-500/50 transition-colors overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {article.imageUrl && !compact && (
          <div className="md:w-48 md:flex-shrink-0">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-48 md:h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="flex-1 p-4 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-yellow-500">
                {article.source}
              </span>
              {article.category && (
                <span className="text-xs px-2 py-1 rounded bg-[var(--background)] text-[var(--text-secondary)]">
                  {article.category}
                </span>
              )}
            </div>
            <span className="text-xs text-[var(--text-secondary)]">
              {formatDate(article.publishedAt)}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 line-clamp-2">
            {article.title}
          </h3>

          {article.author && (
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              By {article.author}
            </p>
          )}

          <p className="text-[var(--text-secondary)] text-sm mb-4">
            {expanded ? article.content : contentPreview}
            {hasMoreContent && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-2 text-yellow-500 hover:underline"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </p>

          {showMatches && article.matches && article.matches.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Related Markets:
              </p>
              <div className="flex flex-wrap gap-2">
                {article.matches.slice(0, 5).map((match) => (
                  <Link
                    key={match.id}
                    href={match.marketTicker ? `/market/${match.marketTicker}` : `/event/${match.eventTicker}`}
                    className="text-xs px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors"
                  >
                    <span className="text-yellow-500">
                      {match.marketTicker || match.eventTicker}
                    </span>
                    <span className={`ml-1 ${getRelevanceColor(match.relevanceScore)}`}>
                      {Math.round(match.relevanceScore * 100)}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-yellow-500 hover:underline flex items-center gap-1"
            >
              Read full article
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

