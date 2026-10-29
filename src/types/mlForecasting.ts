import { CalamityType } from './disaster';

export type ForecastHorizon = '24h' | '72h' | '7d' | '30d';

export type MLModelAlgorithm = 
  | 'SpatioTemporal_KDE' 
  | 'RandomForest_Ensemble' 
  | 'GradientBoosted_Propensity' 
  | 'Poisson_Point_Process';

export type ProbabilityTier = 'VERY_HIGH' | 'HIGH' | 'ELEVATED' | 'MODERATE';

export interface PredictiveFactor {
  factor: string;
  weight: number; // percentage contribution e.g. 34%
  description: string;
  category: 'geophysical' | 'meteorological' | 'historical_recurrence' | 'satellite_anomaly' | 'cascading_risk';
}

export interface PredictiveHotspot {
  id: string;
  name: string;
  region: string;
  country: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  hazardType: CalamityType;
  probability: number; // 0 to 100 (%)
  probabilityTier: ProbabilityTier;
  confidenceInterval: {
    low: number; // e.g. 84%
    high: number; // e.g. 96%
  };
  horizon: ForecastHorizon;
  estimatedImpactRadiusKm: number;
  populationAtRisk: number;
  historicalPrecedentsCount: number;
  lastHistoricalOccurrence: string;
  meanRecurrenceYears: number;
  dominantModel: MLModelAlgorithm;
  predictiveFactors: PredictiveFactor[];
  recommendedPreemptiveAction: string;
  geomorphicSetting: string;
  satellitePrecursorSignal?: string;
  clusterIntensityIndex: number; // 1-10
}

export interface MLModelEvaluationMetrics {
  algorithm: string;
  aucRoc: number; // e.g. 0.934
  f1Score: number; // e.g. 0.887
  brierScore: number; // e.g. 0.082
  precision: number; // e.g. 89.4%
  recall: number; // e.g. 87.9%
  trainingHistoricalEventsCount: number;
  crossValidationFolds: number;
  lastTrainedTimestamp: string;
  spatialResolutionKm: number;
}

export interface ForecastSummary {
  totalHotspots: number;
  veryHighCount: number;
  highCount: number;
  elevatedCount: number;
  moderateCount: number;
  totalPopulationAtRisk: number;
  topHazardType: CalamityType;
  averageProbability: number;
}
