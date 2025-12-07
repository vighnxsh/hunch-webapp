'use client';

interface CreditCardProps {
  theme: 'light' | 'dark';
  loading: boolean;
  error: string | null;
  solBalance: number | null;
  solPrice: number | null;
  tradesCount: number;
  username?: string;
}

export default function CreditCard({
  theme,
  loading,
  error,
  solBalance,
  solPrice,
  tradesCount,
  username,
}: CreditCardProps) {
  return (
    <div className="mb-6">
      <div className={`relative w-full max-w-md mx-auto aspect-[1.586/1] rounded-2xl overflow-hidden ${
        theme === 'light' 
          ? 'shadow-xl' 
          : 'shadow-2xl shadow-black/50'
      }`}>
        {/* Card Background with Gradient */}
        <div className={`absolute inset-0 ${
          theme === 'light'
            ? 'bg-gradient-to-br from-emerald-200 via-lime-300 to-green-200'
            : 'bg-gradient-to-br from-emerald-900/40 via-lime-900/40 to-green-900/40'
        }`}>
          {/* Decorative circles */}
          <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-2xl ${
            theme === 'light' ? 'bg-violet-200/40' : 'bg-white/10'
          }`} />
          <div className={`absolute -bottom-20 -left-20 w-48 h-48 rounded-full blur-3xl ${
            theme === 'light' ? 'bg-fuchsia-200/30' : 'bg-violet-400/20'
          }`} />
          <div className={`absolute top-1/2 right-1/4 w-32 h-32 rounded-full blur-2xl ${
            theme === 'light' ? 'bg-pink-200/20' : 'bg-fuchsia-300/10'
          }`} />
        </div>
        
        {/* Card Content */}
        <div className="relative h-full px-4 pb-4 pt-3 sm:px-7 sm:pb-7 sm:pt-4 flex flex-col justify-between">
          {/* Top Row - Username */}
          <div className="flex items-start justify-end">
            {username && (
              <span className={`text-sm sm:text-lg font-bold tracking-wide ${
                theme === 'light' ? 'text-yellow-700' : 'text-white/90'
              }`}>
                {username}
              </span>
            )}
          </div>
          
          {/* Middle Row - Cash Balance */}
          <div className="flex-1 flex flex-col justify-center -mt-2">
            <p className={`text-sm sm:text-sm font-medium tracking-wider uppercase mb-1 ${
              theme === 'light' ? 'text-black/80' : 'text-white/60'
            }`}>Cash Balance</p>
            <div className="flex items-baseline gap-2">
              {loading ? (
                <div className={`h-8 w-24 sm:h-12 sm:w-36 rounded animate-pulse ${
                  theme === 'light' ? 'bg-gray-300/50' : 'bg-white/20'
                }`} />
              ) : error ? (
                <span className={`text-2xl sm:text-4xl font-bold ${
                  theme === 'light' ? 'text-gray-400' : 'text-black'
                }`}>--</span>
              ) : solBalance !== null && solPrice !== null ? (
                <>
                  <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>
                    {/* ${(solBalance * solPrice).toFixed(2)} */}$ 67.02
                  </span>
                
                </>
              ) : (
                <span className={`text-2xl sm:text-4xl font-bold ${
                  theme === 'light' ? 'text-gray-700' : 'text-white/80'
                }`}>$0.00</span>
              )}
            </div>
          </div>
          
          {/* Bottom Row - Stats */}
          <div className="flex items-end justify-between">
            {/* Total Trades */}
            <div>
              <p className={`text-[10px] sm:text-xs font-medium tracking-wider uppercase mb-0.5 ${
                theme === 'light' ? 'text-gray-700' : 'text-white/90'
              }`}>Total Bets</p>
              <span className={`font-semibold text-base sm:text-xl ${
                theme === 'light' ? 'text-gray-700' : 'text-white'
              }`}>23</span>
            </div>
            
            {/* PnL */}
            <div className="text-right">
              <p className={`text-sm sm:text-lg font-medium tracking-wider uppercase mb-0.5 ${
                theme === 'light' ? 'text-gray-700' : 'text-white/60'
              }`}>P&L</p>
              <div className="flex items-center justify-end gap-1.5">
                <span className={`text-lg sm:text-2xl font-bold ${
                  theme === 'light' ? 'text-red-500' : 'text-white'
                }`}>-12.2%</span>
              
              </div>
            </div>
          </div>
        </div>
        
        {/* Texture Overlay */}
        <div 
          className="absolute inset-0 opacity-60 pointer-events-none mix-blend-overlay" 
          style={{
            backgroundImage: `url("/texture.jpeg")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} 
        />
        
        {/* Shine Effect */}
        <div className={`absolute inset-0 pointer-events-none ${
          theme === 'light'
            ? 'bg-gradient-to-tr from-transparent via-white/30 to-white/50'
            : 'bg-gradient-to-tr from-transparent via-white/5 to-white/10'
        }`} />
        
        {/* Light theme border */}
        {theme === 'light' && (
          <div className="absolute inset-0 rounded-2xl border border-gray-200/50 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

