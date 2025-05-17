# Advanced League of Legends DFS Analysis

## Executive Summary

### Lineup Rankings by ROI

| Rank | Lineup | ROI | First Place % | Min Cash % |
|------|--------|-----|--------------|------------|
| 1 | Lineup 2 | 3.41x | 0.15% | 66.80% |
| 2 | Lineup 1 | 0.08x | 0.00% | 3.70% |

### Portfolio Overview

- **Portfolio Diversity Score:** 7.14/10
- **Average ROI Multiple:** 1.75x

## Detailed Lineup Analysis

### Lineup 1: Imported Lineup 1

#### Lineup Composition

- **CPT:** Faker (MID - T1)
- **TOP:** Zeus (T1)
- **JNG:** Oner (T1)
- **ADC:** Gumayusi (T1)
- **SUP:** Keria (T1)
- **MID:** Caps (G2)
- **TEAM:** G2 (G2)

#### Performance Metrics

- **ROI Multiple:** 0.08x
- **First Place %:** 0.00%
- **Top 5 %:** 0.00%
- **Min Cash %:** 3.70%
- **Average Payout:** $0.39

#### Risk Profile

- **Sharpe Ratio:** -2.21
- **Sortino Ratio:** -0.94
- **Downside Risk:** 4.91

#### Score Distribution

- **Median Score:** 83.66
- **10th Percentile:** 60.17
- **90th Percentile:** 107.78
- **Skewness:** 0.02 (Positive)
- **Ceiling Game Frequency:** 2.05%

#### Tournament Leverage

- **Average Ownership:** 0.00%
- **Average Leverage:** 0.00x
- **Net Leverage Score:** 0.00
- **Uniqueness Score:** 9.50/10
- **Value-to-Ownership Ratio:** 0.00

---

### Lineup 2: Imported Lineup 2

#### Lineup Composition

- **CPT:** Caps (MID - G2)
- **TOP:** BrokenBlade (G2)
- **JNG:** Yike (G2)
- **ADC:** Hans Sama (G2)
- **SUP:** Mikyx (G2)
- **MID:** Faker (T1)
- **TEAM:** T1 (T1)

#### Performance Metrics

- **ROI Multiple:** 3.41x
- **First Place %:** 0.15%
- **Top 5 %:** 1.30%
- **Min Cash %:** 66.80%
- **Average Payout:** $17.07

#### Risk Profile

- **Sharpe Ratio:** 0.25
- **Sortino Ratio:** 4.19
- **Downside Risk:** 2.88

#### Score Distribution

- **Median Score:** 83.80
- **10th Percentile:** 60.33
- **90th Percentile:** 108.91
- **Skewness:** 0.04 (Positive)
- **Ceiling Game Frequency:** 2.35%

#### Tournament Leverage

- **Average Ownership:** 0.00%
- **Average Leverage:** 0.00x
- **Net Leverage Score:** 0.00
- **Uniqueness Score:** 9.50/10
- **Value-to-Ownership Ratio:** 0.00

---

## Portfolio Analysis

### Team Exposure

| Team | Exposure % |
|------|------------|
| G2 | 50.00% |
| T1 | 50.00% |

### Game Exposure

| Matchup | Exposure % | Both Sides |
|---------|------------|------------|
| - | No game exposure data | - |

### Position Exposure

| Position | Exposure % |
|----------|------------|
| MID | 28.57% |
| TOP | 14.29% |
| JNG | 14.29% |
| ADC | 14.29% |
| SUP | 14.29% |
| TEAM | 14.29% |

## Tournament Strategy Recommendations

### Single Entry Contests

Use **Lineup 2** for best overall ROI.

### 3-Max Contests

Use these lineups in order of priority:

1. Lineup 2
2. Lineup 1

### 10-Max and Larger Contests

Allocate entries according to this distribution:

| Lineup | Allocation % |
|--------|-------------|
| Lineup 2 | 98% |
| Lineup 1 | 2% |

### Specialized Contest Strategy

- **For Top-Heavy Contests:** Focus on Lineup 2 (highest first place equity)
- **For Cash Games:** Focus on Lineup 2 (highest min-cash rate)

## Appendix: Statistical Methodology

### Simulation Parameters

- **Iterations:** 2,000
- **Field Size:** 1,176 entries
- **Statistical Model:** Bayesian projections with enhanced correlation modeling
- **Game Script Modeling:** Full Bo3 simulation with momentum effects
- **Correlation Method:** Position-specific Gaussian Copula functions
- **Distribution Model:** Skewed logistic with fat tails for proper ceiling modeling

### Advanced Metrics Explained

- **Sharpe Ratio:** Risk-adjusted return metric (higher = better risk-adjusted ROI)
- **Sortino Ratio:** Similar to Sharpe but only considers downside risk
- **Skewness:** Measures asymmetry of score distribution (positive = more ceiling games)
- **Uniqueness Score:** How different a lineup is from the expected field (higher = more unique)
- **Value-to-Ownership Ratio:** Projected points relative to ownership (higher = better value)
