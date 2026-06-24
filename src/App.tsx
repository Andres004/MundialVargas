// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://spulkmtcpxjxqcolkiuo.supabase.co', 'sb_publishable_OGy26eyySr3gpRsKC1imtA_iOzL_0Hm');

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('pollaUser') || '');
  const [nameInput, setNameInput] = useState('');
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    if (user) {
      fetchApiMatches();
      fetchPredictions();
    }
  }, [user]);

  const fetchApiMatches = async () => {
    // Simulación de la API con escudos reales de internet
    const apiData = [
      { id: 101, homeTeam: { name: 'Bolivia', crest: 'https://crests.football-data.org/735.svg' }, awayTeam: { name: 'Argentina', crest: 'https://crests.football-data.org/762.png' }, score: { fullTime: { home: null, away: null } }, status: 'SCHEDULED' },
      { id: 102, homeTeam: { name: 'Brasil', crest: 'https://crests.football-data.org/764.svg' }, awayTeam: { name: 'Colombia', crest: 'https://crests.football-data.org/733.png' }, score: { fullTime: { home: 1, away: 1 } }, status: 'IN_PLAY' },
      { id: 103, homeTeam: { name: 'España', crest: 'https://crests.football-data.org/760.svg' }, awayTeam: { name: 'Alemania', crest: 'https://crests.football-data.org/759.svg' }, score: { fullTime: { home: 2, away: 1 } }, status: 'FINISHED' }
    ];
    setMatches(apiData);
  };

  const fetchPredictions = async () => {
    const { data: p } = await supabase.from('predictions').select('*');
    if (p) setPredictions(p);
  };

  const login = async (e) => {
    e.preventDefault();
    if (!nameInput) return;
    await supabase.from('users').upsert({ name: nameInput });
    localStorage.setItem('pollaUser', nameInput);
    setUser(nameInput);
  };

  const predict = async (matchId, home, away) => {
    await supabase.from('predictions').upsert({
      user_name: user, match_id: matchId, home_score: parseInt(home), away_score: parseInt(away)
    }, { onConflict: 'user_name, match_id' });
    fetchPredictions();
    alert('¡Predicción guardada! 🍀');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-emerald-500/20 w-full max-w-md">
          <div className="text-center mb-8">
            <span className="text-5xl mb-2 block">🏆</span>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">La Polla Mundialista</h1>
          </div>
          <input 
            type="text" placeholder="Tu nombre..." required
            className="w-full bg-slate-800 text-white px-5 py-4 rounded-xl mb-4 outline-none border border-slate-700 focus:border-emerald-500 transition-all font-bold text-center"
            value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          />
          <button type="submit" className="w-full bg-emerald-500 text-slate-950 font-black py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all text-lg">
            ENTRAR A JUGAR
          </button>
        </form>
      </div>
    );
  }

  const pot = predictions.length * 3;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-10">
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 p-4 md:p-6 flex justify-between items-center border-b border-white/10 shadow-xl">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white">🏆 Polla Familiar</h1>
          <p className="text-emerald-400 text-xs font-bold">Jugador: <span className="text-white bg-white/10 px-2 py-0.5 rounded">{user}</span></p>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-xl border border-emerald-500/20 text-center">
          <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Pozo</p>
          <p className="text-xl md:text-2xl font-black text-amber-400">{pot} Bs</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-8 grid gap-6 md:grid-cols-2">
        {matches.map(m => {
          const myP = predictions.find(p => p.match_id === m.id && p.user_name === user);
          const isFinished = m.status === 'FINISHED';
          const isLive = m.status === 'IN_PLAY';
          
          return (
            <div key={m.id} className="bg-slate-900 rounded-3xl p-6 border border-white/5 relative shadow-xl overflow-hidden">
              {isLive && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-4 py-1 animate-pulse rounded-bl-xl">EN VIVO</div>}
              {isFinished && <div className="absolute top-0 right-0 bg-slate-700 text-slate-300 text-[10px] font-black px-4 py-1 rounded-bl-xl">FINAL</div>}
              
              <div className="flex justify-between items-center mt-2 mb-4">
                <div className="flex flex-col items-center w-1/3">
                  <img src={m.homeTeam.crest} className="w-12 h-12 object-contain mb-2" alt={m.homeTeam.name} />
                  <span className="font-bold text-xs text-slate-300 text-center">{m.homeTeam.name}</span>
                </div>
                
                <div className="bg-slate-950 px-3 py-2 rounded-xl font-black text-xl border border-white/5 text-center text-white">
                  {m.score.fullTime.home ?? '-'} : {m.score.fullTime.away ?? '-'}
                </div>

                <div className="flex flex-col items-center w-1/3">
                  <img src={m.awayTeam.crest} className="w-12 h-12 object-contain mb-2" alt={m.awayTeam.name} />
                  <span className="font-bold text-xs text-slate-300 text-center">{m.awayTeam.name}</span>
                </div>
              </div>

              {!isFinished ? (
                <form 
                  onSubmit={(e) => { e.preventDefault(); predict(m.id, e.target.home.value, e.target.away.value); }}
                  className="bg-slate-950/50 p-3 rounded-xl flex justify-between items-center"
                >
                  <input type="number" name="home" min="0" required defaultValue={myP?.home_score} className="w-12 bg-slate-800 rounded-lg p-1.5 text-center font-black text-white outline-none" />
                  <button type="submit" className="bg-emerald-500 text-slate-950 font-black px-4 py-1.5 rounded-lg text-xs hover:bg-emerald-400 transition-all">
                    {myP ? 'EDITAR' : 'APOSTAR'}
                  </button>
                  <input type="number" name="away" min="0" required defaultValue={myP?.away_score} className="w-12 bg-slate-800 rounded-lg p-1.5 text-center font-black text-white outline-none" />
                </form>
              ) : (
                <div className="bg-slate-950/50 p-2 rounded-xl text-center">
                  <p className="text-xs text-slate-400">Tu predicción: <span className="font-black text-emerald-400 text-sm">{myP?.home_score ?? '-'} : {myP?.away_score ?? '-'}</span></p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}