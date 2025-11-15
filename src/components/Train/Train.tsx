import React, { useState, useEffect } from "react";
import PuzzleCard from "./PuzzleCard";
import ProgressBar from "./ProgressBar";
import { usePuzzles } from "../../hooks/usePuzzles";
import { auth, savePuzzleResult, getUserPuzzlesSolvedCount } from "../../lib/firebaseClient";
import { onAuthStateChanged, User } from "firebase/auth";

// Constants
const THEME_ID = "advancedpawn";
const PUZZLE_BATCH_SIZE = 10;

export default function Train() {
  const [current, setCurrent] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  const { puzzles, loading, error } = usePuzzles(THEME_ID, PUZZLE_BATCH_SIZE);
  
  const puzzleCount = puzzles.length;
  const progress = puzzleCount > 0 ? ((solvedCount / puzzleCount) * 100) : 0;

  // Track auth state and load user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const count = await getUserPuzzlesSolvedCount(currentUser.uid);
        setSolvedCount(count);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (error) {
      setMessage(`Data Error: ${error}`);
    }
  }, [error]);

  const handleSolve = async (correct: boolean) => {
    setIsSolving(true);
    
    if (correct && user && puzzles[current]) {
      try {
        const puzzle = puzzles[current];
        await savePuzzleResult(user.uid, puzzle, correct);
        
        setMessage("✅ Correct! Moving to next puzzle...");
        
        // Update local solved count
        setSolvedCount(prev => prev + 1);
        
        setTimeout(() => {
          nextPuzzle();
          setMessage('');
          setIsSolving(false);
        }, 1500);

      } catch (error) {
        setMessage("❌ Error saving your progress. Please try again.");
        setIsSolving(false);
      }
    } else {
      if (correct) {
        setMessage("✅ Correct! Puzzle Solved. Moving to next puzzle...");
        setSolvedCount(prev => prev + 1);
        
        setTimeout(() => {
          nextPuzzle();
          setMessage('');
          setIsSolving(false);
        }, 1500);
      } else {
        setMessage("❌ Incorrect. Review the board or show solution.");
        setIsSolving(false);
      }
    }
  };

  const nextPuzzle = () => {
    if (current + 1 < puzzleCount) {
      setCurrent(current + 1);
    } else {
      setMessage(`🎉 Batch Complete! Solved ${solvedCount} / ${puzzleCount} puzzles.`);
      setCurrent(0);
      setIsSolving(false);
    }
  };

  const currentPuzzle = puzzles[current];

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>Train Mode</h1>
        <p>Loading puzzles from Firestore... (Limiting fetch to {PUZZLE_BATCH_SIZE})</p>
      </div>
    );
  }

  if (error || !currentPuzzle) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: 'red' }}>
        <h1>Train Mode Error</h1>
        <p>{message || "No puzzles found or data failed to load."}</p>
        <p>Theme ID: {THEME_ID}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Train Mode: {currentPuzzle.theme}</h1>
      {user && (
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          Total Solved: <strong>{solvedCount}</strong>
        </p>
      )}
      <ProgressBar progress={progress} solvedCount={solvedCount} total={puzzleCount} />
      
      {message && (
        <p style={{ 
            color: message.startsWith("✅") ? 'green' : (message.includes("Error") ? 'red' : 'darkorange'), 
            fontWeight: 'bold', 
            fontSize: '1.1rem' 
        }}>
          {message}
        </p>
      )}

      <PuzzleCard 
        key={currentPuzzle.id}
        puzzle={currentPuzzle} 
        onSolve={handleSolve} 
        onNext={nextPuzzle}
        puzzleIndex={current + 1}
        totalPuzzles={puzzleCount}
        solvedCount={solvedCount}
      />
    </div>
  );
}