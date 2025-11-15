// src/components/TestFirestoreSetup.tsx
import React, { useEffect, useState } from 'react';
import { firestoreService } from '../services/firestoreService';
import { logAnalyticsEvent } from '../lib/firebaseAnalytics';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Alert, 
  CircularProgress, 
  Card, 
  CardContent,
  Grid,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
  duration?: number;
}

export default function TestFirestoreSetup() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'pending' | 'running' | 'success' | 'error'>('pending');
  const [isTesting, setIsTesting] = useState(false);

  const tests = [
    {
      name: 'Firestore Connection',
      fn: () => firestoreService.testConnection()
    },
    {
      name: 'Get Popular Openings',
      fn: () => firestoreService.getPopularOpenings(3)
    },
    {
      name: 'Search Openings',
      fn: () => firestoreService.searchOpenings('Sicilian', 2)
    },
    {
      name: 'Get Openings by Difficulty',
      fn: () => firestoreService.getOpeningsByDifficulty('beginner', 2)
    },
    {
      name: 'Get Single Opening',
      fn: async () => {
        const openings = await firestoreService.getPopularOpenings(1);
        if (openings.length > 0) {
          return firestoreService.getOpening(openings[0].id);
        }
        throw new Error('No openings available to test');
      }
    },
    {
      name: 'Save Practice Session',
      fn: () => firestoreService.savePracticeSession({
        openingId: 'test-opening-' + Date.now(),
        score: 85,
        variation: 'Main Line',
        mode: 'practice',
        moves: 'e4 e5 Nf3 Nc6'
      })
    },
    {
      name: 'Get User Progress',
      fn: () => firestoreService.getAllUserProgress(5)
    },
    {
      name: 'Get Practice Statistics',
      fn: () => firestoreService.getPracticeStatistics()
    }
  ];

  const runAllTests = async () => {
    setIsTesting(true);
    setOverallStatus('running');
    setTestResults(tests.map(test => ({ name: test.name, status: 'pending' })));

    const results: TestResult[] = [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      
      // Update current test to running
      const runningResults = [...results, { name: test.name, status: 'running' }];
      setTestResults(runningResults);

      const startTime = Date.now();
      
      try {
        const data = await test.fn();
        const duration = Date.now() - startTime;
        
        results.push({
          name: test.name,
          status: 'success',
          message: `Completed in ${duration}ms`,
          data,
          duration
        });
        
        // Log analytics event for successful test
        await logAnalyticsEvent('firestore_test_success', {
          test_name: test.name,
          duration
        });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          name: test.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration
        });
        
        // Log analytics event for failed test
        await logAnalyticsEvent('firestore_test_error', {
          test_name: test.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      setTestResults([...results]);
    }

    // Determine overall status
    const hasErrors = results.some(result => result.status === 'error');
    setOverallStatus(hasErrors ? 'error' : 'success');
    setIsTesting(false);

    // Log overall test completion
    await logAnalyticsEvent('firestore_test_suite_complete', {
      total_tests: tests.length,
      passed_tests: results.filter(r => r.status === 'success').length,
      failed_tests: results.filter(r => r.status === 'error').length
    });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <Warning color="warning" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'running': return 'info';
      default: return 'warning';
    }
  };

  useEffect(() => {
    // Run tests automatically when component mounts
    runAllTests();
  }, []);

  return (
    <Paper sx={{ p: 3, maxWidth: 1000, mx: 'auto', mt: 3 }}>
      <Typography variant="h4" gutterBottom>
        🧪 Firestore Setup Test Suite
      </Typography>

      <Alert 
        severity={overallStatus === 'success' ? 'success' : overallStatus === 'error' ? 'error' : 'info'}
        sx={{ mb: 3 }}
      >
        <Typography variant="h6">
          Overall Status: {overallStatus.toUpperCase()}
        </Typography>
        {overallStatus === 'running' && 'Running tests...'}
        {overallStatus === 'success' && 'All tests passed! 🎉'}
        {overallStatus === 'error' && 'Some tests failed. Check details below.'}
      </Alert>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {tests.length}
              </Typography>
              <Typography variant="body2">
                Total Tests
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {testResults.filter(r => r.status === 'success').length}
              </Typography>
              <Typography variant="body2">
                Passed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {testResults.filter(r => r.status === 'error').length}
              </Typography>
              <Typography variant="body2">
                Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {testResults.filter(r => r.status === 'running').length}
              </Typography>
              <Typography variant="body2">
                Running
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Button 
        variant="contained" 
        onClick={runAllTests} 
        disabled={isTesting}
        sx={{ mb: 3 }}
        startIcon={isTesting ? <CircularProgress size={20} /> : null}
      >
        {isTesting ? 'Running Tests...' : 'Run Tests Again'}
      </Button>

      <List>
        {testResults.map((result, index) => (
          <React.Fragment key={result.name}>
            <ListItem>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Box sx={{ mr: 2 }}>
                  {getStatusIcon(result.status)}
                </Box>
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1" fontWeight="medium">
                        {result.name}
                      </Typography>
                      <Chip 
                        label={result.status.toUpperCase()} 
                        color={getStatusColor(result.status) as any}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      {result.message && (
                        <Typography variant="body2" color="text.secondary">
                          {result.message}
                        </Typography>
                      )}
                      {result.duration && (
                        <Typography variant="caption" color="text.secondary">
                          Duration: {result.duration}ms
                        </Typography>
                      )}
                      {result.data && (
                        <Typography 
                          variant="caption" 
                          component="div" 
                          sx={{ 
                            mt: 1, 
                            display: 'block',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            bgcolor: 'grey.50',
                            p: 1,
                            borderRadius: 1,
                            overflow: 'auto',
                            maxHeight: 100
                          }}
                        >
                          {JSON.stringify(result.data, null, 2)}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </Box>
            </ListItem>
            {index < testResults.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>

      {testResults.length === 0 && (
        <Alert severity="info">
          No test results yet. Tests are running automatically...
        </Alert>
      )}

      {overallStatus === 'success' && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="h6">🎉 All Systems Go!</Typography>
          <Typography variant="body2">
            Your Firestore setup is working perfectly. You can now:
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            <li><Typography variant="body2">Practice openings with progress tracking</Typography></li>
            <li><Typography variant="body2">View your statistics and mastery progress</Typography></li>
            <li><Typography variant="body2">Search and filter openings efficiently</Typography></li>
            <li><Typography variant="body2">Use analytics to track user behavior</Typography></li>
          </Box>
        </Alert>
      )}

      {overallStatus === 'error' && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="h6">⚠️ Setup Issues Detected</Typography>
          <Typography variant="body2">
            Some tests failed. Common issues:
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            <li><Typography variant="body2">Firestore indexes not fully deployed</Typography></li>
            <li><Typography variant="body2">Missing environment variables</Typography></li>
            <li><Typography variant="body2">Firestore rules blocking access</Typography></li>
            <li><Typography variant="body2">No openings data in Firestore</Typography></li>
          </Box>
          <Button 
            variant="outlined" 
            color="error" 
            sx={{ mt: 1 }}
            onClick={() => window.open('https://console.firebase.google.com/', '_blank')}
          >
            Check Firebase Console
          </Button>
        </Alert>
      )}
    </Paper>
  );
}