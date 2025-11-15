// src/components/Openings/OpeningExplorer.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Alert,
  Tabs,
  Tab
} from "@mui/material";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";

const Chessboard = dynamic(() => import("react-chessboard").then(mod => mod.Chessboard), {
  ssr: false
});

interface OpeningExplorerProps {
  opening: any;
  onExit?: () => void;
}

interface MoveTree {
  move: string;
  san: string;
  frequency: number;
  winRate: number;
  children: MoveTree[];
}

export default function OpeningExplorer({ opening, onExit }: OpeningExplorerProps) {
  const [game, setGame] = useState(new Chess());
  const [position, setPosition] = useState("start");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [moveTree, setMoveTree] = useState<MoveTree[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  useEffect(() => {
    generateMoveTree();
    resetToOpening();
  }, [opening]);

  const generateMoveTree = useCallback(() => {
    // This would typically come from an opening database API
    // For now, we'll generate a simple tree from the main variation
    const moves = opening.moves.split(' ').filter((move: string) => move.trim() && !move.includes('.'));
    
    const tree: MoveTree[] = [];
    let currentLevel = tree;

    moves.forEach((move: string, index: number) => {
      const moveNode: MoveTree = {
        move,
        san: move,
        frequency: Math.max(50, 100 - index * 10), // Simulate frequency data
        winRate: 45 + Math.random() * 10, // Simulate win rate
        children: []
      };

      currentLevel.push(moveNode);
      
      // Occasionally add alternative moves
      if (index % 2 === 0 && index < moves.length - 1) {
        const alternatives = ['Nc3', 'Bc4', 'd3', 'c3'].filter(alt => alt !== move);
        alternatives.forEach(alt => {
          moveNode.children.push({
            move: alt,
            san: alt,
            frequency: Math.max(10, 30 - index * 5),
            winRate: 40 + Math.random() * 15,
            children: []
          });
        });
      }

      currentLevel = moveNode.children;
    });

    setMoveTree(tree);
  }, [opening]);

  const resetToOpening = useCallback(() => {
    const newGame = new Chess();
    const moves = opening.moves.split(' ').filter((move: string) => move.trim() && !move.includes('.'));
    
    moves.forEach(move => {
      try {
        newGame.move(move);
      } catch {
        // Skip invalid moves
      }
    });

    setGame(newGame);
    setPosition(newGame.fen());
    setMoveHistory(moves);
    setSelectedSquare(null);
    setPossibleMoves([]);
  }, [opening]);

  const onSquareClick = useCallback((square: string) => {
    const gameCopy = new Chess(game.fen());
    
    // If no square is selected yet, select this square and show possible moves
    if (!selectedSquare) {
      const piece = gameCopy.get(square);
      if (piece) {
        setSelectedSquare(square);
        const moves = gameCopy.moves({ square, verbose: true });
        setPossibleMoves(moves.map(move => move.to));
      }
      return;
    }

    // If clicking on the same square, deselect it
    if (square === selectedSquare) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    // If clicking on a different square, try to make a move
    try {
      const move = gameCopy.move({
        from: selectedSquare,
        to: square,
        promotion: "q",
      });

      if (move) {
        setGame(gameCopy);
        setPosition(gameCopy.fen());
        setMoveHistory(prev => [...prev, move.san]);
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    } catch (error) {
      console.error('Invalid move:', error);
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }, [game, selectedSquare]);

  const onSquareRightClick = useCallback((square: string) => {
    setSelectedSquare(null);
    setPossibleMoves([]);
  }, []);

  const customSquareStyles = useCallback(() => {
    const styles: any = {};
    
    // Highlight selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)'
      };
    }
    
    // Highlight possible moves
    possibleMoves.forEach(move => {
      styles[move] = {
        backgroundColor: 'rgba(0, 255, 0, 0.4)'
      };
    });
    
    return styles;
  }, [selectedSquare, possibleMoves]);

  const goBack = useCallback(() => {
    if (moveHistory.length > 0) {
      const newGame = new Chess();
      const newMoveHistory = moveHistory.slice(0, -1);
      
      newMoveHistory.forEach(move => {
        try {
          newGame.move(move);
        } catch {
          // Skip invalid moves
        }
      });

      setGame(newGame);
      setPosition(newGame.fen());
      setMoveHistory(newMoveHistory);
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }, [moveHistory]);

  const getCurrentMoveOptions = useCallback(() => {
    const currentMoves = game.moves();
    return currentMoves.map(move => ({
      move,
      san: move,
      frequency: 25 + Math.random() * 50, // Simulated data
      winRate: 40 + Math.random() * 20,
      children: []
    }));
  }, [game]);

  const getWinRateColor = (winRate: number) => {
    if (winRate > 55) return 'success';
    if (winRate > 45) return 'warning';
    return 'error';
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Opening Explorer: {opening.name}
        </Typography>
        <Button variant="outlined" onClick={onExit}>
          Back to Study
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Chessboard and Move History */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
              <Chessboard
                position={position}
                onSquareClick={onSquareClick}
                onSquareRightClick={onSquareRightClick}
                boardWidth={350}
                customBoardStyle={{
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                }}
                customSquareStyles={customSquareStyles()}
                arePiecesDraggable={false}
              />
            </Box>

            <Box display="flex" gap={1} justifyContent="center" mb={2}>
              <Button variant="outlined" onClick={resetToOpening}>
                Reset to Start
              </Button>
              <Button variant="text" onClick={goBack} disabled={moveHistory.length === 0}>
                ← Back
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
              Click to select piece, then click destination
            </Typography>

            {/* Move History */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Move History
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <Typography variant="body2" fontFamily="monospace">
                    {moveHistory.map((move, index) => (
                      <span key={index}>
                        {index % 2 === 0 && <strong>{Math.floor(index/2) + 1}.</strong>}
                        <span style={{ 
                          marginLeft: index % 2 === 0 ? '4px' : '8px',
                          color: index === moveHistory.length - 1 ? 'primary.main' : 'inherit'
                        }}>
                          {move}
                        </span>
                        {index < moveHistory.length - 1 && ' '}
                      </span>
                    ))}
                    {moveHistory.length === 0 && 'No moves played yet'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Paper>
        </Grid>

        {/* Right Column - Move Explorer */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
              <Tab label="Next Moves" />
              <Tab label="Full Tree" />
              <Tab label="Statistics" />
            </Tabs>

            {activeTab === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Recommended Next Moves
                </Typography>
                <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {getCurrentMoveOptions().map((moveOption, index) => (
                    <ListItemButton
                      key={index}
                      onClick={() => {
                        const newGame = new Chess(game.fen());
                        try {
                          newGame.move(moveOption.move);
                          setGame(newGame);
                          setPosition(newGame.fen());
                          setMoveHistory(prev => [...prev, moveOption.move]);
                          setSelectedSquare(null);
                          setPossibleMoves([]);
                        } catch (error) {
                          console.error('Invalid move:', error);
                        }
                      }}
                      sx={{ mb: 1 }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body1" fontFamily="monospace" fontWeight="bold">
                              {moveOption.move}
                            </Typography>
                            <Box display="flex" gap={1} alignItems="center">
                              <Chip 
                                label={`${moveOption.frequency.toFixed(0)}%`}
                                size="small"
                                variant="outlined"
                              />
                              <Chip 
                                label={`${moveOption.winRate.toFixed(1)}%`}
                                size="small"
                                color={getWinRateColor(moveOption.winRate) as any}
                              />
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {moveOption.winRate > 50 ? 'Winning for the side to move' : 'Equal or slightly better for opponent'}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Opening Tree
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Explore all variations of the {opening.name}
                </Alert>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {moveTree.map((moveNode, index) => (
                    <Box key={index} sx={{ ml: 2, mb: 1 }}>
                      <Typography variant="body2" fontFamily="monospace">
                        <strong>{index + 1}.</strong> {moveNode.san}
                        <Chip 
                          label={`${moveNode.winRate.toFixed(1)}%`}
                          size="small"
                          color={getWinRateColor(moveNode.winRate) as any}
                          sx={{ ml: 1 }}
                        />
                      </Typography>
                      {moveNode.children.map((child, childIndex) => (
                        <Typography key={childIndex} variant="body2" fontFamily="monospace" sx={{ ml: 3 }}>
                          {childIndex + 1}... {child.san}
                          <Chip 
                            label={`${child.winRate.toFixed(1)}%`}
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Opening Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {opening.popularity}%
                        </Typography>
                        <Typography variant="body2">
                          Popularity
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="success.main">
                          {opening.difficulty}
                        </Typography>
                        <Typography variant="body2">
                          Difficulty
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Key Ideas
                        </Typography>
                        <List dense>
                          {opening.keyIdeas.map((idea: string, index: number) => (
                            <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                              • {idea}
                            </Typography>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}