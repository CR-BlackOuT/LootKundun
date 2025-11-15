import React, { useState, useEffect, useCallback } from 'react';
import { Player, RotationState } from './types';
import { LOOT_ITEMS, INITIAL_PLAYER_NAMES } from './constants';
import LootTable from './components/LootTable';
import PlayerManager from './components/PlayerManager';
import LootAssignmentModal from './components/LootAssignmentModal';
import { HeaderIcon } from './components/icons';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [rotation, setRotation] = useState<RotationState>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const initializeDatabase = async () => {
    console.log("Initializing database with default data...");

    const playersToInsert = INITIAL_PLAYER_NAMES.map(name => ({ name }));
    const { data: insertedPlayers, error: playerError } = await supabase
      .from('players')
      .insert(playersToInsert)
      .select();

    if (playerError || !insertedPlayers) {
      console.error('Error initializing players:', playerError);
      return { players: [], rotation: {} };
    }
    
    // Ensure consistent order
    insertedPlayers.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const rotationToInsert = LOOT_ITEMS.map(item => ({ loot_id: item.id, player_index: 0 }));
    const { data: insertedRotation, error: rotationError } = await supabase
      .from('rotation')
      .insert(rotationToInsert)
      .select();

    if (rotationError || !insertedRotation) {
      console.error('Error initializing rotation:', rotationError);
      return { players: insertedPlayers, rotation: {} };
    }
    
    const rotationState = insertedRotation.reduce((acc, curr) => {
      acc[curr.loot_id] = curr.player_index;
      return acc;
    }, {} as RotationState);

    return { players: insertedPlayers, rotation: rotationState };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: true });

    if (playersError) {
      console.error("Error fetching players:", playersError);
      setLoading(false);
      return;
    }

    if (playersData.length === 0) {
      const { players: newPlayers, rotation: newRotation } = await initializeDatabase();
      setPlayers(newPlayers);
      setRotation(newRotation);
    } else {
        setPlayers(playersData);
        const { data: rotationData, error: rotationError } = await supabase.from('rotation').select('*');
        if (rotationError) {
            console.error("Error fetching rotation:", rotationError);
        } else if (rotationData) {
            const rotationState = rotationData.reduce((acc, curr) => {
                acc[curr.loot_id] = curr.player_index;
                return acc;
            }, {} as RotationState);
            setRotation(rotationState);
        }
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addPlayer = async (name: string) => {
    if (name && !players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      const { data, error } = await supabase.from('players').insert({ name }).select().single();
      if (error) {
        console.error("Error adding player:", error);
      } else if (data) {
        setPlayers(prev => [...prev, data]);
      }
    }
  };

  const removePlayer = async (id: string) => {
    const playerIndexToRemove = players.findIndex(p => p.id === id);
    if (playerIndexToRemove === -1) return;

    const newRotation: RotationState = { ...rotation };
    LOOT_ITEMS.forEach(item => {
      const currentNextIndex = rotation[item.id];
      if (currentNextIndex > playerIndexToRemove) {
        newRotation[item.id] = currentNextIndex - 1;
      } else if (currentNextIndex === playerIndexToRemove) {
        const newPlayerCount = players.length - 1;
        newRotation[item.id] = playerIndexToRemove % Math.max(1, newPlayerCount);
      }
    });

    const rotationUpdates = Object.entries(newRotation).map(([loot_id, player_index]) => ({ loot_id, player_index }));
    
    const { error: updateError } = await supabase.from('rotation').upsert(rotationUpdates);
    if (updateError) {
        console.error("Error updating rotation:", updateError);
        return;
    }

    const { error: deleteError } = await supabase.from('players').delete().eq('id', id);
    if (deleteError) {
        console.error("Error removing player:", deleteError);
        // Potentially revert rotation changes here if needed
        return;
    }

    setPlayers(prev => prev.filter(p => p.id !== id));
    setRotation(newRotation);
  };

  const advanceRotation = async (lootItemId: string) => {
    if (players.length === 0) return;
    const newIndex = (rotation[lootItemId] + 1) % players.length;
    
    const { error } = await supabase.from('rotation').update({ player_index: newIndex }).eq('loot_id', lootItemId);

    if (error) {
        console.error("Error advancing rotation:", error);
    } else {
        setRotation(prev => ({
            ...prev,
            [lootItemId]: newIndex,
        }));
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset all data in the database? This cannot be undone.")) {
      setLoading(true);
      // It's safer to delete from rotation first, then players, although not critical with this app's logic
      await supabase.from('rotation').delete().neq('loot_id', 'dummy_id_to_delete_all');
      await supabase.from('players').delete().neq('id', 'dummy_id_to_delete_all');
      await fetchData(); // This will trigger re-initialization
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-2xl text-cyan-400 animate-pulse">Loading Guild Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-4">
            <HeaderIcon />
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              Loot Guild Kundun
            </h1>
          </div>
          <p className="text-gray-400 mt-2">Track boss loot and manage player rotation with ease.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Loot Rotation</h2>
            {players.length > 0 ? (
                <LootTable players={players} lootItems={LOOT_ITEMS} rotation={rotation} />
            ) : (
                <div className="flex items-center justify-center h-64 bg-gray-800 rounded-lg">
                    <p className="text-gray-400">Add players to get started!</p>
                </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
                 <PlayerManager players={players} onAddPlayer={addPlayer} onRemovePlayer={removePlayer} />
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700">
                <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Actions</h2>
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        disabled={players.length === 0}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 shadow-md"
                    >
                        Boss Defeated!
                    </button>
                    <button
                        onClick={handleReset}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 shadow-md"
                    >
                        Reset Data
                    </button>
                </div>
            </div>
          </div>
        </main>

        <footer className="text-center mt-12 text-gray-500 text-sm">
            <p>Built for the guild. May your drops be epic.</p>
        </footer>
      </div>

      <LootAssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lootItems={LOOT_ITEMS}
        players={players}
        rotation={rotation}
        onAdvanceRotation={advanceRotation}
      />
    </div>
  );
};

export default App;